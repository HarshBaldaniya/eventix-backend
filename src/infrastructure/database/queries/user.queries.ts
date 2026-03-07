// User-related SQL queries - repositories import from here
export const USER_QUERIES = {
  INSERT: `INSERT INTO users (email, password_hash, name, role) VALUES ($1, $2, $3, $4) RETURNING id, email, name, role, created_at`,
  SELECT_BY_EMAIL: `SELECT id, email, password_hash, name, role, created_at FROM users WHERE email = $1`,
  SELECT_BY_ID: `SELECT id, email, name, role, created_at FROM users WHERE id = $1`,
} as const;
