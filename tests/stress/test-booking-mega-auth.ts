// Mega-Auth Stress Test: 50,000 users with full JWT authentication
import * as fs from 'fs';
import * as path from 'path';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env.dev' });
process.env.NODE_ENV = 'test';  // Force test env so rate limit is skipped
process.env.DB_POOL_MAX = '50'; // Higher pool for stress test (default 10 is too low for 100 concurrent)
import { loadAndValidateConfig } from '../../src/infrastructure/config/config.loader';

loadAndValidateConfig();

import { getPostgresPool } from '../../src/infrastructure/database/postgres.client';
import { EVENT_QUERIES } from '../../src/infrastructure/database/queries/event.queries';
import { getRedisClient, getEventSpotsKey } from '../../src/infrastructure/database/redis.client';
import { saveCustomResult } from '../helpers/custom-reporter';

const CONCURRENCY_COUNT = 50000;
const TOTAL_SPOTS = 5;
const MAX_SIMULTANEOUS_CONNECTIONS = 100;  // Reduced from 500 to avoid DB pool exhaustion
const TOKEN_FILE = path.resolve(process.cwd(), 'tests/stress/cache/stress-tokens.json');

function formatErrorStatus(status: number, code?: string): string {
    if (status === 0 && code === 'ECONNABORTED') return 'timeout';
    if (status === 0) return 'unknown';
    return `HTTP ${status}`;
}

async function runTest() {
    console.log(`\n🚀 Mega-Auth Stress Test`);
    console.log(`   Config: ${CONCURRENCY_COUNT} users (JWT) competing for ${TOTAL_SPOTS} spots (batch: ${MAX_SIMULTANEOUS_CONNECTIONS})\n`);

    if (!fs.existsSync(TOKEN_FILE)) {
        console.error(`❌ Token cache not found. Please run 'npm run test:tokens' first.`);
        process.exit(1);
    }

    const tokens: string[] = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf-8'));
    if (tokens.length < CONCURRENCY_COUNT) throw new Error('Insufficient tokens');

    const pool = await getPostgresPool();
    const { getTestAgent } = await import('../helpers/test-app');
    const agent = getTestAgent();
    const startTime = Date.now();

    try {
        console.log(`--- Step 1: Setting up fresh event (${TOTAL_SPOTS} spots) ---`);
        const eventName = `Mega Auth ${Date.now()}`;
        const eventResult = await pool.query(EVENT_QUERIES.INSERT, [eventName, 'Stress', TOTAL_SPOTS, 'published']);
        const eventId = eventResult.rows[0].id;
        console.log(`   Event created with ID: ${eventId}\n`);

        console.log(`--- Step 2: Triggering ${CONCURRENCY_COUNT} AUTHENTICATED API bookings (Batched: ${MAX_SIMULTANEOUS_CONNECTIONS}) ---`);
        console.log(`   Each batch: ${MAX_SIMULTANEOUS_CONNECTIONS} concurrent POST with Bearer token\n`);
        const results: { success: boolean, status: number; code?: string }[] = [];
        const errorSamples: { batch: number; code: string }[] = [];

        for (let i = 0; i < CONCURRENCY_COUNT; i += MAX_SIMULTANEOUS_CONNECTIONS) {
            const batchNum = Math.floor(i / MAX_SIMULTANEOUS_CONNECTIONS) + 1;
            const batchStart = Date.now();
            const batchTokens = tokens.slice(i, i + MAX_SIMULTANEOUS_CONNECTIONS);
            const batchPromises = batchTokens.map(token =>
                agent.post(`/api/v1/events/${eventId}/bookings`)
                    .set('Authorization', `Bearer ${token}`)
                    .send({ ticket_count: 1 })
                    .timeout({ response: 30000, deadline: 45000 })
                    .then(res => ({ success: res.status === 201, status: res.status }))
                    .catch((err: unknown) => {
                        const e = err as { status?: number; response?: { status: number }; code?: string };
                        const status = e?.response?.status ?? e?.status ?? 0;
                        const code = e?.code ?? '';
                        if (status !== 409 && status !== 429 && errorSamples.length < 3) {
                            errorSamples.push({ batch: batchNum, code: code || 'unknown' });
                        }
                        return { success: false, status, code };
                    })
            );

            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);
            const batchMs = Date.now() - batchStart;

            const sentSoFar = i + MAX_SIMULTANEOUS_CONNECTIONS;
            if (sentSoFar % 5000 === 0 || sentSoFar === CONCURRENCY_COUNT) {
                const elapsed = (Date.now() - startTime) / 1000;
                const rate = elapsed > 0 ? (sentSoFar / elapsed).toFixed(0) : '0';
                console.log(`   [${sentSoFar}/${CONCURRENCY_COUNT}] ${batchMs}ms for last batch | ~${rate} req/s elapsed`);
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
            testName: 'Mega-Auth Stress Test (50k Scale)',
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
