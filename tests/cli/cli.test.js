import test from 'node:test';
import assert from 'node:assert';
import { execFile } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mainScript = path.resolve(__dirname, '../../src/main.js');

/**
 * Runs the CLI inside a Node.js child process and returns exit code, stdout, and stderr.
 * 
 * @param {string[]} args CLI arguments
 * @returns {Promise<{ code: number, stdout: string, stderr: string }>}
 */
function runCli(args = []) {
  return new Promise((resolve) => {
    execFile(process.execPath, [mainScript, ...args], (error, stdout, stderr) => {
      resolve({
        code: error ? (error.code ?? 1) : 0,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      });
    });
  });
}

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
  const result = await runCli(['.']);
  assert.strictEqual(result.code, 0);
  assert.ok(result.stdout.includes('Routed to default command'));
  assert.strictEqual(result.stderr, '');
});

test('CLI - scan command on current directory', async () => {
  const result = await runCli(['scan', '.']);
  assert.strictEqual(result.code, 0);
  assert.ok(result.stdout.includes("Routed to 'scan' command"));
  assert.strictEqual(result.stderr, '');
});

test('CLI - check command on current directory', async () => {
  const result = await runCli(['check', '.']);
  // In Phase 3, check command runs the analyzer and exits with 1 (FINDINGS) because the
  // current repo has uncommitted changes and no .gitignore file.
  assert.strictEqual(result.code, 1);
  assert.ok(result.stdout.includes("Routed to 'check' command"));
  assert.strictEqual(result.stderr, '');
});

test('CLI - doctor command on current directory', async () => {
  const result = await runCli(['doctor', '.']);
  assert.strictEqual(result.code, 0);
  assert.ok(result.stdout.includes("Routed to 'doctor' command"));
  assert.strictEqual(result.stderr, '');
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
