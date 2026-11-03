import assert from 'node:assert/strict';
import test from 'node:test';
import { parse } from 'smol-toml';
import { updateArgs } from '../core/cargo/cargo.js';
import {
  hasDependency,
  planInstall,
  planRemove,
  planUpgrades,
  resolveRequestedRequirement,
  workspaceReferenceValue,
  type InstallRequest,
} from '../core/deps/write.js';
import { parseDependencies } from '../core/cargo/manifestDeps.js';
import { applyPropertyEdits, PACKAGE_PROPERTIES, validateProperty } from '../core/properties.js';
import { migrateLintsToWorkspace, previewStandardization, type StandardizeFinding } from '../core/standardize.js';
import { applyTopLevelOptionEdits } from '../core/rustfmt.js';
import { parseToolchainList } from '../core/toolchain.js';
import { lockedVersion, parseLockfile } from '../core/cargo/lockfile.js';
import { TomlEditor } from '../core/toml/editor.js';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { SnapshotStore } from '../core/snapshot.js';

const workspaceManifestPath = '/tmp/ws/Cargo.toml';

function installRequest(overrides: Partial<InstallRequest> = {}): InstallRequest {
  return {
    packageName: 'serde',
    versionReq: '^1',
    table: 'dependencies',
    features: [],
    workspaceMode: true,
    targets: [],
    workspaceManifestPath,
    texts: new Map([[workspaceManifestPath, '[workspace]\nmembers = []\n']]),
    ...overrides,
  };
}

test('cargo update uses one --precise per invocation', () => {
  assert.deepEqual(updateArgs('serde@1.0.200'), ['update', '-p', 'serde', '--precise', '1.0.200']);
  assert.deepEqual(updateArgs('anyhow'), ['update', 'anyhow']);
});

test('upgrades rewrite every declaration form', () => {
  const forms = [
    '[dependencies]\nserde = "1.0.100"\n',
    '[dependencies]\nserde = { version = "1.0.100", features = ["derive"] }\n',
    '[dependencies]\nserde = { "version" = "1.0.100", features = ["derive"] }\n',
    '[dependencies]\nserde.version = "1.0.100"\n',
    '[dependencies.serde]\nversion = "1.0.100"\nfeatures = ["derive"]\n',
    'dependencies.serde = "1.0.100"\n',
    'dependencies.serde.version = "1.0.100"\n',
  ];
  for (const text of forms) {
    const declaration = parseDependencies(text, '/tmp/Cargo.toml')[0]!;
    const result = planUpgrades(
      [
        {
          manifestPath: '/tmp/Cargo.toml',
          declaration,
          newRequirement: '^1.0.200',
          targetVersion: '1.0.200',
        },
      ],
      new Map([['/tmp/Cargo.toml', text]]),
    );
    const output = result.files.get('/tmp/Cargo.toml');
    assert.ok(output, `no rewrite for:\n${text}`);
    assert.ok(output.includes('1.0.200'), `version not rewritten for:\n${text}\n${output}`);
    assert.equal(result.updateSpecs.length, 1);
    // Every produced manifest must still be valid TOML.
    assert.doesNotThrow(() => parse(output!));
  }
});

test('a path dependency is never given a registry version', () => {
  const text = '[dependencies]\nserde = { path = "../serde" }\n';
  const declaration = parseDependencies(text, '/tmp/Cargo.toml')[0]!;
  const result = planUpgrades(
    [{ manifestPath: '/tmp/Cargo.toml', declaration, newRequirement: '^1.0.200', targetVersion: '1.0.200' }],
    new Map([['/tmp/Cargo.toml', text]]),
  );
  assert.equal(result.files.size, 0);
});

test('install sees declarations written as dotted keys or sub-tables', () => {
  assert.equal(hasDependency('[dependencies]\nserde.version = "1"\n', 'dependencies', 'serde'), true);
  assert.equal(hasDependency('[dependencies.serde]\nversion = "1"\n', 'dependencies', 'serde'), true);
  assert.equal(hasDependency('dependencies.serde = "1"\n', 'dependencies', 'serde'), true);
  assert.equal(hasDependency('[dependencies]\nrand = "1"\n', 'dependencies', 'serde'), false);
});

test('installing over a dotted declaration keeps a single declaration', () => {
  const text = '[package]\nname = "x"\n\n[dependencies]\nserde.version = "1"\nserde.features = ["derive"]\n';
  const plan = planInstall({
    packageName: 'serde',
    versionReq: '^1.0.200',
    table: 'dependencies',
    features: ['derive'],
    workspaceMode: false,
    targets: [{ name: 'x', manifestPath: '/tmp/Cargo.toml' }],
    workspaceManifestPath: '/tmp/Cargo.toml',
    texts: new Map([['/tmp/Cargo.toml', text]]),
  });
  const output = plan.files.get('/tmp/Cargo.toml')!;
  const parsed = parse(output) as Record<string, any>;
  assert.equal(parsed.dependencies.serde.version, '^1.0.200');
  assert.deepEqual([...parsed.dependencies.serde.features], ['derive']);
  assert.equal((output.match(/serde\s*=/g) ?? []).length, 1);
});

test('dev-dependencies are never written as optional', () => {
  const text = '[package]\nname = "x"\n';
  const plan = planInstall({
    packageName: 'serde',
    versionReq: '^1',
    table: 'dev-dependencies',
    optional: true,
    workspaceMode: false,
    targets: [{ name: 'x', manifestPath: '/tmp/Cargo.toml' }],
    workspaceManifestPath: '/tmp/Cargo.toml',
    texts: new Map([['/tmp/Cargo.toml', text]]),
  });
  const parsed = parse(plan.files.get('/tmp/Cargo.toml')!) as Record<string, any>;
  assert.equal(parsed['dev-dependencies'].serde.optional, undefined);
  assert.match(plan.notes.join(' '), /optional/i);
});

test('removing a dependency handles dotted and sub-table forms', () => {
  const subtable = planRemove('/tmp/Cargo.toml', 'dependencies', 'serde', '[dependencies.serde]\nversion = "1"\n');
  assert.equal(subtable.includes('[dependencies.serde]'), false);
  const dotted = planRemove('/tmp/Cargo.toml', 'dependencies', 'serde', '[dependencies]\nserde.version = "1"\nrand = "1"\n');
  assert.equal(dotted.includes('serde'), false);
  assert.ok(dotted.includes('rand = "1"'));
});

test('un-inheriting a package field removes key.workspace', () => {
  const text = '[package]\nname = "x"\nedition.workspace = true\n\n[workspace.package]\nedition = "2024"\n';
  const output = applyPropertyEdits(text, [{ manifestPath: 'x', target: 'package', key: 'edition', value: '2021' }]);
  assert.doesNotThrow(() => parse(output));
  assert.equal((parse(output) as Record<string, any>).package.edition, '2021');
});

test('lint migration adds the workspace opt-in', () => {
  const output = migrateLintsToWorkspace('[package]\nname = "x"\n\n[lints.clippy]\nunwrap_used = "deny"\n');
  const parsed = parse(output) as Record<string, any>;
  assert.equal(parsed.lints.workspace, true);
  assert.equal(parsed.workspace.lints.clippy.unwrap_used, 'deny');
});

test('removing and adding rustfmt options in one batch does not overlap', () => {
  const output = applyTopLevelOptionEdits('max_width = 90\n', [
    { key: 'max_width', value: undefined },
    { key: 'fn_params_layout', value: 'Vertical' },
  ]);
  const parsed = parse(output) as Record<string, any>;
  assert.equal(parsed.max_width, undefined);
  assert.equal(parsed.fn_params_layout, 'Vertical');
});

test('rustup default marker is parsed from current output', () => {
  const list = parseToolchainList('stable-aarch64-apple-darwin (active, default)\n1.93.1-aarch64-apple-darwin\n');
  assert.equal(list[0].default, true);
  assert.equal(list[0].active, true);
  assert.equal(list[1].default, false);
});

test('standardization composes findings that target the same manifest', () => {
  const original = '[package]\nmetadata-rustfmt\nmetadata-clippy\n';
  const finding = (id: string, marker: string): StandardizeFinding => ({
    id,
    kind: 'fmt-in-manifest',
    title: id,
    titleZh: id,
    description: '',
    descriptionZh: '',
    manifestPath: '/tmp/Cargo.toml',
    fixable: true,
    changes: [
      {
        path: '/tmp/Cargo.toml',
        content: original.replace(marker, ''),
        transform: (current) => current.replace(marker, ''),
        original,
        reason: id,
        reasonZh: id,
      },
    ],
  });
  const preview = previewStandardization('/tmp', [finding('a', 'metadata-rustfmt'), finding('b', 'metadata-clippy')]);
  const content = preview.find((change) => change.path === '/tmp/Cargo.toml')!.newContent;
  assert.ok(!content.includes('metadata-rustfmt'));
  assert.ok(!content.includes('metadata-clippy'));
});

test('a table header with a closing bracket in its comment is still recognized', () => {
  const editor = new TomlEditor('[package] # see ] for details\nname = "x"\n');
  assert.equal(editor.getTable('package')?.name, 'package');
  assert.equal(editor.getValue('package', 'name'), '"x"');
});

test('property validation rejects versions cargo rejects', () => {
  const version = PACKAGE_PROPERTIES.find((property) => property.key === 'version')!;
  assert.ok(validateProperty(version, '1.2.3.4'));
  assert.ok(validateProperty(version, '1.2.3abc'));
  assert.equal(validateProperty(version, '1.2.3'), undefined);
  const rustVersion = PACKAGE_PROPERTIES.find((property) => property.key === 'rust-version')!;
  assert.ok(validateProperty(rustVersion, '1.02'));
  assert.equal(validateProperty(rustVersion, '1.75'), undefined);
});

test('snapshot only deletes files that really did not exist', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'rust-forge-snap-'));
  try {
    const store = new SnapshotStore(dir, path.join(dir, '.state'));
    const snapshot = await store.begin('test');
    const missing = path.join(dir, 'new.txt');
    await store.record(snapshot, missing);
    assert.deepEqual(snapshot.createdFiles, [missing]);

    const existing = path.join(dir, 'old.txt');
    await fs.writeFile(existing, 'original');
    await store.record(snapshot, existing);
    assert.equal(snapshot.files.find((file) => file.path === existing)?.content, 'original');
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('locked versions prefer stable releases and the declared requirement', () => {
  const lock = parseLockfile(
    'version = 4\n\n[[package]]\nname = "foo"\nversion = "2.0.0-rc.1"\n\n[[package]]\nname = "foo"\nversion = "1.10.0"\n',
  );
  assert.equal(lockedVersion(lock, 'foo'), '1.10.0');
  assert.equal(lockedVersion(lock, 'foo', '1.10'), '1.10.0');
});

test('the ^latest sentinel becomes a caret on the resolved version', () => {
  assert.equal(resolveRequestedRequirement('^latest', '1.2.3'), '^1.2.3');
  assert.equal(resolveRequestedRequirement('latest', '1.2.3'), '^1.2.3');
  assert.equal(resolveRequestedRequirement(undefined, '1.2.3'), '^1.2.3');
  assert.equal(resolveRequestedRequirement('~1.0', '1.2.3'), '~1.0');
  assert.equal(resolveRequestedRequirement('^latest', undefined), '^latest');
});

test('workspace install keeps features and default-features without a member target', () => {
  const plan = planInstall(installRequest({ features: ['derive'], noDefaultFeatures: true }));
  const entry = (parse(plan.files.get(workspaceManifestPath)!) as Record<string, any>).workspace.dependencies.serde;
  assert.equal(entry.version, '^1');
  assert.deepEqual([...entry.features], ['derive']);
  assert.equal(entry['default-features'], false);
});

test('optional workspace install requires a member target', () => {
  const plan = planInstall(installRequest({ optional: true }));
  assert.equal(plan.files.size, 0);
  assert.match(plan.notes.join(' '), /member/i);
});

test('workspace reference carries all per-member options', () => {
  assert.equal(
    workspaceReferenceValue(['derive'], true, true),
    '{ workspace = true, features = ["derive"], optional = true, default-features = false }',
  );
});

test('a workspace root package receives an inheritance reference', () => {
  const text = `[workspace]
members = ["crates/app"]

[package]
name = "rootpkg"
version = "0.1.0"

[dependencies]
`;
  const plan = planInstall(
    installRequest({
      targets: [{ name: 'rootpkg', manifestPath: workspaceManifestPath }],
      texts: new Map([[workspaceManifestPath, text]]),
    }),
  );
  const parsed = parse(plan.files.get(workspaceManifestPath)!) as Record<string, any>;
  assert.equal(parsed.workspace.dependencies.serde, '^1');
  assert.equal(parsed.dependencies.serde.workspace, true);
  assert.match(plan.notes.join(' '), /rootpkg/);
});
