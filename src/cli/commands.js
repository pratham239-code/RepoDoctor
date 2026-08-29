import fs from 'node:fs';
import path from 'node:path';
import { PathNotFoundError } from './errors.js';
import { ExitCodes } from './exit_codes.js';

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
    console.log(`[verbose] Target path resolved to: ${resolvedPath}`);
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
 * Handles the 'scan' command stub.
 */
function handleScan(resolvedPath, options) {
  console.log(`Routed to 'scan' command for path: ${resolvedPath}`);
  if (options.verbose) {
    console.log('[verbose] Scan mode running in verbose details.');
  }
  return ExitCodes.SUCCESS;
}

/**
 * Handles the 'check' command stub.
 */
function handleCheck(resolvedPath, options) {
  console.log(`Routed to 'check' command for path: ${resolvedPath}`);
  if (options.verbose) {
    console.log('[verbose] Check mode running in verbose details.');
  }
  return ExitCodes.SUCCESS;
}

/**
 * Handles the 'doctor' command stub.
 */
function handleDoctor(resolvedPath, options) {
  console.log(`Routed to 'doctor' command for path: ${resolvedPath}`);
  if (options.verbose) {
    console.log('[verbose] Doctor mode running in verbose details.');
  }
  return ExitCodes.SUCCESS;
}

/**
 * Handles default invocation (no command specified, e.g. `repodoctor .`).
 */
function handleDefault(resolvedPath, options) {
  console.log(`Routed to default command for path: ${resolvedPath}`);
  if (options.verbose) {
    console.log('[verbose] Default mode running in verbose details.');
  }
  return ExitCodes.SUCCESS;
}
