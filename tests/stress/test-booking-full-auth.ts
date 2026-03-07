import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config';
import { loadAndValidateConfig } from '../../src/infrastructure/config/config.loader';
import { config as loadEnv } from 'dotenv';

// Initialize env and config
loadEnv({ path: '.env.dev' });
loadAndValidateConfig();

import { getPostgresPool } from '../../src/infrastructure/database/postgres.client';
import { EVENT_QUERIES } from '../../src/infrastructure/database/queries/event.queries';
import { getTestAgent } from '../helpers/test-app';
import { authHeader } from '../helpers/auth-helper';
import { getRedisClient, getEventSpotsKey } from '../../src/infrastructure/database/redis.client';
import { saveCustomResult } from '../helpers/custom-reporter';

const CONCURRENCY_COUNT = 50;
const TOTAL_SPOTS = 5;
const TEST_PASSWORD = 'Password123';

async function runTest() {
    console.log(`🚀 Starting Full-Auth Concurrency Test (${CONCURRENCY_COUNT} users vs ${TOTAL_SPOTS} spots)...`);
    const pool = await getPostgresPool();
    const agent = getTestAgent();
    const startTime = Date.now();

    try {
        // 1. Setup: Create Test Event
        console.log(`--- Step 1: Setting up fresh event (${TOTAL_SPOTS} spots) ---`);
        const eventName = `Full Auth Test ${Date.now()}`;
        const eventResult = await pool.query(EVENT_QUERIES.INSERT, [eventName, 'Testing with full JWT auth', TOTAL_SPOTS, 'published']);
        const eventId = eventResult.rows[0].id;
        console.log(`Event created with ID: ${eventId}`);

        // 2. Prepare Authenticated Users (Real JWT)
        console.log(`--- Step 2: Preparing ${CONCURRENCY_COUNT} authenticated users (Real JWT) ---`);
        const userIds: number[] = [];
        const tokens: string[] = [];

        for (let i = 0; i < CONCURRENCY_COUNT; i++) {
            const email = `full-auth-user-${i}-${Date.now()}@test.local`;
            const regRes = await agent.post('/api/v1/auth/register').send({
                email,
                password: TEST_PASSWORD,
                name: `Full Auth User ${i}`
            });
            if (regRes.status !== 201) throw new Error(`Failed to register user ${i}`);
            userIds.push(regRes.body.data.user.id);
            tokens.push(regRes.body.data.access_token);
            process.stdout.write('.');
        }
        console.log('\nUsers registered and authenticated.');

        // 3. Execution: Burst API calls
        console.log(`--- Step 3: Triggering ${CONCURRENCY_COUNT} simultaneous API bookings ---`);
        const burstPromises = tokens.map((token, index) => {
            return agent
                .post(`/api/v1/events/${eventId}/bookings`)
                .set(authHeader(token))
                .send({ ticket_count: 1 })
                .timeout({ response: 15000, deadline: 20000 })
                .then(res => ({
                    userIndex: index,
                    status: res.status,
                    body: res.body,
                    success: res.status === 201
                }))
                .catch(err => ({
                    userIndex: index,
                    status: err.status || 0,
                    body: { error: err.message },
                    success: false
                }));
        });

        const responses = await Promise.all(burstPromises);
        const duration = Date.now() - startTime;

        // 4. Summarize Results
        const successCount = responses.filter(r => r.success).length;
        const conflictCount = responses.filter(r => r.status === 409).length;
        const otherFailures = responses.length - successCount - conflictCount;

        console.log(`--- Results ---`);
        console.log(`Duration: ${duration}ms`);
        console.log(`Total Requests: ${CONCURRENCY_COUNT}`);
        console.log(`Success (201): ${successCount} (Expected: ${TOTAL_SPOTS})`);
        console.log(`Conflict (409): ${conflictCount} (Expected: ${CONCURRENCY_COUNT - TOTAL_SPOTS})`);
        if (otherFailures > 0) console.log(`Other Errors: ${otherFailures}`);

        // 5. Final DB Verification
        const finalEvent = await pool.query('SELECT booked_count FROM events WHERE id = $1', [eventId]);
        const finalBookings = await pool.query('SELECT COUNT(*) FROM bookings WHERE event_id = $1 AND status = \'confirmed\'', [eventId]);

        console.log(`--- DB State ---`);
        console.log(`Booked Count: ${finalEvent.rows[0].booked_count}`);
        console.log(`Actual Booking Rows: ${finalBookings.rows[0].count}`);

        // 6. Cleanup
        await pool.query('DELETE FROM bookings WHERE event_id = $1', [eventId]);
        await pool.query('DELETE FROM events WHERE id = $1', [eventId]);
        await pool.query('DELETE FROM users WHERE id = ANY($1)', [userIds]);
        const redis = getRedisClient();
        await redis.del(getEventSpotsKey(eventId));
        await redis.quit();

        console.log('Cleanup complete.');
        if (successCount === TOTAL_SPOTS) console.log('✅ TEST PASSED');

        saveCustomResult({
            testName: 'Full-Auth Stress Test',
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
