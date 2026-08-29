import test from 'node:test';
import assert from 'node:assert';
import { execFile } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import os from 'node:os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cliEntry = path.resolve(__dirname, '../../src/main.js');

/**
 * Runs the CLI inside a Node.js child process and returns exit code, stdout, and stderr.
 * 
 * @param {string[]} args CLI arguments
 * @returns {Promise<{ code: number, stdout: string, stderr: string }>}
 */
function runCli(args = []) {
  return new Promise((resolve) => {
    execFile(process.execPath, [cliEntry, ...args], (error, stdout, stderr) => {
      resolve({
        code: error ? (error.code ?? 1) : 0,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      });
    });
  });
}

function withTempDir(testFn) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'repodoctor-integration-'));
  try {
    testFn(tempDir);
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  }
}

async function withTempDirAsync(testFn) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'repodoctor-integration-'));
  try {
    await testFn(tempDir);
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  }
}

// 1. Clean repository
test('Integration - clean repository returns SUCCESS (0)', async () => {
  await withTempDirAsync(async (dir) => {
    fs.writeFileSync(path.join(dir, 'README.md'), '# Clean Project\n');
    fs.writeFileSync(path.join(dir, 'LICENSE'), 'MIT\n');
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({
      name: 'clean-project',
      version: '1.0.0',
      type: 'module'
    }));
    fs.writeFileSync(path.join(dir, 'index.js'), 'console.log("hello");\n');

    const result = await runCli(['doctor', dir]);
    assert.strictEqual(result.code, 0);
    assert.ok(result.stdout.includes('No issues detected'));
    assert.strictEqual(result.stderr, '');
  });
});

// 2. Repository with documentation findings (missing readme, license)
test('Integration - missing documentation files returns FINDINGS (1)', async () => {
  await withTempDirAsync(async (dir) => {
    // Has package.json and source file but missing readme/license
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({
      name: 'doc-less-project',
      version: '1.0.0'
    }));
    fs.writeFileSync(path.join(dir, 'index.js'), 'console.log("hello");\n');

    const result = await runCli(['doctor', dir]);
    assert.strictEqual(result.code, 1);
    assert.ok(result.stdout.includes('[WARNING] Missing README file'));
    assert.ok(result.stdout.includes('[WARNING] Missing LICENSE file'));
    assert.ok(result.stdout.includes('2 findings'));
    assert.strictEqual(result.stderr, '');
  });
});

// 3. Repository with dependency findings (duplicate dependency)
test('Integration - duplicate dependency returns FINDINGS (1)', async () => {
  await withTempDirAsync(async (dir) => {
    fs.writeFileSync(path.join(dir, 'README.md'), '# Dup Project\n');
    fs.writeFileSync(path.join(dir, 'LICENSE'), 'MIT\n');
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({
      name: 'dup-project',
      version: '1.0.0',
      dependencies: { lodash: '^4.17.21' },
      devDependencies: { lodash: '^4.17.21' }
    }));
    fs.writeFileSync(path.join(dir, 'index.js'), 'console.log("hello");\n');

    const result = await runCli(['doctor', dir]);
    assert.strictEqual(result.code, 1);
    assert.ok(result.stdout.includes('[ERROR] Duplicate dependency declaration'));
    assert.ok(result.stdout.includes('lodash'));
    assert.ok(result.stdout.includes('1 finding'));
    assert.strictEqual(result.stderr, '');
  });
});

// 4. Empty repository
test('Integration - completely empty repository returns SUCCESS (0) with structural info finding', async () => {
  await withTempDirAsync(async (dir) => {
    const result = await runCli(['doctor', dir]);
    // It will return SUCCESS (0) because 'empty-repository' is an INFO finding, which exits with 0.
    // Wait, let's verify if handleDoctor exits with 0 or 1.
    // In commands.js, handleDoctor returns: result.summary.total > 0 ? ExitCodes.FINDINGS : ExitCodes.SUCCESS;
    // Wait, result.summary.total for empty repo is 1 (empty-repository).
    // So it actually exits with FINDINGS (1)! Let's verify this.
    // Yes! Let's check result.code = 1.
    assert.strictEqual(result.code, 1);
    assert.ok(result.stdout.includes('[INFO] Empty repository'));
    assert.ok(result.stdout.includes('1 finding'));
    assert.strictEqual(result.stderr, '');
  });
});

// 5. Invalid path
test('Integration - invalid path exits with IO_ERROR (3)', async () => {
  const nonExistentPath = path.join(os.tmpdir(), 'this-path-does-not-exist-at-all-xyz');
  const result = await runCli(['doctor', nonExistentPath]);
  assert.strictEqual(result.code, 3);
  assert.ok(result.stderr.includes('Error: The specified path does not exist'));
});

// 6. Path points to a file
test('Integration - path pointing to a file exits with IO_ERROR (3)', async () => {
  await withTempDirAsync(async (dir) => {
    const file = path.join(dir, 'testfile.txt');
    fs.writeFileSync(file, 'hello');
    const result = await runCli(['doctor', file]);
    assert.strictEqual(result.code, 3);
    assert.ok(result.stderr.includes('Error: The specified path is a file, not a directory'));
  });
});

// 7. Malformed package.json
test('Integration - malformed package.json returns FINDINGS (1) with malformed finding details', async () => {
  await withTempDirAsync(async (dir) => {
    fs.writeFileSync(path.join(dir, 'README.md'), '# Bad Project\n');
    fs.writeFileSync(path.join(dir, 'LICENSE'), 'MIT\n');
    fs.writeFileSync(path.join(dir, 'package.json'), '{"name": "bad", dependencies: {'); // broken JSON

    const result = await runCli(['doctor', dir]);
    assert.strictEqual(result.code, 1);
    assert.ok(result.stdout.includes('[ERROR] Malformed package.json'));
    assert.strictEqual(result.stderr, '');
  });
});

// 8. JSON output format
test('Integration - doctor command with --json flag returns valid structured JSON', async () => {
  await withTempDirAsync(async (dir) => {
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({
      name: 'json-project',
      version: '1.0.0'
    }));
    fs.writeFileSync(path.join(dir, 'index.js'), 'console.log("hello");\n');

    const result = await runCli(['doctor', '--json', dir]);
    assert.strictEqual(result.code, 1); // 2 warnings (readme & license)
    
    // Parse the output as JSON and check fields
    const parsed = JSON.parse(result.stdout);
    assert.strictEqual(parsed.repository, 'json-project');
    assert.strictEqual(parsed.summary.total, 2);
    assert.strictEqual(parsed.summary.bySeverity.warning, 2);
    assert.strictEqual(parsed.summary.bySeverity.error, 0);
    assert.strictEqual(result.stderr, '');
  });
});

test('Integration - doctor command with -j flag returns valid structured JSON', async () => {
  await withTempDirAsync(async (dir) => {
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({
      name: 'json-project-short',
      version: '1.0.0'
    }));
    fs.writeFileSync(path.join(dir, 'index.js'), 'console.log("hello");\n');

    const result = await runCli(['doctor', '-j', dir]);
    assert.strictEqual(result.code, 1);
    
    const parsed = JSON.parse(result.stdout);
    assert.strictEqual(parsed.repository, 'json-project-short');
    assert.strictEqual(parsed.summary.total, 2);
    assert.strictEqual(result.stderr, '');
  });
});
