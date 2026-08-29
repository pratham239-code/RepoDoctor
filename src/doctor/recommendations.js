/**
 * Deterministic recommendation rules for each supported finding type.
 * Each rule takes the finding and returns an action string.
 */
const recommendationRules = {
  'scan-errors': (finding) => {
    const errorPaths = finding.evidence?.paths || [];
    const pathsStr = errorPaths.length > 0 ? ` (such as: ${errorPaths.join(', ')})` : '';
    return 'Check the read permissions and integrity of the inaccessible paths' + pathsStr + '. ' +
           'Ensure the user running RepoDoctor has sufficient read privileges across the target workspace.';
  },

  'empty-repository': () =>
    'Initialize the repository by adding at minimum a README.md describing the project purpose and setup, ' +
    'and a LICENSE file if applicable.',

  'missing-readme': () =>
    'Add a README.md to the root of the repository. It should include: project purpose, ' +
    'installation and setup instructions, usage examples, and contribution guidelines.',

  'missing-license': () =>
    'Add a LICENSE file to the root of the repository that specifies the terms under which ' +
    'others can use, modify, or distribute this project. Choose a license appropriate for your project ' +
    '(e.g. MIT, Apache-2.0, GPL-3.0) and include it as a LICENSE or LICENSE.md file.',

  'missing-gitignore': () =>
    'Add a .gitignore file to the root of the repository. Include patterns appropriate for the project\'s ' +
    'language and build tooling (e.g. node_modules/, dist/, .env, *.log). ' +
    'A .gitignore generator or template can help identify common entries.',

  'uncommitted-changes': () =>
    'Review the uncommitted changes in the working directory. ' +
    'Either commit relevant changes with a descriptive message (git add . && git commit -m "..."), ' +
    'or discard changes that are not intended (git checkout -- <file> or git clean -fd for untracked files).',

  'malformed-package-json': (finding) => {
    const errorHint = finding.evidence?.error
      ? ` The parser reported: ${finding.evidence.error}`
      : '';
    return `Fix the syntax errors in package.json so it is valid JSON.${errorHint} ` +
      'Use a JSON validator or run "node -e \\"require(\'./package.json\')\\"" to locate the issue.';
  },

  'missing-source-files': () =>
    'Create JavaScript or TypeScript source files in the project (e.g. index.js or src/index.js). ' +
    'If source files exist in a non-standard location, verify that entries are not being excluded by the scanner\'s ' +
    'exclusion policy (e.g. dist/, build/, node_modules/).',

  'duplicate-dependency': (finding) => {
    const dep = finding.evidence?.dependency || 'the dependency';
    return `Remove the duplicate declaration of "${dep}". ` +
      `If it is only needed in development (testing, linting, tooling), remove it from "dependencies" and keep it in "devDependencies". ` +
      `If it is required at runtime, remove it from "devDependencies" and keep it in "dependencies".`;
  },

  'duplicate-peer-dependency': (finding) => {
    const dep = finding.evidence?.dependency || 'the dependency';
    return `Remove the duplicate declaration of "${dep}". ` +
      `"peerDependencies" is intended for packages that the consumer must provide. ` +
      `If the project requires "${dep}" at runtime, keep it only in "dependencies" and remove it from "peerDependencies".`;
  }
};

/**
 * Returns a deterministic, actionable recommendation for a given finding.
 * Handles unknown finding IDs gracefully.
 *
 * @param {object} finding The Finding object from Phase 3
 * @returns {string} A human-readable recommendation string
 */
export function getRecommendation(finding) {
  if (!finding || typeof finding.id !== 'string') {
    return 'Review this finding manually. No specific recommendation could be determined.';
  }

  const rule = recommendationRules[finding.id];
  if (rule) {
    return rule(finding);
  }

  return `Review the finding "${finding.id}" manually. No specific recommendation is available for this finding type.`;
}
