import test from 'node:test';
import assert from 'node:assert';
import { getDiagnosis } from '../../src/doctor/diagnoses.js';
import { getRecommendation } from '../../src/doctor/recommendations.js';
import { doctor } from '../../src/doctor/index.js';
import { formatResult, formatJson } from '../../src/doctor/formatter.js';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeFinding(overrides = {}) {
  return {
    id: 'missing-readme',
    category: 'documentation',
    severity: 'warning',
    title: 'Missing README file',
    description: 'No README.md file was detected.',
    evidence: { readmePresent: false },
    location: null,
    ...overrides
  };
}

function makeSnapshot(overrides = {}) {
  return {
    project: { name: 'test-project', path: '/test', version: '1.0.0', type: 'module' },
    ...overrides
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. getDiagnosis — known findings
// ─────────────────────────────────────────────────────────────────────────────

test('Doctor - getDiagnosis returns structured object for missing-readme', () => {
  const finding = makeFinding({ id: 'missing-readme' });
  const diag = getDiagnosis(finding);
  assert.strictEqual(typeof diag.problem, 'string');
  assert.strictEqual(typeof diag.why, 'string');
  assert.strictEqual(typeof diag.evidence, 'string');
  assert.ok(diag.problem.length > 0);
  assert.ok(diag.why.length > 0);
});

test('Doctor - getDiagnosis covers all supported finding IDs', () => {
  const ids = [
    'empty-repository',
    'missing-readme',
    'missing-license',
    'missing-gitignore',
    'uncommitted-changes',
    'malformed-package-json',
    'missing-source-files',
    'duplicate-dependency',
    'duplicate-peer-dependency'
  ];
  for (const id of ids) {
    const finding = makeFinding({ id, evidence: { dependency: 'lodash', dependenciesVersion: '^4.0.0', devDependenciesVersion: '^4.0.0', peerDependenciesVersion: '^4.0.0', error: 'bad json', totalCount: 0, totalDirectoryCount: 0, sourceFilesCount: 0 } });
    const diag = getDiagnosis(finding);
    assert.ok(diag.problem, `getDiagnosis missing problem for ${id}`);
    assert.ok(diag.why, `getDiagnosis missing why for ${id}`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. getDiagnosis — unknown / malformed findings
// ─────────────────────────────────────────────────────────────────────────────

test('Doctor - getDiagnosis handles unknown finding ID gracefully', () => {
  const finding = makeFinding({ id: 'some-unknown-finding-xyz' });
  const diag = getDiagnosis(finding);
  assert.ok(diag.problem.includes('some-unknown-finding-xyz'));
  assert.ok(diag.why.includes('additional analysis'));
});

test('Doctor - getDiagnosis handles null finding gracefully', () => {
  const diag = getDiagnosis(null);
  assert.strictEqual(typeof diag.problem, 'string');
  assert.ok(diag.problem.length > 0);
});

test('Doctor - getDiagnosis handles finding with non-string id gracefully', () => {
  const diag = getDiagnosis({ id: 42, severity: 'info' });
  assert.strictEqual(typeof diag.problem, 'string');
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. getRecommendation — known findings
// ─────────────────────────────────────────────────────────────────────────────

test('Doctor - getRecommendation returns actionable string for missing-readme', () => {
  const finding = makeFinding({ id: 'missing-readme' });
  const rec = getRecommendation(finding);
  assert.strictEqual(typeof rec, 'string');
  assert.ok(rec.length > 0);
  assert.ok(rec.toLowerCase().includes('readme') || rec.toLowerCase().includes('add'));
});

test('Doctor - getRecommendation covers all supported finding IDs', () => {
  const ids = [
    'empty-repository',
    'missing-readme',
    'missing-license',
    'missing-gitignore',
    'uncommitted-changes',
    'malformed-package-json',
    'missing-source-files',
    'duplicate-dependency',
    'duplicate-peer-dependency'
  ];
  for (const id of ids) {
    const finding = makeFinding({ id, evidence: { dependency: 'lodash', dependenciesVersion: '^4.0.0', devDependenciesVersion: '^4.0.0', peerDependenciesVersion: '^4.0.0', error: 'bad json' } });
    const rec = getRecommendation(finding);
    assert.strictEqual(typeof rec, 'string', `getRecommendation returned non-string for ${id}`);
    assert.ok(rec.length > 0, `getRecommendation returned empty string for ${id}`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. getRecommendation — unknown / malformed findings
// ─────────────────────────────────────────────────────────────────────────────

test('Doctor - getRecommendation handles unknown finding ID gracefully', () => {
  const finding = makeFinding({ id: 'some-unknown-finding-xyz' });
  const rec = getRecommendation(finding);
  assert.ok(rec.includes('some-unknown-finding-xyz') || rec.toLowerCase().includes('manually'));
});

test('Doctor - getRecommendation handles null gracefully', () => {
  const rec = getRecommendation(null);
  assert.strictEqual(typeof rec, 'string');
  assert.ok(rec.length > 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. doctor() — core result structure
// ─────────────────────────────────────────────────────────────────────────────

test('Doctor - doctor() returns DoctorResult structure', () => {
  const findings = [makeFinding()];
  const result = doctor(findings, makeSnapshot());
  assert.ok(result);
  assert.strictEqual(result.repository, 'test-project');
  assert.ok(Array.isArray(result.findings));
  assert.ok(Array.isArray(result.entries));
  assert.strictEqual(typeof result.summary, 'object');
  assert.strictEqual(typeof result.summary.total, 'number');
  assert.strictEqual(typeof result.summary.bySeverity, 'object');
});

test('Doctor - doctor() with zero findings produces empty entries', () => {
  const result = doctor([], makeSnapshot());
  assert.strictEqual(result.entries.length, 0);
  assert.strictEqual(result.summary.total, 0);
  assert.strictEqual(result.findings.length, 0);
});

test('Doctor - doctor() with null findings does not crash', () => {
  const result = doctor(null, makeSnapshot());
  assert.strictEqual(result.entries.length, 0);
  assert.strictEqual(result.summary.total, 0);
});

test('Doctor - doctor() with null snapshot does not crash', () => {
  const result = doctor([], null);
  assert.strictEqual(result.repository, null);
  assert.strictEqual(result.entries.length, 0);
});

test('Doctor - doctor() single finding produces one enriched entry', () => {
  const finding = makeFinding({ id: 'missing-readme' });
  const result = doctor([finding], makeSnapshot());
  assert.strictEqual(result.entries.length, 1);
  const entry = result.entries[0];
  assert.strictEqual(entry.finding, finding);
  assert.ok(typeof entry.diagnosis.why === 'string');
  assert.ok(typeof entry.recommendation === 'string');
});

test('Doctor - doctor() multiple findings all present in entries', () => {
  const findings = [
    makeFinding({ id: 'missing-readme', severity: 'warning' }),
    makeFinding({ id: 'missing-license', severity: 'warning', title: 'Missing LICENSE file' }),
    makeFinding({ id: 'duplicate-dependency', category: 'dependencies', severity: 'error', evidence: { dependency: 'lodash', dependenciesVersion: '^4.0.0', devDependenciesVersion: '^4.0.0' } })
  ];
  const result = doctor(findings, makeSnapshot());
  assert.strictEqual(result.entries.length, 3);
  assert.strictEqual(result.summary.total, 3);
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. doctor() — severity summary counts
// ─────────────────────────────────────────────────────────────────────────────

test('Doctor - summary counts findings by severity correctly', () => {
  const findings = [
    makeFinding({ id: 'missing-readme', severity: 'warning' }),
    makeFinding({ id: 'duplicate-dependency', severity: 'error', evidence: { dependency: 'a', dependenciesVersion: '1', devDependenciesVersion: '1' } }),
    makeFinding({ id: 'uncommitted-changes', severity: 'info' })
  ];
  const result = doctor(findings, makeSnapshot());
  assert.strictEqual(result.summary.bySeverity.warning, 1);
  assert.strictEqual(result.summary.bySeverity.error, 1);
  assert.strictEqual(result.summary.bySeverity.info, 1);
  assert.strictEqual(result.summary.bySeverity.critical, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. doctor() — preserves original finding information
// ─────────────────────────────────────────────────────────────────────────────

test('Doctor - doctor() preserves finding id, category, severity, evidence', () => {
  const finding = makeFinding({ id: 'malformed-package-json', category: 'configuration', severity: 'error', evidence: { error: 'Unexpected token }' } });
  const result = doctor([finding], makeSnapshot());
  const entry = result.entries[0];
  assert.strictEqual(entry.finding.id, 'malformed-package-json');
  assert.strictEqual(entry.finding.category, 'configuration');
  assert.strictEqual(entry.finding.severity, 'error');
  assert.strictEqual(entry.finding.evidence.error, 'Unexpected token }');
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. doctor() — handles unknown and malformed findings
// ─────────────────────────────────────────────────────────────────────────────

test('Doctor - doctor() handles unknown finding id without crashing', () => {
  const finding = makeFinding({ id: 'completely-unknown-xyz', title: 'Unknown thing' });
  const result = doctor([finding], makeSnapshot());
  assert.strictEqual(result.entries.length, 1);
  const entry = result.entries[0];
  assert.ok(typeof entry.diagnosis.why === 'string');
  assert.ok(typeof entry.recommendation === 'string');
});

test('Doctor - doctor() handles malformed (non-object) finding without crashing', () => {
  // A primitive in the findings array
  const result = doctor([null], makeSnapshot());
  assert.strictEqual(result.entries.length, 1);
  assert.ok(typeof result.entries[0].diagnosis.why === 'string');
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. formatResult — output content
// ─────────────────────────────────────────────────────────────────────────────

test('Formatter - formatResult with zero findings outputs success message', () => {
  const result = doctor([], makeSnapshot());
  const output = formatResult(result);
  assert.ok(output.includes('RepoDoctor'));
  assert.ok(output.includes('No issues detected'));
  assert.ok(output.includes('healthy'));
});

test('Formatter - formatResult with findings outputs finding sections', () => {
  const findings = [makeFinding()];
  const result = doctor(findings, makeSnapshot());
  const output = formatResult(result);
  assert.ok(output.includes('[WARNING]'));
  assert.ok(output.includes('Why:'));
  assert.ok(output.includes('Recommendation:'));
  assert.ok(output.includes('1 finding'));
});

test('Formatter - formatResult includes repository name', () => {
  const result = doctor([], makeSnapshot({ project: { name: 'my-cool-project', path: '/' } }));
  const output = formatResult(result);
  assert.ok(output.includes('my-cool-project'));
});

test('Formatter - formatResult severity ordering: error before warning before info', () => {
  const findings = [
    makeFinding({ id: 'uncommitted-changes', severity: 'info', title: 'Info Finding' }),
    makeFinding({ id: 'missing-readme', severity: 'warning', title: 'Warning Finding' }),
    makeFinding({ id: 'duplicate-dependency', severity: 'error', title: 'Error Finding', evidence: { dependency: 'x', dependenciesVersion: '1', devDependenciesVersion: '1' } })
  ];
  const result = doctor(findings, makeSnapshot());
  const output = formatResult(result);
  const errPos = output.indexOf('[ERROR]');
  const warnPos = output.indexOf('[WARNING]');
  const infoPos = output.indexOf('[INFO]');
  assert.ok(errPos < warnPos, 'ERROR should appear before WARNING');
  assert.ok(warnPos < infoPos, 'WARNING should appear before INFO');
});

test('Formatter - formatResult is deterministic (same input → same output)', () => {
  const findings = [
    makeFinding({ id: 'missing-readme', severity: 'warning' }),
    makeFinding({ id: 'missing-license', severity: 'warning', title: 'Missing LICENSE file' })
  ];
  const result1 = doctor(findings, makeSnapshot());
  const result2 = doctor(findings, makeSnapshot());
  assert.strictEqual(formatResult(result1), formatResult(result2));
});

test('Formatter - formatResult includes category label', () => {
  const findings = [makeFinding({ category: 'documentation' })];
  const result = doctor(findings, makeSnapshot());
  const output = formatResult(result);
  assert.ok(output.includes('Category: documentation'));
});

test('Formatter - formatResult includes location when present', () => {
  const findings = [makeFinding({ location: { file: 'package.json', path: 'dependencies.lodash' } })];
  const result = doctor(findings, makeSnapshot());
  const output = formatResult(result);
  assert.ok(output.includes('Location: package.json'));
});

test('Formatter - formatResult with multiple findings shows correct count', () => {
  const findings = [
    makeFinding({ id: 'missing-readme' }),
    makeFinding({ id: 'missing-license', title: 'Missing LICENSE file' })
  ];
  const result = doctor(findings, makeSnapshot());
  const output = formatResult(result);
  assert.ok(output.includes('2 findings'));
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. formatJson — structured output
// ─────────────────────────────────────────────────────────────────────────────

test('Formatter - formatJson returns valid JSON string', () => {
  const result = doctor([makeFinding()], makeSnapshot());
  const json = formatJson(result);
  assert.strictEqual(typeof json, 'string');
  const parsed = JSON.parse(json);
  assert.ok(parsed);
  assert.strictEqual(typeof parsed.summary, 'object');
  assert.ok(Array.isArray(parsed.findings));
});

test('Formatter - formatJson is deterministic for same input', () => {
  const findings = [makeFinding()];
  const r1 = doctor(findings, makeSnapshot());
  const r2 = doctor(findings, makeSnapshot());
  assert.strictEqual(formatJson(r1), formatJson(r2));
});

// ─────────────────────────────────────────────────────────────────────────────
// 11. Read-only verification
// ─────────────────────────────────────────────────────────────────────────────

test('Doctor - doctor() does not mutate the original findings array', () => {
  const findings = [makeFinding()];
  const originalLength = findings.length;
  const originalId = findings[0].id;
  doctor(findings, makeSnapshot());
  assert.strictEqual(findings.length, originalLength);
  assert.strictEqual(findings[0].id, originalId);
});

test('Doctor - doctor() does not mutate the original snapshot', () => {
  const snapshot = makeSnapshot();
  const originalName = snapshot.project.name;
  doctor([makeFinding()], snapshot);
  assert.strictEqual(snapshot.project.name, originalName);
});

// ─────────────────────────────────────────────────────────────────────────────
// 12. Phase 7 UX/UI formatting tests
// ─────────────────────────────────────────────────────────────────────────────

test('Formatter - formatResult supports forced color option', () => {
  const findings = [makeFinding({ id: 'missing-readme', severity: 'warning' })];
  const result = doctor(findings, makeSnapshot());
  
  const outputColor = formatResult(result, { color: true });
  const outputNoColor = formatResult(result, { color: false });
  
  // Color output should contain ANSI escape codes
  assert.ok(outputColor.includes('\x1b[30;43;1m'));
  assert.ok(outputColor.includes('\x1b[0m'));
  
  // No-color output should not contain ANSI escape codes
  assert.ok(!outputNoColor.includes('\x1b[30;43;1m'));
});

test('Formatter - formatResult renders category summary table', () => {
  const findings = [
    makeFinding({ id: 'missing-readme', category: 'documentation', severity: 'warning' }),
    makeFinding({ id: 'missing-license', category: 'documentation', severity: 'warning' }),
    makeFinding({ id: 'uncommitted-changes', category: 'git', severity: 'info' })
  ];
  const result = doctor(findings, makeSnapshot());
  const output = formatResult(result, { color: false });
  
  assert.ok(output.includes('Categories Summary'));
  assert.ok(output.includes('documentation'));
  assert.ok(output.includes('git'));
});

test('Formatter - formatResult renders duplicate dependency table', () => {
  const findings = [
    makeFinding({
      id: 'duplicate-dependency',
      category: 'dependencies',
      severity: 'error',
      evidence: {
        dependency: 'lodash',
        dependenciesVersion: '^4.17.21',
        devDependenciesVersion: '^4.17.21'
      }
    })
  ];
  const result = doctor(findings, makeSnapshot());
  const output = formatResult(result, { color: false });
  
  assert.ok(output.includes('dependencies'));
  assert.ok(output.includes('devDependencies'));
  assert.ok(output.includes('^4.17.21'));
});

test('Formatter - formatResult renders priority actions list', () => {
  const findings = [
    makeFinding({ id: 'missing-readme', severity: 'warning', title: 'Missing README' }),
    makeFinding({ id: 'uncommitted-changes', severity: 'info', title: 'Uncommitted changes' })
  ];
  const result = doctor(findings, makeSnapshot());
  const output = formatResult(result, { color: false });
  
  assert.ok(output.includes('Priority Actions:'));
  assert.ok(output.includes('1. '));
  assert.ok(output.includes('2. '));
});
