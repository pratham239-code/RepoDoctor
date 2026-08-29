import fs from 'node:fs';
import path from 'node:path';

// Excluded directories list for Phase 2 Scanner
export const EXCLUDED_DIRECTORIES = ['.git', 'node_modules', 'vendor', 'build', 'dist', 'target'];

// Recognizable project configurations and manifest files
export const IMPORTANT_FILES = [
  'README.md',
  'LICENSE',
  '.gitignore',
  'package.json',
  'pyproject.toml',
  'Cargo.toml',
  'go.mod',
  'pom.xml',
  'Makefile',
  'Dockerfile'
];

// Named configuration constant for maximum size of manifests (e.g. package.json)
export const MAX_MANIFEST_SIZE_BYTES = 1024 * 1024; // 1 MB

/**
 * Traverses a repository directory recursively to collect filesystem stats, counts, and flags.
 * 
 * @param {string} rootDir Resolved absolute path to the repository directory
 * @returns {object} Discovered file details, counts, size metrics, and important config paths
 */
export function traverseRepo(rootDir) {
  let totalCount = 0;
  let totalDirectoryCount = 0;
  let totalSizeOctets = 0;
  const entries = [];
  const configs = [];
  const scanErrors = [];

  const importantFileLower = IMPORTANT_FILES.map(f => f.toLowerCase());
  const importantFileMap = Object.fromEntries(
    IMPORTANT_FILES.map(f => [f.toLowerCase(), f])
  );

  const stack = [
    {
      dir: rootDir,
      items: null,
      index: 0
    }
  ];

  while (stack.length > 0) {
    const frame = stack[stack.length - 1];

    if (frame.items === null) {
      try {
        frame.items = fs.readdirSync(frame.dir);
      } catch (err) {
        const relativePath = path.relative(rootDir, frame.dir);
        const posixPath = relativePath.split(path.sep).join('/');
        scanErrors.push({
          type: 'access-denied',
          path: posixPath,
          code: err.code || 'UNKNOWN',
          message: err.message
        });
        stack.pop();
        continue;
      }
    }

    if (frame.index < frame.items.length) {
      const item = frame.items[frame.index];
      frame.index++;

      const fullPath = path.join(frame.dir, item);
      const relativePath = path.relative(rootDir, fullPath);
      const posixPath = relativePath.split(path.sep).join('/');

      let lstat;
      try {
        lstat = fs.lstatSync(fullPath);
      } catch (err) {
        scanErrors.push({
          type: 'lstat-failed',
          path: posixPath,
          code: err.code || 'UNKNOWN',
          message: err.message
        });
        continue;
      }

      const lowerName = item.toLowerCase();

      // Symlink Protection: Record symlinks without entering / resolving recursively
      if (lstat.isSymbolicLink()) {
        entries.push({
          path: posixPath,
          type: 'symlink',
          size: lstat.size,
          extension: path.extname(item) || null
        });
        totalCount++;
        totalSizeOctets += lstat.size;
        continue;
      }

      if (lstat.isDirectory()) {
        // Exclusion Policy check: Skip excluded directories
        if (EXCLUDED_DIRECTORIES.includes(item)) {
          continue;
        }

        totalDirectoryCount++;
        entries.push({
          path: posixPath,
          type: 'directory'
        });

        stack.push({
          dir: fullPath,
          items: null,
          index: 0
        });
      } else if (lstat.isFile()) {
        totalCount++;
        totalSizeOctets += lstat.size;

        const ext = path.extname(item);
        entries.push({
          path: posixPath,
          type: 'file',
          size: lstat.size,
          extension: ext || null
        });

        // Config file detection (root folder only)
        if (importantFileLower.includes(lowerName)) {
          const canonicalName = importantFileMap[lowerName];
          if (!posixPath.includes('/')) {
            configs.push(canonicalName);
          }
        }
      }
    } else {
      stack.pop();
    }
  }

  // Calculate helper binary flags for standard items found at root
  const rootFiles = entries.filter(e => !e.path.includes('/'));
  const hasPackageJson = rootFiles.some(e => e.path.toLowerCase() === 'package.json');
  const hasLicense = rootFiles.some(e => e.path.toLowerCase() === 'license');
  const hasReadme = rootFiles.some(e => e.path.toLowerCase() === 'readme.md');
  const hasGitignore = rootFiles.some(e => e.path.toLowerCase() === '.gitignore');

  return {
    totalCount,
    totalDirectoryCount,
    totalSizeOctets,
    hasPackageJson,
    hasLicense,
    hasReadme,
    hasGitignore,
    configs: Array.from(new Set(configs)).sort(),
    entries,
    scanErrors
  };
}
