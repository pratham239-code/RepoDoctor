import fs from 'node:fs';
import path from 'node:path';
import { traverseRepo } from './fs_utils.js';
import { getGitFacts } from './git_utils.js';
import { CLIError } from '../cli/errors.js';
import { ExitCodes } from '../cli/exit_codes.js';

export const SCANNER_VERSION = '1.0.0';

/**
 * Runs a complete repository scan, collecting stats, configurations, and dependency facts.
 * 
 * @param {string} resolvedPath Absolute verified directory path to scan
 * @param {object} options CLI options (like verbose)
 * @returns {object} The complete RepositorySnapshot structure
 * @throws {CLIError} if path is not a directory or filesystem read permissions fail
 */
export function scanRepo(resolvedPath, options = {}) {
  // Validate path type
  let stat;
  try {
    stat = fs.statSync(resolvedPath);
  } catch (err) {
    throw new CLIError(`Failed to read path: ${err.message}`, ExitCodes.IO_ERROR);
  }

  if (!stat.isDirectory()) {
    throw new CLIError(`The specified path is a file, not a directory: ${resolvedPath}`, ExitCodes.IO_ERROR);
  }

  const timestamp = new Date().toISOString();

  // Execute filesystem traversal facts
  const fsFacts = traverseRepo(resolvedPath);

  // Extract optional Git metadata details
  const gitFacts = getGitFacts(resolvedPath);

  // Build baseline project metadata
  const project = {
    name: path.basename(resolvedPath),
    version: '0.0.0',
    type: 'commonjs',
    path: resolvedPath
  };

  // Build baseline dependencies metadata
  const dependencies = {
    dependencies: {},
    devDependencies: {},
    peerDependencies: {},
    optionalDependencies: {}
  };

  // Parse root package.json details safely if detected
  if (fsFacts.hasPackageJson) {
    const pkgPath = path.join(resolvedPath, 'package.json');
    try {
      const rawPkg = fs.readFileSync(pkgPath, 'utf8');
      const pkgData = JSON.parse(rawPkg);

      if (pkgData.name) project.name = String(pkgData.name);
      if (pkgData.version) project.version = String(pkgData.version);
      if (pkgData.type) project.type = String(pkgData.type);

      if (pkgData.dependencies && typeof pkgData.dependencies === 'object') {
        dependencies.dependencies = pkgData.dependencies;
      }
      if (pkgData.devDependencies && typeof pkgData.devDependencies === 'object') {
        dependencies.devDependencies = pkgData.devDependencies;
      }
      if (pkgData.peerDependencies && typeof pkgData.peerDependencies === 'object') {
        dependencies.peerDependencies = pkgData.peerDependencies;
      }
      if (pkgData.optionalDependencies && typeof pkgData.optionalDependencies === 'object') {
        dependencies.optionalDependencies = pkgData.optionalDependencies;
      }
    } catch (err) {
      // Record parsing mismatch fact natively for downstream analyzer to review
      dependencies.error = `Failed to parse package.json: ${err.message}`;
    }
  }

  // Combine components into RepositorySnapshot
  return {
    timestamp,
    scannerVersion: SCANNER_VERSION,
    project,
    git: gitFacts,
    files: {
      totalCount: fsFacts.totalCount,
      totalDirectoryCount: fsFacts.totalDirectoryCount,
      totalSizeOctets: fsFacts.totalSizeOctets,
      hasPackageJson: fsFacts.hasPackageJson,
      hasLicense: fsFacts.hasLicense,
      hasReadme: fsFacts.hasReadme,
      hasGitignore: fsFacts.hasGitignore,
      configs: fsFacts.configs,
      entries: fsFacts.entries
    },
    dependencies
  };
}
