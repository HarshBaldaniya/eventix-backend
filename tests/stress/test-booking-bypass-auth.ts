// Bypass-Auth Stress Test: 50,000 users with bypass authentication header
import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config';
import { loadAndValidateConfig } from '../../src/infrastructure/config/config.loader';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env.dev' });
loadAndValidateConfig();

import { getPostgresPool } from '../../src/infrastructure/database/postgres.client';
import { EVENT_QUERIES } from '../../src/infrastructure/database/queries/event.queries';
import { getTestAgent } from '../helpers/test-app';
import { getRedisClient, getEventSpotsKey } from '../../src/infrastructure/database/redis.client';
import { saveCustomResult } from '../helpers/custom-reporter';

const CONCURRENCY_COUNT = 50000;
const TOTAL_SPOTS = 5;
const MAX_SIMULTANEOUS_CONNECTIONS = 500;

async function runTest() {
    console.log(`🚀 Starting Bypass-Auth Stress Test (${CONCURRENCY_COUNT} users vs ${TOTAL_SPOTS} spots)...`);
    const pool = await getPostgresPool();
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
        console.log(`Fetched ${userIds.length} users successfully.`);

        console.log(`--- Step 3: Triggering ${CONCURRENCY_COUNT} API bookings (Batched: ${MAX_SIMULTANEOUS_CONNECTIONS}) ---`);
        const results: { success: boolean, status: number }[] = [];
        for (let i = 0; i < userIds.length; i += MAX_SIMULTANEOUS_CONNECTIONS) {
            const batch = userIds.slice(i, i + MAX_SIMULTANEOUS_CONNECTIONS);
            const batchPromises = batch.map(userId => {
                return agent.post(`/api/v1/events/${eventId}/bookings`)
                    .set('x-test-user-id', userId.toString())
                    .send({ ticket_count: 1 })
                    .timeout({ response: 60000, deadline: 90000 })
                    .then(res => ({ success: res.status === 201, status: res.status }))
                    .catch(err => ({ success: false, status: err.status || 0 }));
            });
            results.push(...(await Promise.all(batchPromises)));
            if (i % 10000 === 0 && i > 0) console.log(`...sent ${i} requests...`);
        }

        const duration = Date.now() - startTime;
        const successCount = results.filter(r => r.success).length;
        const conflictCount = results.filter(r => (r as any).status === 409).length;
        const otherFailures = results.length - successCount - conflictCount;

        const finalEvent = await pool.query('SELECT booked_count FROM events WHERE id = $1', [eventId]);

        console.log(`--- Results ---`);
        console.log(`Duration: ${duration}ms`);
        console.log(`Success (201): ${successCount} (Expected: ${TOTAL_SPOTS})`);
        console.log(`Conflict (409): ${conflictCount}`);

        await pool.query('DELETE FROM bookings WHERE event_id = $1', [eventId]);
        await pool.query('DELETE FROM events WHERE id = $1', [eventId]);
        const redis = getRedisClient();
        await redis.del(getEventSpotsKey(eventId));
        await redis.quit();

        console.log('Cleanup complete.');
        if (successCount === TOTAL_SPOTS) console.log('✅ TEST PASSED');

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
