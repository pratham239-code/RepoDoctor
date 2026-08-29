/**
 * Centralized exit codes for RepoDoctor.
 * These codes represent the standard exit statuses returned by the CLI.
 */
export const ExitCodes = {
  // Command completed successfully and no issues were found
  SUCCESS: 0,
  
  // Command completed successfully but findings/issues were detected (for future phases)
  FINDINGS: 1,
  
  // CLI arguments or command usage error (e.g. invalid flag or argument combination)
  USAGE_ERROR: 2,
  
  // Filesystem I/O error (e.g. specified path does not exist)
  IO_ERROR: 3,
  
  // Unexpected internal application error or crash
  INTERNAL_ERROR: 4,
};
