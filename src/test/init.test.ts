/**
 * In-place initialization: the open folder itself must become the project root.
 */
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

import { CargoService } from '../core/cargo/cargo.js';
import { buildModel } from '../core/cargo/project.js';
import { defaultCrateName, writeWorkspaceSkeleton } from '../core/cargo/scaffold.js';

const exec = promisify(execFile);
const cargo = new CargoService({ timeoutMs: 120_000 });
const cargoReady = exec('cargo', ['--version']).then(
  () => true,
  () => false,
);

async function exists(file: string): Promise<boolean> {
  try {
    await fs.stat(file);
    return true;
  } catch {
    return false;
  }
}

test('defaultCrateName derives a cargo-safe name from the folder', () => {
  assert.equal(defaultCrateName('/tmp/Schema Shift'), 'schema-shift');
  assert.equal(defaultCrateName('/tmp/123-app'), 'crate-123-app');
  assert.equal(defaultCrateName('/tmp/...'), 'my-rust-project');
});

test(
  'cargo init makes the folder the package root',
  { skip: process.env.RF_SKIP_CARGO_TESTS === '1' },
  async (t) => {
    if (!(await cargoReady)) {
      t.skip('cargo is unavailable');
      return;
    }
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'rust-forge-init-'));
    try {
      const result = await cargo.init(dir, 'probe-crate', 'bin', 'none');
      assert.equal(result.code, 0, result.stderr);
      assert.ok(await exists(path.join(dir, 'Cargo.toml')), 'root manifest is missing');
      assert.ok(await exists(path.join(dir, 'src', 'main.rs')), 'binary target is missing');
      const manifest = await fs.readFile(path.join(dir, 'Cargo.toml'), 'utf8');
      assert.match(manifest, /name = "probe-crate"/);

      const built = await buildModel(dir);
      assert.equal(built.model?.kind, 'package');
      assert.equal(path.resolve(built.model!.root), path.resolve(dir));
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  },
);

test('workspace skeleton writes the root manifest in place', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'rust-forge-ws-init-'));
  try {
    await writeWorkspaceSkeleton(dir, {
      name: 'demo-workspace',
      vcs: 'none',
      generateRustfmt: true,
      language: 'en',
    });
    assert.ok(await exists(path.join(dir, 'Cargo.toml')), 'root manifest is missing');
    assert.ok(await exists(path.join(dir, 'crates')), 'crates/ is missing');
    assert.ok(await exists(path.join(dir, 'rustfmt.toml')), 'rustfmt.toml is missing');
    assert.ok(!(await exists(path.join(dir, 'demo-workspace'))), 'initialization must not create a child folder');

    const built = await buildModel(dir);
    assert.equal(built.model?.kind, 'workspace');
    assert.equal(path.resolve(built.model!.root), path.resolve(dir));
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
