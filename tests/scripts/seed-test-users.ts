import 'dotenv/config';
import { Pool } from 'pg';
import { config as loadEnv } from 'dotenv';
import { loadAndValidateConfig } from '../../src/infrastructure/config/config.loader';

// Initialize env and config
loadEnv({ path: '.env.dev' });
loadAndValidateConfig();

const SEED_COUNT = 50000;
const BATCH_SIZE = 1000; // Batching to avoid PG parameter limits (max 65535)

async function seedUserBatch() {
    console.log(`🌱 Seeding ${SEED_COUNT} test users for stress testing (Batch size: ${BATCH_SIZE})...`);

    const config = loadAndValidateConfig();
    const pool = new Pool({
        host: config.DB_HOST,
        port: config.DB_PORT,
        database: config.DB_NAME,
        user: config.DB_USER,
        password: config.DB_PASSWORD,
    });

    try {
        const startTime = Date.now();
        let totalInserted = 0;

        for (let batchStart = 0; batchStart < SEED_COUNT; batchStart += BATCH_SIZE) {
            const currentBatchCount = Math.min(BATCH_SIZE, SEED_COUNT - batchStart);
            const values: any[] = [];
            let query = 'INSERT INTO users (email, password_hash, name, role) VALUES ';

            for (let i = 0; i < currentBatchCount; i++) {
                const userIdx = batchStart + i;
                const email = `stress-user-${userIdx}@test.local`;
                const name = `Stress User ${userIdx}`;
                const placeholderHash = 'bypass-auth-hash';

                values.push(email, placeholderHash, name, 'user');

                const base = i * 4;
                query += `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})${i === currentBatchCount - 1 ? '' : ','}`;
            }

            query += ' ON CONFLICT (email) DO NOTHING RETURNING id';

            const result = await pool.query(query, values);
            totalInserted += result.rowCount || 0;

            if (batchStart % 5000 === 0 && batchStart > 0) {
                console.log(`...processed ${batchStart} users...`);
            }
        }

        const duration = Date.now() - startTime;
        console.log(`✅ Seeded ${SEED_COUNT} users in ${duration}ms (Total new users inserted: ${totalInserted}).`);

    } catch (err) {
        console.error('❌ Seeding failed:', err);
    } finally {
        await pool.end();
    }
}

seedUserBatch();
