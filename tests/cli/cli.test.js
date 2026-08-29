import test from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { runCli } from '../helpers/test_utils.js';

test('CLI - --help prints help text and exits 0', async () => {
  const result = await runCli(['--help']);
  assert.strictEqual(result.code, 0);
  assert.ok(result.stdout.includes('Usage:'));
  assert.ok(result.stdout.includes('Available Commands:'));
  assert.strictEqual(result.stderr, '');
});

test('CLI - -h prints help text and exits 0', async () => {
  const result = await runCli(['-h']);
  assert.strictEqual(result.code, 0);
  assert.ok(result.stdout.includes('Usage:'));
  assert.strictEqual(result.stderr, '');
});

test('CLI - --version prints version and exits 0', async () => {
  const result = await runCli(['--version']);
  assert.strictEqual(result.code, 0);
  assert.match(result.stdout, /^repodoctor version \d+\.\d+\.\d+/);
  assert.strictEqual(result.stderr, '');
});

test('CLI - -v prints version and exits 0', async () => {
  const result = await runCli(['-v']);
  assert.strictEqual(result.code, 0);
  assert.match(result.stdout, /^repodoctor version \d+\.\d+\.\d+/);
  assert.strictEqual(result.stderr, '');
});

test('CLI - default path invocation on current directory', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'repodoctor-default-'));
  try {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'default-test', version: '1.0.0' }));
    fs.writeFileSync(path.join(tmpDir, 'index.js'), 'console.log("hello");\n');
    const result = await runCli([tmpDir]);
    assert.strictEqual(result.code, 0);
    assert.ok(result.stdout.includes('Routed to default command'));
    assert.strictEqual(result.stderr, '');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('CLI - scan command on current directory', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'repodoctor-scan-'));
  try {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'scan-test', version: '1.0.0' }));
    fs.writeFileSync(path.join(tmpDir, 'index.js'), 'console.log("hello");\n');
    const result = await runCli(['scan', tmpDir]);
    assert.strictEqual(result.code, 0);
    assert.ok(result.stdout.includes("Routed to 'scan' command"));
    assert.strictEqual(result.stderr, '');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('CLI - check command exits with FINDINGS (1) on repo missing documentation', async () => {
  // Use an isolated temp dir with known content so this test is deterministic
  // regardless of the state of the host repository.
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'repodoctor-check-'));
  try {
    // package.json + source file only; no README, no LICENSE → 2 warnings
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'check-test', version: '1.0.0' }));
    fs.writeFileSync(path.join(tmpDir, 'index.js'), 'console.log("hello");\n');
    const result = await runCli(['check', tmpDir]);
    assert.strictEqual(result.code, 1);
    assert.ok(result.stdout.includes("Routed to 'check' command"));
    assert.strictEqual(result.stderr, '');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('CLI - doctor command exits with FINDINGS (1) on repo missing documentation', async () => {
  // Use an isolated temp dir with known content so this test is deterministic
  // regardless of the state of the host repository.
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'repodoctor-doctor-'));
  try {
    // package.json + source file only; no README, no LICENSE → 2 warnings
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'doctor-test', version: '1.0.0' }));
    fs.writeFileSync(path.join(tmpDir, 'index.js'), 'console.log("hello");\n');
    const result = await runCli(['doctor', tmpDir]);
    assert.strictEqual(result.code, 1);
    assert.ok(result.stdout.includes('doctor-test'));
    assert.ok(result.stdout.includes('Findings'));
    assert.strictEqual(result.stderr, '');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('CLI - unknown command exits with USAGE_ERROR (2)', async () => {
  const result = await runCli(['unknown_cmd']);
  assert.strictEqual(result.code, 2);
  assert.ok(result.stderr.includes('Error: Unknown command: unknown_cmd'));
  assert.strictEqual(result.stdout, '');
});

test('CLI - unknown option exits with USAGE_ERROR (2)', async () => {
  const result = await runCli(['--unknown-option']);
  assert.strictEqual(result.code, 2);
  assert.ok(result.stderr.includes('Error: Unknown option: --unknown-option'));
  assert.strictEqual(result.stdout, '');
});

test('CLI - non-existent path exits with IO_ERROR (3)', async () => {
  const result = await runCli(['scan', './non_existent_folder_abc']);
  assert.strictEqual(result.code, 3);
  assert.ok(result.stderr.includes('Error: The specified path does not exist: ./non_existent_folder_abc'));
  assert.strictEqual(result.stdout, '');
});

test('CLI - verbose flag logs verbose output and stack trace on error', async () => {
  const result = await runCli(['--verbose', 'scan', './non_existent_folder_abc']);
  assert.strictEqual(result.code, 3);
  assert.ok(result.stdout.includes('[verbose] Target path resolved to:'));
  assert.ok(result.stderr.includes('Error: The specified path does not exist: ./non_existent_folder_abc'));
  assert.ok(result.stderr.includes('--- Stack Trace ---'));
});

test('CLI Phase 4 - doctor on clean directory exits SUCCESS (0) and shows healthy message', async () => {
  // Create a minimal clean directory with no findings
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'repodoctor-clean-'));
  try {
    // Write a README, LICENSE, package.json with a JS source file
    fs.writeFileSync(path.join(tmpDir, 'README.md'), '# Test Project\n');
    fs.writeFileSync(path.join(tmpDir, 'LICENSE'), 'MIT License\n');
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'clean-test', version: '1.0.0' }));
    fs.writeFileSync(path.join(tmpDir, 'index.js'), 'console.log("hello");\n');
    // No .git dir → scanner won't check uncommitted-changes or missing-gitignore
    const result = await runCli(['doctor', tmpDir]);
    assert.strictEqual(result.code, 0, `Expected exit 0, got ${result.code}. stdout: ${result.stdout}`);
    assert.ok(result.stdout.includes('No issues detected'), `Expected 'No issues detected'. Got: ${result.stdout}`);
    assert.strictEqual(result.stderr, '');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('CLI Phase 4 - doctor formatted output contains Why and Recommendation sections', async () => {
  // Directory with a missing README to trigger at least one finding
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'repodoctor-findings-'));
  try {
    // Only a package.json and JS file — no README, no LICENSE
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'partial-test', version: '1.0.0' }));
    fs.writeFileSync(path.join(tmpDir, 'index.js'), 'console.log("hello");\n');
    const result = await runCli(['doctor', tmpDir]);
    assert.strictEqual(result.code, 1, `Expected exit 1 (findings). Got: ${result.code}. stdout: ${result.stdout}`);
    assert.ok(result.stdout.includes('Why:'), `Expected 'Why:' section. Got: ${result.stdout}`);
    assert.ok(result.stdout.includes('Recommendation:'), `Expected 'Recommendation:' section. Got: ${result.stdout}`);
    assert.strictEqual(result.stderr, '');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
