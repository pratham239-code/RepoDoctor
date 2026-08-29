import { getDiagnosis } from './diagnoses.js';
import { getRecommendation } from './recommendations.js';

/**
 * Constructs a DoctorResult from an array of Phase 3 findings and optional
 * snapshot metadata.
 *
 * The Doctor is strictly read-only. It never modifies the target repository.
 *
 * @param {object[]} findings Array of Finding objects produced by the Analyzer
 * @param {object}  [snapshot] The RepositorySnapshot (used for repository name)
 * @returns {object} DoctorResult
 */
export function doctor(findings, snapshot) {
  // Defensive guard: treat null/undefined findings as empty
  const rawFindings = Array.isArray(findings) ? findings : [];

  // Derive a display name for the repository
  const repository = snapshot?.project?.name || snapshot?.project?.path || null;

  // Build enriched entries – one per finding
  const entries = rawFindings.map((finding) => {
    // Accept any object, but guard against genuinely malformed data
    if (!finding || typeof finding !== 'object') {
      return {
        finding: { id: '<malformed>', severity: 'info', category: null, title: 'Malformed finding', description: '' },
        diagnosis: {
          problem: 'Malformed finding encountered.',
          why: 'This finding requires additional analysis.',
          evidence: 'No details available.'
        },
        recommendation: 'Review this finding manually. No specific recommendation could be determined.'
      };
    }

    return {
      finding,
      diagnosis: getDiagnosis(finding),
      recommendation: getRecommendation(finding)
    };
  });

  // Compute summary counts by severity
  const severityCounts = { critical: 0, error: 0, warning: 0, info: 0 };
  for (const { finding } of entries) {
    const sev = typeof finding.severity === 'string' ? finding.severity : 'info';
    if (sev in severityCounts) {
      severityCounts[sev]++;
    }
  }

  return {
    repository,
    findings: rawFindings,
    entries,
    summary: {
      total: entries.length,
      bySeverity: severityCounts
    }
  };
}
