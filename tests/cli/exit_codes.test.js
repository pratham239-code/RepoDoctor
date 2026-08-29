import test from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { runCli, createFixture, cleanupFixture } from '../helpers/test_utils.js';

test('ExitCodes - SUCCESS (0) for healthy repository', async () => {
  const dir = createFixture('healthy');
  try {
    const result = await runCli(['doctor', dir]);
    assert.strictEqual(result.code, 0);
    assert.ok(result.stdout.includes('No issues detected'));
    assert.strictEqual(result.stderr, '');
  } finally {
    cleanupFixture(dir);
  }
});

test('ExitCodes - SUCCESS (0) for scan command on healthy repository', async () => {
  const dir = createFixture('healthy');
  try {
    const result = await runCli(['scan', dir]);
    assert.strictEqual(result.code, 0);
    assert.ok(result.stdout.includes("Routed to 'scan' command"));
    assert.strictEqual(result.stderr, '');
    
    // Verify stdout contains a valid JSON snapshot structure
    const lines = result.stdout.split('\n');
    const jsonStartIndex = lines.findIndex(l => l.trim().startsWith('{'));
    assert.ok(jsonStartIndex !== -1);
    const jsonStr = lines.slice(jsonStartIndex).join('\n');
    const snapshot = JSON.parse(jsonStr);
    assert.strictEqual(snapshot.project.name, 'healthy-fixture');
  } finally {
    cleanupFixture(dir);
  }
});

test('ExitCodes - SUCCESS (0) for --help and -h', async () => {
  const resultLong = await runCli(['--help']);
  assert.strictEqual(resultLong.code, 0);
  assert.ok(resultLong.stdout.includes('Usage:'));
  assert.strictEqual(resultLong.stderr, '');

  const resultShort = await runCli(['-h']);
  assert.strictEqual(resultShort.code, 0);
  assert.ok(resultShort.stdout.includes('Usage:'));
  assert.strictEqual(resultShort.stderr, '');
});

test('ExitCodes - SUCCESS (0) for --version and -v', async () => {
  const resultLong = await runCli(['--version']);
  assert.strictEqual(resultLong.code, 0);
  assert.match(resultLong.stdout, /^repodoctor version \d+\.\d+\.\d+/);
  assert.strictEqual(resultLong.stderr, '');

  const resultShort = await runCli(['-v']);
  assert.strictEqual(resultShort.code, 0);
  assert.match(resultShort.stdout, /^repodoctor version \d+\.\d+\.\d+/);
  assert.strictEqual(resultShort.stderr, '');
});

test('ExitCodes - FINDINGS (1) for empty repository', async () => {
  const dir = createFixture('empty');
  try {
    const result = await runCli(['doctor', dir]);
    assert.strictEqual(result.code, 1);
    assert.ok(result.stdout.includes('[INFO] Empty repository'));
    assert.strictEqual(result.stderr, '');
  } finally {
    cleanupFixture(dir);
  }
});

test('ExitCodes - FINDINGS (1) for missing documentation', async () => {
  const dir = createFixture('missing_docs');
  try {
    const result = await runCli(['doctor', dir]);
    assert.strictEqual(result.code, 1);
    assert.ok(result.stdout.includes('[WARNING] Missing README file'));
    assert.ok(result.stdout.includes('[WARNING] Missing LICENSE file'));
    assert.strictEqual(result.stderr, '');
  } finally {
    cleanupFixture(dir);
  }
});

test('ExitCodes - FINDINGS (1) for duplicate dependency', async () => {
  const dir = createFixture('duplicate_dependency');
  try {
    const result = await runCli(['doctor', dir]);
    assert.strictEqual(result.code, 1);
    assert.ok(result.stdout.includes('[ERROR] Duplicate dependency declaration'));
    assert.strictEqual(result.stderr, '');
  } finally {
    cleanupFixture(dir);
  }
});

test('ExitCodes - USAGE_ERROR (2) for unknown option', async () => {
  const result = await runCli(['--invalid-flag-xyz']);
  assert.strictEqual(result.code, 2);
  assert.ok(result.stderr.includes('Error: Unknown option: --invalid-flag-xyz'));
  assert.strictEqual(result.stdout, '');
});

test('ExitCodes - USAGE_ERROR (2) for unknown command', async () => {
  const result = await runCli(['nonexistentcommand']);
  assert.strictEqual(result.code, 2);
  assert.ok(result.stderr.includes('Error: Unknown command: nonexistentcommand'));
  assert.strictEqual(result.stdout, '');
});

test('ExitCodes - USAGE_ERROR (2) for extra positional arguments', async () => {
  const result = await runCli(['scan', 'dir1', 'dir2']);
  assert.strictEqual(result.code, 2);
  assert.ok(result.stderr.includes('Error: Unexpected argument: dir2'));
  assert.strictEqual(result.stdout, '');
});

test('ExitCodes - IO_ERROR (3) for non-existent path', async () => {
  const nonexistentPath = path.join(os.tmpdir(), 'repodoctor-nonexistent-path-123456');
  const result = await runCli(['doctor', nonexistentPath]);
  assert.strictEqual(result.code, 3);
  assert.ok(result.stderr.includes('Error: The specified path does not exist'));
  assert.strictEqual(result.stdout, '');
});

test('ExitCodes - IO_ERROR (3) for path pointing to a file', async () => {
  const dir = createFixture('healthy');
  try {
    const fileTarget = path.join(dir, 'index.js');
    const result = await runCli(['doctor', fileTarget]);
    assert.strictEqual(result.code, 3);
    assert.ok(result.stderr.includes('Error: The specified path is a file, not a directory'));
    assert.strictEqual(result.stdout, '');
  } finally {
    cleanupFixture(dir);
  }
});

test('Output Purity - JSON mode outputs ONLY valid JSON on stdout', async () => {
  const dir = createFixture('missing_docs');
  try {
    // Run CLI in verbose mode with --json flag
    const result = await runCli(['--verbose', 'doctor', '--json', dir]);
    
    // Process exit code must be 1 because of missing readme and license
    assert.strictEqual(result.code, 1);
    
    // Check that stdout parses as valid JSON cleanly without any non-JSON prepended/postpended text
    const parsed = JSON.parse(result.rawStdout.trim());
    assert.strictEqual(parsed.repository, 'missing-docs-fixture');
    assert.strictEqual(parsed.summary.total, 2);
    
    // Verify that verbose logs are redirected to stderr to prevent stdout contamination
    assert.ok(result.rawStderr.includes('[verbose]'));
  } finally {
    cleanupFixture(dir);
  }
});

test('Output Purity - NO_COLOR environment variable disables color codes', async () => {
  const dir = createFixture('missing_docs');
  try {
    const result = await runCli(['doctor', dir], { NO_COLOR: '1' });
    assert.ok(!result.rawStdout.includes('\x1b['));
    assert.ok(!result.rawStderr.includes('\x1b['));
  } finally {
    cleanupFixture(dir);
  }
});

test('Output Purity - FORCE_COLOR environment variable forces color codes', async () => {
  const dir = createFixture('missing_docs');
  try {
    const result = await runCli(['doctor', dir], { FORCE_COLOR: '1' });
    // Color output should contain ANSI escape codes
    assert.ok(result.rawStdout.includes('\x1b['));
  } finally {
    cleanupFixture(dir);
  }
});
