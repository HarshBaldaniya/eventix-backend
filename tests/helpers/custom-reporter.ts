import * as fs from 'fs';
import * as path from 'path';

export interface CustomTestResult {
    testName: string;
    status: 'passed' | 'failed';
    durationMs: number;
    timestamp: string;
    metrics: Record<string, any>;
    details?: string;
}

const REPORTS_DIR = path.resolve(process.cwd(), 'test-reports');
const CUSTOM_RESULTS_PATH = path.resolve(REPORTS_DIR, 'custom-results.json');

export function saveCustomResult(result: CustomTestResult) {
    if (!fs.existsSync(REPORTS_DIR)) {
        fs.mkdirSync(REPORTS_DIR, { recursive: true });
    }

    let currentResults: CustomTestResult[] = [];
    if (fs.existsSync(CUSTOM_RESULTS_PATH)) {
        try {
            currentResults = JSON.parse(fs.readFileSync(CUSTOM_RESULTS_PATH, 'utf-8'));
        } catch {
            currentResults = [];
        }
    }

    // Replace existing result for the same test if it exists, or append
    const existingIndex = currentResults.findIndex(r => r.testName === result.testName);
    if (existingIndex > -1) {
        currentResults[existingIndex] = result;
    } else {
        currentResults.push(result);
    }

    fs.writeFileSync(CUSTOM_RESULTS_PATH, JSON.stringify(currentResults, null, 2));
    console.log(`\n[reporter] Result for "${result.testName}" saved to test-reports/custom-results.json`);
}
