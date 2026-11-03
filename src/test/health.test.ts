import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import test from 'node:test';
import type { ProjectModel } from '../core/cargo/project.js';
import { readDependencies, readWorkspaceDependencies } from '../core/cargo/manifestDeps.js';
import { analyzeDeclaredHealth } from '../core/deps/health.js';

async function write(file: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, content, 'utf8');
}

test('reports unused declarations, inheritance gaps and member version mismatches', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'rf-health-'));
  try {
    const appDir = path.join(root, 'crates', 'app');
    const cliDir = path.join(root, 'crates', 'cli');

    await write(
      path.join(root, 'Cargo.toml'),
      `[workspace]
members = ["crates/app", "crates/cli"]
resolver = "2"

[workspace.dependencies]
serde = "1"
unused-shared = "1"
`,
    );
    await write(
      path.join(appDir, 'Cargo.toml'),
      `[package]
name = "app"
version = "0.1.0"
edition = "2021"

[dependencies]
serde = { workspace = true }
used = "1"
unused-crate = "1"
optional-dep = { version = "1", optional = true }

[build-dependencies]
cc = "1"
bindgen = "0.69"

[dev-dependencies]
proptest = "1"
criterion = "0.5"
`,
    );
    await write(
      path.join(appDir, 'src', 'lib.rs'),
      `pub fn use_deps() {
    let _ = serde::json::json!({});
    used::run();
}
`,
    );
    await write(
      path.join(appDir, 'build.rs'),
      `fn main() {
    let mut build = cc::Build::new();
    build.compile("native");
}
`,
    );
    await write(
      path.join(appDir, 'tests', 'integration.rs'),
      `proptest! {
    fn roundtrip(value in 0..10u32) {}
}
`,
    );
    await write(
      path.join(cliDir, 'Cargo.toml'),
      `[package]
name = "cli"
version = "0.1.0"
edition = "2021"

[dependencies]
serde = "2"
used = "2"
`,
    );
    await write(
      path.join(cliDir, 'src', 'main.rs'),
      `fn main() {
    let _ = serde::json::json!({});
    used::run();
}
`,
    );

    const model: ProjectModel = {
      kind: 'workspace',
      root,
      manifestPath: path.join(root, 'Cargo.toml'),
      members: [
        { name: 'app', dir: appDir, manifestPath: path.join(appDir, 'Cargo.toml') },
        { name: 'cli', dir: cliDir, manifestPath: path.join(cliDir, 'Cargo.toml') },
      ],
      emptyWorkspaceShell: false,
      hasLockfile: false,
    };

    const declarations = await Promise.all(
      model.members.map(async (member) => ({
        member: member.name,
        manifestPath: member.manifestPath,
        deps: await readDependencies(member.manifestPath),
      })),
    );
    const workspaceDependencies = await readWorkspaceDependencies(root);

    const health = await analyzeDeclaredHealth(model, declarations, { workspaceDependencies });
    const unusedNames = new Set(health.unused.map((entry) => entry.packageName));
    assert.ok(unusedNames.has('unused-crate'));
    assert.ok(unusedNames.has('bindgen'), 'an unreferenced build dependency is unused');
    assert.ok(unusedNames.has('criterion'), 'an unreferenced dev dependency is unused');
    assert.ok(!unusedNames.has('used'), 'a referenced normal dependency is used');
    assert.ok(!unusedNames.has('cc'), 'a build dependency used from build.rs is used');
    assert.ok(!unusedNames.has('proptest'), 'a dev dependency used from tests is used');
    assert.ok(!unusedNames.has('optional-dep'), 'optional dependencies are not flagged');

    const serdeEntry = health.workspaceDependencies.find((issue) => issue.name === 'serde');
    assert.equal(serdeEntry?.kind, 'not-inherited');
    assert.deepEqual(serdeEntry?.members.map((member) => member.member), ['cli']);
    assert.equal(serdeEntry?.members[0].requirement, '2');

    const unusedEntry = health.workspaceDependencies.find((issue) => issue.name === 'unused-shared');
    assert.equal(unusedEntry?.kind, 'unused-entry');

    const serdeMismatch = health.versionMismatches.find((mismatch) => mismatch.packageName === 'serde');
    assert.deepEqual(new Set(serdeMismatch?.requirements), new Set(['1', '2']));
    const usedMismatch = health.versionMismatches.find((mismatch) => mismatch.packageName === 'used');
    assert.deepEqual(new Set(usedMismatch?.requirements), new Set(['1', '2']));

    assert.ok(health.scannedFiles >= 3);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('the root package does not borrow references from nested members', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'rf-health-root-'));
  try {
    const appDir = path.join(root, 'crates', 'app');
    await write(
      path.join(root, 'Cargo.toml'),
      `[package]
name = "root"
version = "0.1.0"
edition = "2021"

[workspace]
members = ["crates/app"]

[dependencies]
shared = "1"
`,
    );
    await write(path.join(root, 'src', 'lib.rs'), 'pub fn root() {}\n');
    await write(
      path.join(appDir, 'Cargo.toml'),
      `[package]
name = "app"
version = "0.1.0"
edition = "2021"

[dependencies]
shared = "1"
`,
    );
    await write(path.join(appDir, 'src', 'lib.rs'), 'pub fn app() { shared::run(); }\n');

    const model: ProjectModel = {
      kind: 'workspace',
      root,
      manifestPath: path.join(root, 'Cargo.toml'),
      members: [
        { name: 'root', dir: root, manifestPath: path.join(root, 'Cargo.toml') },
        { name: 'app', dir: appDir, manifestPath: path.join(appDir, 'Cargo.toml') },
      ],
      rootPackage: { name: 'root', dir: root, manifestPath: path.join(root, 'Cargo.toml') },
      emptyWorkspaceShell: false,
      hasLockfile: false,
    };
    const declarations = await Promise.all(
      model.members.map(async (member) => ({
        member: member.name,
        manifestPath: member.manifestPath,
        deps: await readDependencies(member.manifestPath),
      })),
    );

    const health = await analyzeDeclaredHealth(model, declarations, { workspaceDependencies: [] });
    const unusedForRoot = health.unused.filter((entry) => entry.member === 'root').map((entry) => entry.packageName);
    const unusedForApp = health.unused.filter((entry) => entry.member === 'app').map((entry) => entry.packageName);
    assert.ok(unusedForRoot.includes('shared'), 'root must not see the nested member source');
    assert.ok(!unusedForApp.includes('shared'));
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('equivalent caret requirements do not count as a version mismatch', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'rf-health-'));
  try {
    const aDir = path.join(root, 'crates', 'a');
    const bDir = path.join(root, 'crates', 'b');
    await write(
      path.join(root, 'Cargo.toml'),
      `[workspace]
members = ["crates/a", "crates/b"]
resolver = "2"
`,
    );
    await write(path.join(aDir, 'Cargo.toml'), `[package]\nname = "a"\nversion = "0.1.0"\n\n[dependencies]\nserde = "1"\n`);
    await write(path.join(bDir, 'Cargo.toml'), `[package]\nname = "b"\nversion = "0.1.0"\n\n[dependencies]\nserde = "^1"\n`);
    await write(path.join(aDir, 'src', 'lib.rs'), 'pub fn a() { serde::json::json!({}); }\n');
    await write(path.join(bDir, 'src', 'lib.rs'), 'pub fn b() { serde::json::json!({}); }\n');

    const model: ProjectModel = {
      kind: 'workspace',
      root,
      manifestPath: path.join(root, 'Cargo.toml'),
      members: [
        { name: 'a', dir: aDir, manifestPath: path.join(aDir, 'Cargo.toml') },
        { name: 'b', dir: bDir, manifestPath: path.join(bDir, 'Cargo.toml') },
      ],
      emptyWorkspaceShell: false,
      hasLockfile: false,
    };
    const declarations = await Promise.all(
      model.members.map(async (member) => ({
        member: member.name,
        manifestPath: member.manifestPath,
        deps: await readDependencies(member.manifestPath),
      })),
    );

    const health = await analyzeDeclaredHealth(model, declarations, { workspaceDependencies: [] });
    assert.equal(health.versionMismatches.some((mismatch) => mismatch.packageName === 'serde'), false);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
