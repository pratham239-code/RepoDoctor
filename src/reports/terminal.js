import { ReportRenderer } from './index.js';
import { Categories } from '../analyzer/findings.js';

const DIVIDER = '────────────────────────────────────────────────────────';

/** Canonical severity ordering (lowest index = highest priority). */
const SEVERITY_ORDER = ['critical', 'error', 'warning', 'info'];

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[90m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgYellow: '\x1b[43m',
  bgCyan: '\x1b[46m',
  bgGreen: '\x1b[42m',
};

export class TerminalReportRenderer extends ReportRenderer {
  /**
   * Helper to determine if ANSI escape color codes should be enabled.
   */
  isColorEnabled(options = {}) {
    if (options.noColor) return false;
    if (process.argv.includes('--no-color')) return false;
    if (process.env.NO_COLOR !== undefined) return false;
    if (process.env.FORCE_COLOR !== undefined) return true;
    return process.stdout.isTTY;
  }

  /**
   * Pads text to a specific visible length, ignoring ANSI escape color codes.
   */
  padText(text, length, char = ' ') {
    const plain = String(text).replace(/\x1b\[\d+(;\d+)*m/g, '');
    const diff = length - plain.length;
    if (diff <= 0) return String(text);
    return String(text) + char.repeat(diff);
  }

  /**
   * Sorts diagnosis entries by severity (high → low), then by category, then by id.
   */
  sortEntries(entries) {
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
   * Returns a severity badge or label.
   */
  severityLabel(severity, useColor) {
    const label = typeof severity === 'string' ? severity.toUpperCase() : 'UNKNOWN';
    if (!useColor) {
      return `[${label}]`;
    }
    switch (severity) {
      case 'critical':
        return `\x1b[97;41;1m CRITICAL \x1b[0m`;
      case 'error':
        return `\x1b[30;41;1m ERROR \x1b[0m`;
      case 'warning':
        return `\x1b[30;43;1m WARNING \x1b[0m`;
      case 'info':
        return `\x1b[30;46;1m INFO \x1b[0m`;
      default:
        return `\x1b[37;1m ${label} \x1b[0m`;
    }
  }

  /**
   * Returns a left border character styled with the severity color.
   */
  getBorderChar(severity, useColor) {
    const char = '┃';
    if (!useColor) return char;
    switch (severity) {
      case 'critical':
      case 'error':
        return `\x1b[31m${char}\x1b[0m`;
      case 'warning':
        return `\x1b[33m${char}\x1b[0m`;
      case 'info':
        return `\x1b[36m${char}\x1b[0m`;
      default:
        return char;
    }
  }

  /**
   * Word-wraps a paragraph to the supplied column width.
   * Preserves leading indent on each wrapped line.
   */
  wrapLine(text, width = 72, linePrefix = '  ┃ ') {
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
        lines.push(linePrefix + current);
        current = word;
      }
    }
    if (current) lines.push(linePrefix + current);
    return lines.join('\n');
  }

  /**
   * Wraps text, handling explicit newlines.
   */
  wrapText(text, width = 72, linePrefix = '  ┃ ') {
    const paragraphs = String(text).split('\n');
    return paragraphs.map(p => {
      if (p.trim() === '') return linePrefix.trimEnd();
      return this.wrapLine(p, width, linePrefix);
    }).join('\n');
  }

  /**
   * Formats a metadata label and value, wrapping long values.
   */
  formatMetadata(label, value, width = 60, linePrefix = '  ┃ ') {
    const paddedLabel = label + ' ';
    const valPrefix = linePrefix + ' '.repeat(paddedLabel.length);
    const valueLines = [];
    let currentLine = '';

    const tokens = String(value).split(/([/\\]|\s+)/);
    for (const token of tokens) {
      if ((currentLine + token).length <= width) {
        currentLine += token;
      } else {
        if (currentLine) valueLines.push(currentLine);
        currentLine = token;
      }
    }
    if (currentLine) valueLines.push(currentLine);

    return valueLines.map((line, idx) => {
      if (idx === 0) return linePrefix + paddedLabel + line;
      return valPrefix + line;
    }).join('\n');
  }

  /**
   * Generic aligned table formatter.
   */
  formatTable(headers, rows, useColor) {
    const colWidths = headers.map((h, i) => {
      let max = h.length;
      for (const row of rows) {
        const val = String(row[i] ?? '');
        const plain = val.replace(/\x1b\[\d+(;\d+)*m/g, '');
        if (plain.length > max) max = plain.length;
      }
      return max;
    });

    const lines = [];

    // Header
    const headerStr = headers.map((h, i) => h.padEnd(colWidths[i], ' ')).join('   ');
    lines.push(useColor ? `${colors.bold}${headerStr}${colors.reset}` : headerStr);

    // Divider
    const totalWidth = colWidths.reduce((sum, w) => sum + w, 0) + (headers.length - 1) * 3;
    lines.push('─'.repeat(totalWidth));

    // Rows
    for (const row of rows) {
      const rowStr = row.map((val, i) => {
        const valStr = String(val ?? '');
        // Compute visible length to pad correctly
        const plain = valStr.replace(/\x1b\[\d+(;\d+)*m/g, '');
        const diff = colWidths[i] - plain.length;
        const padded = valStr + ' '.repeat(diff > 0 ? diff : 0);

        // Dim 0 values in summary table
        if (useColor && plain === '0' && headers.includes('Total')) {
          return `${colors.dim}${padded}${colors.reset}`;
        }
        return padded;
      }).join('   ');
      lines.push(rowStr);
    }

    return lines.join('\n');
  }

  render(report, options = {}) {
    const useColor = options.color !== undefined ? options.color : this.isColorEnabled(options);
    const lines = [];

    const bold = (str) => useColor ? `${colors.bold}${str}${colors.reset}` : str;
    const dim = (str) => useColor ? `${colors.dim}${str}${colors.reset}` : str;
    const red = (str) => useColor ? `${colors.red}${str}${colors.reset}` : str;
    const green = (str) => useColor ? `${colors.green}${str}${colors.reset}` : str;
    const yellow = (str) => useColor ? `${colors.yellow}${str}${colors.reset}` : str;
    const cyan = (str) => useColor ? `${colors.cyan}${str}${colors.reset}` : str;

    // --- HEADER ---
    lines.push(bold('RepoDoctor'));
    lines.push(dim(DIVIDER));
    lines.push('');

    const entries = report.entries || [];
    const totalIssues = report.summary.total;

    // --- SUMMARY BOX ---
    if (totalIssues === 0) {
      const line1 = `Repository: ${report.repository || 'unknown'}`;
      const line2 = `Status:     ${green('✓ Healthy')}`;
      const line3 = `   ${green('✓ No issues detected')}`;

      lines.push(useColor ? `${colors.green}┌─ SUMMARY ─────────────────────────────────────────────┐${colors.reset}` : `┌─ SUMMARY ─────────────────────────────────────────────┐`);
      lines.push(`${useColor ? `${colors.green}│${colors.reset}` : '│'} ${this.padText(line1, 55)} ${useColor ? `${colors.green}│${colors.reset}` : '│'}`);
      lines.push(`${useColor ? `${colors.green}│${colors.reset}` : '│'} ${this.padText(line2, 55)} ${useColor ? `${colors.green}│${colors.reset}` : '│'}`);
      lines.push(`${useColor ? `${colors.green}│${colors.reset}` : '│'} ${' '.repeat(55)} ${useColor ? `${colors.green}│${colors.reset}` : '│'}`);
      lines.push(`${useColor ? `${colors.green}│${colors.reset}` : '│'} ${this.padText(line3, 55)} ${useColor ? `${colors.green}│${colors.reset}` : '│'}`);
      lines.push(useColor ? `${colors.green}└───────────────────────────────────────────────────────┘${colors.reset}` : `└───────────────────────────────────────────────────────┘`);
    } else {
      const { critical = 0, error = 0, warning = 0, info = 0 } = report.summary.bySeverity;
      const line1 = `Repository:   ${report.repository || 'unknown'}`;
      const line2 = `Total Issues: ${totalIssues} ${totalIssues === 1 ? 'finding' : 'findings'}`;

      const line3_1 = `  ${red('✗')} ${critical} Critical`;
      const line3_2 = `  ${red('✗')} ${error} ${error === 1 ? 'Error' : 'Errors'}`;
      const line3_3 = `  ${yellow('⚠')} ${warning} ${warning === 1 ? 'Warning' : 'Warnings'}`;
      const line3_4 = `  ${cyan('ℹ')} ${info} ${info === 1 ? 'Suggestion' : 'Suggestions'}`;

      const row1 = this.padText(line3_1, 27) + this.padText(line3_2, 28);
      const row2 = this.padText(line3_3, 27) + this.padText(line3_4, 28);

      const hasSerious = critical > 0 || error > 0;
      const boxColor = useColor ? (hasSerious ? colors.red : colors.yellow) : '';
      const boxReset = useColor ? colors.reset : '';

      lines.push(`${boxColor}┌─ SUMMARY ─────────────────────────────────────────────┐${boxReset}`);
      lines.push(`${boxColor}│${boxReset} ${this.padText(line1, 55)} ${boxColor}│${boxReset}`);
      lines.push(`${boxColor}│${boxReset} ${this.padText(line2, 55)} ${boxColor}│${boxReset}`);
      lines.push(`${boxColor}│${boxReset} ${' '.repeat(55)} ${boxColor}│${boxReset}`);
      lines.push(`${boxColor}│${boxReset} ${this.padText(row1, 55)} ${boxColor}│${boxReset}`);
      lines.push(`${boxColor}│${boxReset} ${this.padText(row2, 55)} ${boxColor}│${boxReset}`);
      lines.push(`${boxColor}└───────────────────────────────────────────────────────┘${boxReset}`);
    }

    lines.push('');

    // --- ZERO FINDINGS FALLBACK ---
    if (entries.length === 0) {
      lines.push('No issues detected.');
      lines.push('');
      lines.push('Repository looks healthy based on the available checks.');
      lines.push('');
      return lines.join('\n');
    }

    // --- CATEGORIES TABLE ---
    const categoryRows = [];
    let totalCritical = 0, totalError = 0, totalWarning = 0, totalInfo = 0;

    for (const catKey of Object.keys(Categories)) {
      const catName = Categories[catKey];
      const catFindings = entries.filter(e => e.finding.category === catName);
      if (catFindings.length > 0) {
        const counts = { critical: 0, error: 0, warning: 0, info: 0 };
        for (const f of catFindings) {
          const sev = f.finding.severity;
          if (sev in counts) counts[sev]++;
        }
        categoryRows.push([
          catName,
          String(counts.critical),
          String(counts.error),
          String(counts.warning),
          String(counts.info),
          String(catFindings.length)
        ]);
        totalCritical += counts.critical;
        totalError += counts.error;
        totalWarning += counts.warning;
        totalInfo += counts.info;
      }
    }

    if (categoryRows.length > 0) {
      lines.push(bold('Categories Summary'));
      lines.push(dim('──────────────────'));

      // Add divider and Totals to Category summary
      const rowsWithTotal = [...categoryRows];
      rowsWithTotal.push(['─'.repeat(16), '─'.repeat(8), '─'.repeat(5), '─'.repeat(7), '─'.repeat(10), '─'.repeat(5)]);
      rowsWithTotal.push([
        bold('Total'),
        bold(String(totalCritical)),
        bold(String(totalError)),
        bold(String(totalWarning)),
        bold(String(totalInfo)),
        bold(String(totalIssues))
      ]);

      const headers = ['Category', 'Critical', 'Error', 'Warning', 'Suggestion', 'Total'];
      lines.push(this.formatTable(headers, rowsWithTotal, useColor));
      lines.push('');
    }

    // --- FINDINGS LIST ---
    lines.push(bold('Findings'));
    lines.push(dim('────────'));
    lines.push('');

    const sorted = this.sortEntries(entries);

    for (const entry of sorted) {
      const { finding, diagnosis, recommendation } = entry;
      const bc = this.getBorderChar(finding.severity, useColor);
      const badge = this.severityLabel(finding.severity, useColor);
      const title = finding.title || finding.id || 'Untitled finding';

      // Format Duplicate Dependencies Table if present
      let depTable = '';
      if (finding.id === 'duplicate-dependency' && finding.evidence?.dependency) {
        const depHeaders = ['Section', 'Version'];
        const depRows = [
          ['dependencies', finding.evidence.dependenciesVersion || 'N/A'],
          ['devDependencies', finding.evidence.devDependenciesVersion || 'N/A']
        ];
        const tableStr = this.formatTable(depHeaders, depRows, useColor);
        depTable = tableStr.split('\n').map(line => `  ${bc}   ${line}`).join('\n');
      } else if (finding.id === 'duplicate-peer-dependency' && finding.evidence?.dependency) {
        const depHeaders = ['Section', 'Version'];
        const depRows = [
          ['dependencies', finding.evidence.dependenciesVersion || 'N/A'],
          ['peerDependencies', finding.evidence.peerDependenciesVersion || 'N/A']
        ];
        const tableStr = this.formatTable(depHeaders, depRows, useColor);
        depTable = tableStr.split('\n').map(line => `  ${bc}   ${line}`).join('\n');
      }

      lines.push(`  ${bc} ${badge} ${bold(title)}`);
      lines.push(this.formatMetadata('Category:', finding.category || 'N/A', 60, `  ${bc} `));

      if (finding.location?.file) {
        const displayLoc = finding.location.file + (finding.location.path ? ` → ${finding.location.path}` : '');
        lines.push(this.formatMetadata('Location:', displayLoc, 60, `  ${bc} `));
      }

      lines.push(`  ${bc}`);
      lines.push(`  ${bc} ${bold('Why:')}`);
      lines.push(this.wrapText(diagnosis.why, 72, `  ${bc}   `));

      if (depTable) {
        lines.push(`  ${bc}`);
        lines.push(depTable);
      }

      lines.push(`  ${bc}`);
      lines.push(`  ${bc} ${bold('Recommendation:')}`);
      lines.push(this.wrapText(recommendation, 72, `  ${bc}   `));
      lines.push('');
    }

    // --- PRIORITY ACTIONS ---
    const priorities = sorted.slice(0, 3);
    if (priorities.length > 0) {
      lines.push(bold('Priority Actions:'));
      lines.push(dim('─────────────────'));
      priorities.forEach((entry, index) => {
        const rec = entry.recommendation || entry.finding.description;
        // Fix: Use a safer split regex so periods in filenames (e.g., .gitignore) don't trigger splits
        let shortRec = rec.split(/\.(?:\s|$)/)[0].trim();
        if (shortRec.length > 68) {
          shortRec = shortRec.substring(0, 65) + '...';
        }
        lines.push(`  ${index + 1}. ${shortRec}`);
      });
      lines.push('');
    }

    // --- FINAL SUMMARY LINE ---
    lines.push(dim(DIVIDER));
    const noun = totalIssues === 1 ? 'finding' : 'findings';
    lines.push(bold(`${totalIssues} ${noun} detected.`));
    lines.push('');

    return lines.join('\n');
  }
}
