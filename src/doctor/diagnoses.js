/**
 * Deterministic mapping rules for each finding type.
 */
export const diagnosisRules = {
  'scan-errors': (finding) => ({
    problem: 'Some files or directories could not be read during the repository scan.',
    why: 'Inaccessible paths (due to permissions, lockups, or broken links) prevent RepoDoctor from analyzing the complete state of the repository.',
    evidence: `${finding.evidence?.count ?? 0} path(s) failed access checks: ${(finding.evidence?.paths || []).join(', ')}`
  }),
  'empty-repository': (finding) => ({
    problem: 'The repository contains no files and no subdirectories.',
    why: 'An empty repository does not contain any code, configuration, or documentation to run, build, or understand.',
    evidence: `totalCount: ${finding.evidence?.totalCount ?? 0}, totalDirectoryCount: ${finding.evidence?.totalDirectoryCount ?? 0}.`
  }),
  'missing-readme': (finding) => ({
    problem: 'No README.md file was detected at the root of the repository.',
    why: 'A README helps developers understand how to install, use and contribute to the project.',
    evidence: 'readmePresent is false.'
  }),
  'missing-license': (finding) => ({
    problem: 'No LICENSE file was detected at the root of the repository.',
    why: 'A LICENSE file defines the legal terms under which others can use, modify, and distribute the repository code.',
    evidence: 'licensePresent is false.'
  }),
  'missing-gitignore': (finding) => ({
    problem: 'The directory is a Git repository but does not contain a .gitignore file at the root.',
    why: 'A .gitignore file prevents untracked files like build artifacts, sensitive keys, or dependencies (e.g. node_modules) from being committed to Git.',
    evidence: 'gitignorePresent is false.'
  }),
  'uncommitted-changes': (finding) => ({
    problem: 'There are uncommitted changes or untracked files in the Git workspace.',
    why: 'Uncommitted files leave the repository in a transient state, making it hard to track exact code versions or clean builds.',
    evidence: 'hasUncommittedChanges is true.'
  }),
  'malformed-package-json': (finding) => ({
    problem: 'The package.json file is present but could not be parsed.',
    why: 'package.json defines the project metadata, scripts, and dependencies. If it contains syntax errors, Node.js and package tools cannot function.',
    evidence: finding.evidence?.error || 'Failed to parse package.json.'
  }),
  'missing-source-files': (finding) => ({
    problem: 'A package.json file exists, but no JavaScript or TypeScript source files were found.',
    why: 'A Node.js project requires source files to verify functionality or execute code.',
    evidence: `sourceFilesCount: ${finding.evidence?.sourceFilesCount ?? 0}.`
  }),
  'duplicate-dependency': (finding) => {
    const dep = finding.evidence?.dependency || 'unknown';
    const depVer = finding.evidence?.dependenciesVersion || 'N/A';
    const devDepVer = finding.evidence?.devDependenciesVersion || 'N/A';
    return {
      problem: `Dependency "${dep}" is declared in both dependencies and devDependencies in package.json.`,
      why: 'Duplicate declarations in dependencies and devDependencies lead to conflicts, installation redundancy, or package size bloating.',
      evidence: `"${dep}" in dependencies is ${depVer}; devDependencies is ${devDepVer}.`
    };
  },
  'duplicate-peer-dependency': (finding) => {
    const dep = finding.evidence?.dependency || 'unknown';
    const depVer = finding.evidence?.dependenciesVersion || 'N/A';
    const peerDepVer = finding.evidence?.peerDependenciesVersion || 'N/A';
    return {
      problem: `Dependency "${dep}" is declared in both dependencies and peerDependencies in package.json.`,
      why: 'This is redundant and can lead to runtime package duplication or dependency conflicts in consumer environments.',
      evidence: `"${dep}" in dependencies is ${depVer}; peerDependencies is ${peerDepVer}.`
    };
  }
};

/**
 * Returns the deterministic diagnosis for a given finding.
 * Handles unknown finding IDs gracefully.
 *
 * @param {object} finding The Finding object
 * @returns {{ problem: string, why: string, evidence: string }} Diagnosis structure
 */
export function getDiagnosis(finding) {
  if (!finding || typeof finding.id !== 'string') {
    return {
      problem: 'Malformed finding encountered.',
      why: 'This finding requires additional analysis.',
      evidence: 'No details available.'
    };
  }

  const rule = diagnosisRules[finding.id];
  if (rule) {
    return rule(finding);
  }

  return {
    problem: `Unknown finding: ${finding.id}.`,
    why: 'This finding requires additional analysis.',
    evidence: finding.description || 'No detailed evidence provided.'
  };
}
