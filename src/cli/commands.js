import fs from 'node:fs';
import path from 'node:path';
import { PathNotFoundError } from './errors.js';
import { ExitCodes } from './exit_codes.js';
import { scanRepo } from '../scanner/index.js';
import { analyze } from '../analyzer/index.js';
import { doctor } from '../doctor/index.js';
import { formatResult, formatJson } from '../doctor/formatter.js';

/**
 * Helper to print diagnostic message to stderr if JSON mode is active,
 * or stdout if it is not. This maintains clean stdout for JSON parsers.
 */
function logDiagnostic(msg, options = {}) {
  if (options.json) {
    console.error(msg);
  } else {
    console.log(msg);
  }
}

/**
 * Main command router/dispatcher. Resolves the target path, verifies its
 * existence on the filesystem, and dispatches to the appropriate command handler.
 * 
 * @param {string|null} command The command name (scan, check, doctor, or null)
 * @param {string|null} targetPath The path argument (or null)
 * @param {{ verbose: boolean }} options Parsed command options
 * @returns {number} The exit code to return
 * @throws {PathNotFoundError} If the resolved path does not exist
 */
export function routeCommand(command, targetPath, options) {
  // Resolve path (default to '.' if no path was passed)
  const rawPath = targetPath || '.';
  const resolvedPath = path.resolve(rawPath);
  
  if (options.verbose) {
    logDiagnostic(`[verbose] Target path resolved to: ${resolvedPath}`, options);
  }
  
  // Validate path existence
  if (!fs.existsSync(resolvedPath)) {
    throw new PathNotFoundError(rawPath);
  }
  
  // Dispatch based on command
  switch (command) {
    case 'scan':
      return handleScan(resolvedPath, options);
    case 'check':
      return handleCheck(resolvedPath, options);
    case 'doctor':
      return handleDoctor(resolvedPath, options);
    case 'stats':
      return handleQuickStats(resolvedPath, options);
    case 'git':
      return handleGitAudit(resolvedPath, options);
    case 'deps':
      return handleDependencyList(resolvedPath, options);
    case 'export':
      return handleExportReport(resolvedPath, options);
    case null:
      return handleDefault(resolvedPath, options);
    default:
      // Fallback for safety, though parser should filter out invalid commands
      throw new Error(`Unknown command: ${command}`);
  }
}

/**
 * Handles the 'scan' command.
 */
function handleScan(resolvedPath, options) {
  logDiagnostic(`Routed to 'scan' command for path: ${resolvedPath}`, options);
  if (options.verbose) {
    logDiagnostic('[verbose] Scan mode running in verbose details.', options);
  }

  const snapshot = scanRepo(resolvedPath, options);
  console.log(JSON.stringify(snapshot, null, 2));

  return ExitCodes.SUCCESS;
}

/**
 * Handles the 'check' command.
 */
function handleCheck(resolvedPath, options) {
  logDiagnostic(`Routed to 'check' command for path: ${resolvedPath}`, options);
  if (options.verbose) {
    logDiagnostic('[verbose] Check mode running in verbose details.', options);
  }

  const snapshot = scanRepo(resolvedPath, options);
  const findings = analyze(snapshot);

  console.log(JSON.stringify(findings, null, 2));

  return findings.length > 0 ? ExitCodes.FINDINGS : ExitCodes.SUCCESS;
}

/**
 * Handles the 'doctor' command.
 * Runs the full scan → analyze → doctor pipeline and outputs a formatted report.
 */
function handleDoctor(resolvedPath, options) {
  if (options.verbose) {
    logDiagnostic(`[verbose] Doctor mode running for path: ${resolvedPath}`, options);
  }

  const snapshot = scanRepo(resolvedPath, options);
  const findings = analyze(snapshot);
  const result = doctor(findings, snapshot);

  if (options.json) {
    console.log(formatJson(result));
  } else {
    console.log(formatResult(result, options));
  }

  return result.summary.total > 0 ? ExitCodes.FINDINGS : ExitCodes.SUCCESS;
}

/**
 * Handles default invocation (no command specified, e.g. `repodoctor .`).
 */
function handleDefault(resolvedPath, options) {
  logDiagnostic(`Routed to default command for path: ${resolvedPath}`, options);
  if (options.verbose) {
    logDiagnostic('[verbose] Default mode running in verbose details.', options);
  }

  const snapshot = scanRepo(resolvedPath, options);
  const findings = analyze(snapshot);
  const result = doctor(findings, snapshot);

  if (options.json) {
    console.log(formatJson(result));
  } else {
    console.log(formatResult(result, options));
  }

  return ExitCodes.SUCCESS;
}

/**
 * Formats bytes to human-readable size.
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Draws dependency tree lines.
 */
function renderDependencyTree(depsObj, prefix = '  ') {
  const entries = Object.entries(depsObj);
  if (entries.length === 0) {
    console.log(`${prefix}  (none)`);
    return;
  }
  entries.forEach(([name, version], index) => {
    const isLast = index === entries.length - 1;
    const branch = isLast ? '└── ' : '├── ';
    console.log(`${prefix}${branch}${name}@${version}`);
  });
}

/**
 * Handles the 'stats' command.
 */
function handleQuickStats(resolvedPath, options) {
  const snapshot = scanRepo(resolvedPath, options);
  const useColor = !options.noColor && !process.env.NO_COLOR && (process.env.FORCE_COLOR !== undefined || process.stdout.isTTY);
  
  const bold = (str) => useColor ? `\x1b[1m${str}\x1b[0m` : str;
  const cyan = (str) => useColor ? `\x1b[36m${str}\x1b[0m` : str;
  
  // Group extensions
  const extCounts = {};
  for (const entry of snapshot.files.entries) {
    if (entry.type === 'file') {
      const ext = entry.extension || '(no extension)';
      extCounts[ext] = (extCounts[ext] || 0) + 1;
    }
  }

  const sortedExts = Object.entries(extCounts).sort((a, b) => b[1] - a[1]);

  if (options.json) {
    console.log(JSON.stringify({
      repository: snapshot.project.name,
      totalFiles: snapshot.files.totalCount,
      totalDirectories: snapshot.files.totalDirectoryCount,
      totalSize: snapshot.files.totalSizeOctets,
      extensions: extCounts
    }, null, 2));
    return ExitCodes.SUCCESS;
  }

  console.log(bold('\nQuick Stats'));
  console.log(cyan('────────────────────────────────────────────────────────'));
  console.log(`Repository:      ${bold(snapshot.project.name)}`);
  console.log(`Total Files:     ${snapshot.files.totalCount}`);
  console.log(`Total Folders:   ${snapshot.files.totalDirectoryCount}`);
  console.log(`Total Size:      ${formatBytes(snapshot.files.totalSizeOctets)}`);
  console.log(cyan('\nFile Extension Breakdown:'));
  if (sortedExts.length === 0) {
    console.log('  No files found.');
  } else {
    for (const [ext, count] of sortedExts) {
      console.log(`  ${ext.padEnd(15)} : ${count} ${count === 1 ? 'file' : 'files'}`);
    }
  }
  console.log(cyan('────────────────────────────────────────────────────────'));
  
  return ExitCodes.SUCCESS;
}

/**
 * Handles the 'git' command.
 */
function handleGitAudit(resolvedPath, options) {
  const snapshot = scanRepo(resolvedPath, options);
  const git = snapshot.git || {};
  const useColor = !options.noColor && !process.env.NO_COLOR && (process.env.FORCE_COLOR !== undefined || process.stdout.isTTY);
  
  const bold = (str) => useColor ? `\x1b[1m${str}\x1b[0m` : str;
  const cyan = (str) => useColor ? `\x1b[36m${str}\x1b[0m` : str;
  const green = (str) => useColor ? `\x1b[32m${str}\x1b[0m` : str;
  const yellow = (str) => useColor ? `\x1b[33m${str}\x1b[0m` : str;
  const dim = (str) => useColor ? `\x1b[90m${str}\x1b[0m` : str;

  if (options.json) {
    console.log(JSON.stringify({
      repository: snapshot.project.name,
      git
    }, null, 2));
    return ExitCodes.SUCCESS;
  }

  console.log(bold('\nGit Audit'));
  console.log(cyan('────────────────────────────────────────────────────────'));
  console.log(`Repository:      ${bold(snapshot.project.name)}`);
  
  if (!git.isRepo) {
    console.log(`Git Status:      ${yellow('Not a Git repository (or Git is not installed)')}`);
    console.log(cyan('────────────────────────────────────────────────────────'));
    return ExitCodes.SUCCESS;
  }

  console.log(`Git Status:      ${green('✓ Active Git Repository')}`);
  console.log(`Active Branch:   ${bold(git.currentBranch || 'N/A')}`);
  console.log(`Uncommitted:     ${git.hasUncommittedChanges ? yellow('Yes (Local changes exist)') : green('No (Clean working tree)')}`);
  
  if (git.latestCommit) {
    console.log(bold('\nLatest Commit:'));
    console.log(`  Hash:          ${git.latestCommit.hash || 'N/A'}`);
    console.log(`  Author:        ${git.latestCommit.author || 'N/A'}`);
    console.log(`  Date:          ${git.latestCommit.date || 'N/A'}`);
    console.log(`  Message:       ${dim(git.latestCommit.message || 'N/A')}`);
  } else {
    console.log('\nLatest Commit:   No commits found.');
  }
  
  console.log(cyan('────────────────────────────────────────────────────────'));
  return ExitCodes.SUCCESS;
}

/**
 * Handles the 'deps' command.
 */
function handleDependencyList(resolvedPath, options) {
  const snapshot = scanRepo(resolvedPath, options);
  const deps = snapshot.dependencies || {};
  const useColor = !options.noColor && !process.env.NO_COLOR && (process.env.FORCE_COLOR !== undefined || process.stdout.isTTY);
  
  const bold = (str) => useColor ? `\x1b[1m${str}\x1b[0m` : str;
  const cyan = (str) => useColor ? `\x1b[36m${str}\x1b[0m` : str;
  const yellow = (str) => useColor ? `\x1b[33m${str}\x1b[0m` : str;

  if (options.json) {
    console.log(JSON.stringify({
      repository: snapshot.project.name,
      dependencies: deps
    }, null, 2));
    return ExitCodes.SUCCESS;
  }

  console.log(bold('\nDependency List'));
  console.log(cyan('────────────────────────────────────────────────────────'));
  console.log(`Repository:      ${bold(snapshot.project.name)}`);
  
  if (deps.error) {
    console.log(`Error:           ${yellow(deps.error)}`);
    console.log(cyan('────────────────────────────────────────────────────────'));
    return ExitCodes.SUCCESS;
  }

  if (!snapshot.files.hasPackageJson) {
    console.log(`Status:          ${yellow('No package.json file found (Not a Node.js project)')}`);
    console.log(cyan('────────────────────────────────────────────────────────'));
    return ExitCodes.SUCCESS;
  }

  console.log(bold('\nDependencies (Runtime):'));
  renderDependencyTree(deps.dependencies || {});

  console.log(bold('\nDevDependencies (Development):'));
  renderDependencyTree(deps.devDependencies || {});

  if (deps.peerDependencies && Object.keys(deps.peerDependencies).length > 0) {
    console.log(bold('\nPeerDependencies:'));
    renderDependencyTree(deps.peerDependencies);
  }

  if (deps.optionalDependencies && Object.keys(deps.optionalDependencies).length > 0) {
    console.log(bold('\nOptionalDependencies:'));
    renderDependencyTree(deps.optionalDependencies);
  }

  console.log(cyan('────────────────────────────────────────────────────────'));
  return ExitCodes.SUCCESS;
}

/**
 * Handles the 'export' command.
 */
function handleExportReport(resolvedPath, options) {
  const snapshot = scanRepo(resolvedPath, options);
  const findings = analyze(snapshot);
  const result = doctor(findings, snapshot);
  
  // Format report without ANSI escape sequences
  const reportText = formatResult(result, { ...options, noColor: true });
  const exportFile = path.join(resolvedPath, 'repodoctor-report.md');

  try {
    fs.writeFileSync(exportFile, reportText, 'utf8');
  } catch (err) {
    throw new Error(`Failed to write export file: ${err.message}`);
  }

  if (options.json) {
    console.log(JSON.stringify({
      success: true,
      exportedPath: exportFile
    }, null, 2));
  } else {
    console.log(`\n✓ Diagnostic health report successfully saved to:`);
    console.log(`  ${exportFile}`);
  }

  return ExitCodes.SUCCESS;
}
