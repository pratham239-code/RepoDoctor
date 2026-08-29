import { ExitCodes } from './exit_codes.js';

/**
 * Base class for all expected CLI errors in RepoDoctor.
 */
export class CLIError extends Error {
  constructor(message, exitCode = ExitCodes.INTERNAL_ERROR) {
    super(message);
    this.name = this.constructor.name;
    this.exitCode = exitCode;
    
    // Ensure correct prototype chain
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when there is an issue with CLI arguments, options, or usage.
 */
export class UsageError extends CLIError {
  constructor(message) {
    super(message, ExitCodes.USAGE_ERROR);
  }
}

/**
 * Thrown when a specified target path does not exist on the filesystem.
 */
export class PathNotFoundError extends CLIError {
  constructor(path) {
    super(`The specified path does not exist: ${path}`, ExitCodes.IO_ERROR);
    this.path = path;
  }
}

/**
 * Centrally handles any CLI errors, prints clean messages to stderr,
 * and exits the process with the corresponding exit code.
 * 
 * @param {Error} error The caught error object
 * @param {boolean} verbose Whether to output verbose logs (including stack trace)
 */
export function handleError(error, verbose = false) {
  const exitCode = error.exitCode ?? ExitCodes.INTERNAL_ERROR;
  
  if (exitCode === ExitCodes.INTERNAL_ERROR) {
    console.error(`Error: An unexpected internal error occurred.`);
    if (verbose || !error.exitCode) {
      console.error(error.stack || error);
    } else {
      console.error(error.message);
    }
  } else {
    // Expected CLI errors (e.g. UsageError, PathNotFoundError)
    console.error(`Error: ${error.message}`);
    if (verbose && error.stack) {
      console.error('\n--- Stack Trace ---');
      console.error(error.stack);
    }
  }
  
  process.exit(exitCode);
}
