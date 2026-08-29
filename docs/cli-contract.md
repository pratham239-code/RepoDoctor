# RepoDoctor CLI Contract (Phase 1)

This document defines the formal CLI interface contract for RepoDoctor.

---

## 1. Usage Signature

```text
repodoctor [options] [command] [path]
```

- **`options`**: Zero or more optional flags (e.g. `--verbose`).
- **`command`**: An optional command name (`scan`, `check`, or `doctor`). If omitted, the CLI invokes the default handler.
- **`path`**: An optional file or directory path. Defaults to `.` (the current working directory) if not provided.

---

## 2. Supported Options

| Long Option | Short Option | Type | Description |
| :--- | :--- | :--- | :--- |
| `--help` | `-h` | Boolean | Prints the help text and exits with code `0`. Takes priority over commands. |
| `--version` | `-v` | Boolean | Prints the current version string and exits with code `0`. Takes priority over commands. |
| `--verbose` | N/A | Boolean | Enables verbose output, including detailed filesystem paths and full error stack traces on failure. |

*Note: Short options can be grouped (e.g., `-vh` or `-hv`).*

---

## 3. Supported Commands

RepoDoctor supports the following commands in Phase 1:

- **`scan`**: Routes to the scanner stub (future: scans dependencies and metadata).
- **`check`**: Routes to the check stub (future: runs rules and checks package health).
- **`doctor`**: Routes to the diagnostic stub (future: compiles comprehensive health report).
- **(default)**: Used when no command string is specified (e.g., `repodoctor .`).

---

## 4. Exit Codes

RepoDoctor uses a centralized set of numeric exit codes:

| Name | Code | Description |
| :--- | :--- | :--- |
| `SUCCESS` | `0` | Command executed successfully with no findings/issues. |
| `FINDINGS` | `1` | Command executed successfully but issues were detected (reserved for future phases). |
| `USAGE_ERROR` | `2` | User input error (invalid option, unknown command, unexpected arguments). |
| `IO_ERROR` | `3` | Filesystem issue (e.g., specified target path does not exist). |
| `INTERNAL_ERROR` | `4` | Unexpected application failure or bug. |

---

## 5. Output Streams (STDOUT & STDERR)

- **`stdout`**:
  - Normal command output (e.g., help text, version information, successful routing logs).
- **`stderr`**:
  - Error messages and diagnostics (e.g., invalid flags, usage warnings, path not found errors).
  - Normal CLI errors print as: `Error: <message>`.
  - When `--verbose` is active, the raw stack trace of the error is appended to `stderr` below the message.

---

## 6. Examples

### Standard Invocation
```powershell
repodoctor .
```
- Routes to: Default handler
- Path: Current directory (`.`)
- Output: `Routed to default command for path: <resolved-path>`

### Command with Path
```powershell
repodoctor scan ./my-project
```
- Routes to: `scan` handler
- Path: `./my-project`
- Output: `Routed to 'scan' command for path: <resolved-path>`

### Command with Flags
```powershell
repodoctor check --verbose
```
- Routes to: `check` handler
- Path: Current directory (`.`)
- Options: `verbose = true`
- Output:
  ```text
  [verbose] Target path resolved to: <resolved-path>
  Routed to 'check' command for path: <resolved-path>
  [verbose] Check mode running in verbose details.
  ```

### Invalid Options
```powershell
repodoctor --invalid-flag
```
- Exit Code: `2` (USAGE_ERROR)
- Output (stderr): `Error: Unknown option: --invalid-flag`

### Invalid Path
```powershell
repodoctor scan ./non-existent-dir
```
- Exit Code: `3` (IO_ERROR)
- Output (stderr): `Error: The specified path does not exist: ./non-existent-dir`
