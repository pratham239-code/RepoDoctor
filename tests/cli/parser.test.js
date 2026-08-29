import test from 'node:test';
import assert from 'node:assert';
import { parseArgs } from '../../src/cli/parser.js';
import { UsageError } from '../../src/cli/errors.js';

test('Parser - empty arguments', () => {
  const result = parseArgs([]);
  assert.deepStrictEqual(result.options, { help: false, version: false, verbose: false, json: false, noColor: false });
  assert.strictEqual(result.command, null);
  assert.strictEqual(result.path, null);
});

test('Parser - help long option', () => {
  const result = parseArgs(['--help']);
  assert.strictEqual(result.options.help, true);
  assert.strictEqual(result.options.version, false);
  assert.strictEqual(result.options.verbose, false);
});

test('Parser - help short option', () => {
  const result = parseArgs(['-h']);
  assert.strictEqual(result.options.help, true);
});

test('Parser - version long option', () => {
  const result = parseArgs(['--version']);
  assert.strictEqual(result.options.version, true);
});

test('Parser - version short option', () => {
  const result = parseArgs(['-v']);
  assert.strictEqual(result.options.version, true);
});

test('Parser - verbose option', () => {
  const result = parseArgs(['--verbose']);
  assert.strictEqual(result.options.verbose, true);
});

test('Parser - option grouping -vh', () => {
  const result = parseArgs(['-vh']);
  assert.strictEqual(result.options.version, true);
  assert.strictEqual(result.options.help, true);
});

test('Parser - option grouping -hv', () => {
  const result = parseArgs(['-hv']);
  assert.strictEqual(result.options.version, true);
  assert.strictEqual(result.options.help, true);
});

test('Parser - command scan', () => {
  const result = parseArgs(['scan']);
  assert.strictEqual(result.command, 'scan');
  assert.strictEqual(result.path, null);
});

test('Parser - command check', () => {
  const result = parseArgs(['check']);
  assert.strictEqual(result.command, 'check');
  assert.strictEqual(result.path, null);
});

test('Parser - command doctor', () => {
  const result = parseArgs(['doctor']);
  assert.strictEqual(result.command, 'doctor');
  assert.strictEqual(result.path, null);
});

test('Parser - command and path', () => {
  const result = parseArgs(['scan', 'my-path']);
  assert.strictEqual(result.command, 'scan');
  assert.strictEqual(result.path, 'my-path');
});

test('Parser - path only', () => {
  const result = parseArgs(['./my-path']);
  assert.strictEqual(result.command, null);
  assert.strictEqual(result.path, './my-path');
});

test('Parser - command, path, and options combined', () => {
  const result = parseArgs(['--verbose', 'check', 'src']);
  assert.strictEqual(result.options.verbose, true);
  assert.strictEqual(result.command, 'check');
  assert.strictEqual(result.path, 'src');
});

test('Parser - unknown long option throws UsageError', () => {
  assert.throws(() => {
    parseArgs(['--invalid']);
  }, UsageError);
});

test('Parser - unknown short option throws UsageError', () => {
  assert.throws(() => {
    parseArgs(['-x']);
  }, UsageError);
});

test('Parser - unknown short option in group throws UsageError', () => {
  assert.throws(() => {
    parseArgs(['-vx']);
  }, UsageError);
});

test('Parser - unexpected extra positional throws UsageError', () => {
  assert.throws(() => {
    parseArgs(['scan', 'path1', 'path2']);
  }, UsageError);
});

test('Parser - json option', () => {
  const result = parseArgs(['--json']);
  assert.strictEqual(result.options.json, true);
});

test('Parser - json short option', () => {
  const result = parseArgs(['-j']);
  assert.strictEqual(result.options.json, true);
});

test('Parser - json and other options combined', () => {
  const result = parseArgs(['-jh', '--verbose']);
  assert.strictEqual(result.options.json, true);
  assert.strictEqual(result.options.help, true);
  assert.strictEqual(result.options.verbose, true);
});

test('Parser - no-color option', () => {
  const result = parseArgs(['--no-color']);
  assert.strictEqual(result.options.noColor, true);
});

test('Parser - no-color option with other options', () => {
  const result = parseArgs(['--no-color', '-j']);
  assert.strictEqual(result.options.noColor, true);
  assert.strictEqual(result.options.json, true);
});
