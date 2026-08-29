import test from 'node:test';
import assert from 'node:assert';
import { analyze } from '../../src/analyzer/index.js';
import { doctor } from '../../src/doctor/index.js';
import { Categories, Severities } from '../../src/analyzer/findings.js';

test('Analyzer Safety - scan-errors triggers structure warning finding', () => {
  const snapshot = {
    files: {
      totalCount: 1,
      totalDirectoryCount: 1,
      totalSizeOctets: 100,
      hasPackageJson: false,
      configs: [],
      entries: [
        { path: 'a.txt', type: 'file', size: 100 }
      ],
      scanErrors: [
        { type: 'access-denied', path: 'secret-dir', code: 'EACCES', message: 'Permission denied' }
      ]
    }
  };

  const findings = analyze(snapshot);
  const scanErrFinding = findings.find(f => f.id === 'scan-errors');
  assert.ok(scanErrFinding);
  assert.strictEqual(scanErrFinding.category, Categories.STRUCTURE);
  assert.strictEqual(scanErrFinding.severity, Severities.WARNING);
  assert.strictEqual(scanErrFinding.evidence.count, 1);
  assert.deepStrictEqual(scanErrFinding.evidence.paths, ['secret-dir']);
});

test('Analyzer Safety - doctor diagnostic and recommendations for scan-errors', () => {
  const findings = [
    {
      id: 'scan-errors',
      category: Categories.STRUCTURE,
      severity: Severities.WARNING,
      title: 'Filesystem access errors during scan',
      description: '1 path(s) could not be read.',
      evidence: { count: 1, paths: ['secret-dir'] },
      location: null
    }
  ];

  const result = doctor(findings);
  const entry = result.entries.find(e => e.finding.id === 'scan-errors');
  assert.ok(entry);
  
  assert.ok(entry.diagnosis.problem.includes('could not be read'));
  assert.ok(entry.diagnosis.why.includes('Inaccessible paths'));
  assert.ok(entry.diagnosis.evidence.includes('secret-dir'));

  assert.ok(entry.recommendation.includes('Check the read permissions'));
  assert.ok(entry.recommendation.includes('secret-dir'));
});
