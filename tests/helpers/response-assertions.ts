// Reusable response assertions - validates status codes and envelope shape
import { expect } from 'vitest';
import type { Response } from 'supertest';

export function expectSuccess(res: Response, statusCode: number): void {
  expect(res.status).toBe(statusCode);
}

export function expectSuccessWithData(
  res: Response,
  statusCode: number,
  requiredKeys: string[]
): void {
  expect(res.status).toBe(statusCode);
  const body = res.body as Record<string, unknown>;
  expect(body.success).toBe(true);
  const data = body.data as Record<string, unknown> | undefined;
  if (requiredKeys.length > 0 && data) {
    for (const key of requiredKeys) {
      expect(data).toHaveProperty(key);
    }
  }
}

export function expectError(res: Response, statusCode: number, errorCode?: string): void {
  expect(res.status).toBe(statusCode);
  const body = res.body as Record<string, unknown>;
  expect(body.success).toBe(false);
  const err = body.error as Record<string, unknown> | undefined;
  expect(err).toBeDefined();
  expect(err?.code).toBeDefined();
  if (errorCode) {
    expect(err?.code).toBe(errorCode);
  }
}

export function expectErrorDetails(
  res: Response,
  statusCode: number,
  code: string,
  detailsKeys: string[]
): void {
  expectError(res, statusCode, code);
  const body = res.body as Record<string, unknown>;
  const err = body.error as Record<string, unknown>;
  const details = err?.details as Record<string, unknown> | undefined;
  if (detailsKeys.length > 0) {
    expect(details).toBeDefined();
    for (const key of detailsKeys) {
      expect(details).toHaveProperty(key);
    }
  }
}

export function expectPagination(res: Response, keys?: string[]): void {
  const body = res.body as Record<string, unknown>;
  const pagination = body.pagination as Record<string, unknown> | undefined;
  expect(pagination).toBeDefined();
  const defaultKeys = ['page', 'limit', 'total', 'total_pages'];
  const toCheck = keys ?? defaultKeys;
  for (const key of toCheck) {
    expect(pagination).toHaveProperty(key);
  }
}
