import test from 'node:test';
import assert from 'node:assert';
import { Report } from '../../src/reports/index.js';
import { TerminalReportRenderer } from '../../src/reports/terminal.js';

function makeFinding(overrides = {}) {
  return {
    id: 'missing-gitignore',
    category: 'git',
    severity: 'warning',
    title: 'Missing .gitignore file',
    description: 'No .gitignore file detected.',
    evidence: {},
    location: null,
    ...overrides
  };
}

test('TerminalReportRenderer - renders health summary, category table, and details correctly without colors', () => {
  const report = new Report({
    repository: 'test-project',
    findings: [makeFinding()],
    entries: [{
      finding: makeFinding(),
      diagnosis: { problem: 'No .gitignore file.', why: 'Untracked files might be committed.', evidence: '' },
      recommendation: 'Add a .gitignore file to the root of the repository.'
    }],
    summary: { total: 1, bySeverity: { critical: 0, error: 0, warning: 1, info: 0 } }
  });

  const renderer = new TerminalReportRenderer();
  const output = renderer.render(report, { color: false });
  
  assert.ok(output.includes('RepoDoctor'));
  assert.ok(output.includes('Repository:   test-project'));
  assert.ok(output.includes('Categories Summary'));
  assert.ok(output.includes('git'));
  assert.ok(output.includes('[WARNING]'));
  assert.ok(output.includes('Why:'));
  assert.ok(output.includes('Recommendation:'));
  assert.ok(output.includes('Priority Actions:'));
  assert.ok(output.includes('1. Add a .gitignore file to the root of the repository'));
});

test('TerminalReportRenderer - priority action split bug handles filenames with periods correctly', () => {
  const report = new Report({
    repository: 'test-project',
    findings: [makeFinding()],
    entries: [{
      finding: makeFinding(),
      diagnosis: { problem: 'No .gitignore file.', why: 'Untracked files.', evidence: '' },
      recommendation: 'Add a .gitignore file. Then run git commit.'
    }],
    summary: { total: 1, bySeverity: { critical: 0, error: 0, warning: 1, info: 0 } }
  });

  const renderer = new TerminalReportRenderer();
  const output = renderer.render(report, { color: false });

  // Priority action should split at the period+space, not at '.gitignore'
  // So the priority action should be "Add a .gitignore file"
  assert.ok(output.includes('1. Add a .gitignore file'));
  assert.strictEqual(output.includes('  1. Add a\n') || output.includes('  1. Add a\r\n'), false);
});

test('TerminalReportRenderer - handles clean repository state', () => {
  const report = new Report({
    repository: 'clean-project',
    findings: [],
    entries: [],
    summary: { total: 0, bySeverity: { critical: 0, error: 0, warning: 0, info: 0 } }
  });

  const renderer = new TerminalReportRenderer();
  const output = renderer.render(report, { color: false });

  assert.ok(output.includes('✓ Healthy'));
  assert.ok(output.includes('✓ No issues detected'));
});
