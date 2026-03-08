// HTML Report Generator: Consolidated Quality Excellence Dashboard
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const REPORTS_DIR = resolve(process.cwd(), 'test-reports');
const VITEST_JSON = resolve(REPORTS_DIR, 'test-results.json');
const CUSTOM_JSON = resolve(REPORTS_DIR, 'custom-results.json');
const HTML_OUT = resolve(REPORTS_DIR, 'report.html');

interface VitestData {
    numTotalTests: number;
    numPassedTests: number;
    numFailedTests: number;
    success: boolean;
    startTime: number;
    testResults: any[];
}

interface CustomResult {
    testName: string;
    status: 'passed' | 'failed';
    durationMs: number;
    timestamp: string;
    metrics: Record<string, any>;
}

const TEST_META: Record<string, { title: string; order: number; desc: string }> = {
    'Mega-Auth Stress Test (50k Scale)': {
        title: '💎 Mega-Auth: Extreme Scale (In-Process)',
        order: 1,
        desc: "Simulates 50,000 users with real JWT tokens. In-process (supertest) – no HTTP. Verifies CPU and Redis overhead."
    },
    'Mega-Auth Stress Test (Real API)': {
        title: '🌐 Mega-Auth Real API: Live HTTP Server',
        order: 2,
        desc: "Same as Mega-Auth but hits actual HTTP server (localhost:3000). Simulates real users over the network. Start server first."
    },
    'Extreme Bypass Stress Test': {
        title: '🚀 Extreme Bypass: Pure Load (Bypass Auth)',
        order: 3,
        desc: "Pure Performance Test. Simulates 50,000 requests using x-test-user-id bypass to eliminate JWT overhead."
    },
    'Full-Auth Stress Test': {
        title: '🔑 Full-Auth: Standard Scale (Setup-based)',
        order: 4,
        desc: "End-to-end integration. Registers 50 users from scratch and books for each."
    },
    'Rate Limit Validation Test': {
        title: '🛡️ Rate Limit: Security Protection (429)',
        order: 5,
        desc: "Security Guard Test. Ensures our 100-request limit correctly triggers a 429 block."
    }
};

function formatDuration(ms: number): string {
    if (ms <= 0) return '0ms';
    if (ms < 1000) return `${Math.round(ms)}ms`;
    const seconds = ms / 1000;
    if (seconds < 60) return `${seconds.toFixed(2)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds.toFixed(1)}s`;
}

function formatLabel(key: string): string {
    const labels: Record<string, string> = {
        'concurrency': 'Concurrency',
        'totalSpots': 'Total Spots Available',
        'success': 'Bookings Completed (201)',
        'expectedConflicts': 'Expected Conflicts (409)',
        'failed': 'Requests Rejected',
        'otherErrors': 'Technical Errors',
        'dbBookedCount': 'DB Final Count',
        'maxRequests': 'Rate Limit Max',
        'testCount': 'Total Requests Sent',
        'actualSuccesses': 'Allowed Requests (200)',
        'actualRateLimited': 'Blocked Requests (429)'
    };
    return labels[key] || key.replace(/([A-Z])/g, ' $1').toLowerCase();
}

function generateHtml() {
    console.log('📊 Generating Quality Dashboard...');
    let vitest: VitestData | null = null;
    let custom: CustomResult[] = [];

    if (existsSync(VITEST_JSON)) {
        try {
            vitest = JSON.parse(readFileSync(VITEST_JSON, 'utf-8'));
        } catch { }
    }
    if (existsSync(CUSTOM_JSON)) {
        try {
            custom = JSON.parse(readFileSync(CUSTOM_JSON, 'utf-8'));
        } catch { }
    }

    const sortedCustom = custom.sort((a, b) => {
        const orderA = TEST_META[a.testName]?.order ?? 99;
        const orderB = TEST_META[b.testName]?.order ?? 99;
        return orderA - orderB;
    });

    const totalPassed = (vitest?.numPassedTests ?? 0) + custom.filter(r => r.status === 'passed').length;
    const totalFailed = (vitest?.numFailedTests ?? 0) + custom.filter(r => r.status === 'failed').length;
    const isAllPassed = totalFailed === 0;

    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Eventix Dashboard</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&family=JetBrains+Mono&display=swap" rel="stylesheet">
    <style>:root { --bg-dark: #0f172a; --bg-card: #1e293b; --primary: #38bdf8; --success: #10b981; --error: #ef4444; --warning: #f59e0b; --text-main: #f8fafc; --text-dim: #94a3b8; --border: #334155; }
    body { background-color: var(--bg-dark); color: var(--text-main); font-family: 'Inter', sans-serif; margin: 0; padding: 2rem; line-height: 1.6; }
    .container { max-width: 1100px; margin: 0 auto; }
    header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; border-bottom: 1px solid var(--border); padding-bottom: 1rem; }
    h1 { margin: 0; font-weight: 700; color: var(--primary); font-size: 1.8rem; }
    .timestamp { color: var(--text-dim); font-size: 0.9rem; }
    .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
    .stat-card { background: var(--bg-card); padding: 1.5rem; border-radius: 12px; border: 1px solid var(--border); text-align: center; }
    .stat-value { font-size: 2rem; font-weight: 700; display: block; }
    .stat-label { color: var(--text-dim); text-transform: uppercase; font-size: 0.75rem; font-weight: 600; }
    section { margin-bottom: 3rem; }
    h2 { font-size: 1.4rem; margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.5rem; }
    .test-file-card { background: var(--bg-card); border-radius: 8px; border: 1px solid var(--border); margin-bottom: 2rem; overflow: hidden; }
    .test-file-header { padding: 1.25rem 1.5rem; background: rgba(255, 255, 255, 0.03); display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); }
    .test-file-name { font-weight: 700; font-size: 1.1rem; }
    .status-badge { padding: 0.25rem 0.75rem; border-radius: 99px; font-size: 0.75rem; font-weight: 600; }
    .status-badge.passed { background: rgba(16, 185, 129, 0.1); color: var(--success); }
    .status-badge.failed { background: rgba(239, 68, 68, 0.1); color: var(--error); }
    .test-desc { padding: 1rem 1.5rem; color: var(--text-dim); font-size: 0.9rem; background: rgba(0,0,0,0.1); border-bottom: 1px solid var(--border); font-style: italic; }
    .metrics-list { padding: 1.5rem; display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1.5rem; }
    .metric-item { display: flex; flex-direction: column; }
    .metric-val { font-family: 'JetBrains Mono', monospace; font-size: 1.25rem; color: var(--primary); }
    .metric-lab { font-size: 0.7rem; color: var(--text-dim); text-transform: uppercase; font-weight: 600; }
    .metric-val.success-text { color: var(--success); }
    .metric-val.warning-text { color: var(--warning); }
    .metric-val.error-text { color: var(--error); }
    .footer { margin-top: 4rem; text-align: center; color: var(--text-dim); font-size: 0.8rem; }
    </style></head>
<body>
    <div class="container">
        <header><h1>Quality Dashboard</h1><div class="timestamp">Generated: ${new Date().toLocaleString()}</div></header>
        <div class="summary-grid">
            <div class="stat-card"><span class="stat-value">${totalPassed + totalFailed}</span><span class="stat-label">Total Checks</span></div>
            <div class="stat-card"><span class="stat-value">${isAllPassed ? '✅' : '❌'}</span><span class="stat-label">System Integrity</span></div>
        </div>
        <section>
            <h2>🚀 Performance Benchmarks</h2>
            ${sortedCustom.map(res => {
        const meta = TEST_META[res.testName] || { title: res.testName, desc: '' };
        return `
                <div class="test-file-card">
                    <div class="test-file-header"><span class="test-file-name">${meta.title}</span><span class="status-badge ${res.status}">${res.status}</span></div>
                    <div class="test-desc">${meta.desc}</div>
                    <div class="metrics-list">
                        ${Object.entries(res.metrics).map(([k, v]) => `
                            <div class="metric-item">
                                <span class="metric-val ${k.includes('success') ? 'success-text' : k.includes('conflict') ? 'warning-text' : (k.includes('Error') || k.includes('failed')) && v > 0 ? 'error-text' : ''}">${v}</span>
                                <span class="metric-lab">${formatLabel(k)}</span>
                            </div>
                        `).join('')}
                        <div class="metric-item"><span class="metric-val">${formatDuration(res.durationMs)}</span><span class="metric-lab">TIME</span></div>
                    </div>
                </div>`;
    }).join('')}
        </section>

        ${vitest && vitest.testResults && vitest.testResults.length > 0 ? `
        <section>
            <h2>🧩 Standard Logic & Integration Suites</h2>
            ${vitest.testResults.map(suite => {
        const suiteName = suite.name.split('/').pop()?.replace('.test.ts', '') || 'Test Suite';
        return `
                <div class="test-file-card">
                    <div class="test-file-header"><span class="test-file-name">${suiteName}</span><span class="status-badge ${suite.status}">${suite.status}</span></div>
                    <div class="test-desc">File: ${suite.name.split('assignment-task/backend/')[1] || suite.name}</div>
                    <div class="metrics-list" style="display: block; padding: 1rem 1.5rem;">
                        <ul style="list-style-type: none; padding: 0; margin: 0;">
                        ${suite.assertionResults.map((assert: any) => `
                            <li style="margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem;">
                                <span style="font-family: monospace; font-size: 1.2rem; color: ${assert.status === 'passed' ? 'var(--success)' : 'var(--error)'}">${assert.status === 'passed' ? '✓' : '✗'}</span>
                                <span style="color: ${assert.status === 'passed' ? 'var(--text-main)' : 'var(--error)'}">${assert.title}</span>
                                ${assert.duration ? `<span style="color: var(--text-dim); font-size: 0.8rem; margin-left: auto;">${formatDuration(assert.duration)}</span>` : ''}
                            </li>
                        `).join('')}
                        </ul>
                    </div>
                </div>`;
    }).join('')}
        </section>
        ` : ''}

        <div class="footer">&copy; ${new Date().getFullYear()} Eventix Backend Infrastructure</div>
    </div></body></html>`;

    writeFileSync(HTML_OUT, html);
    console.log(`✅ [report] HTML Dashboard updated: ${HTML_OUT}`);
}

generateHtml();
