/**
 * Human-readable terminal formatter for DoctorResult.
 *
 * Formatting principles:
 *  - Plain text with basic ANSI labels; readable without colour too.
 *  - Severity ordering: critical → error → warning → info.
 *  - Within the same severity, secondary sort by category then id (deterministic).
 *  - Zero dependencies: only built-in string operations.
 */

const DIVIDER = '──────────────────────────';

/** Canonical severity ordering (lowest index = highest priority). */
const SEVERITY_ORDER = ['critical', 'error', 'warning', 'info'];

/**
 * Sorts diagnosis entries by severity (high → low), then by category, then by id.
 *
 * @param {object[]} entries Array of { finding, diagnosis, recommendation } objects
 * @returns {object[]} Sorted copy (original array not mutated)
 */
function sortEntries(entries) {
  return [...entries].sort((a, b) => {
    const sA = SEVERITY_ORDER.indexOf(a.finding.severity);
    const sB = SEVERITY_ORDER.indexOf(b.finding.severity);
    const severityIndexA = sA === -1 ? SEVERITY_ORDER.length : sA;
    const severityIndexB = sB === -1 ? SEVERITY_ORDER.length : sB;

    if (severityIndexA !== severityIndexB) return severityIndexA - severityIndexB;

    // Secondary: category (alphabetical)
    const catA = (a.finding.category || '').toLowerCase();
    const catB = (b.finding.category || '').toLowerCase();
    if (catA !== catB) return catA < catB ? -1 : 1;

    // Tertiary: id (alphabetical)
    const idA = (a.finding.id || '').toLowerCase();
    const idB = (b.finding.id || '').toLowerCase();
    return idA < idB ? -1 : idA > idB ? 1 : 0;
  });
}

/**
 * Returns an upper-cased severity label.
 * @param {string} severity
 * @returns {string}
 */
function severityLabel(severity) {
  if (typeof severity !== 'string') return '[UNKNOWN]';
  return `[${severity.toUpperCase()}]`;
}

/**
 * Word-wraps a paragraph to the supplied column width.
 * Preserves leading indent on each wrapped line.
 *
 * @param {string} text
 * @param {number} width Maximum line width (default 72)
 * @param {string} indent Line prefix for wrapped lines
 * @returns {string}
 */
function wrap(text, width = 72, indent = '  ') {
  const words = String(text).split(/\s+/);
  const lines = [];
  let current = '';

  for (const word of words) {
    if (!word) continue;
    if (!current) {
      current = word;
    } else if ((current + ' ' + word).length <= width) {
      current += ' ' + word;
    } else {
      lines.push(current);
      current = indent + word;
    }
  }
  if (current) lines.push(current);
  return lines.join('\n');
}

/**
 * Formats the complete DoctorResult as a human-readable string.
 *
 * @param {object} result DoctorResult from doctor()
 * @returns {string} Formatted output
 */
export function formatResult(result) {
  const lines = [];

  lines.push('RepoDoctor');
  lines.push(DIVIDER);
  lines.push('');

  if (result.repository) {
    lines.push(`Repository: ${result.repository}`);
    lines.push('');
  }

  const entries = result.entries || [];

  // --- ZERO FINDINGS ---
  if (entries.length === 0) {
    lines.push('No issues detected.');
    lines.push('');
    lines.push('Repository looks healthy based on the available checks.');
    lines.push('');
    return lines.join('\n');
  }

  // --- FINDINGS HEADER ---
  lines.push('Findings');
  lines.push(DIVIDER);
  lines.push('');

  const sorted = sortEntries(entries);

  for (const entry of sorted) {
    const { finding, diagnosis, recommendation } = entry;

    const label = severityLabel(finding.severity);
    const title = finding.title || finding.id || 'Untitled finding';
    lines.push(`${label} ${title}`);

    if (finding.category) {
      lines.push(`Category: ${finding.category}`);
    }

    if (finding.location?.file) {
      lines.push(`Location: ${finding.location.file}${finding.location.path ? ` → ${finding.location.path}` : ''}`);
    }

    lines.push('');
    lines.push('Why:');
    lines.push(wrap(diagnosis.why));

    lines.push('');
    lines.push('Recommendation:');
    lines.push(wrap(recommendation));

    lines.push('');
    lines.push(DIVIDER);
    lines.push('');
  }

  // --- SUMMARY ---
  const count = entries.length;
  const noun = count === 1 ? 'finding' : 'findings';
  lines.push(`${count} ${noun}`);
  lines.push('');

  return lines.join('\n');
}

/**
 * Formats the complete DoctorResult as a deterministic JSON string.
 * Delegates serialisation to JSON.stringify (built-in).
 *
 * @param {object} result DoctorResult
 * @returns {string}
 */
export function formatJson(result) {
  return JSON.stringify(result, null, 2);
}
