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
