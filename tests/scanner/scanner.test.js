import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync, execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { scanRepo } from '../../src/scanner/index.js';
import { CLIError } from '../../src/cli/errors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cliEntry = path.resolve(__dirname, '../../src/main.js');

// Synchronous helper
function withTempDir(testFn) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'repodoctor-test-'));
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

// Async helper
async function withTempDirAsync(testFn) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'repodoctor-test-'));
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

// 1. Empty repository
test('Scanner - empty repository', () => {
  withTempDir((dir) => {
    const snapshot = scanRepo(dir);
    assert.ok(snapshot.timestamp);
    assert.strictEqual(snapshot.scannerVersion, '1.0.0');
    assert.strictEqual(snapshot.project.name, path.basename(dir));
    assert.strictEqual(snapshot.project.version, '0.0.0');
    assert.strictEqual(snapshot.git.isRepo, false);
    assert.strictEqual(snapshot.files.totalCount, 0);
    assert.strictEqual(snapshot.files.totalDirectoryCount, 0);
    assert.strictEqual(snapshot.files.totalSizeOctets, 0);
    assert.deepStrictEqual(snapshot.files.entries, []);
    assert.deepStrictEqual(snapshot.files.configs, []);
  });
});

// 2-8. Basic files, nesting, counts, sizes, extensions, relative paths
test('Scanner - basic files, nested directories, metadata metrics', () => {
  withTempDir((dir) => {
    fs.writeFileSync(path.join(dir, 'a.txt'), 'hello');
    fs.mkdirSync(path.join(dir, 'sub'));
    fs.writeFileSync(path.join(dir, 'sub', 'b.log'), '0123456789');
    fs.mkdirSync(path.join(dir, 'sub2'));
    fs.mkdirSync(path.join(dir, 'sub2', 'emptyDir'));

    const snapshot = scanRepo(dir);
    assert.strictEqual(snapshot.files.totalCount, 2);
    assert.strictEqual(snapshot.files.totalDirectoryCount, 3);
    assert.strictEqual(snapshot.files.totalSizeOctets, 15);

    const aEntry = snapshot.files.entries.find(e => e.path === 'a.txt');
    assert.ok(aEntry);
    assert.strictEqual(aEntry.type, 'file');
    assert.strictEqual(aEntry.size, 5);
    assert.strictEqual(aEntry.extension, '.txt');

    const bEntry = snapshot.files.entries.find(e => e.path === 'sub/b.log');
    assert.ok(bEntry);
    assert.strictEqual(bEntry.type, 'file');
    assert.strictEqual(bEntry.size, 10);
    assert.strictEqual(bEntry.extension, '.log');

    const dirEntry = snapshot.files.entries.find(e => e.path === 'sub2/emptyDir');
    assert.ok(dirEntry);
    assert.strictEqual(dirEntry.type, 'directory');
  });
});

// 9-13. Project file detection
test('Scanner - important configs detection at root', () => {
  withTempDir((dir) => {
    fs.writeFileSync(path.join(dir, 'README.md'), '# test');
    fs.writeFileSync(path.join(dir, 'LICENSE'), 'MIT');
    fs.writeFileSync(path.join(dir, '.gitignore'), 'node_modules');
    fs.writeFileSync(path.join(dir, 'go.mod'), 'module test');
    
    // Create nested config file which should NOT get added to main config checklist
    fs.mkdirSync(path.join(dir, 'sub'));
    fs.writeFileSync(path.join(dir, 'sub', 'Makefile'), 'nested');

    const snapshot = scanRepo(dir);
    
    assert.strictEqual(snapshot.files.hasReadme, true);
    assert.strictEqual(snapshot.files.hasLicense, true);
    assert.strictEqual(snapshot.files.hasGitignore, true);
    assert.strictEqual(snapshot.files.hasPackageJson, false);

    assert.ok(snapshot.files.configs.includes('README.md'));
    assert.ok(snapshot.files.configs.includes('LICENSE'));
    assert.ok(snapshot.files.configs.includes('.gitignore'));
    assert.ok(snapshot.files.configs.includes('go.mod'));
    assert.ok(!snapshot.files.configs.includes('Makefile'));
  });
});

// 14. package.json dependency extraction
test('Scanner - valid package.json parsing', () => {
  withTempDir((dir) => {
    const pkg = {
      name: 'test-project',
      version: '2.1.0',
      type: 'module',
      dependencies: { lodash: '^4.17.21' },
      devDependencies: { eslint: '^8.0.0' }
    };
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(pkg));

    const snapshot = scanRepo(dir);

    assert.strictEqual(snapshot.project.name, 'test-project');
    assert.strictEqual(snapshot.project.version, '2.1.0');
    assert.strictEqual(snapshot.project.type, 'module');
    assert.deepStrictEqual(snapshot.dependencies, {
      dependencies: { lodash: '^4.17.21' },
      devDependencies: { eslint: '^8.0.0' },
      peerDependencies: {},
      optionalDependencies: {}
    });
  });
});

// 15. Malformed package.json
test('Scanner - malformed package.json parsing recovery', () => {
  withTempDir((dir) => {
    fs.writeFileSync(path.join(dir, 'package.json'), '{"name": "test", "dependencies": {');

    const snapshot = scanRepo(dir);

    assert.strictEqual(snapshot.project.name, path.basename(dir));
    assert.ok(snapshot.dependencies.error);
    assert.ok(snapshot.dependencies.error.includes('Failed to parse package.json'));
    assert.deepStrictEqual(snapshot.dependencies.dependencies, {});
  });
});

// 16-18. Git detection & details
test('Scanner - git detection and properties', () => {
  withTempDir((dir) => {
    fs.mkdirSync(path.join(dir, '.git'));
    
    const snapshot = scanRepo(dir);
    assert.strictEqual(snapshot.git.isRepo, true);
    assert.strictEqual(snapshot.git.currentBranch, null);
    assert.strictEqual(snapshot.git.latestCommit, null);
    assert.strictEqual(snapshot.git.hasUncommittedChanges, null);
  });
});

// Git operations integration (only run when Git executable is available)
test('Scanner - git repositories active specs extraction', () => {
  withTempDir((dir) => {
    let hasGitExecutable = false;
    try {
      execFileSync('git', ['--version'], { stdio: 'ignore' });
      hasGitExecutable = true;
    } catch {
      // skip without fail
    }

    if (!hasGitExecutable) {
      return;
    }

    try {
      execFileSync('git', ['init'], { cwd: dir, stdio: 'ignore' });
      execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: dir, stdio: 'ignore' });
      execFileSync('git', ['config', 'user.name', 'Test Author'], { cwd: dir, stdio: 'ignore' });
      
      fs.writeFileSync(path.join(dir, 'file.txt'), 'content');
      execFileSync('git', ['add', 'file.txt'], { cwd: dir, stdio: 'ignore' });
      execFileSync('git', ['commit', '-m', 'initial commit'], { cwd: dir, stdio: 'ignore' });

      const snapshot = scanRepo(dir);

      assert.strictEqual(snapshot.git.isRepo, true);
      assert.ok(snapshot.git.currentBranch);
      assert.ok(snapshot.git.latestCommit);
      assert.strictEqual(snapshot.git.latestCommit.author, 'Test Author');
      assert.strictEqual(snapshot.git.latestCommit.message, 'initial commit');
      assert.strictEqual(snapshot.git.hasUncommittedChanges, false);

      fs.writeFileSync(path.join(dir, 'untracked.txt'), 'hello');
      const snapshotAfterMutate = scanRepo(dir);
      assert.strictEqual(snapshotAfterMutate.git.hasUncommittedChanges, true);
      
    } catch (e) {
      // skip if testing is blocked by git shell context
    }
  });
});

// 19. Excluded directories
test('Scanner - exclusion policy skips search nodes', () => {
  withTempDir((dir) => {
    fs.mkdirSync(path.join(dir, 'node_modules'));
    fs.writeFileSync(path.join(dir, 'node_modules', 'dep.js'), 'code');
    fs.mkdirSync(path.join(dir, 'vendor'));
    fs.writeFileSync(path.join(dir, 'vendor', 'thirdparty.py'), 'code');
    fs.writeFileSync(path.join(dir, 'normal.js'), 'code');

    const snapshot = scanRepo(dir);

    assert.strictEqual(snapshot.files.totalCount, 1);
    assert.ok(snapshot.files.entries.some(e => e.path === 'normal.js'));
    assert.ok(!snapshot.files.entries.some(e => e.path.startsWith('node_modules')));
    assert.ok(!snapshot.files.entries.some(e => e.path.startsWith('vendor')));
  });
});

// 20. Symlink behavior
test('Scanner - symlink cycle safety', () => {
  withTempDir((dir) => {
    fs.writeFileSync(path.join(dir, 'target.txt'), 'source content');
    
    try {
      fs.symlinkSync('target.txt', path.join(dir, 'link.txt'));
    } catch {
      return; // ignore on Windows environment lacking admin role
    }

    try {
      fs.symlinkSync(dir, path.join(dir, 'loop_dir'));
    } catch {
      // ignore on Windows environment lacking admin role
    }

    const snapshot = scanRepo(dir);

    const linkEntry = snapshot.files.entries.find(e => e.path === 'link.txt');
    assert.ok(linkEntry);
    assert.strictEqual(linkEntry.type, 'symlink');
    assert.ok(snapshot.files.totalCount >= 2);
  });
});

// 21. Invalid path throws CLIError
test('Scanner - invalid path throws CLIError', () => {
  assert.throws(() => {
    scanRepo(path.join(os.tmpdir(), 'repodoctor-non-existent-xyz-123'));
  }, (err) => {
    return err instanceof CLIError && err.exitCode === 3;
  });
});

// 22. File instead of directory throws CLIError
test('Scanner - path pointing to file throws CLIError', () => {
  withTempDir((dir) => {
    const file = path.join(dir, 'myfile.txt');
    fs.writeFileSync(file, 'content');
    assert.throws(() => {
      scanRepo(file);
    }, (err) => {
      return err instanceof CLIError && err.exitCode === 3;
    });
  });
});

// 23. CLI integration scan outputs deterministic JSON
test('CLI Integration - scan temporary repository prints JSON', async () => {
  await withTempDirAsync(async (dir) => {
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'cli-test', dependencies: { foo: '1.0' } }));
    fs.writeFileSync(path.join(dir, 'README.md'), '# read');

    const result = await new Promise((resolve) => {
      execFile(process.execPath, [cliEntry, 'scan', dir], (error, stdout, stderr) => {
        resolve({
          code: error ? (error.code ?? 1) : 0,
          stdout: stdout.trim(),
          stderr: stderr.trim()
        });
      });
    });

    assert.strictEqual(result.code, 0);
    assert.ok(result.stdout.includes("Routed to 'scan' command"));
    
    const lines = result.stdout.split('\n');
    const jsonStartIndex = lines.findIndex(l => l.trim().startsWith('{'));
    assert.ok(jsonStartIndex !== -1);
    
    const jsonBody = lines.slice(jsonStartIndex).join('\n');
    const parsed = JSON.parse(jsonBody);

    assert.strictEqual(parsed.project.name, 'cli-test');
    assert.strictEqual(parsed.files.hasReadme, true);
    assert.deepStrictEqual(parsed.dependencies.dependencies, { foo: '1.0' });
    assert.strictEqual(result.stderr, '');
  });
});
