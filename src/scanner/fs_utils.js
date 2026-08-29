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

  const importantFileLower = IMPORTANT_FILES.map(f => f.toLowerCase());
  const importantFileMap = Object.fromEntries(
    IMPORTANT_FILES.map(f => [f.toLowerCase(), f])
  );

  function walk(currentDir) {
    let items;
    try {
      items = fs.readdirSync(currentDir);
    } catch {
      // If a folder itself is inaccessible, skip recursive walk
      return;
    }

    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const relativePath = path.relative(rootDir, fullPath);
      const posixPath = relativePath.split(path.sep).join('/');

      let lstat;
      try {
        lstat = fs.lstatSync(fullPath);
      } catch {
        // Skip files that generate errors on access (broken symlinks, access errors)
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

        walk(fullPath);
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
    }
  }

  walk(rootDir);

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
    entries
  };
}
