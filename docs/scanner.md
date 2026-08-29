# RepoDoctor - Phase 2 Repository Scanner Documentation

This document describes the design, implementation patterns, and contract constraints of the RepoDoctor Phase 2 Repository Scanner.

---

## 1. Scope of Scan

The Repository Scanner is designed to run offline and perform pure, non-judgmental **fact collection**. Its sole responsibility is to compile a raw snapshot of the targeted directory.

### What it Scans:
*   **Directory Layout**: Lists paths, sizes, and extensions of files.
*   **Important Configs**: Detects presence at the root directory of standard configuration and manifest files (e.g. `package.json`, `README.md`, `LICENSE`, `.gitignore`, `go.mod`, etc.).
*   **Dependencies**: Gathers names and range versions of runtime, development, peer, and optional dependencies defined inside the root `package.json`.
*   **Local Git Status**: Optionally resolves active branch names, latest commit stats (hash, author name, date, text description), and checks if uncommitted edits exist.

### What it does NOT Analyze:
*   Does not judge repository quality, score health, or warn of deprecated APIs.
*   Does not analyze, report, or diagnose vulnerabilities within dependencies.
*   Does not connect to external network registries (like npm, GitHub, or HTTP/REST APIs).
*   Does not edit, correct, write, or fix files.
*   Does not generate final human-readable check lists (reports are compiled downstream in future phases).

---

## 2. Directory Traversal & Exclusions

To ensure CLI execution remains highly performant and secure against massive subdirectories, the scanner implements a strict traversal policy.

### Folder Exclusions:
The recursive directory walk fully avoids entering the following folders:
*   `.git` (Separate custom git checks are made, but standard recursive directory walking skips this to prevent bloating counts)
*   `node_modules`
*   `vendor`
*   `build`
*   `dist`
*   `target`

### Symlink Policy:
*   Before checking any filesystem path, the walker runs `fs.lstatSync(path)`.
*   If the entity is a symbolic link (`isSymbolicLink() === true`), the scanner cataloges the item as a file with `type: 'symlink'` but **does not follow it**.
*   This prevents infinite loops, cycles, and traversal leakages outside the repository constraints.

---

## 3. Safe Git Extraction

Git metadata extraction is optional and strictly local. We use safe argument bindings to interface with the local system:

*   **Optional Behavior**: If `git` is not installed on the system, commands fail, or the scan target is not a git repository, the scanner catches all errors silently. It resolves `git.isRepo = false` (or returns empty metadata placeholders) without throwing errors or causing CLI failures.
*   **Local Queries**: All Git stats queries are retrieved directly from the matching workspace path via native subprocess bindings. No remote fetches or network connections are made.
*   **Execution Safety**: Uses `child_process.execFileSync` passing arguments as a clean string list (preventing shell word-splitting or command injection issues).

---

## 4. RepositorySnapshot Structure

The scanner returns a deterministic JSON object structure. Example representation:

```json
{
  "timestamp": "2026-08-29T11:05:15.000Z",
  "scannerVersion": "1.0.0",
  "project": {
    "name": "repodoctor",
    "version": "1.0.0",
    "type": "module",
    "path": "C:\\path\\to\\project"
  },
  "git": {
    "isRepo": true,
    "currentBranch": "main",
    "latestCommit": {
      "hash": "8f8b820...",
      "author": "Developer 2",
      "date": "2026-08-29T05:06:16Z",
      "message": "Commit message log details"
    },
    "hasUncommittedChanges": false
  },
  "files": {
    "totalCount": 18,
    "totalDirectoryCount": 3,
    "totalSizeOctets": 18765,
    "hasPackageJson": true,
    "hasLicense": true,
    "hasReadme": true,
    "hasGitignore": true,
    "configs": [
      "LICENSE",
      "README.md",
      "package.json"
    ],
    "entries": [
      {
        "path": "src/main.js",
        "type": "file",
        "size": 1475,
        "extension": ".js"
      },
      ...
    ]
  },
  "dependencies": {
    "dependencies": {},
    "devDependencies": {},
    "peerDependencies": {},
    "optionalDependencies": {}
  }
}
```

If the root `package.json` file is malformed, the `dependencies` object will contain an `error` key indicating the JSON parsing failure string, rather than preventing scanner execution.
