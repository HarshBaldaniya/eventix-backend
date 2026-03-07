// Runs DDL scripts in order - use: npm run db:init
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

const DDL_DIR = join(__dirname, '../src/infrastructure/database/ddl');
const SCHEMA_FILE = 'schema.sql';

async function main(): Promise<void> {
  const schemaPath = join(DDL_DIR, SCHEMA_FILE);
  const fullSql = readFileSync(schemaPath, 'utf8');
  const firstLine = fullSql.split('\n')[0]?.trim() || '';
  const isCreateDb = /^CREATE\s+DATABASE\s+/i.test(firstLine);
  const schemaSql = isCreateDb ? fullSql.replace(firstLine, '').replace(/^\n+/, '') : fullSql;

  const adminPool = new Pool({
    host: DB_HOST,
    port: DB_PORT,
    database: 'postgres',
    user: DB_USER,
    password: DB_PASSWORD,
  });
  if (isCreateDb) {
    try {
      await adminPool.query(firstLine);
      console.log(`Created database: ${DB_NAME}`);
    } catch (err: unknown) {
      if ((err as { code?: string })?.code !== '42P04') throw err;
      console.log(`Database ${DB_NAME} already exists`);
    }
  }
  await adminPool.end();

  const pool = new Pool({
    host: DB_HOST,
    port: DB_PORT,
    database: DB_NAME,
    user: DB_USER,
    password: DB_PASSWORD,
  });
  await pool.query(schemaSql);
  console.log(`Ran ${SCHEMA_FILE}`);
  await pool.end();
  console.log('DB init complete');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
