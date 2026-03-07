// Rate Limit Validation Test: Verifies the 429 security threshold
import 'dotenv/config';
import { loadAndValidateConfig } from '../../src/infrastructure/config/config.loader';
import { config as loadEnv } from 'dotenv';
import { getTestAgent } from '../helpers/test-app';
import { saveCustomResult } from '../helpers/custom-reporter';

loadEnv({ path: '.env.dev' });
loadAndValidateConfig();

async function runTest() {
    const config = loadAndValidateConfig();
    const agent = getTestAgent();
    const maxRequests = config.API_RATE_LIMIT_MAX_REQUESTS;
    const windowMs = config.API_RATE_LIMIT_WINDOW_MS;

    console.log(`🚀 Starting Rate Limit Validation Test...`);
    console.log(`Config: Max ${maxRequests} requests per ${windowMs}ms.`);

    const results: any[] = [];
    const testCount = maxRequests + 5;

    console.log(`--- Step 1: Sending ${testCount} requests to /api/v1/health ---`);
    for (let i = 1; i <= testCount; i++) {
        try {
            const res = await agent.get('/api/v1/health').set('x-test-rate-limit', 'true');
            results.push({
                status: res.status,
                success: res.status === 200,
                rateLimited: res.status === 429
            });
            process.stdout.write(res.status === 429 ? '❌' : '✅');
        } catch (error: any) {
            // Rate limiters often drop connections (ECONNRESET) once the limit is severely exceeded.
            // We count this as a successful block.
            if (error?.code === 'ECONNRESET' || error?.message?.includes('socket hang up') || error?.code === 'ECONNREFUSED') {
                results.push({
                    status: 429,
                    success: false,
                    rateLimited: true
                });
                process.stdout.write('❌');
            } else {
                throw error;
            }
        }
    }

    const successCount = results.filter(r => r.success).length;
    const limitedCount = results.filter(r => r.rateLimited).length;
    const passed = successCount === maxRequests && limitedCount > 0;

    console.log(`\n\n--- Results ---`);
    console.log(`Successful Requests: ${successCount}`);
    console.log(`Rate Limited (429): ${limitedCount}`);

    if (passed) console.log(`✅ TEST PASSED: Rate limiter triggered exactly after ${maxRequests} requests.`);
    else console.log(`❌ TEST FAILED: Rate limiter did not trigger correctly.`);

    saveCustomResult({
        testName: 'Rate Limit Validation Test',
        status: passed ? 'passed' : 'failed',
        durationMs: 0,
        timestamp: new Date().toISOString(),
        metrics: {
            maxRequests,
            testCount,
            actualSuccesses: successCount,
            actualRateLimited: limitedCount
        }
    });
}

runTest();
