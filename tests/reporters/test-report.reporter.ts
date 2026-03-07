// Custom Vitest reporter - generates TEST-REPORT.md after test execution
import type { Reporter } from 'vitest';
import { writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

interface TestResult {
  file: string;
  name: string;
  status: string;
  duration?: number;
}

function collectFromModule(mod: unknown, file: string, results: TestResult[]): void {
  if (!mod || typeof mod !== 'object') return;
  const m = mod as Record<string, unknown>;
  const children = m.children ?? m.tasks ?? m.suites;
  if (children) {
    const iter = Array.isArray(children)
      ? children
      : children instanceof Map
        ? children.values()
        : children instanceof Set
          ? children.values()
          : typeof (children as Iterable<unknown>)[Symbol.iterator] === 'function'
            ? (children as Iterable<unknown>)
            : Object.values(children as Record<string, unknown>);
    for (const child of iter) {
      const c = child as Record<string, unknown>;
      if (c.type === 'test' || c.taskType === 'test') {
        const res = typeof c.result === 'function' ? c.result() : c.result;
        const state = (res as { state?: string })?.state ?? 'unknown';
        const status = state === 'pass' ? 'passed' : state === 'fail' ? 'failed' : 'skipped';
        results.push({
          file,
          name: String(c.name ?? c.fullName ?? 'unknown'),
          status,
          duration: (res as { duration?: number })?.duration,
        });
      } else {
        collectFromModule(child, file, results);
      }
    }
  }
}

function collectTests(testModules: ReadonlyArray<unknown>): TestResult[] {
  const results: TestResult[] = [];
  for (const mod of testModules) {
    const m = mod as Record<string, unknown>;
    const file =
      (m.file as { filepath?: string })?.filepath ??
      (m.filepath as string) ??
      (m.moduleId as string) ??
      (m.id as string) ??
      'unknown';
    const relFile = file.replace(process.cwd(), '').replace(/^[/\\]+/, '') || file;
    collectFromModule(mod, relFile, results);
  }
  return results;
}

function collectFromJson(jsonPath: string): TestResult[] {
  if (!existsSync(jsonPath)) return [];
  try {
    const { readFileSync } = require('fs');
    const data = JSON.parse(readFileSync(jsonPath, 'utf-8'));
    const results: TestResult[] = [];
    const files = data.testResults ?? data.results ?? [];
    for (const f of files) {
      const file = f.name ?? f.filePath ?? '';
      const tests = f.assertionResults ?? f.testResults ?? [];
      for (const t of tests) {
        results.push({
          file,
          name: t.fullName ?? t.title ?? t.name ?? 'unknown',
          status: t.status === 'passed' ? 'passed' : t.status === 'failed' ? 'failed' : 'skipped',
          duration: t.duration,
        });
      }
    }
    return results;
  } catch {
    return [];
  }
}

function buildReport(testResults: TestResult[], durationMs: number): string {
  const now = new Date();
  const cmd = process.env.npm_lifecycle_event || 'vitest run';
  const passed = testResults.filter((t) => t.status === 'passed').length;
  const failed = testResults.filter((t) => t.status === 'failed').length;
  const total = testResults.length;

  const byFile = new Map<string, { passed: number; failed: number; tests: string[] }>();
  for (const t of testResults) {
    const key = t.file.replace(process.cwd(), '').replace(/^[/\\]+/, '') || t.file;
    if (!byFile.has(key)) byFile.set(key, { passed: 0, failed: 0, tests: [] });
    const f = byFile.get(key)!;
    f.tests.push(t.name);
    if (t.status === 'passed') f.passed++;
    else if (t.status === 'failed') f.failed++;
  }

  const testDescriptions: Record<string, string> = {
    'health.api.test.ts': 'Health API - GET /api/v1/health (status, db), 404 for unknown routes',
    'auth.api.test.ts': 'Auth API - Register, login, logout, refresh. Validation, 409 duplicate email, 401 wrong credentials',
    'events.api.test.ts': 'Events API - List, get, create (admin), update (admin), book spot. Pagination, 404, 401, 403, 400, 409 overbook',
    'bookings.api.test.ts': 'Bookings API - List, get by id, cancel. Auth required, 404',
    'audit-log.api.test.ts': 'Audit Log API - GET /api/v1/audit-log (admin only). Uses event_audit_log + booking_audit_log. 401, 403, filters',
    'booking.integration.test.ts': 'Integration - Event and booking in DB, API returns correct data',
    'booking.service.unit.test.ts': 'Unit - BookingService: bookSpot, listBookings, getBookingById, cancelBooking',
    'auth.service.unit.test.ts': 'Unit - AuthService: register, login. Mocks user/session repos',
    'event.service.unit.test.ts': 'Unit - EventService: listEvents, getEventById, createEvent, updateEvent',
    'audit-log.service.unit.test.ts': 'Unit - AuditLogService: listAuditLog (event_audit_log + booking_audit_log)',
  };

  let md = `# Test Execution Report\n\n`;
  md += `**Generated:** ${now.toISOString()} (${now.toLocaleString()})\n\n`;
  md += `**Command:** \`npm run ${cmd}\`\n\n`;
  md += `**Duration:** ${formatDuration(durationMs)}\n\n`;
  md += `**Result:** ${passed} passed, ${failed} failed, ${total} total\n\n`;
  md += `---\n\n## Summary\n\n`;
  md += `| Metric | Value |\n|--------|-------|\n`;
  md += `| Passed | ${passed} |\n`;
  md += `| Failed | ${failed} |\n`;
  md += `| Total  | ${total} |\n`;
  md += `| Duration | ${formatDuration(durationMs)} |\n\n`;
  md += `---\n\n## What Was Tested\n\n`;

  if (byFile.size > 0) {
    for (const [file, data] of byFile) {
      const shortFile = file.split(/[/\\]/).pop() ?? file;
      const desc = testDescriptions[shortFile] ?? 'API/unit tests';
      md += `### ${shortFile}\n\n`;
      md += `${desc}\n\n`;
      md += `- Passed: ${data.passed}, Failed: ${data.failed}\n`;
      md += `- Tests: ${data.tests.slice(0, 10).map((t) => `\`${t}\``).join(', ')}${data.tests.length > 10 ? ` ... (+${data.tests.length - 10} more)` : ''}\n\n`;
    }
  } else {
    md += `*Test details collected from reporter. Run \`npm run test:api\` or \`npm run test:all\` for full coverage.*\n\n`;
  }

  md += `---\n\n## Database Tables Used\n\n`;
  md += `| Table | Purpose |\n|-------|--------|\n`;
  md += `| users | Auth, bookings, audit log user_id |\n`;
  md += `| sessions | Login/logout, refresh tokens |\n`;
  md += `| events | Event catalog, capacity, booked_count |\n`;
  md += `| bookings | User bookings, ticket_count, status |\n`;
  md += `| event_audit_log | Audit trail for event create/update |\n`;
  md += `| booking_audit_log | Audit trail for book/cancel |\n`;
  md += `| event_booking_config | Max tickets per booking/user |\n\n`;
  md += `---\n\n## Post-Run Cleanup\n\n`;
  md += `Global teardown runs after all tests: deletes users (email like %@test.local), test events. Cascades to sessions, bookings, event_audit_log, booking_audit_log.\n`;

  return md;
}

export default class TestReportReporter {
  private startTime = 0;
  private collectedResults: TestResult[] = [];

  onTestRunStart(): void {
    this.startTime = Date.now();
    this.collectedResults = [];
  }

  onTestCaseResult(testCase: unknown): void {
    const t = testCase as Record<string, unknown>;
    const file = (t.file as { filepath?: string })?.filepath ?? (t.module as { file?: string })?.file ?? '';
    const res = typeof t.result === 'function' ? t.result() : t.result;
    const state = (res as { state?: string })?.state ?? 'unknown';
    this.collectedResults.push({
      file: String(file).replace(process.cwd(), '').replace(/^[/\\]+/, '') || 'unknown',
      name: String(t.fullName ?? t.name ?? 'unknown'),
      status: state === 'pass' ? 'passed' : state === 'fail' ? 'failed' : 'skipped',
      duration: (res as { duration?: number })?.duration,
    });
  }

  onTestRunEnd(
    testModules: ReadonlyArray<unknown>,
    _unhandledErrors: ReadonlyArray<unknown>,
    _reason: string
  ): void {
    let testResults = this.collectedResults.length > 0 ? this.collectedResults : collectTests(testModules);
    if (testResults.length === 0) {
      const jsonPath = resolve(process.cwd(), 'test-results.json');
      testResults = collectFromJson(jsonPath);
    }
    const durationMs = Date.now() - this.startTime;
    const report = buildReport(testResults, durationMs);
    const outPath = resolve(process.cwd(), 'TEST-REPORT.md');
    writeFileSync(outPath, report);
    console.log(`\n[reporter] TEST-REPORT.md written to ${outPath}`);
  }
}
