// Bypass-Auth Stress Test: 50,000 users with bypass authentication header
import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env.dev' });
process.env.NODE_ENV = 'test';  // Force test env so rate limit is skipped
process.env.DB_POOL_MAX = '50'; // Higher pool for stress test
import { loadAndValidateConfig } from '../../src/infrastructure/config/config.loader';

loadAndValidateConfig();

import { getPostgresPool } from '../../src/infrastructure/database/postgres.client';
import { EVENT_QUERIES } from '../../src/infrastructure/database/queries/event.queries';
import { getRedisClient, getEventSpotsKey } from '../../src/infrastructure/database/redis.client';
import { saveCustomResult } from '../helpers/custom-reporter';

const CONCURRENCY_COUNT = 50000;
const TOTAL_SPOTS = 5;
const MAX_SIMULTANEOUS_CONNECTIONS = 100;  // Reduced to avoid DB pool exhaustion

function formatErrorStatus(status: number, code?: string): string {
    if (status === 0 && code === 'ECONNABORTED') return 'timeout';
    if (status === 0) return 'unknown';
    return `HTTP ${status}`;
}

async function runTest() {
    console.log(`\n🚀 Bypass-Auth Stress Test`);
    console.log(`   Config: ${CONCURRENCY_COUNT} users competing for ${TOTAL_SPOTS} spots (batch size: ${MAX_SIMULTANEOUS_CONNECTIONS})\n`);
    const pool = await getPostgresPool();
    const { getTestAgent } = await import('../helpers/test-app');
    const agent = getTestAgent();
    const startTime = Date.now();

    try {
        console.log(`--- Step 1: Setting up fresh event (${TOTAL_SPOTS} spots) ---`);
        const eventName = `Bypass Test ${Date.now()}`;
        const eventResult = await pool.query(EVENT_QUERIES.INSERT, [eventName, 'Stress', TOTAL_SPOTS, 'published']);
        const eventId = eventResult.rows[0].id;
        console.log(`Event created with ID: ${eventId}`);

        console.log(`--- Step 2: Fetching ${CONCURRENCY_COUNT} pre-seeded users ---`);
        const userResult = await pool.query('SELECT id FROM users WHERE email LIKE $1 LIMIT $2', ['stress-user-%@test.local', CONCURRENCY_COUNT]);
        const userIds = userResult.rows.map(r => r.id);
        console.log(`   Fetched ${userIds.length} users (x-test-user-id bypass)\n`);

        console.log(`--- Step 3: Triggering ${CONCURRENCY_COUNT} API bookings (Batched: ${MAX_SIMULTANEOUS_CONNECTIONS}) ---`);
        console.log(`   Each batch: ${MAX_SIMULTANEOUS_CONNECTIONS} concurrent POST /api/v1/events/:id/bookings\n`);
        const results: { success: boolean, status: number; code?: string }[] = [];
        const errorSamples: { batch: number; code: string; status: number }[] = [];
        for (let i = 0; i < userIds.length; i += MAX_SIMULTANEOUS_CONNECTIONS) {
            const batchNum = Math.floor(i / MAX_SIMULTANEOUS_CONNECTIONS) + 1;
            const batchStart = Date.now();
            const batch = userIds.slice(i, i + MAX_SIMULTANEOUS_CONNECTIONS);
            const batchPromises = batch.map(userId =>
                agent.post(`/api/v1/events/${eventId}/bookings`)
                    .set('x-test-user-id', userId.toString())
                    .send({ ticket_count: 1 })
                    .timeout({ response: 30000, deadline: 45000 })
                    .then(res => ({ success: res.status === 201, status: res.status }))
                    .catch((err: unknown) => {
                        const e = err as { status?: number; response?: { status: number }; code?: string };
                        const status = e?.response?.status ?? e?.status ?? 0;
                        const code = e?.code ?? '';
                        if (status !== 409 && status !== 429 && errorSamples.length < 3) {
                            errorSamples.push({ batch: batchNum, code: code || 'unknown', status });
                        }
                        return { success: false, status, code };
                    })
            );
            results.push(...(await Promise.all(batchPromises)));
            const batchMs = Date.now() - batchStart;

            const sentSoFar = Math.min(i + MAX_SIMULTANEOUS_CONNECTIONS, userIds.length);
            if (sentSoFar % 5000 === 0 || sentSoFar >= userIds.length) {
                const elapsed = (Date.now() - startTime) / 1000;
                const rate = elapsed > 0 ? (sentSoFar / elapsed).toFixed(0) : '0';
                console.log(`   [${sentSoFar}/${userIds.length}] ${batchMs}ms for last batch | ~${rate} req/s elapsed`);
            }
        }

        const duration = Date.now() - startTime;
        const successCount = results.filter(r => r.success).length;
        const conflictCount = results.filter(r => r.status === 409).length;
        const otherFailures = results.length - successCount - conflictCount;

        const finalEvent = await pool.query('SELECT booked_count FROM events WHERE id = $1', [eventId]);

        console.log(`\n--- Results ---`);
        console.log(`   Duration: ${(duration / 1000).toFixed(2)}s`);
        console.log(`   Throughput: ${(results.length / (duration / 1000)).toFixed(0)} req/s`);
        console.log(`   Success (201): ${successCount} (expected: ${TOTAL_SPOTS})`);
        console.log(`   Conflict (409): ${conflictCount} (no spots left)`);
        if (otherFailures > 0) {
            const byType = results.filter(r => !r.success && r.status !== 409).reduce((acc, r) => {
                const key = formatErrorStatus(r.status, r.code);
                acc[key] = (acc[key] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);
            const parts = Object.entries(byType).map(([k, v]) => `${k}: ${v}`).join(', ');
            console.log(`   Other Errors: ${otherFailures} (${parts})`);
            if (errorSamples.length > 0) {
                console.log(`   Sample: ${errorSamples.map(s => `batch ${s.batch} ${s.code}`).join('; ')}`);
            }
        }

        await pool.query('DELETE FROM bookings WHERE event_id = $1', [eventId]);
        await pool.query('DELETE FROM events WHERE id = $1', [eventId]);
        const redis = getRedisClient();
        await redis.del(getEventSpotsKey(eventId));
        await redis.quit();

        console.log(`\n   Cleanup: events, bookings, Redis key removed.`);
        if (successCount === TOTAL_SPOTS) {
            console.log(`\n✅ TEST PASSED - Exactly ${TOTAL_SPOTS} bookings, no overbooking.\n`);
        } else {
            console.log(`\n❌ TEST FAILED - Expected ${TOTAL_SPOTS} successes, got ${successCount}.\n`);
        }

        saveCustomResult({
            testName: 'Extreme Bypass Stress Test',
            status: successCount === TOTAL_SPOTS ? 'passed' : 'failed',
            durationMs: duration,
            timestamp: new Date().toISOString(),
            metrics: {
                concurrency: CONCURRENCY_COUNT,
                totalSpots: TOTAL_SPOTS,
                success: successCount,
                expectedConflicts: conflictCount,
                otherErrors: otherFailures,
                dbBookedCount: finalEvent.rows[0].booked_count
            }
        });

    } catch (err) {
        console.error('Fatal error during test:', err);
    } finally {
        await pool.end();
    }
}

runTest();
