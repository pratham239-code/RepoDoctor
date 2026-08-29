/**
 * Generates the clean formatted CLI help text.
 * 
 * @returns {string} The help documentation string
 */
export function getHelpText() {
  return `RepoDoctor - Zero-dependency repository health and diagnostics CLI

Usage:
  repodoctor [options] [command] [path]

Available Commands:
  scan      Scan the repository for dependencies and metadata.
  check     Check repository health, outdated packages, or warnings.
  doctor    Run full diagnostics and generate recommendations.
  (default) Run default checks on the targeted repository if no command is specified.

Available Options:
  -h, --help     Show this help information and exit.
  -v, --version  Show the application version and exit.
  --verbose      Enable verbose output logging.

Examples:
  repodoctor .
  repodoctor scan /path/to/project
  repodoctor check --verbose
  repodoctor doctor .
`;
}
