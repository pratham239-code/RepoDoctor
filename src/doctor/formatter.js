import { Report } from '../reports/index.js';
import { TerminalReportRenderer } from '../reports/terminal.js';
import { JsonReportRenderer } from '../reports/json.js';

/**
 * Human-readable terminal formatter for DoctorResult. Preserves Phase 7 TUI theme.
 * Delegates to the reporting abstraction.
 *
 * @param {object} result DoctorResult from doctor()
 * @param {object} [options] CLI options
 * @returns {string} Formatted TUI output
 */
export function formatResult(result, options = {}) {
  const report = new Report(result);
  const renderer = new TerminalReportRenderer();
  return renderer.render(report, options);
}

/**
 * Formats the complete DoctorResult as a deterministic JSON string.
 * Delegates to the reporting abstraction.
 *
 * @param {object} result DoctorResult
 * @returns {string} Fully serialized JSON string
 */
export function formatJson(result) {
  const report = new Report(result);
  const renderer = new JsonReportRenderer();
  return renderer.render(report);
}
