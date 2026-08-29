import test from 'node:test';
import assert from 'node:assert';
import { Report } from '../../src/reports/index.js';

test('Report - instantiates correctly with valid result', () => {
  const result = {
    repository: 'test-repo',
    findings: [{ id: 'test-finding' }],
    entries: [{ finding: {}, diagnosis: {}, recommendation: '' }],
    summary: { total: 1, bySeverity: { critical: 0, error: 0, warning: 1, info: 0 } }
  };
  const report = new Report(result);
  
  assert.strictEqual(report.repository, 'test-repo');
  assert.strictEqual(report.findings.length, 1);
  assert.strictEqual(report.entries.length, 1);
  assert.strictEqual(report.summary.total, 1);
});

test('Report - handles empty values correctly', () => {
  const report = new Report({ repository: 'empty-test' });
  assert.strictEqual(report.repository, 'empty-test');
  assert.deepStrictEqual(report.findings, []);
  assert.deepStrictEqual(report.entries, []);
  assert.strictEqual(report.summary.total, 0);
});

test('Report - throws error when result is null or undefined', () => {
  assert.throws(() => new Report(null), /Report data is required/);
});
