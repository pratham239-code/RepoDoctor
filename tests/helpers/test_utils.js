import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cliEntry = path.resolve(__dirname, '../../src/main.js');

/**
 * Runs the RepoDoctor CLI inside a Node.js child process.
 *
 * @param {string[]} args CLI arguments
 * @param {object} env Optional environment variable overrides
 * @returns {Promise<{ code: number, stdout: string, stderr: string }>}
 */
export function runCli(args = [], env = {}) {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [cliEntry, ...args],
      { env: { ...process.env, ...env } },
      (error, stdout, stderr) => {
        resolve({
          code: error ? (error.code ?? 1) : 0,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          rawStdout: stdout,
          rawStderr: stderr,
        });
      }
    );
  });
}

/**
 * Creates a deterministic temporary repository fixture.
 *
 * @param {string} type The type of fixture ('healthy', 'missing_docs', 'duplicate_dependency', 'malformed_json', 'empty')
 * @param {object} customFiles Optional dictionary of filename -> content mappings to override or add files
 * @returns {string} The absolute path to the temporary directory
 */
export function createFixture(type, customFiles = {}) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'repodoctor-fixture-'));

  const fixtures = {
    healthy: {
      'package.json': JSON.stringify({
        name: 'healthy-fixture',
        version: '1.0.0',
        type: 'module',
      }, null, 2),
      'README.md': '# Healthy Fixture\nThis is a healthy test repository.\n',
      'LICENSE': 'MIT License\n',
      'index.js': 'console.log("hello world");\n',
    },
    missing_docs: {
      'package.json': JSON.stringify({
        name: 'missing-docs-fixture',
        version: '1.0.0',
        type: 'module',
      }, null, 2),
      'index.js': 'console.log("hello world");\n',
    },
    duplicate_dependency: {
      'package.json': JSON.stringify({
        name: 'duplicate-dependency-fixture',
        version: '1.0.0',
        type: 'module',
        dependencies: {
          lodash: '^4.17.21',
        },
        devDependencies: {
          lodash: '^4.17.21',
        },
      }, null, 2),
      'README.md': '# Duplicate Dependency Fixture\n',
      'LICENSE': 'MIT License\n',
      'index.js': 'console.log("hello world");\n',
    },
    malformed_json: {
      'package.json': '{\n  "name": "malformed-fixture",\n  "dependencies": {\n',
      'README.md': '# Malformed JSON Fixture\n',
      'LICENSE': 'MIT License\n',
    },
    empty: {},
  };

  const files = { ...fixtures[type], ...customFiles };

  for (const [filename, content] of Object.entries(files)) {
    const filePath = path.join(tempDir, filename);
    const parentDir = path.dirname(filePath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    fs.writeFileSync(filePath, content);
  }

  return tempDir;
}

/**
 * Safely removes a directory recursively.
 *
 * @param {string} dirPath The path to delete
 */
export function cleanupFixture(dirPath) {
  if (dirPath && fs.existsSync(dirPath)) {
    try {
      fs.rmSync(dirPath, { recursive: true, force: true });
    } catch {
      // Ignore cleanup failures in test env
    }
  }
}
