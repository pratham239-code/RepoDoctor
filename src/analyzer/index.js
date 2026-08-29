import { createFinding, Severities, Categories } from './findings.js';

/**
 * Consumes a RepositorySnapshot and applies deterministic rules to detect issues.
 * Returns an array of Finding objects.
 *
 * @param {object} snapshot The RepositorySnapshot object returned by the scanner
 * @returns {object[]} Array of structured Finding objects
 */
export function analyze(snapshot) {
  const findings = [];

  // Guard against missing or null snapshot, or missing files metadata
  if (!snapshot || !snapshot.files) {
    return findings;
  }

  const files = snapshot.files;
  const git = snapshot.git || {};
  const deps = snapshot.dependencies || {};

  // ----------------------------------------------------
  // 1. Structure: Empty Repository Check
  // ----------------------------------------------------
  const totalCount = typeof files.totalCount === 'number' ? files.totalCount : 0;
  const totalDirectoryCount = typeof files.totalDirectoryCount === 'number' ? files.totalDirectoryCount : 0;
  if (totalCount === 0 && totalDirectoryCount === 0) {
    findings.push(createFinding({
      id: 'empty-repository',
      category: Categories.STRUCTURE,
      severity: Severities.INFO,
      title: 'Empty repository',
      description: 'The repository contains no files and no subdirectories.',
      evidence: { totalCount, totalDirectoryCount },
      location: null
    }));
    // If the repository is completely empty, we skip downstream checks since they will only trigger redundant errors
    return findings;
  }

  // ----------------------------------------------------
  // 2. Documentation: README & LICENSE Checks
  // ----------------------------------------------------
  if (files.hasReadme === false) {
    findings.push(createFinding({
      id: 'missing-readme',
      category: Categories.DOCUMENTATION,
      severity: Severities.WARNING,
      title: 'Missing README file',
      description: 'No README.md file was detected at the root of the repository.',
      evidence: { readmePresent: false },
      location: null
    }));
  }

  if (files.hasLicense === false) {
    findings.push(createFinding({
      id: 'missing-license',
      category: Categories.DOCUMENTATION,
      severity: Severities.WARNING,
      title: 'Missing LICENSE file',
      description: 'No LICENSE file was detected at the root of the repository.',
      evidence: { licensePresent: false },
      location: null
    }));
  }

  // ----------------------------------------------------
  // 3. Git: .gitignore & Uncommitted Changes Checks
  // ----------------------------------------------------
  if (git.isRepo === true) {
    if (files.hasGitignore === false) {
      findings.push(createFinding({
        id: 'missing-gitignore',
        category: Categories.GIT,
        severity: Severities.WARNING,
        title: 'Missing .gitignore file',
        description: 'The directory is a Git repository but does not contain a .gitignore file at the root.',
        evidence: { isRepo: true, gitignorePresent: false },
        location: null
      }));
    }

    if (git.hasUncommittedChanges === true) {
      findings.push(createFinding({
        id: 'uncommitted-changes',
        category: Categories.GIT,
        severity: Severities.INFO,
        title: 'Uncommitted changes in repository',
        description: 'There are uncommitted file updates or untracked changes in the Git workspace.',
        evidence: { hasUncommittedChanges: true },
        location: null
      }));
    }
  }

  // ----------------------------------------------------
  // 4. Configuration: Malformed package.json Check
  // ----------------------------------------------------
  if (files.hasPackageJson === true && deps.error) {
    findings.push(createFinding({
      id: 'malformed-package-json',
      category: Categories.CONFIGURATION,
      severity: Severities.ERROR,
      title: 'Malformed package.json',
      description: `The package.json file is present but could not be parsed: ${deps.error}`,
      evidence: { error: deps.error },
      location: { file: 'package.json' }
    }));
  }

  // ----------------------------------------------------
  // 5. Structure: Missing Source Files in Node.js Project
  // ----------------------------------------------------
  if (files.hasPackageJson === true && !deps.error && Array.isArray(files.entries)) {
    const jsTsExtensions = ['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx'];
    const hasJsTsSource = files.entries.some(entry => {
      if (entry.type !== 'file' || !entry.extension) return false;
      const ext = entry.extension.toLowerCase();
      // Ensure we don't count package.json or other configs as source files
      if (entry.path === 'package.json') return false;
      return jsTsExtensions.includes(ext);
    });

    if (!hasJsTsSource) {
      findings.push(createFinding({
        id: 'missing-source-files',
        category: Categories.STRUCTURE,
        severity: Severities.WARNING,
        title: 'Missing source files in Node.js project',
        description: 'A package.json file exists, but no JavaScript or TypeScript source files were found.',
        evidence: { hasPackageJson: true, sourceFilesCount: 0 },
        location: null
      }));
    }
  }

  // ----------------------------------------------------
  // 6. Dependencies: Duplicate Declaration Checks
  // ----------------------------------------------------
  if (!deps.error) {
    const dependenciesKeys = deps.dependencies ? Object.keys(deps.dependencies) : [];
    const devDependenciesKeys = deps.devDependencies ? Object.keys(deps.devDependencies) : [];
    const peerDependenciesKeys = deps.peerDependencies ? Object.keys(deps.peerDependencies) : [];

    // Check duplicates between dependencies and devDependencies
    for (const dep of dependenciesKeys) {
      if (devDependenciesKeys.includes(dep)) {
        findings.push(createFinding({
          id: 'duplicate-dependency',
          category: Categories.DEPENDENCIES,
          severity: Severities.ERROR,
          title: 'Duplicate dependency declaration',
          description: `Dependency "${dep}" is declared in both dependencies and devDependencies in package.json.`,
          evidence: {
            dependency: dep,
            dependenciesVersion: deps.dependencies[dep],
            devDependenciesVersion: deps.devDependencies[dep]
          },
          location: { file: 'package.json', path: `dependencies.${dep}` }
        }));
      }
    }

    // Check duplicates between dependencies and peerDependencies
    for (const dep of dependenciesKeys) {
      if (peerDependenciesKeys.includes(dep)) {
        findings.push(createFinding({
          id: 'duplicate-peer-dependency',
          category: Categories.DEPENDENCIES,
          severity: Severities.WARNING,
          title: 'Duplicate dependency in peerDependencies',
          description: `Dependency "${dep}" is declared in both dependencies and peerDependencies in package.json.`,
          evidence: {
            dependency: dep,
            dependenciesVersion: deps.dependencies[dep],
            peerDependenciesVersion: deps.peerDependencies[dep]
          },
          location: { file: 'package.json', path: `peerDependencies.${dep}` }
        }));
      }
    }
  }

  return findings;
}
