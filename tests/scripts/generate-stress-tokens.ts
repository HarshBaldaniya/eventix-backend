// JWT Generator: Pre-signs 50,000 tokens for massive scale authentication testing
import 'dotenv/config';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve } from 'path';
import { config as loadEnv } from 'dotenv';
import { loadAndValidateConfig } from '../../src/infrastructure/config/config.loader';

loadEnv({ path: '.env.dev' });
const config = loadAndValidateConfig();

const TOKEN_COUNT = 50000;
const OUTPUT_DIR = resolve(process.cwd(), 'tests/stress/cache');
const OUTPUT_FILE = resolve(OUTPUT_DIR, 'stress-tokens.json');

async function generateTokens() {
    console.log(`🔑 Generating ${TOKEN_COUNT} JWT tokens for stress testing...`);

    const pool = new Pool({
        host: config.DB_HOST,
        port: config.DB_PORT,
        database: config.DB_NAME,
        user: config.DB_USER,
        password: config.DB_PASSWORD,
    });

    try {
        const startTime = Date.now();
        console.log(`--- Step 1: Fetching users from DB ---`);
        const userResult = await pool.query(
            'SELECT id, email, role FROM users WHERE email LIKE $1 LIMIT $2',
            ['stress-user-%@test.local', TOKEN_COUNT]
        );
        const users = userResult.rows;

        if (users.length < TOKEN_COUNT) {
            console.error(`❌ Only found ${users.length} stress users. Please run 'npm run db:seed-stress' first.`);
            return;
        }
        console.log(`Fetched ${users.length} users successfully.`);

        console.log(`--- Step 2: Signing JWT tokens ---`);
        const tokens: string[] = [];
        for (let i = 0; i < users.length; i++) {
            const user = users[i];
            const token = jwt.sign(
                { sub: user.id.toString(), email: user.email, role: user.role, type: 'access' },
                config.JWT_SECRET,
                { expiresIn: config.JWT_ACCESS_EXPIRY } as any
            );
            tokens.push(token);
            if (i % 10000 === 0 && i > 0) console.log(`...signed ${i} tokens...`);
        }

        console.log(`--- Step 3: Saving to cache file ---`);
        if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });
        writeFileSync(OUTPUT_FILE, JSON.stringify(tokens));

        const duration = Date.now() - startTime;
        console.log(`✅ Generated ${tokens.length} tokens in ${duration}ms.`);
    } catch (err) {
        console.error('❌ Token generation failed:', err);
    } finally {
        await pool.end();
    }
}

generateTokens();
