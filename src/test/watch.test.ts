import assert from 'node:assert/strict';
import test from 'node:test';
import { isProjectConfigFile } from '../core/watch.js';

test('recognizes every project configuration file', () => {
  for (const file of [
    'Cargo.toml',
    'Cargo.lock',
    'rust-toolchain.toml',
    'rust-toolchain',
    'rustfmt.toml',
    '.rustfmt.toml',
  ]) {
    assert.equal(isProjectConfigFile(file), true, `${file} must trigger a project refresh`);
  }
});

test('ignores unrelated files', () => {
  for (const file of ['lib.rs', 'README.md', 'Cargo.toml.bak', 'rustfmt.toml.old', 'not-cargo.toml', '']) {
    assert.equal(isProjectConfigFile(file), false, `${file || '<empty>'} must not trigger a project refresh`);
  }
});

test('compares the basename, including nested and Windows-style paths', () => {
  assert.equal(isProjectConfigFile('/work/project/Cargo.toml'), true);
  assert.equal(isProjectConfigFile('/work/project/crates/core/Cargo.lock'), true);
  assert.equal(isProjectConfigFile('crates\\core\\rust-toolchain.toml'), true);
  assert.equal(isProjectConfigFile('/work/project/src/Cargo.toml.bak'), false);
  assert.equal(isProjectConfigFile('cargo.toml'), false);
});
