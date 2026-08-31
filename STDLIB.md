# RepoDoctor: Zero-Dependency Craft & STDLIB.md

RepoDoctor is built using a strict **Zero-Dependency Craft** philosophy. It uses absolutely zero runtime third-party dependencies and zero developer dependencies. Instead, it relies entirely on the Node.js standard library modules, native runtimes, and lightweight custom implementations of features that typically require heavy external packages.

This document details every Node.js built-in module used across the `src/` and `tests/` directories, explains what they replace or enable, and highlights the custom solutions we developed.

---

## 1. Node.js Standard Library Modules Used

The following native Node.js standard-library modules are the sole building blocks of RepoDoctor:

### `node:fs` (File System)
* **Genuinely Used In**: `src/main.js`, `src/cli/commands.js`, `src/cli/parser.js`, `src/scanner/index.js`, `src/scanner/fs_utils.js`, `src/scanner/git_utils.js`, `tests/helpers/test_utils.js`, `tests/scanner/safety.test.js`, `tests/scanner/scanner.test.js`, `tests/cli/exit_codes.test.js`, and `tests/cli/cli.test.js`.
* **What It Enables**: Performs folder checks, reads manifests (like `package.json`), checks path existence, recursively reads files, and writes reports.
* **Third-Party Replaced**: Replaces utility libraries like `fs-extra`, `graceful-fs`, `rimraf` (for cleanups in tests), and `glob` / `globby` (for matching configuration patterns).

### `node:path` (Path Handling)
* **Genuinely Used In**: `src/main.js`, `src/cli/commands.js`, `src/cli/parser.js`, `src/scanner/index.js`, `src/scanner/fs_utils.js`, `src/scanner/git_utils.js`, `tests/helpers/test_utils.js`, `tests/scanner/safety.test.js`, `tests/scanner/scanner.test.js`, `tests/cli/exit_codes.test.js`, and `tests/cli/cli.test.js`.
* **What It Enables**: Performs cross-platform path resolution, joins directory segments, queries file extensions, and computes relative path outputs.
* **Third-Party Replaced**: Replaces path utility libraries like `upath`.

### `node:readline` (Interactive Input)
* **Genuinely Used In**: `src/main.js`.
* **What It Enables**: Drives the interactive TUI shell dashboard. When no path is passed, RepoDoctor starts an interactive looping prompt system to ask coordinates, display results, change directory targets, and exit.
* **Third-Party Replaced**: Replaces interactive prompt systems like `inquirer`, `prompts`, or `enquirer`.

### `node:child_process` (Process Execution)
* **Genuinely Used In**: `src/scanner/git_utils.js` (uses `execFileSync`) and `tests/helpers/test_utils.js` (uses `execFile`).
* **What It Enables**: Spawns host git processes synchronously to collect facts like active branches, commits, staging changes, and git-specific configurations. Spawns RepoDoctor CLI in tests to run integration suites.
* **Third-Party Replaced**: Replaces git wrappers like `simple-git` and process launchers like `execa`.

### `node:test` (Native Test Runner)
* **Genuinely Used In**: All test suites in `tests/` (`tests/analyzer/analyzer.test.js`, `tests/analyzer/safety.test.js`, `tests/cli/cli.test.js`, `tests/cli/exit_codes.test.js`, `tests/cli/integration.test.js`, `tests/cli/parser.test.js`, `tests/doctor/doctor.test.js`, `tests/reports/json.test.js`, `tests/reports/report.test.js`, `tests/reports/terminal.test.js`, `tests/scanner/safety.test.js`, `tests/scanner/scanner.test.js`).
* **What It Enables**: Runs all the unit and integration tests using Node's native test-runner suite (`node --test`).
* **Third-Party Replaced**: Replaces heavy testing frameworks like `jest`, `mocha`, `vitest`, or `ava`.

### `node:assert` (Assertions)
* **Genuinely Used In**: All test suites in `tests/`.
* **What It Enables**: Verifies test scenarios, comparing outcomes against expectations.
* **Third-Party Replaced**: Replaces assertion libraries like `chai`, `expect`, or `should`.

### `node:os` (Operating System Details)
* **Genuinely Used In**: `tests/helpers/test_utils.js`, `tests/scanner/safety.test.js`, `tests/scanner/scanner.test.js`, `tests/cli/exit_codes.test.js`, and `tests/cli/cli.test.js`.
* **What It Enables**: Queries operating system details, particularly `os.tmpdir()` to output sandbox directories for CLI integration and scanner safety tests in a cross-platform manner.
* **Third-Party Replaced**: Replaces sandbox libraries like `temp` or `tmp`.

### `node:url` (ES Modules Utilities)
* **Genuinely Used In**: `src/main.js` (lines 205-223), `tests/helpers/test_utils.js`, and `tests/scanner/scanner.test.js`.
* **What It Enables**: Implements ESM metadata handling, such as using `fileURLToPath(import.meta.url)` to load the local package.json relative path and resolve the entry point path correctly.
* **Third-Party Replaced**: Replaces libraries that fetch current filenames or script absolute paths in ESM (like `get-current-line`).

---

## 2. Lightweight Custom-Built Solutions

Because RepoDoctor is completely zero-dependency, standard libraries alone do not provide a complete out-of-the-box solution for CLI features. We implemented the following specialized solutions from scratch:

### CLI Argument & Flag Parsing
* **File Location**: `src/cli/parser.js`
* **How It Works**: Iterates over standard `process.argv.slice(2)` arguments to parse:
  * POSIX options (`--help`, `-h`, `--version`, `-v`, `--verbose`, `--json`, `--no-color`).
  * Short option grouping (e.g. `-vh` correctly turns on help and verbose modes).
  * Positional commands (`scan`, `doctor`, `check`, etc.).
  * Interactive fallback mapping when non-exists.
* **Third-Party Replaced**: `yargs`, `commander`, `minimist`, or `meow`.

### Filesystem Metadata Scanning
* **File Location**: `src/scanner/fs_utils.js`
* **How It Works**: A recursive folder scan stack (`traverseRepo`) avoiding recursion overflow using an iterative DFS (depth-first search) loop. Features include:
  * **Exclusion Policies**: Stops immediately when seeing directories like `.git`, `node_modules`, `dist`, `build`, `vendor`, or `target` to ensure blistering fast execution.
  * **Symlink Safe Traversal**: Registers symlinks but does not enter them, preventing cyclic directory scanner lockups.
  * **Size Cap Protection**: Aborts reading manifest files exceeding `MAX_MANIFEST_SIZE_BYTES` (1 MB) to prevent out-of-memory crashes.
  * **Errors Tracking**: Accumulates filesystem errors (e.g., access denied, stat reading failures) without crashing the scans.
* **Third-Party Replaced**: `globby`, `fast-glob`, or `readdirp`.

### Terminal Colors & ANSI Styling
* **File Location**: `src/reports/terminal.js` and `src/main.js`
* **How It Works**: Leverages a colors object specifying standard raw ANSI escapes (e.g., `\x1b[31m` for red, `\x1b[33m` for yellow, `\x1b[1m` for bold). Also handles conditional coloration:
  * Bypasses ANSI outputs if `--no-color` is set as an argument.
  * Check process environment variables (`NO_COLOR` and `FORCE_COLOR`).
  * Uses `process.stdout.isTTY` to automatically toggle color features depending on terminal interface capability.
* **Third-Party Replaced**: `chalk`, `kleur`, `picocolors`, or `color-support`.

### Custom Dynamic Table Layouts
* **File Location**: `src/reports/terminal.js` (specifically `formatTable`)
* **How It Works**: Scans header names and the columns inside each matrix line, formats them, strips ANSI formatting codes to compute *visible* string lengths, calculates optimal cell boundaries, and prints standard UTF-8 bordered tables.
* **Third-Party Replaced**: `cli-table3`, `table`, or `ascii-table`.

### Terminal Output Layout & Word-Wrapping
* **File Location**: `src/reports/terminal.js` (specifically `wrapTextToLines` and `padText`)
* **How It Works**: Splices finding blocks by lines and spaces, wrapping them to 64-character constraints while maintaining left vertical border decorations (`│` / `┃`) and spacing. It handles Unicode characters and trims lines gracefully.
* **Third-Party Replaced**: `wrap-ansi`, `word-wrap`, or `boxen`.

### serialization & Diagnostics
* **File Location**: `src/reports/json.js` and `src/doctor/formatter.js`
* **How It Works**: Standardizes output formatting by serializing JSON using the native `JSON.stringify(report, null, 2)` call. Diagnostic severity comparisons and findings priority rules are resolved natively using JS arrays and objects array logic mapping.
* **Third-Party Replaced**: Replaces schema serialization or sorting libraries (like `lodash.difference`, `fast-json-stringify`).
