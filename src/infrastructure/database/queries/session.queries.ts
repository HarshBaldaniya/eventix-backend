// Session SQL queries - for refresh token storage (login/logout) with active/inactive status
export const SESSION_QUERIES = {
  INSERT: `INSERT INTO sessions (user_id, refresh_token_hash, status, expires_at) VALUES ($1, $2, 'active', $3) RETURNING id`,
  FIND_BY_TOKEN_HASH: `SELECT id, user_id, expires_at FROM sessions WHERE refresh_token_hash = $1 AND status = 'active' AND expires_at > NOW()`,
  DEACTIVATE_BY_TOKEN_HASH: `UPDATE sessions SET status = 'inactive' WHERE refresh_token_hash = $1 AND status = 'active'`,
  DEACTIVATE_BY_USER_ID: `UPDATE sessions SET status = 'inactive' WHERE user_id = $1 AND status = 'active'`,
} as const;
