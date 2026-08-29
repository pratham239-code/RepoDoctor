/**
 * Helper to determine if ANSI escape color codes should be enabled.
 * 
 * @returns {boolean}
 */
function isColorEnabled() {
  if (process.argv.includes('--no-color')) return false;
  if (process.env.NO_COLOR !== undefined) return false;
  if (process.env.FORCE_COLOR !== undefined) return true;
  return process.stdout.isTTY;
}

/**
 * Generates the clean formatted CLI help text.
 * 
 * @param {object} [options] Optional parsed options
 * @returns {string} The help documentation string
 */
export function getHelpText(options = {}) {
  const useColor = options.color !== undefined ? options.color : isColorEnabled();

  const bold = (str) => useColor ? `\x1b[1m${str}\x1b[0m` : str;
  const cyan = (str) => useColor ? `\x1b[36m${str}\x1b[0m` : str;
  const dim = (str) => useColor ? `\x1b[90m${str}\x1b[0m` : str;

  return `${bold('RepoDoctor')} - Zero-dependency repository health and diagnostics CLI

${bold('Usage:')}
  repodoctor [options] [command] [path]

${bold('Available Commands:')}
  ${cyan('scan')}      Scan the repository for dependencies and metadata.
  ${cyan('check')}     Check repository health, outdated packages, or warnings.
  ${cyan('doctor')}    Run full diagnostics and generate recommendations.
  ${cyan('(default)')} Run default checks on the targeted repository if no command is specified.

${bold('Available Options:')}
  ${cyan('-h, --help')}     Show this help information and exit.
  ${cyan('-v, --version')}  Show the application version and exit.
  ${cyan('--verbose')}      Enable verbose output logging.
  ${cyan('-j, --json')}     Output findings in JSON format (doctor command only).
  ${cyan('--no-color')}     Disable colored output.

${bold('Examples:')}
  ${dim('# Run diagnostics on current directory')}
  repodoctor .

  ${dim('# Scan a repository and output facts')}
  repodoctor scan /path/to/project

  ${dim('# Run diagnostics with JSON output')}
  repodoctor doctor --json .
`;
}
