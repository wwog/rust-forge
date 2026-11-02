import assert from 'node:assert/strict';
import test from 'node:test';
import { compileGlob, isPathExcluded, sortEntries } from '../core/files.js';

test('sorts folders first with natural number order', () => {
  const entries = [
    { name: 'file10.rs', isDirectory: false },
    { name: 'src', isDirectory: true },
    { name: 'file2.rs', isDirectory: false },
    { name: 'Cargo.toml', isDirectory: false },
  ];
  assert.deepEqual(
    sortEntries(entries).map((entry) => entry.name),
    ['src', 'Cargo.toml', 'file2.rs', 'file10.rs'],
  );
});

test('supports filesFirst and mixed explorer sort orders', () => {
  const entries = [
    { name: 'a-folder', isDirectory: true },
    { name: 'a-file', isDirectory: false },
  ];
  assert.deepEqual(sortEntries(entries, 'filesFirst').map((entry) => entry.name), ['a-file', 'a-folder']);
  assert.deepEqual(sortEntries(entries, 'mixed').map((entry) => entry.name), ['a-file', 'a-folder']);
});

test('compiles glob stars without crossing path separators', () => {
  assert.equal(compileGlob('*.rs').test('main.rs'), true);
  assert.equal(compileGlob('*.rs').test('xrs'), false);
  assert.equal(compileGlob('**/*.log').test('logs/app.log'), true);
  assert.equal(compileGlob('**/*.log').test('app.log'), true);
  assert.equal(compileGlob('src/**').test('src/main.rs'), true);
  assert.equal(compileGlob('src/**').test('src'), false);
});

test('hides paths matched by files.exclude patterns', () => {
  const defaults = ['**/.git', '**/.DS_Store', '**/node_modules/**'];
  assert.equal(isPathExcluded('.git', defaults), true);
  assert.equal(isPathExcluded('crates/demo/.git', defaults), true);
  assert.equal(isPathExcluded('src/.DS_Store', defaults), true);
  assert.equal(isPathExcluded('node_modules', defaults), true);
  assert.equal(isPathExcluded('node_modules/serde/index.js', defaults), true);
  assert.equal(isPathExcluded('src/main.rs', defaults), false);
});

test('handles brace alternation and directory-only patterns', () => {
  const patterns = ['**/{build,dist}/**', '**/target/**'];
  assert.equal(isPathExcluded('build/out/app', patterns), true);
  assert.equal(isPathExcluded('dist', patterns), true);
  assert.equal(isPathExcluded('target/debug/deps', patterns), true);
  assert.equal(isPathExcluded('src/target.rs', patterns), false);
});
