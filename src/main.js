#!/usr/bin/env node

import fs from 'node:fs';
import { parseArgs } from './cli/parser.js';
import { routeCommand } from './cli/commands.js';
import { getHelpText } from './cli/help.js';
import { handleError } from './cli/errors.js';
import { ExitCodes } from './cli/exit_codes.js';

/**
 * Main application entry point.
 */
function main() {
  let verbose = false;
  
  try {
    // Parse arguments
    const rawArgs = process.argv.slice(2);
    const { options, command, path: targetPath } = parseArgs(rawArgs);
    
    // Track verbose option in case of catch block errors
    verbose = options.verbose;
    
    // If help flag is specified, print help text and exit immediately
    if (options.help) {
      console.log(getHelpText());
      process.exit(ExitCodes.SUCCESS);
    }
    
    // If version flag is specified, print version from package.json and exit immediately
    if (options.version) {
      const packageJsonUrl = new URL('../package.json', import.meta.url);
      const packageJson = JSON.parse(fs.readFileSync(packageJsonUrl, 'utf8'));
      console.log(`repodoctor version ${packageJson.version}`);
      process.exit(ExitCodes.SUCCESS);
    }
    
    // Route command execution
    const exitCode = routeCommand(command, targetPath, options);
    process.exit(exitCode);
    
  } catch (error) {
    // Process-level error handling
    handleError(error, verbose);
  }
}

// Start the CLI
main();
