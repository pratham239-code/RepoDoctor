import fs from 'node:fs';
import path from 'node:path';
import { UsageError } from './errors.js';

/**
 * Checks if a string looks like a path or exists on the filesystem.
 * 
 * @param {string} arg The argument string to check
 * @returns {boolean} True if the argument is a path
 */
function isPathLikeOrExists(arg) {
  try {
    if (fs.existsSync(path.resolve(arg))) {
      return true;
    }
  } catch {
    // Ignore fs errors
  }
  return arg.includes('/') || arg.includes('\\') || arg.startsWith('.');
}

/**
 * Parses raw command-line arguments.
 * 
 * Supports:
 * - Options: --help, -h, --version, -v, --verbose
 * - Short option grouping: e.g. -vh, -hv
 * - Commands: scan, check, doctor
 * - Path argument (optional, defaults to null, which router can default to '.')
 * 
 * @param {string[]} args Array of command line arguments (excluding node and script paths)
 * @returns {{ options: { help: boolean, version: boolean, verbose: boolean }, command: string|null, path: string|null }}
 * @throws {UsageError} If arguments or options are invalid
 */
export function parseArgs(args) {
  const options = {
    help: false,
    version: false,
    verbose: false,
    json: false,
    noColor: false,
  };
  
  let command = null;
  let path = null;
  
  const knownCommands = ['scan', 'check', 'doctor', 'stats', 'git', 'deps', 'export'];
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg.startsWith('--')) {
      if (arg === '--help') {
        options.help = true;
      } else if (arg === '--version') {
        options.version = true;
      } else if (arg === '--verbose') {
        options.verbose = true;
      } else if (arg === '--json') {
        options.json = true;
      } else if (arg === '--no-color') {
        options.noColor = true;
      } else {
        throw new UsageError(`Unknown option: ${arg}`);
      }
    } else if (arg.startsWith('-') && arg !== '-') {
      // Handle short options, supporting grouping (e.g. -vh)
      const chars = arg.slice(1);
      for (const char of chars) {
        if (char === 'h') {
          options.help = true;
        } else if (char === 'v') {
          options.version = true;
        } else if (char === 'j') {
          options.json = true;
        } else {
          throw new UsageError(`Unknown option: -${char}`);
        }
      }
    } else {
      // Positional argument
      if (!command && !path && knownCommands.includes(arg)) {
        command = arg;
      } else if (!path) {
        // If no command has been set, and this positional arg is not a known command,
        // we check if it looks like a path or exists. If not, it's an unknown command.
        if (!command && !isPathLikeOrExists(arg)) {
          throw new UsageError(`Unknown command: ${arg}`);
        }
        path = arg;
      } else {
        throw new UsageError(`Unexpected argument: ${arg}`);
      }
    }
  }
  
  return { options, command, path };
}
