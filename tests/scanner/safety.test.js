import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { scanRepo } from '../../src/scanner/index.js';
import { traverseRepo, MAX_MANIFEST_SIZE_BYTES } from '../../src/scanner/fs_utils.js';

function withTempDir(testFn) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'repodoctor-safety-'));
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

test('Scanner Safety - iterative DFS order matching recursive logic', () => {
  withTempDir((dir) => {
    fs.mkdirSync(path.join(dir, 'a'));
    fs.mkdirSync(path.join(dir, 'a', 'b'));
    fs.writeFileSync(path.join(dir, 'a', 'b', 'c.txt'), 'hello');
    fs.writeFileSync(path.join(dir, 'a', 'd.txt'), 'world');
    fs.writeFileSync(path.join(dir, 'e.txt'), 'root file');

    const result = traverseRepo(dir);
    const paths = result.entries.map(e => e.path);

    const expected = [
      'a',
      'a/b',
      'a/b/c.txt',
      'a/d.txt',
      'e.txt'
    ];
    assert.deepStrictEqual(paths, expected);
  });
});

test('Scanner Safety - broken symlink handling', () => {
  withTempDir((dir) => {
    fs.writeFileSync(path.join(dir, 'exist.txt'), 'content');
    try {
      fs.symlinkSync('nonexistent.txt', path.join(dir, 'broken-link.txt'));
    } catch {
      // Skip symlink tests if OS/user lacks permissions (Windows developer mode)
      return;
    }

    const result = traverseRepo(dir);
    const brokenEntry = result.entries.find(e => e.path === 'broken-link.txt');
    assert.ok(brokenEntry);
    assert.strictEqual(brokenEntry.type, 'symlink');
    assert.strictEqual(result.scanErrors.length, 0);
  });
});

test('Scanner Safety - directory symlinks are recorded but not followed', () => {
  withTempDir((dir) => {
    fs.mkdirSync(path.join(dir, 'sub'));
    fs.writeFileSync(path.join(dir, 'sub', 'file.txt'), 'hello');
    try {
      fs.symlinkSync('sub', path.join(dir, 'sub-link'));
    } catch {
      return;
    }

    const result = traverseRepo(dir);
    const linkEntry = result.entries.find(e => e.path === 'sub-link');
    assert.ok(linkEntry);
    assert.strictEqual(linkEntry.type, 'symlink');

    const recurseEntry = result.entries.find(e => e.path.startsWith('sub-link/'));
    assert.strictEqual(recurseEntry, undefined);
  });
});

test('Scanner Safety - readdirSync and lstatSync failure handling via stubs', () => {
  withTempDir((dir) => {
    fs.mkdirSync(path.join(dir, 'fail-dir'));
    fs.writeFileSync(path.join(dir, 'fail-dir', 'ok.txt'), 'hello');
    fs.writeFileSync(path.join(dir, 'fail-file.txt'), 'hello');
    fs.writeFileSync(path.join(dir, 'normal.txt'), 'normal');

    const originalReaddir = fs.readdirSync;
    const originalLstat = fs.lstatSync;

    try {
      fs.readdirSync = (p, options) => {
        if (p.endsWith('fail-dir')) {
          const err = new Error('Permission denied');
          err.code = 'EACCES';
          throw err;
        }
        return originalReaddir(p, options);
      };

      fs.lstatSync = (p, options) => {
        if (p.endsWith('fail-file.txt')) {
          const err = new Error('Inaccessible filesystem object');
          err.code = 'ENOENT';
          throw err;
        }
        return originalLstat(p, options);
      };

      const result = traverseRepo(dir);

      assert.strictEqual(result.scanErrors.length, 2);

      const readdirErr = result.scanErrors.find(e => e.type === 'access-denied');
      assert.ok(readdirErr);
      assert.strictEqual(readdirErr.path, 'fail-dir');
      assert.strictEqual(readdirErr.code, 'EACCES');

      const lstatErr = result.scanErrors.find(e => e.type === 'lstat-failed');
      assert.ok(lstatErr);
      assert.strictEqual(lstatErr.path, 'fail-file.txt');
      assert.strictEqual(lstatErr.code, 'ENOENT');

      const normalEntry = result.entries.find(e => e.path === 'normal.txt');
      assert.ok(normalEntry);
      assert.strictEqual(result.entries.find(e => e.path === 'fail-file.txt'), undefined);

    } finally {
      fs.readdirSync = originalReaddir;
      fs.lstatSync = originalLstat;
    }
  });
});

test('Scanner Safety - deeply nested directories do not cause stack overflow', () => {
  withTempDir((dir) => {
    let current = dir;
    const depth = 200;
    for (let i = 0; i < depth; i++) {
      const next = path.join(current, `nest-${i}`);
      fs.mkdirSync(next);
      current = next;
    }
    fs.writeFileSync(path.join(current, 'deep.txt'), 'deep');

    const result = traverseRepo(dir);
    assert.strictEqual(result.totalCount, 1);
    assert.strictEqual(result.totalDirectoryCount, depth);
    const deepEntry = result.entries.find(e => e.path.endsWith('deep.txt'));
    assert.ok(deepEntry);
  });
});

test('Scanner Safety - package.json size limit configuration guard', () => {
  withTempDir((dir) => {
    const extraSize = MAX_MANIFEST_SIZE_BYTES + 100;
    const content = '{\n' + ' '.repeat(extraSize) + '\n"name": "large"\n}';
    fs.writeFileSync(path.join(dir, 'package.json'), content);

    const snapshot = scanRepo(dir);

    assert.ok(snapshot.dependencies.error);
    assert.ok(snapshot.dependencies.error.includes('File size validation failed'));
    assert.ok(snapshot.dependencies.error.includes('exceeds maximum allowed size'));
    assert.strictEqual(snapshot.dependencies.dependencies && Object.keys(snapshot.dependencies.dependencies).length, 0); 
  });
});

test('Scanner Safety - malformed package.json empty file', () => {
  withTempDir((dir) => {
    fs.writeFileSync(path.join(dir, 'package.json'), '');
    const snapshot = scanRepo(dir);
    assert.ok(snapshot.dependencies.error);
    assert.ok(snapshot.dependencies.error.includes('Failed to parse package.json'));
  });
});
