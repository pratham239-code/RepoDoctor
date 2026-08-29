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
 * Helper to determine if ANSI escape color codes should be enabled.
 * 
 * @returns {boolean}
 */
function isColorEnabled() {
  if (process.argv.includes('--no-color')) return false;
  if (process.env.NO_COLOR !== undefined) return false;
  if (process.env.FORCE_COLOR !== undefined) return true;
  return process.stderr.isTTY;
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
  const useColor = isColorEnabled();
  
  const red = (str) => useColor ? `\x1b[31;1m${str}\x1b[0m` : str;
  const dim = (str) => useColor ? `\x1b[90m${str}\x1b[0m` : str;

  const errorPrefix = useColor ? `\x1b[31;1m✗ Error:\x1b[0m` : '✗ Error:';
  
  let message = error.message;
  let hint = null;

  if (error instanceof PathNotFoundError) {
    hint = 'Please check the path and try again.';
  } else if (error instanceof UsageError) {
    hint = 'Run `repodoctor --help` for usage information.';
  } else if (message && message.includes('Permission denied')) {
    hint = 'RepoDoctor requires read access to scan this directory.';
  }

  if (exitCode === ExitCodes.INTERNAL_ERROR) {
    console.error(`${errorPrefix} An unexpected internal error occurred.`);
    if (verbose || !error.exitCode) {
      console.error(error.stack || error);
    } else {
      console.error(message);
    }
  } else {
    // Expected CLI errors (e.g. UsageError, PathNotFoundError)
    console.error(`${errorPrefix} ${message}`);
    if (hint) {
      console.error(dim(`  → ${hint}`));
    }
    if (verbose && error.stack) {
      console.error('\n--- Stack Trace ---');
      console.error(error.stack);
    }
  }
  
  process.exit(exitCode);
}
