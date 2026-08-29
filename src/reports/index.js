export class Report {
  /**
   * Encapsulates the structured doctor result.
   * @param {object} result Enriched DoctorResult object from doctor()
   */
  constructor(result) {
    if (!result) {
      throw new Error('Report data is required');
    }
    this.repository = result.repository || null;
    this.findings = result.findings || [];
    this.entries = result.entries || [];
    this.summary = result.summary || { total: 0, bySeverity: { critical: 0, error: 0, warning: 0, info: 0 } };
  }
}

export class ReportRenderer {
  /**
   * Base class for report renderers.
   */
  render(report, options = {}) {
    throw new Error('render() must be implemented');
  }
}
