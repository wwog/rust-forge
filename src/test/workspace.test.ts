import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import test from 'node:test';
import { applyMetadataMembers, buildModel } from '../core/cargo/project.js';
import { CargoService } from '../core/cargo/cargo.js';
import type { ProjectModel } from '../core/cargo/project.js';
import type { CargoMetadata } from '../core/cargo/types.js';

const cargo = new CargoService({ timeoutMs: 60_000 });

async function writeCrate(dir: string, name: string): Promise<void> {
  await fs.mkdir(path.join(dir, 'src'), { recursive: true });
  await fs.writeFile(
    path.join(dir, 'Cargo.toml'),
    `[package]\nname = "${name}"\nversion = "0.1.0"\nedition = "2021"\n`,
  );
  await fs.writeFile(path.join(dir, 'src', 'lib.rs'), '');
}

async function makeWorkspace(manifest: string): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'rust-forge-ws-'));
  await fs.writeFile(path.join(root, 'Cargo.toml'), manifest);
  return root;
}

test('a workspace root package is included as a member', async () => {
  const root = await makeWorkspace(`[package]
name = "rootpkg"
version = "0.1.0"
edition = "2021"

[workspace]
members = ["crates/*"]
`);
  try {
    await writeCrate(path.join(root, 'crates', 'foo'), 'foo');
    const built = await buildModel(root);
    assert.equal(built.model?.kind, 'workspace');
    assert.deepEqual(built.model!.members.map((member) => member.name).sort(), ['foo', 'rootpkg']);
    assert.equal(built.model!.rootPackage?.name, 'rootpkg');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('an explicit "." member does not duplicate the root package', async () => {
  const root = await makeWorkspace(`[package]
name = "rootpkg"
version = "0.1.0"
edition = "2021"

[workspace]
members = ["."]
`);
  try {
    const built = await buildModel(root);
    assert.deepEqual(built.model!.members.map((member) => member.name), ['rootpkg']);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('workspace excludes and glob suffixes follow cargo', async () => {
  const root = await makeWorkspace(`[workspace]
members = ["crates/*-crate"]
exclude = ["crates/skip-crate"]
`);
  try {
    for (const name of ['keep-crate', 'skip-crate', 'other']) {
      await writeCrate(path.join(root, 'crates', name), name);
    }
    const built = await buildModel(root);
    assert.deepEqual(built.model!.members.map((member) => member.name), ['keep-crate']);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('multi-segment member globs are expanded', async () => {
  const root = await makeWorkspace(`[workspace]
members = ["crates/*/*"]
`);
  try {
    await writeCrate(path.join(root, 'crates', 'a', 'x'), 'x');
    await writeCrate(path.join(root, 'crates', 'b', 'y'), 'y');
    const built = await buildModel(root);
    assert.deepEqual(built.model!.members.map((member) => member.name).sort(), ['x', 'y']);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('cargo metadata membership covers path dependencies and the root package', () => {
  const model = {
    kind: 'workspace',
    root: '/ws',
    manifestPath: '/ws/Cargo.toml',
    members: [],
    emptyWorkspaceShell: false,
    hasLockfile: false,
  } as unknown as ProjectModel;
  const metadata = {
    packages: [
      { id: 'root', name: 'rootpkg', manifest_path: '/ws/Cargo.toml' },
      { id: 'app', name: 'app', manifest_path: '/ws/crates/app/Cargo.toml' },
      { id: 'lib', name: 'lib', manifest_path: '/ws/lib/Cargo.toml' },
    ],
    workspace_members: ['root', 'app', 'lib'],
    workspace_default_members: ['root'],
    workspace_root: '/ws',
  } as unknown as CargoMetadata;

  const applied = applyMetadataMembers(model, metadata);
  assert.deepEqual(applied.members.map((member) => member.name), ['app', 'lib', 'rootpkg']);
  assert.equal(applied.rootPackage?.name, 'rootpkg');
});

test('metadata from a different workspace root is ignored', () => {
  const model = {
    kind: 'workspace',
    root: '/ws',
    manifestPath: '/ws/Cargo.toml',
    members: [],
    emptyWorkspaceShell: false,
    hasLockfile: false,
  } as unknown as ProjectModel;
  const metadata = {
    packages: [{ id: 'app', name: 'app', manifest_path: '/other/Cargo.toml' }],
    workspace_members: ['app'],
    workspace_default_members: ['app'],
    workspace_root: '/other',
  } as unknown as CargoMetadata;
  assert.equal(applyMetadataMembers(model, metadata), model);
});

test(
  'cargo metadata promotes in-workspace path dependencies to members',
  { skip: process.env.RF_SKIP_CARGO_TESTS === '1' },
  async () => {
    if (!(await cargo.isAvailable())) return;
    const root = await makeWorkspace(`[workspace]
members = ["app"]
resolver = "2"
`);
    try {
      await writeCrate(path.join(root, 'app'), 'app');
      await writeCrate(path.join(root, 'lib'), 'lib');
      await fs.writeFile(
        path.join(root, 'app', 'Cargo.toml'),
        `[package]
name = "app"
version = "0.1.0"
edition = "2021"

[dependencies]
lib = { path = "../lib" }
`,
      );

      const built = await buildModel(root);
      assert.deepEqual(built.model!.members.map((member) => member.name), ['app']);

      const result = await cargo.metadata(root, { noDeps: true });
      assert.ok(result.ok && result.metadata, result.error ?? 'cargo metadata failed');
      const applied = applyMetadataMembers(built.model!, result.metadata!);
      assert.deepEqual(applied.members.map((member) => member.name).sort(), ['app', 'lib']);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  },
);
