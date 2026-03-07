// Audit enums - aligned with PostgreSQL audit_operation_enum and audit_outcome_enum
export const AUDIT_OPERATION = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  FETCH: 'fetch',
  BOOK: 'book',
  CANCEL: 'cancel',
} as const;

export type AuditOperation = (typeof AUDIT_OPERATION)[keyof typeof AUDIT_OPERATION];

export const AUDIT_OUTCOME = {
  SUCCESS: 'success',
  FAILURE: 'failure',
} as const;

export type AuditOutcome = (typeof AUDIT_OUTCOME)[keyof typeof AUDIT_OUTCOME];
