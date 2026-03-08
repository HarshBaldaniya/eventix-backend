// Runs seed-down.sql to remove seed data from local DB
import { readFileSync } from 'fs';
import { join } from 'path';
import { config as loadEnv } from 'dotenv';
import { Pool } from 'pg';

loadEnv();
loadEnv({ path: `.env.${process.env.NODE_ENV || 'dev'}`, override: true });

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT || '5432', 10);
const DB_NAME = process.env.DB_NAME || 'eventix';
const DB_USER = process.env.DB_USER || 'postgres';
const DB_PASSWORD = process.env.DB_PASSWORD || 'postgres';

const SEED_DOWN_FILE = 'seed-down.sql';
const DDL_DIR = join(__dirname, '../src/infrastructure/database/ddl');

async function main(): Promise<void> {
  const seedPath = join(DDL_DIR, SEED_DOWN_FILE);
  const sql = readFileSync(seedPath, 'utf8');

  const pool = new Pool({
    host: DB_HOST,
    port: DB_PORT,
    database: DB_NAME,
    user: DB_USER,
    password: DB_PASSWORD,
  });

  await pool.query(sql);
  console.log(`Ran ${SEED_DOWN_FILE}`);
  await pool.end();
  console.log('Seed down complete');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
