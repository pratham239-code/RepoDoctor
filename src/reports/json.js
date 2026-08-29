import { ReportRenderer } from './index.js';

export class JsonReportRenderer extends ReportRenderer {
  /**
   * Renders the structured report as a deterministic, clean JSON string.
   *
   * @param {Report} report Structured Report object
   * @param {object} [options] Format options
   * @returns {string} Fully serialized JSON string
   */
  render(report, options = {}) {
    // Return deterministic JSON string with indentation
    const data = {
      repository: report.repository,
      findings: report.findings,
      entries: report.entries,
      summary: report.summary
    };

    return JSON.stringify(data, null, 2);
  }
}
