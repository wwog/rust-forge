/**
 * End-to-end tests against real cargo and a temporary project.
 * These are skipped automatically when cargo is unavailable.
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
import { readDependencies } from '../core/cargo/manifestDeps.js';
import { readLockfile } from '../core/cargo/lockfile.js';
import { planInstall, planUpgrades } from '../core/deps/write.js';
import { parseVersionReq, requirementSatisfied } from '../core/deps/versions.js';
import { applyConversion, planConversion, rollbackLatest } from '../core/migration/execute.js';
import { SnapshotStore } from '../core/snapshot.js';
import { readTextFile } from '../core/process.js';
import { parseCargoTreeDuplicates } from '../core/deps/duplicates.js';

const exec = promisify(execFile);
const cargo = new CargoService({ timeoutMs: 300_000 });

const cargoReady = exec('cargo', ['--version']).then(
  () => true,
  () => false,
);

async function makeProject(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'rust-forge-it-'));
  await fs.mkdir(path.join(dir, 'src'), { recursive: true });
  await fs.writeFile(
    path.join(dir, 'Cargo.toml'),
    `# Integration test crate
[package]
name = "it-demo"
version = "0.4.0"
edition = "2021"
rust-version = "1.75"
description = "integration test"
license = "MIT"

[dependencies]
anyhow = "1"     # keeps its trailing comment
`,
  );
  await fs.writeFile(path.join(dir, 'src', 'main.rs'), 'fn main() {\n    println!("hi");\n}\n');
  await fs.writeFile(path.join(dir, 'README.md'), '# it-demo\n');
  await fs.writeFile(path.join(dir, 'LICENSE'), 'MIT\n');
  await exec('cargo', ['generate-lockfile'], { cwd: dir });
  return dir;
}

test('install writes a member dependency and verifies', { skip: process.env.RF_SKIP_CARGO_TESTS === '1' }, async () => {
  const root = await makeProject();
  try {
    const manifest = path.join(root, 'Cargo.toml');
    const before = await readTextFile(manifest);
    const plan = planInstall({
      packageName: 'regex',
      versionReq: '^1',
      table: 'dependencies',
      features: [],
      workspaceMode: false,
      targets: [{ name: 'it-demo', manifestPath: manifest }],
      workspaceManifestPath: manifest,
      texts: new Map([[manifest, before]]),
    });
    await fs.writeFile(manifest, plan.files.get(manifest) ?? '');

    const deps = await readDependencies(manifest);
    assert.ok(deps.some((d) => d.packageName === 'regex'), 'regex was not written');
    assert.match(await readTextFile(manifest), /# keeps its trailing comment/, 'comments must survive');

    const check = await cargo.check(root);
    assert.equal(check.code, 0, check.stderr);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('workspace install uses workspace.dependencies plus inheritance', { skip: process.env.RF_SKIP_CARGO_TESTS === '1' }, async () => {
  const root = await makeProject();
  try {
    // Build a real workspace: convert the package, then install into it.
    const store = new SnapshotStore(root, path.join(root, '.rf-snapshots'));
    const converted = await applyConversion({ root, dryRun: false, gitCheck: false }, cargo, store);
    assert.ok(converted.ok, converted.error ?? 'conversion failed');

    const rootManifest = path.join(root, 'Cargo.toml');
    const memberManifest = path.join(root, 'crates', 'it-demo', 'Cargo.toml');
    const plan = planInstall({
      packageName: 'regex',
      versionReq: '^1',
      table: 'dependencies',
      features: [],
      workspaceMode: true,
      targets: [{ name: 'it-demo', manifestPath: memberManifest }],
      workspaceManifestPath: rootManifest,
      texts: new Map([
        [rootManifest, await readTextFile(rootManifest)],
        [memberManifest, await readTextFile(memberManifest)],
      ]),
    });

    const rootAfter = plan.files.get(rootManifest) ?? '';
    const memberAfter = plan.files.get(memberManifest) ?? '';
    assert.match(rootAfter, /\[workspace\.dependencies\]/);
    assert.match(rootAfter, /regex = "\^1"/);
    assert.match(memberAfter, /regex = \{ workspace = true \}/);

    await fs.writeFile(rootManifest, rootAfter);
    await fs.writeFile(memberManifest, memberAfter);

    // Cargo must accept the inheritance and the member must see the crate.
    const meta = await cargo.metadata(root, { noDeps: true });
    assert.ok(meta.ok, meta.error ?? 'cargo metadata failed');
    const member = meta.metadata!.packages.find((p) => p.name === 'it-demo')!;
    assert.ok(member.dependencies.some((d) => d.name === 'regex'));

    const check = await cargo.check(root, { workspace: true });
    assert.equal(check.code, 0, check.stderr);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('upgrade rewrites only the requirement and leaves comments', { skip: process.env.RF_SKIP_CARGO_TESTS === '1' }, async () => {
  const root = await makeProject();
  try {
    const manifest = path.join(root, 'Cargo.toml');
    const before = await readTextFile(manifest);
    const deps = await readDependencies(manifest);
    const anyhow = deps.find((d) => d.packageName === 'anyhow')!;
    const lock = await readLockfile(root);
    const locked = lock?.versions.get('anyhow')?.[0];
    assert.ok(locked);

    const plan = planUpgrades(
      [
        {
          manifestPath: manifest,
          declaration: anyhow,
          newRequirement: '^1.0.100',
          targetVersion: '1.0.100',
        },
      ],
      new Map([[manifest, before]]),
    );
    const updated = plan.files.get(manifest) ?? '';
    assert.match(updated, /anyhow = "\^1\.0\.100"     # keeps its trailing comment/);
    await fs.writeFile(manifest, updated);
    const check = await cargo.check(root);
    assert.equal(check.code, 0, check.stderr);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('lock check distinguishes missing resolution from a constraint mismatch', { skip: process.env.RF_SKIP_CARGO_TESTS === '1' }, async () => {
  const root = await makeProject();
  try {
    const lock = await readLockfile(root);
    const versions = lock?.versions.get('anyhow') ?? [];
    assert.ok(versions.length);
    assert.ok(requirementSatisfied(parseVersionReq('^1'), versions[0]));
    assert.ok(!requirementSatisfied(parseVersionReq('^9'), versions[0]));
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('conversion produces a resolving workspace and rollback restores the package', { skip: process.env.RF_SKIP_CARGO_TESTS === '1' }, async () => {
  const root = await makeProject();
  const store = new SnapshotStore(root, path.join(root, '.rf-snapshots'));
  try {
    const planned = await planConversion({ root, dryRun: true, gitCheck: false });
    assert.ok(planned.ok, planned.issues.map((i) => i.message).join('\n'));
    assert.ok(planned.plan);
    assert.match(planned.plan!.workspaceManifest, /members = \["crates\/\*"\]/);
    assert.match(planned.plan!.memberManifest, /version\.workspace = true/);

    const result = await applyConversion({ root, dryRun: false, gitCheck: false }, cargo, store);
    assert.ok(result.ok, `${result.error ?? ''} ${result.report?.steps.map((s) => `${s.name}:${s.ok}`).join(',')}`);

    // Physical layout.
    const member = await fs.stat(path.join(root, 'crates', 'it-demo', 'src', 'main.rs'));
    assert.ok(member.isFile());
    assert.ok(!(await fs.stat(path.join(root, 'src')).catch(() => undefined)), 'src should have moved');

    // Root manifest is a real workspace with extracted fields.
    const rootText = await readTextFile(path.join(root, 'Cargo.toml'));
    assert.match(rootText, /\[workspace\.package\]/);
    assert.match(rootText, /version = "0\.4\.0"/);

    // cargo accepts the layout and the member metadata is complete.
    const model = await buildModel(root);
    assert.equal(model.model?.kind, 'workspace');
    const meta = await cargo.metadata(root, { noDeps: true });
    assert.ok(meta.ok, meta.error ?? 'cargo metadata failed');
    assert.equal(meta.metadata!.packages[0].name, 'it-demo');
    assert.equal(meta.metadata!.packages[0].version, '0.4.0');

    const check = await cargo.check(root, { workspace: true });
    assert.equal(check.code, 0, check.stderr);

    // Rollback restores the original single-package layout verbatim.
    await store.load();
    const rollback = await rollbackLatest(store);
    assert.ok(rollback.ok, rollback.warnings.join('\n'));
    const restored = await readTextFile(path.join(root, 'Cargo.toml'));
    assert.match(restored, /^# Integration test crate/);
    assert.match(restored, /^\[package\]$/m);
    assert.ok((await fs.stat(path.join(root, 'src', 'main.rs'))).isFile());
    assert.ok(!(await fs.stat(path.join(root, 'crates')).catch(() => undefined)), 'crates/ should be gone');

    const reMeta = await cargo.metadata(root, { noDeps: true });
    assert.ok(reMeta.ok, 'restored manifest must resolve');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('cargo tree -d is parsed into explained duplicate versions', { skip: process.env.RF_SKIP_CARGO_TESTS === '1' }, async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'rust-forge-dup-'));
  try {
    const aDir = path.join(root, 'a');
    const bDir = path.join(root, 'b');
    await fs.mkdir(path.join(aDir, 'src'), { recursive: true });
    await fs.mkdir(path.join(bDir, 'src'), { recursive: true });
    await fs.writeFile(
      path.join(root, 'Cargo.toml'),
      '[workspace]\nmembers = ["a", "b"]\nresolver = "2"\n',
      'utf8',
    );
    await fs.writeFile(
      path.join(aDir, 'Cargo.toml'),
      '[package]\nname = "a"\nversion = "0.1.0"\nedition = "2021"\n\n[dependencies]\nrand = "0.7"\n',
      'utf8',
    );
    await fs.writeFile(
      path.join(bDir, 'Cargo.toml'),
      '[package]\nname = "b"\nversion = "0.1.0"\nedition = "2021"\n\n[dependencies]\nrand = "0.8"\n',
      'utf8',
    );
    await fs.writeFile(path.join(aDir, 'src', 'lib.rs'), 'pub fn a() {}\n', 'utf8');
    await fs.writeFile(path.join(bDir, 'src', 'lib.rs'), 'pub fn b() {}\n', 'utf8');

    const tree = await cargo.treeDuplicates(root, { workspace: true });
    assert.equal(tree.code, 0, tree.stderr);
    const meta = await cargo.metadata(root, { noDeps: false });
    assert.ok(meta.ok, meta.error ?? 'cargo metadata failed');

    const groups = parseCargoTreeDuplicates(tree.stdout, {
      members: [
        { name: 'a', dir: aDir },
        { name: 'b', dir: bDir },
      ],
      metadata: meta.metadata,
    });
    const rand = groups.find((group) => group.name === 'rand');
    assert.ok(rand, 'rand duplicate is missing');
    assert.equal(rand!.versions.length, 2);
    assert.equal(rand!.incompatible, true);
    assert.deepEqual(
      new Set(rand!.requirements.map((requirement) => requirement.requirement)),
      new Set(['^0.7', '^0.8']),
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
