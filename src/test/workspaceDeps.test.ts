import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import test from 'node:test';
import { parse as parseToml } from 'smol-toml';
import { buildModel, type ProjectModel } from '../core/cargo/project.js';
import { CargoService } from '../core/cargo/cargo.js';
import type { DependencyDeclaration, WorkspaceDependencyDeclaration } from '../core/cargo/manifestDeps.js';
import { parseDependencies, readWorkspaceDependencies } from '../core/cargo/manifestDeps.js';
import { planConvergence, planPromotion } from '../core/topology/workspaceDeps.js';

const ROOT = path.resolve('/tmp/rf-workspace-deps');

function model(members: { name: string; dir: string }[]): ProjectModel {
  return {
    kind: 'workspace',
    root: ROOT,
    manifestPath: path.join(ROOT, 'Cargo.toml'),
    members: members.map((member) => ({
      name: member.name,
      dir: path.join(ROOT, member.dir),
      manifestPath: path.join(ROOT, member.dir, 'Cargo.toml'),
    })),
    emptyWorkspaceShell: false,
    hasLockfile: false,
  };
}

function manifestPath(dir: string): string {
  return path.join(ROOT, dir, 'Cargo.toml');
}

function declarationsOf(entries: { text: string; dir: string }[]): DependencyDeclaration[] {
  return entries.flatMap((entry) => parseDependencies(entry.text, manifestPath(entry.dir)));
}

function workspaceEntry(
  name: string,
  value: string | Record<string, unknown>,
): WorkspaceDependencyDeclaration {
  const object = typeof value === 'string' ? undefined : value;
  return {
    name,
    packageName: typeof object?.package === 'string' ? object.package : name,
    version: typeof object?.version === 'string' ? object.version : typeof value === 'string' ? value : undefined,
    kind: object ? ('path' in object ? 'path' : 'git' in object ? 'git' : 'registry') : 'registry',
    path: typeof object?.path === 'string' ? object.path : undefined,
    git: typeof object?.git === 'string' ? object.git : undefined,
    features: Array.isArray(object?.features)
      ? (object.features as unknown[]).filter((feature): feature is string => typeof feature === 'string')
      : [],
    defaultFeatures: typeof object?.['default-features'] === 'boolean' ? (object['default-features'] as boolean) : undefined,
    rawValue: JSON.stringify(value),
    line: 0,
  };
}

test('promotion shares common features and keeps per-member extras', () => {
  const project = model([
    { name: 'root', dir: '' },
    { name: 'a', dir: 'crates/a' },
    { name: 'b', dir: 'crates/b' },
  ]);
  const rootText = `[package]
name = "root"
version = "0.1.0"

[workspace]
members = ["crates/a", "crates/b"]

[dependencies]
serde = { version = "1.0", features = ["derive", "std"] }
`;
  const aText = `[package]
name = "a"
version = "0.1.0"

[dependencies]
serde = { version = "1.0", features = ["derive", "rc"], optional = true }
`;
  const bText = `[package]
name = "b"
version = "0.1.0"

[dependencies]
serde = { version = "1.0", features = ["derive"], default-features = false }
`;

  const plan = planPromotion({
    model: project,
    packageName: 'serde',
    declarations: declarationsOf([
      { text: rootText, dir: '' },
      { text: aText, dir: 'crates/a' },
      { text: bText, dir: 'crates/b' },
    ]),
    workspaceEntries: [],
    texts: new Map([
      [project.manifestPath, rootText],
      [manifestPath('crates/a'), aText],
      [manifestPath('crates/b'), bText],
    ]),
  });

  assert.ok(plan.ok, plan.errors.join(' '));
  assert.equal(plan.members.length, 3);

  const rootUpdated = plan.changes.find((change) => change.path === project.manifestPath)!.updated;
  assert.match(rootUpdated, /\[workspace\.dependencies\]/);
  assert.ok(
    rootUpdated.includes('serde = { version = "1.0", features = ["derive"] }'),
    'the entry carries the feature intersection',
  );
  assert.ok(
    rootUpdated.includes('serde = { workspace = true, features = ["std"] }'),
    'the root package keeps only its extra feature',
  );
  assert.doesNotThrow(() => parseToml(rootUpdated));

  const aUpdated = plan.changes.find((change) => change.path === manifestPath('crates/a'))!.updated;
  assert.ok(
    aUpdated.includes('serde = { workspace = true, features = ["rc"], optional = true }'),
    'optional and extras stay on the member',
  );

  const bUpdated = plan.changes.find((change) => change.path === manifestPath('crates/b'))!.updated;
  assert.ok(
    bUpdated.includes('serde = { workspace = true, default-features = false }'),
    'a mixed default-features group keeps false on the member',
  );

  // No declaration may keep a version next to workspace = true.
  for (const change of plan.changes) {
    assert.doesNotThrow(() => parseToml(change.updated));
    const data = parseToml(change.updated) as Record<string, unknown>;
    const deps = data.dependencies as Record<string, unknown> | undefined;
    if (deps?.serde && typeof deps.serde === 'object') {
      const serde = deps.serde as Record<string, unknown>;
      if (serde.workspace === true) assert.equal(serde.version, undefined);
    }
  }
});

test('promotion moves default-features to the entry when every member disables it', () => {
  const project = model([{ name: 'a', dir: 'crates/a' }]);
  const rootText = '[workspace]\nmembers = ["crates/a"]\n';
  const aText = '[package]\nname = "a"\n\n[dependencies]\nserde = { version = "1", default-features = false }\n';

  const plan = planPromotion({
    model: project,
    packageName: 'serde',
    declarations: declarationsOf([{ text: aText, dir: 'crates/a' }]),
    workspaceEntries: [],
    texts: new Map([
      [project.manifestPath, rootText],
      [manifestPath('crates/a'), aText],
    ]),
  });

  assert.ok(plan.ok, plan.errors.join(' '));
  const rootUpdated = plan.changes.find((change) => change.path === project.manifestPath)!.updated;
  assert.ok(rootUpdated.includes('serde = { version = "1", default-features = false }'));
  const aUpdated = plan.changes.find((change) => change.path === manifestPath('crates/a'))!.updated;
  assert.ok(aUpdated.includes('serde = { workspace = true }'));
});

test('promotion rejects conflicting requirements, kinds and keys', () => {
  const project = model([
    { name: 'a', dir: 'crates/a' },
    { name: 'b', dir: 'crates/b' },
  ]);
  const rootText = '[workspace]\nmembers = ["crates/a", "crates/b"]\n';
  const texts = new Map([[project.manifestPath, rootText]]);

  const request = (aText: string, bText: string) =>
    planPromotion({
      model: project,
      packageName: 'serde',
      declarations: declarationsOf([
        { text: aText, dir: 'crates/a' },
        { text: bText, dir: 'crates/b' },
      ]),
      workspaceEntries: [],
      texts: new Map([
        ...texts,
        [manifestPath('crates/a'), aText],
        [manifestPath('crates/b'), bText],
      ]),
    });

  const versions = request(
    '[package]\nname = "a"\n\n[dependencies]\nserde = "1"\n',
    '[package]\nname = "b"\n\n[dependencies]\nserde = "2"\n',
  );
  assert.equal(versions.ok, false);
  assert.match(versions.errors.join('\n'), /conflicting registry requirements/i);

  const kinds = request(
    '[package]\nname = "a"\n\n[dependencies]\nserde = "1"\n',
    '[package]\nname = "b"\n\n[dependencies]\nserde = { git = "https://example.com/serde" }\n',
  );
  assert.equal(kinds.ok, false);
  assert.match(kinds.errors.join('\n'), /conflicting dependency kinds/i);

  const keys = request(
    '[package]\nname = "a"\n\n[dependencies]\nserde = "1"\n',
    '[package]\nname = "b"\n\n[dependencies]\nserde2 = { package = "serde", version = "1" }\n',
  );
  assert.equal(keys.ok, false);
  assert.match(keys.errors.join('\n'), /different keys/i);
});

test('promotion refuses options the workspace reference cannot carry', () => {
  const project = model([{ name: 'a', dir: 'crates/a' }]);
  const rootText = '[workspace]\nmembers = ["crates/a"]\n';
  const aText = '[package]\nname = "a"\n\n[dependencies]\nserde = { version = "1", registry = "internal" }\n';

  const plan = planPromotion({
    model: project,
    packageName: 'serde',
    declarations: declarationsOf([{ text: aText, dir: 'crates/a' }]),
    workspaceEntries: [],
    texts: new Map([
      [project.manifestPath, rootText],
      [manifestPath('crates/a'), aText],
    ]),
  });

  assert.equal(plan.ok, false);
  assert.match(plan.errors.join('\n'), /dependency options that cannot be moved/i);
});

test('promotion refuses to repurpose an existing entry with a different source', () => {
  const project = model([{ name: 'a', dir: 'crates/a' }]);
  const rootText =
    '[workspace]\nmembers = ["crates/a"]\n\n[workspace.dependencies]\nlib = { path = "crates/lib" }\n';
  const aText = '[package]\nname = "a"\n\n[dependencies]\nlib = "1"\n';

  const plan = planPromotion({
    model: project,
    packageName: 'lib',
    declarations: declarationsOf([{ text: aText, dir: 'crates/a' }]),
    workspaceEntries: [workspaceEntry('lib', { path: 'crates/lib' })],
    texts: new Map([
      [project.manifestPath, rootText],
      [manifestPath('crates/a'), aText],
    ]),
  });

  assert.equal(plan.ok, false);
  assert.match(plan.errors.join('\n'), /would change its source/i);
  assert.equal(plan.changes.length, 0);
});

test('promotion refuses to overwrite entry options it cannot preserve', () => {
  const project = model([{ name: 'a', dir: 'crates/a' }]);
  const rootText =
    '[workspace]\nmembers = ["crates/a"]\n\n[workspace.dependencies]\nserde = { version = "1", registry = "internal" }\n';
  const aText = '[package]\nname = "a"\n\n[dependencies]\nserde = "1"\n';

  const plan = planPromotion({
    model: project,
    packageName: 'serde',
    declarations: declarationsOf([{ text: aText, dir: 'crates/a' }]),
    workspaceEntries: [workspaceEntry('serde', { version: '1', registry: 'internal' })],
    texts: new Map([
      [project.manifestPath, rootText],
      [manifestPath('crates/a'), aText],
    ]),
  });

  assert.equal(plan.ok, false);
  assert.match(plan.errors.join('\n'), /cannot preserve/i);
});

test('convergence refuses a key reused for a different package', () => {
  const project = model([{ name: 'a', dir: 'crates/a' }]);
  const rootText =
    '[workspace]\nmembers = ["crates/a"]\n\n[workspace.dependencies]\nhelper = { package = "lib", version = "1" }\n';
  const aText =
    '[package]\nname = "a"\n\n[dependencies]\nhelper = { package = "other-lib", version = "1" }\n';

  const plan = planConvergence({
    model: project,
    name: 'helper',
    declarations: declarationsOf([{ text: aText, dir: 'crates/a' }]),
    workspaceEntries: [workspaceEntry('helper', { package: 'lib', version: '1' })],
    texts: new Map([
      [project.manifestPath, rootText],
      [manifestPath('crates/a'), aText],
    ]),
  });

  assert.equal(plan.ok, false);
  assert.match(plan.errors.join('\n'), /resolves to package/i);
  assert.equal(plan.changes.length, 0);
});

test('path promotion recomputes a root-relative path for nested members', () => {
  const project = model([
    { name: 'a', dir: 'crates/a' },
    { name: 'deep', dir: 'crates/nested/deep' },
  ]);
  const rootText = '[workspace]\nmembers = ["crates/a", "crates/nested/deep"]\n';
  const aText = '[package]\nname = "a"\n\n[dependencies]\nhelper = { path = "../helper" }\n';
  const deepText =
    '[package]\nname = "deep"\n\n[dependencies]\nhelper = { path = "../../helper" }\n';

  const plan = planPromotion({
    model: project,
    packageName: 'helper',
    declarations: declarationsOf([
      { text: aText, dir: 'crates/a' },
      { text: deepText, dir: 'crates/nested/deep' },
    ]),
    workspaceEntries: [],
    texts: new Map([
      [project.manifestPath, rootText],
      [manifestPath('crates/a'), aText],
      [manifestPath('crates/nested/deep'), deepText],
    ]),
  });

  assert.ok(plan.ok, plan.errors.join(' '));
  const rootUpdated = plan.changes.find((change) => change.path === project.manifestPath)!.updated;
  assert.ok(rootUpdated.includes('helper = { path = "crates/helper" }'));
  for (const dir of ['crates/a', 'crates/nested/deep']) {
    const updated = plan.changes.find((change) => change.path === manifestPath(dir))!.updated;
    assert.ok(updated.includes('helper = { workspace = true }'), `missing reference in ${dir}`);
  }
});

test('an existing equivalent workspace entry is left untouched', () => {
  const project = model([{ name: 'a', dir: 'crates/a' }]);
  const rootText = '[workspace]\nmembers = ["crates/a"]\n';
  const aText = '[package]\nname = "a"\n\n[dependencies]\nserde = { version = "1.0", features = ["derive"] }\n';

  const plan = planPromotion({
    model: project,
    packageName: 'serde',
    declarations: declarationsOf([{ text: aText, dir: 'crates/a' }]),
    workspaceEntries: [
      workspaceEntry('serde', { version: '1.0', features: ['derive'] }),
    ],
    texts: new Map([
      [project.manifestPath, rootText],
      [manifestPath('crates/a'), aText],
    ]),
  });

  assert.ok(plan.ok, plan.errors.join(' '));
  assert.equal(plan.entryUnchanged, true);
  assert.equal(plan.changes.some((change) => change.path === project.manifestPath), false);
  assert.equal(plan.changes.length, 1);
});

test('convergence rewrites direct declarations and keeps member extras', () => {
  const project = model([
    { name: 'a', dir: 'crates/a' },
    { name: 'b', dir: 'crates/b' },
  ]);
  const rootText = `[workspace]
members = ["crates/a", "crates/b"]

[workspace.dependencies]
serde = { version = "1", features = ["derive"] }
`;
  const aText =
    '[package]\nname = "a"\n\n[dependencies]\nserde = { version = "1.0", default-features = false }\n';
  const bText =
    '[package]\nname = "b"\n\n[dependencies]\nserde = { version = "1.2", features = ["derive", "rc"], optional = true }\n';

  const plan = planConvergence({
    model: project,
    name: 'serde',
    declarations: declarationsOf([
      { text: aText, dir: 'crates/a' },
      { text: bText, dir: 'crates/b' },
    ]),
    workspaceEntries: [workspaceEntry('serde', { version: '1', features: ['derive'] })],
    texts: new Map([
      [project.manifestPath, rootText],
      [manifestPath('crates/a'), aText],
      [manifestPath('crates/b'), bText],
    ]),
  });

  assert.ok(plan.ok, plan.errors.join(' '));
  assert.equal(plan.converged.length, 2);
  assert.equal(plan.changes.some((change) => change.path === project.manifestPath), false);

  const aUpdated = plan.changes.find((change) => change.path === manifestPath('crates/a'))!.updated;
  assert.ok(aUpdated.includes('serde = { workspace = true, default-features = false }'));

  const bUpdated = plan.changes.find((change) => change.path === manifestPath('crates/b'))!.updated;
  assert.ok(bUpdated.includes('serde = { workspace = true, features = ["rc"], optional = true }'));
  assert.doesNotThrow(() => parseToml(bUpdated));
});

test('convergence refuses a requirement the workspace entry does not permit', () => {
  const project = model([
    { name: 'a', dir: 'crates/a' },
    { name: 'c', dir: 'crates/c' },
  ]);
  const rootText = '[workspace]\nmembers = ["crates/a", "crates/c"]\n\n[workspace.dependencies]\nserde = "1"\n';
  const aText = '[package]\nname = "a"\n\n[dependencies]\nserde = "1.0"\n';
  const cText = '[package]\nname = "c"\n\n[dependencies]\nserde = "2"\n';

  const plan = planConvergence({
    model: project,
    name: 'serde',
    declarations: declarationsOf([
      { text: aText, dir: 'crates/a' },
      { text: cText, dir: 'crates/c' },
    ]),
    workspaceEntries: [workspaceEntry('serde', '1')],
    texts: new Map([
      [project.manifestPath, rootText],
      [manifestPath('crates/a'), aText],
      [manifestPath('crates/c'), cText],
    ]),
  });

  assert.equal(plan.ok, false);
  assert.deepEqual(plan.incompatible.map((entry) => entry.member), ['c']);
  assert.match(plan.errors.join('\n'), /does not allow/i);
  assert.equal(plan.changes.length, 0);
  assert.equal(plan.proposedWorkspaceRequirement, undefined, 'two distinct direct requirements cannot be merged');

  // A single distinct direct requirement can be offered as a workspace update.
  const single = planConvergence({
    model: project,
    name: 'serde',
    declarations: declarationsOf([{ text: cText, dir: 'crates/c' }]),
    workspaceEntries: [workspaceEntry('serde', '1')],
    texts: new Map([
      [project.manifestPath, rootText],
      [manifestPath('crates/c'), cText],
    ]),
  });
  assert.equal(single.ok, false);
  assert.equal(single.proposedWorkspaceRequirement, '2');

  const approved = planConvergence({
    model: project,
    name: 'serde',
    declarations: declarationsOf([{ text: cText, dir: 'crates/c' }]),
    workspaceEntries: [workspaceEntry('serde', '1')],
    texts: new Map([
      [project.manifestPath, rootText],
      [manifestPath('crates/c'), cText],
    ]),
    workspaceRequirementOverride: '2',
  });
  assert.ok(approved.ok, approved.errors.join(' '));
  const rootUpdated = approved.changes.find((change) => change.path === project.manifestPath)!.updated;
  assert.ok(rootUpdated.includes('serde = "2"'));
  const cUpdated = approved.changes.find((change) => change.path === manifestPath('crates/c'))!.updated;
  assert.ok(cUpdated.includes('serde = { workspace = true }'));
});

test('convergence accepts overlapping requirements with a different floor', () => {
  const project = model([{ name: 'a', dir: 'crates/a' }]);
  const rootText = '[workspace]\nmembers = ["crates/a"]\n\n[workspace.dependencies]\nserde = "1.5"\n';
  const aText = '[package]\nname = "a"\n\n[dependencies]\nserde = "1.2"\n';

  const plan = planConvergence({
    model: project,
    name: 'serde',
    declarations: declarationsOf([{ text: aText, dir: 'crates/a' }]),
    workspaceEntries: [workspaceEntry('serde', '1.5')],
    texts: new Map([
      [project.manifestPath, rootText],
      [manifestPath('crates/a'), aText],
    ]),
  });

  // ^1.2 and ^1.5 overlap, so the locked version already satisfies both and
  // inheriting the workspace entry cannot change it.
  assert.ok(plan.ok, plan.errors.join(' '));
  assert.equal(plan.incompatible.length, 0);
  const updated = plan.changes.find((change) => change.path === manifestPath('crates/a'))!.updated;
  assert.ok(updated.includes('serde = { workspace = true }'));
});

test('promotion of dotted keys keeps unrelated interleaved statements', () => {
  const project = model([{ name: 'a', dir: 'crates/a' }]);
  const rootText = '[workspace]\nmembers = ["crates/a"]\n';
  const aText = [
    '[package]',
    'name = "a"',
    '',
    '[dependencies]',
    'serde.version = "1"',
    'anyhow = "1"',
    'serde.features = ["derive"]',
    '',
  ].join('\n');

  const plan = planPromotion({
    model: project,
    packageName: 'serde',
    declarations: declarationsOf([{ text: aText, dir: 'crates/a' }]),
    workspaceEntries: [],
    texts: new Map([
      [project.manifestPath, rootText],
      [manifestPath('crates/a'), aText],
    ]),
  });

  assert.ok(plan.ok, plan.errors.join(' '));
  const updated = plan.changes.find((change) => change.path === manifestPath('crates/a'))!.updated;
  assert.ok(updated.includes('anyhow = "1"'), 'the unrelated statement must survive');
  assert.ok(updated.includes('serde = { workspace = true }'));
  assert.ok(!updated.includes('serde.version'), 'the dotted source key must be gone');
  assert.doesNotThrow(() => parseToml(updated));
});

test('promotion rewrites sub-table declarations in place', () => {
  const project = model([
    { name: 'a', dir: 'crates/a' },
    { name: 'b', dir: 'crates/b' },
  ]);
  const rootText = '[workspace]\nmembers = ["crates/a", "crates/b"]\n';
  const aText = `[package]
name = "a"

[dependencies.serde]
version = "1"
features = ["derive", "rc"]
`;
  const bText = '[package]\nname = "b"\n\n[dependencies]\nserde = { version = "1", features = ["derive"] }\n';

  const plan = planPromotion({
    model: project,
    packageName: 'serde',
    declarations: declarationsOf([
      { text: aText, dir: 'crates/a' },
      { text: bText, dir: 'crates/b' },
    ]),
    workspaceEntries: [],
    texts: new Map([
      [project.manifestPath, rootText],
      [manifestPath('crates/a'), aText],
      [manifestPath('crates/b'), bText],
    ]),
  });

  assert.ok(plan.ok, plan.errors.join(' '));
  const aUpdated = plan.changes.find((change) => change.path === manifestPath('crates/a'))!.updated;
  assert.ok(aUpdated.includes('[dependencies.serde]'));
  assert.ok(aUpdated.includes('workspace = true'));
  assert.ok(aUpdated.includes('features = ["rc"]'));
  assert.ok(!aUpdated.includes('version = "1"'), 'the source version must be removed');
  assert.doesNotThrow(() => parseToml(aUpdated));
  const parsed = parseToml(aUpdated) as Record<string, unknown>;
  const serde = (parsed.dependencies as Record<string, unknown>).serde as Record<string, unknown>;
  assert.equal(serde.workspace, true);
  assert.deepEqual(serde.features, ['rc']);
});

test('promotion includes target-specific dependency tables', () => {
  const project = model([{ name: 'a', dir: 'crates/a' }]);
  const rootText = '[workspace]\nmembers = ["crates/a"]\n';
  const aText = `[package]
name = "a"

[target.'cfg(unix)'.dependencies]
libc = "0.2"
`;

  const plan = planPromotion({
    model: project,
    packageName: 'libc',
    declarations: declarationsOf([{ text: aText, dir: 'crates/a' }]),
    workspaceEntries: [],
    texts: new Map([
      [project.manifestPath, rootText],
      [manifestPath('crates/a'), aText],
    ]),
  });

  assert.ok(plan.ok, plan.errors.join(' '));
  const aUpdated = plan.changes.find((change) => change.path === manifestPath('crates/a'))!.updated;
  assert.ok(aUpdated.includes('libc = { workspace = true }'));
  assert.ok(aUpdated.includes("[target.'cfg(unix)'.dependencies]"));
  const rootUpdated = plan.changes.find((change) => change.path === project.manifestPath)!.updated;
  assert.ok(rootUpdated.includes('libc = "0.2"'));
  assert.doesNotThrow(() => parseToml(aUpdated));
});

test('promotion preserves comments and CRLF line endings', () => {
  const project = model([{ name: 'a', dir: 'crates/a' }]);
  const rootText = '[workspace]\r\nmembers = ["crates/a"]\r\n';
  const aText =
    '[package]\r\nname = "a"\r\nversion = "0.1.0"\r\n\r\n# Keep this comment\r\n[dependencies]\r\nserde = "1" # pinned comment\r\n';

  const plan = planPromotion({
    model: project,
    packageName: 'serde',
    declarations: declarationsOf([{ text: aText, dir: 'crates/a' }]),
    workspaceEntries: [],
    texts: new Map([
      [project.manifestPath, rootText],
      [manifestPath('crates/a'), aText],
    ]),
  });

  assert.ok(plan.ok, plan.errors.join(' '));
  const aUpdated = plan.changes.find((change) => change.path === manifestPath('crates/a'))!.updated;
  assert.ok(aUpdated.includes('# Keep this comment'));
  assert.ok(aUpdated.includes('# pinned comment'));
  assert.ok(aUpdated.includes('serde = { workspace = true }'));
  assertCRLF(aUpdated);

  const rootUpdated = plan.changes.find((change) => change.path === project.manifestPath)!.updated;
  assert.ok(rootUpdated.includes('serde = "1"'));
  assertCRLF(rootUpdated);
  assert.doesNotThrow(() => parseToml(aUpdated));
  assert.doesNotThrow(() => parseToml(rootUpdated));
});

test(
  'a promoted path dependency is accepted by cargo with the merged feature set',
  { skip: process.env.RF_SKIP_CARGO_TESTS === '1' },
  async () => {
    const cargo = new CargoService({ timeoutMs: 60_000 });
    if (!(await cargo.isAvailable())) return;

    const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'rust-forge-promote-')));
    const write = async (file: string, text: string) => {
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, text, 'utf8');
    };
    try {
      await write(
        path.join(root, 'Cargo.toml'),
        '[workspace]\nmembers = ["crates/a", "crates/b", "crates/lib"]\nresolver = "2"\n',
      );
      await write(
        path.join(root, 'crates', 'lib', 'Cargo.toml'),
        [
          '[package]',
          'name = "lib"',
          'version = "0.1.0"',
          'edition = "2021"',
          '',
          '[features]',
          'default = []',
          'f1 = []',
          'f2 = []',
          '',
        ].join('\n'),
      );
      await write(path.join(root, 'crates', 'lib', 'src', 'lib.rs'), '');
      await write(
        path.join(root, 'crates', 'a', 'Cargo.toml'),
        '[package]\nname = "a"\nversion = "0.1.0"\nedition = "2021"\n\n[dependencies]\nlib = { path = "../lib", features = ["f1", "f2"] }\n',
      );
      await write(path.join(root, 'crates', 'a', 'src', 'lib.rs'), '');
      await write(
        path.join(root, 'crates', 'b', 'Cargo.toml'),
        '[package]\nname = "b"\nversion = "0.1.0"\nedition = "2021"\n\n[dependencies]\nlib = { path = "../lib", features = ["f1"] }\n',
      );
      await write(path.join(root, 'crates', 'b', 'src', 'lib.rs'), '');

      const built = await buildModel(root);
      assert.ok(built.model, built.error ?? 'model discovery failed');
      const model = built.model!;
      const texts = new Map<string, string>();
      texts.set(model.manifestPath, await fs.readFile(model.manifestPath, 'utf8'));
      const declarations: DependencyDeclaration[] = [];
      for (const member of model.members) {
        const text = await fs.readFile(member.manifestPath, 'utf8');
        texts.set(member.manifestPath, text);
        declarations.push(...parseDependencies(text, member.manifestPath));
      }

      const plan = planPromotion({
        model,
        packageName: 'lib',
        declarations,
        workspaceEntries: await readWorkspaceDependencies(root),
        texts,
      });
      assert.ok(plan.ok, plan.errors.join(' '));
      for (const change of plan.changes) await write(change.path, change.updated);

      const result = await cargo.metadata(root, { noDeps: true });
      assert.ok(result.ok, result.error ?? 'cargo metadata failed');

      const rootManifest = parseToml(await fs.readFile(model.manifestPath, 'utf8')) as Record<string, any>;
      assert.deepEqual(rootManifest.workspace.dependencies.lib.features, ['f1']);
      const a = parseToml(await fs.readFile(path.join(root, 'crates', 'a', 'Cargo.toml'), 'utf8')) as Record<string, any>;
      assert.equal(a.dependencies.lib.workspace, true);
      assert.deepEqual(a.dependencies.lib.features, ['f2']);
      const b = parseToml(await fs.readFile(path.join(root, 'crates', 'b', 'Cargo.toml'), 'utf8')) as Record<string, any>;
      assert.equal(b.dependencies.lib.workspace, true);
      assert.equal(b.dependencies.lib.features, undefined);

      // The inherited feature set must actually compile.
      const check = await cargo.check(root, { workspace: true });
      assert.equal(check.code, 0, check.stderr);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  },
);

function assertCRLF(text: string): void {
  const lines = text.split('\n');
  // The final element after the trailing newline is empty.
  for (const line of lines.slice(0, -1)) {
    assert.ok(line.endsWith('\r'), `missing CRLF in: ${JSON.stringify(line)}`);
  }
}
