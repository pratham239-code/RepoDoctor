import test from 'node:test';
import assert from 'node:assert';
import { analyze } from '../../src/analyzer/index.js';
import { Severities, Categories } from '../../src/analyzer/findings.js';

// Helper to create a base mock snapshot with everything clean
function createBaseSnapshot() {
  return {
    timestamp: '2026-08-29T12:00:00.000Z',
    scannerVersion: '1.0.0',
    project: {
      name: 'mock-project',
      version: '1.0.0',
      type: 'module',
      path: '/mock/path'
    },
    git: {
      isRepo: true,
      currentBranch: 'main',
      latestCommit: {
        hash: 'abc12345',
        author: 'Developer',
        date: '2026-08-29T12:00:00.000Z',
        message: 'Initial commit'
      },
      hasUncommittedChanges: false
    },
    files: {
      totalCount: 3,
      totalDirectoryCount: 1,
      totalSizeOctets: 1500,
      hasPackageJson: true,
      hasLicense: true,
      hasReadme: true,
      hasGitignore: true,
      configs: ['README.md', 'LICENSE', '.gitignore', 'package.json'],
      entries: [
        { path: 'package.json', type: 'file', size: 100, extension: '.json' },
        { path: 'index.js', type: 'file', size: 400, extension: '.js' },
        { path: 'README.md', type: 'file', size: 500, extension: '.md' },
        { path: 'LICENSE', type: 'file', size: 500, extension: null }
      ]
    },
    dependencies: {
      dependencies: { lodash: '^4.17.21' },
      devDependencies: { eslint: '^8.0.0' },
      peerDependencies: {},
      optionalDependencies: {}
    }
  };
}

// 1. README present
test('Analyzer - README present yields no README finding', () => {
  const snapshot = createBaseSnapshot();
  const findings = analyze(snapshot);
  const readmeFinding = findings.find(f => f.id === 'missing-readme');
  assert.strictEqual(readmeFinding, undefined);
});

// 2. README missing
test('Analyzer - README missing yields missing-readme finding', () => {
  const snapshot = createBaseSnapshot();
  snapshot.files.hasReadme = false;
  const findings = analyze(snapshot);
  const readmeFinding = findings.find(f => f.id === 'missing-readme');
  assert.ok(readmeFinding);
  assert.strictEqual(readmeFinding.category, Categories.DOCUMENTATION);
  assert.strictEqual(readmeFinding.severity, Severities.WARNING);
  assert.strictEqual(readmeFinding.title, 'Missing README file');
  assert.strictEqual(readmeFinding.location, null);
  assert.deepStrictEqual(readmeFinding.evidence, { readmePresent: false });
});

// 3. LICENSE present
test('Analyzer - LICENSE present yields no LICENSE finding', () => {
  const snapshot = createBaseSnapshot();
  const findings = analyze(snapshot);
  const licenseFinding = findings.find(f => f.id === 'missing-license');
  assert.strictEqual(licenseFinding, undefined);
});

// 4. LICENSE missing
test('Analyzer - LICENSE missing yields missing-license finding', () => {
  const snapshot = createBaseSnapshot();
  snapshot.files.hasLicense = false;
  const findings = analyze(snapshot);
  const licenseFinding = findings.find(f => f.id === 'missing-license');
  assert.ok(licenseFinding);
  assert.strictEqual(licenseFinding.category, Categories.DOCUMENTATION);
  assert.strictEqual(licenseFinding.severity, Severities.WARNING);
  assert.strictEqual(licenseFinding.title, 'Missing LICENSE file');
  assert.strictEqual(licenseFinding.location, null);
  assert.deepStrictEqual(licenseFinding.evidence, { licensePresent: false });
});

// 5. .gitignore behavior
test('Analyzer - .gitignore behavior in Git vs non-Git repository', () => {
  // Case A: Git repo, gitignore present -> no finding
  const snapshotA = createBaseSnapshot();
  const findingsA = analyze(snapshotA);
  assert.strictEqual(findingsA.find(f => f.id === 'missing-gitignore'), undefined);

  // Case B: Git repo, gitignore missing -> warning finding
  const snapshotB = createBaseSnapshot();
  snapshotB.files.hasGitignore = false;
  const findingsB = analyze(snapshotB);
  const gitignoreFinding = findingsB.find(f => f.id === 'missing-gitignore');
  assert.ok(gitignoreFinding);
  assert.strictEqual(gitignoreFinding.category, Categories.GIT);
  assert.strictEqual(gitignoreFinding.severity, Severities.WARNING);
  assert.deepStrictEqual(gitignoreFinding.evidence, { isRepo: true, gitignorePresent: false });

  // Case C: Non-Git repo, gitignore missing -> no finding
  const snapshotC = createBaseSnapshot();
  snapshotC.git.isRepo = false;
  snapshotC.files.hasGitignore = false;
  const findingsC = analyze(snapshotC);
  assert.strictEqual(findingsC.find(f => f.id === 'missing-gitignore'), undefined);
});

// 6. Git facts (uncommitted changes)
test('Analyzer - Git facts (uncommitted changes)', () => {
  // Case A: Git repo, no changes -> no finding
  const snapshotA = createBaseSnapshot();
  const findingsA = analyze(snapshotA);
  assert.strictEqual(findingsA.find(f => f.id === 'uncommitted-changes'), undefined);

  // Case B: Git repo, has uncommitted changes -> info finding
  const snapshotB = createBaseSnapshot();
  snapshotB.git.hasUncommittedChanges = true;
  const findingsB = analyze(snapshotB);
  const changeFinding = findingsB.find(f => f.id === 'uncommitted-changes');
  assert.ok(changeFinding);
  assert.strictEqual(changeFinding.category, Categories.GIT);
  assert.strictEqual(changeFinding.severity, Severities.INFO);
  assert.deepStrictEqual(changeFinding.evidence, { hasUncommittedChanges: true });

  // Case C: Non-Git repo, hasUncommittedChanges is true/ignored -> no finding
  const snapshotC = createBaseSnapshot();
  snapshotC.git.isRepo = false;
  snapshotC.git.hasUncommittedChanges = true;
  const findingsC = analyze(snapshotC);
  assert.strictEqual(findingsC.find(f => f.id === 'uncommitted-changes'), undefined);
});

// 7. Dependency facts (duplicate declarations)
test('Analyzer - Dependency declaration inconsistencies', () => {
  // Case A: Duplicate between dependencies and devDependencies
  const snapshotA = createBaseSnapshot();
  snapshotA.dependencies.dependencies.lodash = '^4.17.21';
  snapshotA.dependencies.devDependencies.lodash = '^4.17.21';
  const findingsA = analyze(snapshotA);
  const dupDepFinding = findingsA.find(f => f.id === 'duplicate-dependency');
  assert.ok(dupDepFinding);
  assert.strictEqual(dupDepFinding.category, Categories.DEPENDENCIES);
  assert.strictEqual(dupDepFinding.severity, Severities.ERROR);
  assert.deepStrictEqual(dupDepFinding.location, { file: 'package.json', path: 'dependencies.lodash' });
  assert.strictEqual(dupDepFinding.evidence.dependency, 'lodash');

  // Case B: Duplicate between dependencies and peerDependencies
  const snapshotB = createBaseSnapshot();
  snapshotB.dependencies.dependencies.react = '^18.0.0';
  snapshotB.dependencies.peerDependencies.react = '^18.0.0';
  const findingsB = analyze(snapshotB);
  const dupPeerFinding = findingsB.find(f => f.id === 'duplicate-peer-dependency');
  assert.ok(dupPeerFinding);
  assert.strictEqual(dupPeerFinding.category, Categories.DEPENDENCIES);
  assert.strictEqual(dupPeerFinding.severity, Severities.WARNING);
  assert.deepStrictEqual(dupPeerFinding.location, { file: 'package.json', path: 'peerDependencies.react' });
  assert.strictEqual(dupPeerFinding.evidence.dependency, 'react');
});

// 8. Malformed package.json state from scanner
test('Analyzer - Malformed package.json parsing error forwarding', () => {
  const snapshot = createBaseSnapshot();
  snapshot.dependencies.error = 'Failed to parse package.json: Unexpected token }';
  // If there's an error parsing package.json, the scanner leaves dependencies/devDependencies empty
  snapshot.dependencies.dependencies = {};
  snapshot.dependencies.devDependencies = {};
  const findings = analyze(snapshot);
  const malformedFinding = findings.find(f => f.id === 'malformed-package-json');
  assert.ok(malformedFinding);
  assert.strictEqual(malformedFinding.category, Categories.CONFIGURATION);
  assert.strictEqual(malformedFinding.severity, Severities.ERROR);
  assert.deepStrictEqual(malformedFinding.location, { file: 'package.json' });
  assert.ok(malformedFinding.evidence.error.includes('Unexpected token }'));
});

// 9. Severity assignment & Finding structure
test('Analyzer - Verification of Finding model structure', () => {
  const snapshot = createBaseSnapshot();
  snapshot.files.hasReadme = false;
  const findings = analyze(snapshot);
  const finding = findings[0];

  assert.ok(finding);
  assert.strictEqual(typeof finding.id, 'string');
  assert.strictEqual(typeof finding.category, 'string');
  assert.strictEqual(typeof finding.severity, 'string');
  assert.strictEqual(typeof finding.title, 'string');
  assert.strictEqual(typeof finding.description, 'string');
  assert.strictEqual(typeof finding.evidence, 'object');
  assert.ok(finding.hasOwnProperty('location'));
});

// 10. Multiple findings
test('Analyzer - Multiple concurrent findings', () => {
  const snapshot = createBaseSnapshot();
  snapshot.files.hasReadme = false;
  snapshot.files.hasLicense = false;
  snapshot.git.hasUncommittedChanges = true;
  const findings = analyze(snapshot);
  
  const ids = findings.map(f => f.id);
  assert.ok(ids.includes('missing-readme'));
  assert.ok(ids.includes('missing-license'));
  assert.ok(ids.includes('uncommitted-changes'));
  assert.strictEqual(findings.length, 3);
});

// 11. No findings
test('Analyzer - Completely clean snapshot yields zero findings', () => {
  const snapshot = createBaseSnapshot();
  const findings = analyze(snapshot);
  assert.strictEqual(findings.length, 0);
});

// 12. Deterministic output
test('Analyzer - Analysis is deterministic and repeatable', () => {
  const snapshot = createBaseSnapshot();
  snapshot.files.hasReadme = false;
  snapshot.files.hasLicense = false;
  
  const run1 = analyze(snapshot);
  const run2 = analyze(snapshot);
  
  assert.deepStrictEqual(run1, run2);
});

// 13. Empty repository snapshot
test('Analyzer - Empty repository snapshot behavior', () => {
  const snapshot = {
    timestamp: '2026-08-29T12:00:00.000Z',
    scannerVersion: '1.0.0',
    project: { name: 'empty', version: '0.0.0', type: 'commonjs', path: '/mock' },
    git: { isRepo: false, currentBranch: null, latestCommit: null, hasUncommittedChanges: null },
    files: {
      totalCount: 0,
      totalDirectoryCount: 0,
      totalSizeOctets: 0,
      hasPackageJson: false,
      hasLicense: false,
      hasReadme: false,
      hasGitignore: false,
      configs: [],
      entries: []
    },
    dependencies: { dependencies: {}, devDependencies: {}, peerDependencies: {}, optionalDependencies: {} }
  };

  const findings = analyze(snapshot);
  assert.strictEqual(findings.length, 1);
  assert.strictEqual(findings[0].id, 'empty-repository');
  assert.strictEqual(findings[0].category, Categories.STRUCTURE);
  assert.strictEqual(findings[0].severity, Severities.INFO);
});

// 14. Missing source files in Node project
test('Analyzer - Missing source files in Node.js project', () => {
  // Case A: Node project (has package.json), but no JS/TS files in entries -> warning
  const snapshotA = createBaseSnapshot();
  snapshotA.files.entries = [
    { path: 'package.json', type: 'file', size: 100, extension: '.json' },
    { path: 'README.md', type: 'file', size: 500, extension: '.md' }
  ];
  const findingsA = analyze(snapshotA);
  const missingSourceFinding = findingsA.find(f => f.id === 'missing-source-files');
  assert.ok(missingSourceFinding);
  assert.strictEqual(missingSourceFinding.category, Categories.STRUCTURE);
  assert.strictEqual(missingSourceFinding.severity, Severities.WARNING);

  // Case B: Node project, contains JS/TS file -> no finding
  const snapshotB = createBaseSnapshot();
  const findingsB = analyze(snapshotB);
  assert.strictEqual(findingsB.find(f => f.id === 'missing-source-files'), undefined);
});

// 15. Incomplete / empty snapshot handling where relevant
test('Analyzer - Graceful handling of null/empty snapshots', () => {
  assert.deepStrictEqual(analyze(null), []);
  assert.deepStrictEqual(analyze(undefined), []);
  assert.deepStrictEqual(analyze({}), []);
});
