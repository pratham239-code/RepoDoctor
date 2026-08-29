import test from 'node:test';
import assert from 'node:assert';
import { Report } from '../../src/reports/index.js';
import { JsonReportRenderer } from '../../src/reports/json.js';

test('JsonReportRenderer - outputs valid, color-free, deterministic JSON', () => {
  const result = {
    repository: 'test-repo',
    findings: [{ id: 'test-finding', severity: 'warning', category: 'git', title: 'Uni\\code test \u00A9', description: 'desc "with quotes"' }],
    entries: [{
      finding: { id: 'test-finding', severity: 'warning', category: 'git' },
      diagnosis: { problem: 'prob', why: 'line1\nline2', evidence: '' },
      recommendation: 'rec'
    }],
    summary: { total: 1, bySeverity: { critical: 0, error: 0, warning: 1, info: 0 } }
  };

  const report = new Report(result);
  const renderer = new JsonReportRenderer();
  const output = renderer.render(report);

  // Validate it parses correctly
  const parsed = JSON.parse(output);
  assert.ok(parsed);
  assert.strictEqual(parsed.repository, 'test-repo');
  assert.strictEqual(parsed.summary.total, 1);
  assert.strictEqual(parsed.findings[0].title, 'Uni\\code test ©');
  assert.strictEqual(parsed.findings[0].description, 'desc "with quotes"');
  assert.strictEqual(parsed.entries[0].diagnosis.why, 'line1\nline2');
  
  // Ensure no ANSI characters are present
  assert.ok(!output.includes('\x1b['));

  // Validate determinism (identical serialization for same structures)
  const output2 = renderer.render(new Report(result));
  assert.strictEqual(output, output2);
});
