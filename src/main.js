#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { parseArgs } from './cli/parser.js';
import { routeCommand } from './cli/commands.js';
import { getHelpText } from './cli/help.js';
import { handleError } from './cli/errors.js';
import { ExitCodes } from './cli/exit_codes.js';

/**
 * Draws the centered RepoDoctor header.
 * 
 * @param {boolean} useColor Whether to use ANSI colors
 */
function drawHeader(useColor) {
  const bold = (str) => useColor ? `\x1b[1m${str}\x1b[0m` : str;
  const cyan = (str) => useColor ? `\x1b[36m${str}\x1b[0m` : str;

  console.log(cyan('┌────────────────────────────────────────────────────────┐'));
  console.log(`${cyan('│')}                       ${bold('REPODOCTOR')}                       ${cyan('│')}`);
  console.log(cyan('└────────────────────────────────────────────────────────┘'));
}

/**
 * Draws the side-by-side action boxes.
 * 
 * @param {boolean} useColor Whether to use ANSI colors
 */
/**
 * Draws the side-by-side action boxes.
 * 
 * @param {boolean} useColor Whether to use ANSI colors
 */
function drawOptions(useColor) {
  const cyan = (str) => useColor ? `\x1b[36m${str}\x1b[0m` : str;
  const bold = (str) => useColor ? `\x1b[1m${str}\x1b[0m` : str;
  const dim = (str) => useColor ? `\x1b[90m${str}\x1b[0m` : str;

  console.log('\nSelect mode:');
  console.log(cyan('┌───────────────────────────┐   ┌───────────────────────────┐'));
  console.log(`${cyan('│')}        ${bold('[1] CHECKUP')}        ${cyan('│')}   ${cyan('│')}        ${bold('[2] ANALYZE')}        ${cyan('│')}`);
  console.log(`${cyan('│')}   ${dim('Show full diagnostics')}   ${cyan('│')}   ${cyan('│')}     ${dim('List raw findings')}     ${cyan('│')}`);
  console.log(`${cyan('│')}    ${dim('and recommendations')}    ${cyan('│')}   ${cyan('│')}      ${dim('as JSON output')}       ${cyan('│')}`);
  console.log(cyan('└───────────────────────────┘   └───────────────────────────┘'));
  console.log(cyan('┌───────────────────────────┐   ┌───────────────────────────┐'));
  console.log(`${cyan('│')}      ${bold('[3] QUICK STATS')}      ${cyan('│')}   ${cyan('│')}       ${bold('[4] GIT AUDIT')}       ${cyan('│')}`);
  console.log(`${cyan('│')}    ${dim('Show total size and')}    ${cyan('│')}   ${cyan('│')}    ${dim('Check active branch')}    ${cyan('│')}`);
  console.log(`${cyan('│')}    ${dim('file count details')}     ${cyan('│')}   ${cyan('│')}    ${dim('and commit details')}     ${cyan('│')}`);
  console.log(cyan('└───────────────────────────┘   └───────────────────────────┘'));
  console.log(cyan('┌───────────────────────────┐   ┌───────────────────────────┐'));
  console.log(`${cyan('│')}    ${bold('[5] DEPENDENCY LIST')}    ${cyan('│')}   ${cyan('│')}     ${bold('[6] EXPORT REPORT')}     ${cyan('│')}`);
  console.log(`${cyan('│')}    ${dim('Render a list of all')}   ${cyan('│')}   ${cyan('│')}    ${dim('Save health report')}     ${cyan('│')}`);
  console.log(`${cyan('│')}   ${dim('installed dependencies')}  ${cyan('│')}   ${cyan('│')}    ${dim('to a markdown file')}     ${cyan('│')}`);
  console.log(cyan('└───────────────────────────┘   └───────────────────────────┘'));
  console.log(cyan('┌───────────────────────────┐   ┌───────────────────────────┐'));
  console.log(`${cyan('│')}      ${bold('[7] CHANGE PATH')}      ${cyan('│')}   ${cyan('│')}         ${bold('[8] EXIT')}          ${cyan('│')}`);
  console.log(`${cyan('│')}    ${dim('Analyze a different')}    ${cyan('│')}   ${cyan('│')}    ${dim('Exit the program')}        ${cyan('│')}`);
  console.log(`${cyan('│')}     ${dim('repository path')}       ${cyan('│')}   ${cyan('│')}   ${dim('interactive session')}      ${cyan('│')}`);
  console.log(cyan('└───────────────────────────┘   └───────────────────────────┘'));
}

/**
 * Runs the interactive looping TUI shell dashboard.
 * 
 * @param {object} options CLI options
 * @returns {Promise<void>} Resolves when the user selects exit
 */
function runInteractiveTUI(options) {
  const useColor = !options.noColor && !process.env.NO_COLOR && (process.env.FORCE_COLOR !== undefined || process.stdout.isTTY);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const pathPromptText = useColor ? '\x1b[36m>\x1b[0m ' : '> ';
  const optionPromptText = useColor ? '\x1b[36mChoose option (1 to 8):\x1b[0m ' : 'Choose option (1 to 8): ';

  return new Promise((resolve) => {
    let targetPath = null;
    let resolvedPath = null;

    const askPath = () => {
      console.clear();
      drawHeader(useColor);
      console.log('\nEnter your repo path:');
      rl.question(pathPromptText, (answer) => {
        let cleanedPath = answer.trim();

        // Strip surrounding quotes (common when dragging and dropping folders on Windows/macOS)
        if ((cleanedPath.startsWith('"') && cleanedPath.endsWith('"')) ||
            (cleanedPath.startsWith("'") && cleanedPath.endsWith("'"))) {
          cleanedPath = cleanedPath.slice(1, -1).trim();
        }

        if (!cleanedPath) {
          cleanedPath = '.';
        }

        const resolved = path.resolve(cleanedPath);
        if (fs.existsSync(resolved)) {
          try {
            const stats = fs.statSync(resolved);
            if (stats.isDirectory()) {
              targetPath = cleanedPath;
              resolvedPath = resolved;
              askAction();
              return;
            } else {
              const fileErrorMsg = useColor
                ? `\x1b[31mError: The specified path is a file, not a directory. Please try again.\x1b[0m`
                : `Error: The specified path is a file, not a directory. Please try again.`;
              console.log(fileErrorMsg);
            }
          } catch (err) {
            const readErrorMsg = useColor
              ? `\x1b[31mError checking path: ${err.message}. Please try again.\x1b[0m`
              : `Error checking path: ${err.message}. Please try again.`;
            console.log(readErrorMsg);
          }
        } else {
          const errorMsg = useColor
            ? `\x1b[31mError: The path "${cleanedPath}" does not exist. Please try again.\x1b[0m`
            : `Error: The path "${cleanedPath}" does not exist. Please try again.`;
          console.log(errorMsg);
        }

        rl.question('\nPress Enter to try again...', () => {
          askPath();
        });
      });
    };

    const askAction = () => {
      console.clear();
      drawHeader(useColor);
      
      const bold = (str) => useColor ? `\x1b[1m${str}\x1b[0m` : str;
      const dim = (str) => useColor ? `\x1b[90m${str}\x1b[0m` : str;
      
      console.log(`\n${bold('Repo Path:')} ${dim(resolvedPath)}`);
      drawOptions(useColor);

      rl.question(optionPromptText, (optAnswer) => {
        const choice = optAnswer.trim();
        let command = null;

        if (choice === '1') command = 'doctor';
        else if (choice === '2') command = 'check';
        else if (choice === '3') command = 'stats';
        else if (choice === '4') command = 'git';
        else if (choice === '5') command = 'deps';
        else if (choice === '6') command = 'export';
        else if (choice === '7') {
          targetPath = null;
          resolvedPath = null;
          askPath();
          return;
        } else if (choice === '8') {
          console.log('\nGoodbye!');
          rl.close();
          resolve();
          return;
        }

        if (command) {
          console.clear();
          try {
            // Run command (outputs straight to console)
            routeCommand(command, targetPath, options);
          } catch (err) {
            handleError(err, options.verbose);
          }

          rl.question('\nPress Enter to return to the menu...', () => {
            askAction();
          });
        } else {
          const invalidMsg = useColor
            ? `\x1b[31mInvalid option. Please enter a number from 1 to 8.\x1b[0m`
            : `Invalid option. Please enter a number from 1 to 8.`;
          console.log(invalidMsg);

          rl.question('\nPress Enter to try again...', () => {
            askAction();
          });
        }
      });
    };

    askPath();
  });
}

/**
 * Main application entry point.
 */
async function main() {
  let verbose = false;
  
  try {
    // Parse arguments
    const rawArgs = process.argv.slice(2);
    let { options, command, path: targetPath } = parseArgs(rawArgs);
    
    // Track verbose option in case of catch block errors
    verbose = options.verbose;
    
    // If help flag is specified, print help text and exit immediately
    if (options.help) {
      console.log(getHelpText(options));
      process.exit(ExitCodes.SUCCESS);
    }
    
    // If version flag is specified, print version from package.json and exit immediately
    if (options.version) {
      const packageJsonUrl = new URL('../package.json', import.meta.url);
      const packageJson = JSON.parse(fs.readFileSync(packageJsonUrl, 'utf8'));
      console.log(`repodoctor version ${packageJson.version}`);
      process.exit(ExitCodes.SUCCESS);
    }

    // If no path is specified, and we are in an interactive terminal (TTY), run TUI loop
    if (!targetPath && !command && process.stdin.isTTY) {
      await runInteractiveTUI(options);
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
