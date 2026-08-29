/**
 * Centralized severity levels for RepoDoctor findings.
 * Using a standard scale allows consumers (like Phase 4) to prioritize issues.
 */
export const Severities = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  CRITICAL: 'critical'
};

/**
 * Centralized category classifications for RepoDoctor findings.
 * Grouping issues makes reporting cleaner and easier to filter.
 */
export const Categories = {
  DOCUMENTATION: 'documentation',
  STRUCTURE: 'structure',
  GIT: 'git',
  DEPENDENCIES: 'dependencies',
  CONFIGURATION: 'configuration'
};

/**
 * Constructor/factory function that creates a structured Finding object.
 * A Finding is a deterministic record representing a potential repository issue.
 *
 * @param {object} params
 * @param {string} params.id Unique ID identifying the rule (e.g., 'missing-readme')
 * @param {string} params.category The category grouping (from Categories)
 * @param {string} params.severity The severity weight (from Severities)
 * @param {string} params.title A short, human-readable title of the problem
 * @param {string} params.description A detailed explanation of what the problem is
 * @param {object} [params.evidence] Raw facts from the snapshot supporting this finding
 * @param {object|null} [params.location] Target location descriptor, e.g. { file: 'package.json' } or null
 * @returns {object} The standardized Finding object
 */
export function createFinding({
  id,
  category,
  severity,
  title,
  description,
  evidence = {},
  location = null
}) {
  // Return a clean, serializable JavaScript object matching the Phase 3 schema
  return {
    id,
    category,
    severity,
    title,
    description,
    evidence,
    location
  };
}
