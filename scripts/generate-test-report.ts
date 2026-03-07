// Test Report Generator: Transforms Vitest JSON output into a formatted Markdown report
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { config } from 'dotenv';

const REPORTS_DIR = resolve(process.cwd(), 'test-reports');
const REPORT_TYPE = (process.env.REPORT_TYPE || 'all').toLowerCase();
const JSON_PATH = resolve(REPORTS_DIR, 'test-results.json');
const isCombined = REPORT_TYPE === 'all';
const REPORT_FILE = isCombined ? 'TEST-REPORT.md' : `TEST-REPORT-${REPORT_TYPE.toUpperCase()}.md`;
const JSON_FILE = isCombined ? 'test-results.json' : `test-results-${REPORT_TYPE}.json`;
const OUT_PATH = resolve(REPORTS_DIR, REPORT_FILE);
const JSON_COPY_PATH = resolve(REPORTS_DIR, JSON_FILE);

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

const TEST_DESCRIPTIONS: Record<string, string> = {
  'health.api.test.ts': 'Health API - GET /api/v1/health (status, db), 404 for unknown routes',
  'auth.api.test.ts': 'Auth API - Register, login, logout, refresh. Validation, 409 duplicate email, 401 wrong credentials',
  'events.api.test.ts': 'Events API - List, get, create (admin), update (admin), book spot. Pagination, 404, 401, 403, 400, 409 overbook',
  'bookings.api.test.ts': 'Bookings API - List, get by id, cancel. Auth required, 404',
  'audit-log.api.test.ts': 'Audit Log API - GET /api/v1/audit-log (admin only). Uses event_audit_log + booking_audit_log. 401, 403, filters',
  'booking.integration.test.ts': 'Integration - Event and booking in DB, API returns correct data',
  'auth.integration.test.ts': 'Integration - Register, login, protected route, logout. DB + API flow',
  'event-booking.integration.test.ts': 'Integration - Full flow: admin creates event, user books, user cancels. DB + API',
  'audit.integration.test.ts': 'Integration - event_audit_log and booking_audit_log entries via API',
  'booking.service.unit.test.ts': 'Unit - BookingService: bookSpot, listBookings, getBookingById, cancelBooking',
  'auth.service.unit.test.ts': 'Unit - AuthService: register, login. Mocks user/session repos',
  'event.service.unit.test.ts': 'Unit - EventService: listEvents, getEventById, createEvent, updateEvent',
  'audit-log.service.unit.test.ts': 'Unit - AuditLogService: listAuditLog (event_audit_log + booking_audit_log)',
};

function getTestCategory(filePath: string): 'API' | 'Unit' | 'Integration' {
  if (filePath.includes('/unit/')) return 'Unit';
  if (filePath.includes('/integration/') || filePath.includes('.integration.test')) return 'Integration';
  return 'API';
}

function loadTestEnv(): { envFile: string; dbHost: string; dbPort: string; dbName: string; dbUser: string; dbPoolMax: string } {
  const root = resolve(process.cwd());
  const candidates: { path: string; name: string }[] = [
    { path: resolve(root, '.env.test'), name: '.env.test' },
    { path: resolve(root, '.env'), name: '.env' },
    { path: resolve(root, '.env.dev'), name: '.env.dev' },
    { path: resolve(root, '.env.example'), name: '.env.example' },
  ];
  let envFile = '(none loaded)';
  for (const { path: p, name } of candidates) {
    if (existsSync(p)) {
      config({ path: p });
      envFile = name;
      break;
    }
  }
  return {
    envFile,
    dbHost: process.env.DB_HOST ?? '—',
    dbPort: process.env.DB_PORT ?? '5432',
    dbName: process.env.DB_NAME ?? '—',
    dbUser: process.env.DB_USER ?? '—',
    dbPoolMax: process.env.DB_POOL_MAX ?? '20',
  };
}

function main(): void {
  const env = loadTestEnv();
  if (!existsSync(REPORTS_DIR)) mkdirSync(REPORTS_DIR, { recursive: true });
  if (!existsSync(JSON_PATH)) {
    console.warn(`[report] ${JSON_PATH} not found. Run tests with JSON reporter first.`);
    return;
  }

  const raw = readFileSync(JSON_PATH, 'utf-8');
  let data: any;
  try {
    data = JSON.parse(raw);
  } catch {
    console.error('[report] Invalid JSON in test-results.json');
    return;
  }

  const prettyJson = JSON.stringify(data, null, 2);
  writeFileSync(JSON_PATH, prettyJson, 'utf-8');
  writeFileSync(JSON_COPY_PATH, prettyJson, 'utf-8');

  const passed = data.numPassedTests ?? 0;
  const failed = data.numFailedTests ?? 0;
  const skipped = (data.numSkippedTests ?? 0) + (data.numPendingTests ?? 0);
  const total = data.numTotalTests ?? 0;
  const startTime = data.startTime ?? Date.now();
  const durationMs = Date.now() - startTime;
  const now = new Date();
  const cmd = process.env.npm_lifecycle_event || 'vitest run';

  const testResults = data.testResults ?? [];
  const apiFiles = testResults.filter((r: any) => getTestCategory(r.name) === 'API');
  const unitFiles = testResults.filter((r: any) => getTestCategory(r.name) === 'Unit');
  const integrationFiles = testResults.filter((r: any) => getTestCategory(r.name) === 'Integration');

  let md = `# Test Execution Report\n\n`;
  md += `> **Generated:** ${now.toLocaleString('en-IN', { dateStyle: 'full', timeStyle: 'long' })}\n`;
  md += `> **Command:** \`npm run ${cmd}\`\n`;
  md += `> **Duration:** ${formatDuration(durationMs)}\n`;
  md += `> **Status:** ${data.success ? '✅ All passed' : '❌ Some failed'}\n\n`;
  md += `---\n\n`;

  md += `## 📊 Summary\n\n`;
  md += `| Metric | Count |\n`;
  md += `| :----- | ----: |\n`;
  md += `| **Passed** | ${passed} |\n`;
  md += `| **Failed** | ${failed} |\n`;
  if (skipped > 0) md += `| **Skipped** | ${skipped} |\n`;
  md += `| **Total** | ${total} |\n`;
  md += `| **Duration** | ${formatDuration(durationMs)} |\n\n`;

  md += `---\n\n## 🔌 Environment & Database\n\n`;
  md += `| Setting | Value |\n`;
  md += `| :------ | :---- |\n`;
  md += `| **Env file used** | \`${env.envFile}\` |\n`;
  md += `| **NODE_ENV** | \`${process.env.NODE_ENV ?? '—'}\` |\n`;
  md += `| **DB Host** | \`${env.dbHost}\` |\n`;
  md += `| **DB Name** | \`${env.dbName}\` |\n\n`;

  const failedAssertions = testResults.flatMap((r: any) =>
    (r.assertionResults ?? [])
      .filter((a: any) => a.status === 'failed' && (a.failureMessages?.length ?? 0) > 0)
      .map((a: any) => ({ file: r.name, fullName: a.fullName, messages: a.failureMessages ?? [] }))
  );
  if (failedAssertions.length > 0) {
    md += `---\n\n## ❌ Failed Tests (Details)\n\n`;
    for (const { file, fullName, messages } of failedAssertions as any) {
      const shortFile = file.split(/[/\\]/).pop() ?? file;
      md += `### \`${shortFile}\`\n\n**${fullName}**\n\n`;
      for (const msg of messages) {
        md += `\`\`\`\n${msg.split('\n').slice(0, 5).join('\n')}\n\`\`\`\n\n`;
      }
    }
  }

  const renderSection = (title: string, files: any[], emoji: string) => {
    if (files.length === 0) return;
    md += `---\n\n## ${emoji} ${title}\n\n`;
    for (const fileResult of files) {
      const shortFile = fileResult.name.split(/[/\\]/).pop() ?? fileResult.name;
      const desc = TEST_DESCRIPTIONS[shortFile] ?? 'Tests';
      const assertions = fileResult.assertionResults ?? [];
      const fileFailed = assertions.filter((a: any) => a.status === 'failed').length;
      const statusIcon = fileFailed > 0 ? '❌' : '✅';
      md += `### ${statusIcon} ${shortFile}\n\n*${desc}*\n\n`;
      for (const a of assertions) {
        const icon = a.status === 'passed' ? '✓' : a.status === 'skipped' ? '⊘' : '✗';
        md += `- ${icon} \`${a.fullName ?? a.title ?? a.status}\`\n`;
      }
      md += `\n`;
    }
  };

  renderSection('API Tests', apiFiles, '🌐');
  renderSection('Unit Tests', unitFiles, '🔬');
  renderSection('Integration Tests', integrationFiles, '🔗');

  writeFileSync(OUT_PATH, md);
  console.log(`\n[report] test-reports/${REPORT_FILE} written`);
}

main();
