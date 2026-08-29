import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

/**
 * Gathers optional local Git status and active revision facts.
 * Safe from command execution failures or missing Git CLI dependencies.
 * 
 * @param {string} repoPath Absolute path to the repository directory
 * @returns {object} Git metadata facts (falls back to default structure on failure)
 */
export function getGitFacts(repoPath) {
  const gitFacts = {
    isRepo: false,
    currentBranch: null,
    latestCommit: null,
    hasUncommittedChanges: null
  };

  // Determine if directories contain a local .git configuration folder
  const dotGitPath = path.join(repoPath, '.git');
  try {
    const isGitFolder = fs.existsSync(dotGitPath);
    if (!isGitFolder) {
      return gitFacts;
    }
    gitFacts.isRepo = true;
  } catch {
    return gitFacts;
  }

  // Safe wrapper for local git command invocations using execFileSync
  function runGitCmd(args) {
    try {
      return execFileSync('git', args, {
        cwd: repoPath,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 5000 // 5 seconds operation timeout limits lockups
      }).trim();
    } catch {
      return null;
    }
  }

  // Retrieve current active branch name
  const branchOutput = runGitCmd(['rev-parse', '--abbrev-ref', 'HEAD']);
  if (branchOutput) {
    gitFacts.currentBranch = branchOutput;
  }

  // Retrieve last commit metadata: hash, author, ISO date, commit subject message
  const commitOutput = runGitCmd(['log', '-1', '--format=%H%n%an%n%aI%n%s']);
  if (commitOutput) {
    const parts = commitOutput.split('\n');
    if (parts.length >= 4) {
      gitFacts.latestCommit = {
        hash: parts[0] || null,
        author: parts[1] || null,
        date: parts[2] || null,
        message: parts.slice(3).join('\n') || null
      };
    }
  }

  // Check if uncommitted file updates exist in workspace
  const statusOutput = runGitCmd(['status', '--porcelain']);
  if (statusOutput !== null) {
    gitFacts.hasUncommittedChanges = statusOutput.length > 0;
  }

  return gitFacts;
}
