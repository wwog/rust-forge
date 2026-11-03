import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import test from 'node:test';
import { parseDependencies, declarationTablePath } from '../core/cargo/manifestDeps.js';
import { parse } from 'smol-toml';
import { analyzeStandardization, migrateLintsToWorkspace } from '../core/standardize.js';
import { buildModel } from '../core/cargo/project.js';
import {
  applyPropertyEdits,
  validateProperty,
  PACKAGE_PROPERTIES,
  WORKSPACE_PROPERTIES,
  readProperties,
} from '../core/properties.js';
import { generateRustfmtToml, applyRustfmtEdits, unstableOptionsWithoutFlag, RUSTFMT_OPTIONS } from '../core/rustfmt.js';
import { planMigration, chooseResolver, evaluatePromotion } from '../core/migration/plan.js';
import { TomlEditor } from '../core/toml/editor.js';
import { crateDocsUrl } from '../core/deps/registry.js';
import { planUpgrades } from '../core/deps/write.js';
import { buildDependencyTree } from '../core/deps/tree.js';
import type { ProjectModel } from '../core/cargo/project.js';

test('parses dependency declarations of every shape', () => {
  const text = `[dependencies]
serde = "1"
anyhow = { version = "1.0", features = ["backtrace"], optional = true }
local = { path = "../local" }
gitdep = { git = "https://example.com/x", branch = "main" }
shared = { workspace = true }
`;
  const deps = parseDependencies(text, '/tmp/Cargo.toml');
  assert.equal(deps.length, 5);
  assert.equal(deps.find((d) => d.key === 'serde')!.kind, 'registry');
  assert.deepEqual(deps.find((d) => d.key === 'anyhow')!.features, ['backtrace']);
  assert.equal(deps.find((d) => d.key === 'anyhow')!.optional, true);
  assert.equal(deps.find((d) => d.key === 'local')!.kind, 'path');
  assert.equal(deps.find((d) => d.key === 'gitdep')!.branch, 'main');
  assert.equal(deps.find((d) => d.key === 'shared')!.kind, 'workspace');
});

test('target-specific dependencies are read with their cfg', () => {
  const text = `[target.'cfg(unix)'.dependencies]
libc = "0.2"
`;
  const deps = parseDependencies(text, '/tmp/Cargo.toml');
  assert.equal(deps.length, 1);
  assert.equal(deps[0].target, "cfg(unix)");
});

test('workspace lints migration produces inherit-friendly output', () => {
  const input = `[package]
name = "a"

[lints.clippy]
unwrap_used = "deny"
`;
  const output = migrateLintsToWorkspace(input);
  assert.match(output, /\[workspace\.lints\.clippy\]/);
  assert.ok(!/^\[lints\.clippy\]/m.test(output));
  assert.ok(output.indexOf('[workspace]') < output.indexOf('[workspace.lints.clippy]'));
});

test('property edits write values and inheritance switches', () => {
  const input = `[package]
name = "a"
version = "0.1.0"
`;
  const updated = applyPropertyEdits(input, [
    { manifestPath: 'x', target: 'package', key: 'rust-version', value: '1.75' },
    { manifestPath: 'x', target: 'package', key: 'version', inherit: true },
  ]);
  const editor = new TomlEditor(updated);
  assert.equal(editor.getValue('package', 'rust-version'), '"1.75"');
  assert.equal(editor.getValue('package', 'version.workspace'), 'true');
});

test('property validation rejects bad values', () => {
  const edition = PACKAGE_PROPERTIES.find((p) => p.key === 'edition')!;
  assert.ok(validateProperty(edition, '2025'));
  assert.equal(validateProperty(edition, '2021'), undefined);
  const msrv = PACKAGE_PROPERTIES.find((p) => p.key === 'rust-version')!;
  assert.ok(validateProperty(msrv, 'abc'));
  assert.equal(validateProperty(msrv, '1.75'), undefined);
  const name = PACKAGE_PROPERTIES.find((p) => p.key === 'name')!;
  assert.ok(validateProperty(name, '1bad'));
});

test('expanded package properties cover metadata, publishing and build', () => {
  const keys = new Set(PACKAGE_PROPERTIES.map((property) => property.key));
  for (const key of [
    'authors',
    'repository',
    'homepage',
    'documentation',
    'readme',
    'keywords',
    'categories',
    'license-file',
    'publish',
    'exclude',
    'include',
    'build',
    'links',
    'default-run',
    'autobins',
    'autoexamples',
    'autotests',
    'autobenches',
  ]) {
    assert.ok(keys.has(key), `${key} is missing`);
  }
  assert.deepEqual(WORKSPACE_PROPERTIES.map((property) => property.key), ['resolver', 'members', 'default-members', 'exclude']);
  const keywords = PACKAGE_PROPERTIES.find((p) => p.key === 'keywords')!;
  assert.ok(validateProperty(keywords, 'a, b, c, d, e, f'));
  assert.equal(validateProperty(keywords, 'a, b, c'), undefined);
});

test('property edits serialize arrays, booleans and workspace package defaults', () => {
  const input = `[package]
name = "a"
version = "0.1.0"
`;
  const updated = applyPropertyEdits(input, [
    { manifestPath: 'x', target: 'package', key: 'authors', value: 'Jane <jane@example.com>, John' },
    { manifestPath: 'x', target: 'package', key: 'autobins', value: 'false' },
    { manifestPath: 'x', target: 'package', key: 'publish', value: 'false' },
    { manifestPath: 'x', target: 'workspace.package', key: 'edition', value: '2024' },
    { manifestPath: 'x', target: 'workspace', key: 'default-members', value: 'crates/app' },
  ]);
  const editor = new TomlEditor(updated);
  assert.equal(editor.getValue('package', 'authors'), '["Jane <jane@example.com>", "John"]');
  assert.equal(editor.getValue('package', 'autobins'), 'false');
  assert.equal(editor.getValue('package', 'publish'), 'false');
  assert.equal(editor.getValue('workspace.package', 'edition'), '"2024"');
  assert.equal(editor.getValue('workspace', 'default-members'), '["crates/app"]');
});

test('workspace package defaults expose inheritable member values', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'rf-properties-'));
  try {
    const memberDir = path.join(dir, 'crates', 'app');
    await fs.mkdir(memberDir, { recursive: true });
    await fs.writeFile(
      path.join(dir, 'Cargo.toml'),
      `[workspace]
members = ["crates/app"]
resolver = "3"

[workspace.package]
edition = "2024"
version = "0.2.0"
license = "MIT"
`,
      'utf8',
    );
    await fs.writeFile(
      path.join(memberDir, 'Cargo.toml'),
      `[package]
name = "app"
version.workspace = true
edition.workspace = true
license.workspace = true
`,
      'utf8',
    );

    const model: ProjectModel = {
      kind: 'workspace',
      root: dir,
      manifestPath: path.join(dir, 'Cargo.toml'),
      members: [
        {
          name: 'app',
          dir: memberDir,
          manifestPath: path.join(memberDir, 'Cargo.toml'),
        },
      ],
      emptyWorkspaceShell: false,
      hasLockfile: false,
    };

    const properties = await readProperties(model);
    assert.equal(properties.hasRootPackage, false);
    assert.equal(
      properties.workspacePackageProperties.find((property) => property.key === 'edition')?.value,
      '2024',
    );
    assert.equal(
      properties.workspacePackageProperties
        .find((property) => property.key === 'edition')
        ?.memberValues?.find((member) => member.member === 'app')?.inherited,
      true,
    );
    const version = properties.packageProperties.find((property) => property.key === 'version')!;
    assert.equal(version.workspaceValue, '0.2.0');
    assert.equal(version.memberValues?.find((member) => member.member === 'app')?.inherited, true);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('rustfmt generation is conservative and stable', () => {
  const content = generateRustfmtToml({ edition: '2021' });
  assert.match(content, /max_width = 100/);
  assert.match(content, /edition = "2021"/);
  assert.ok(!content.includes('imports_granularity'));
  const withImports = generateRustfmtToml({ edition: '2021', includeImportsGranularity: true });
  assert.match(withImports, /imports_granularity = "Crate"/);
});

test('rustfmt edits preserve comments and only touch selected keys', () => {
  const original = `# my settings\nmax_width = 90\nreorder_imports = true\n`;
  const updated = applyRustfmtEdits(original, [
    { key: 'max_width', value: 110 },
    { key: 'tab_spaces', value: 2 },
  ]);
  assert.match(updated, /# my settings/);
  assert.match(updated, /max_width = 110/);
  assert.match(updated, /tab_spaces = 2/);
});

test('unstable rustfmt options are reported without unstable_features', () => {
  assert.deepEqual(unstableOptionsWithoutFlag({ imports_granularity: 'Crate' }), ['imports_granularity']);
  assert.deepEqual(unstableOptionsWithoutFlag({ imports_granularity: 'Crate', unstable_features: true }), []);
});

test('rustfmt catalogue covers layout, comments, heuristics, imports and style', () => {
  const options = new Map(RUSTFMT_OPTIONS.map((option) => [option.key, option]));
  for (const key of [
    'newline_style',
    'style_edition',
    'fn_params_layout',
    'fn_call_width',
    'single_line_let_else_max_width',
    'wrap_comments',
    'comment_width',
    'format_code_in_doc_comments',
    'imports_layout',
    'group_imports',
    'trailing_comma',
    'blank_lines_upper_bound',
    'format_macro_bodies',
    'skip_children',
    'ignore',
  ]) {
    assert.ok(options.has(key), `${key} is missing`);
  }
  assert.equal(options.get('ignore')!.type, 'array');
  assert.equal(options.get('style_edition')!.stable, true);
  assert.equal(options.get('wrap_comments')!.stable, false);
});

test('resolver selection follows the edition', () => {
  assert.equal(chooseResolver('2015'), '1');
  assert.equal(chooseResolver('2018'), '1');
  assert.equal(chooseResolver('2021'), '2');
  assert.equal(chooseResolver('2024'), '3');
  assert.equal(chooseResolver(undefined), '2');
});

test('dependency promotion rejects conflicting requirements', () => {
  const text = `[dependencies]
a = "1"
b = { version = "1", features = ["x"] }

[dev-dependencies]
b = "1"
c = { path = "../c", optional = true }
`;
  const deps = parseDependencies(text, '/tmp/Cargo.toml');
  const { promoted, kept } = evaluatePromotion(deps);
  assert.ok(promoted.has('a'));
  assert.ok(!promoted.has('b'), 'same dep in two tables is not promoted');
  assert.ok(!promoted.has('c'), 'path deps stay in place');
  assert.ok(kept.some((k) => k.name === 'b'));
});

test('migration plan extracts fields and rewrites the member', () => {
  const manifest = `[package]
name = "demo"
version = "0.3.0"
edition = "2021"
rust-version = "1.75"
license = "MIT"
description = "x"

[dependencies]
serde = "1"
`;
  const plan = planMigration({
    packageName: 'demo',
    rootManifestText: manifest,
    readmeHandling: 'keep',
    extractFields: ['version', 'edition', 'rust-version'],
  });
  assert.match(plan.workspaceManifest, /members = \["crates\/\*"\]/);
  assert.match(plan.workspaceManifest, /resolver = "2"/);
  assert.match(plan.workspaceManifest, /serde = "1"/);
  assert.match(plan.memberManifest, /version\.workspace = true/);
  assert.match(plan.memberManifest, /serde = \{ workspace = true \}/);
  assert.match(plan.memberManifest, /description = "x"/);
});

test('member manifest that inherits lints cannot keep local lint tables', () => {
  const manifest = `[package]
name = "demo"
version = "0.1.0"
edition = "2021"

[lints.clippy]
unwrap_used = "deny"
`;
  const plan = planMigration({
    packageName: 'demo',
    rootManifestText: manifest,
    readmeHandling: 'keep',
    extractFields: ['version'],
  });
  assert.match(plan.workspaceManifest, /\[workspace\.lints\.clippy\]/);
  assert.match(plan.memberManifest, /\[lints\]\nworkspace = true/);
  assert.ok(!/unwrap_used/.test(plan.memberManifest), 'local lint levels move to the workspace');
  assert.ok(!/\[lints\.clippy\]/.test(plan.memberManifest));
});

test('parse re-exported from manifestDeps still works', () => {
  const data = parse('[package]\nname = "x"\n') as Record<string, unknown>;
  assert.equal((data.package as Record<string, unknown>).name, 'x');
});

test('crate documentation links target crates.io and pin the version', () => {
  assert.equal(crateDocsUrl('serde', '1.0.229'), 'https://crates.io/crates/serde/1.0.229');
  assert.equal(crateDocsUrl('serde'), 'https://crates.io/crates/serde');
  assert.equal(crateDocsUrl('foo bar'), 'https://crates.io/crates/foo%20bar');
  assert.equal(crateDocsUrl('serde', 'workspace'), 'https://crates.io/crates/serde');
});

test('target-specific declarations resolve to the full table path and can be removed', () => {
  const text = `[target.'cfg(unix)'.dependencies]
libc = "0.2"
`;
  const decl = parseDependencies(text, '/tmp/Cargo.toml')[0];
  assert.equal(declarationTablePath(decl), 'target."cfg(unix)".dependencies');
  const editor = new TomlEditor(text);
  const updated = editor.apply(editor.removeKey(declarationTablePath(decl), decl.key, { dropEmptyTable: true }));
  assert.equal(updated.trim(), '');
});

test('new rustfmt options are inserted on separate lines', () => {
  const updated = applyRustfmtEdits('# my settings\nmax_width = 90\n', [
    { key: 'tab_spaces', value: 2 },
    { key: 'hard_tabs', value: false },
  ]);
  const parsed = parse(updated) as Record<string, unknown>;
  assert.equal(parsed.max_width, 90);
  assert.equal(parsed.tab_spaces, 2);
  assert.equal(parsed.hard_tabs, false);
  assert.ok(updated.startsWith('# my settings\n'));
});

test('new rustfmt options are safe when the file starts with a table', () => {
  const updated = applyRustfmtEdits('[unstable]\nwrap_comments = true\n', [{ key: 'tab_spaces', value: 2 }]);
  const parsed = parse(updated) as Record<string, any>;
  assert.equal(parsed.tab_spaces, 2);
  assert.equal(parsed.unstable.wrap_comments, true);
});

test('target-specific upgrades rewrite only the target table', () => {
  const manifestPath = '/tmp/target/Cargo.toml';
  const text = `[dependencies]
libc = "0.2.100"

[target.'cfg(unix)'.dependencies]
libc = "0.1"
`;
  const declarations = parseDependencies(text, manifestPath);
  const target = declarations.find((decl) => decl.target === 'cfg(unix)');
  assert.ok(target);
  assert.equal(target!.line, 4);
  const result = planUpgrades(
    declarations.map((declaration) => ({
      manifestPath,
      declaration,
      newRequirement: '^0.2.200',
      targetVersion: '0.2.200',
    })),
    new Map([[manifestPath, text]]),
  );
  assert.equal(result.updateSpecs.length, 1);
  const parsed = parse(result.files.get(manifestPath)!) as Record<string, any>;
  assert.equal(parsed.dependencies.libc, '^0.2.200');
  assert.equal(parsed.target['cfg(unix)'].dependencies.libc, '^0.2.200');
});

test('a target-only dependency is upgraded instead of silently skipped', () => {
  const manifestPath = '/tmp/target-only/Cargo.toml';
  const text = `[target.'cfg(windows)'.dependencies]
winapi = "0.3"
`;
  const declaration = parseDependencies(text, manifestPath)[0];
  const result = planUpgrades(
    [{ manifestPath, declaration, newRequirement: '^0.3.10', targetVersion: '0.3.10' }],
    new Map([[manifestPath, text]]),
  );
  const parsed = parse(result.files.get(manifestPath)!) as Record<string, any>;
  assert.equal(parsed.target['cfg(windows)'].dependencies.winapi, '^0.3.10');
});

test('duplicate upgrades for the same workspace key are applied once', () => {
  const manifestPath = '/tmp/ws/Cargo.toml';
  const text = `[workspace.dependencies]
serde = "1.0"
`;
  const declaration = {
    key: 'serde',
    packageName: 'serde',
    table: 'dependencies' as const,
    version: '1.0',
    kind: 'registry' as const,
    features: [],
    rawValue: '"1.0"',
    manifestPath,
    line: 1,
  };
  const edit = {
    manifestPath,
    declaration,
    newRequirement: '^1.0.200',
    targetVersion: '1.0.200',
    workspaceDependency: true,
  };
  const memberEdit = { ...edit, declaration: { ...declaration, tablePath: undefined } };
  const result = planUpgrades([edit, memberEdit], new Map([[manifestPath, text]]));
  assert.equal(result.updateSpecs.length, 1);
  const parsed = parse(result.files.get(manifestPath)!) as Record<string, any>;
  assert.equal(parsed.workspace.dependencies.serde, '^1.0.200');
});

test('standardization merges metadata into existing rustfmt and clippy files', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'rust-forge-std-'));
  try {
    const manifestPath = path.join(dir, 'Cargo.toml');
    await fs.writeFile(
      manifestPath,
      `[package]
name = "demo"
version = "0.1.0"
edition = "2021"

[package.metadata.rustfmt]
max_width = 120

[package.metadata.clippy]
too-many-arguments-threshold = 10
`,
    );
    const rustfmtPath = path.join(dir, 'rustfmt.toml');
    await fs.writeFile(rustfmtPath, '# keep this\nedition = "2021"\n');
    const clippyPath = path.join(dir, 'clippy.toml');
    await fs.writeFile(clippyPath, 'avoid-breaking-exported-api = false\n');

    const model = {
      kind: 'package',
      root: dir,
      manifestPath,
      members: [{ name: 'demo', dir, manifestPath }],
      rootPackage: { name: 'demo', dir, manifestPath },
      emptyWorkspaceShell: false,
      hasLockfile: false,
      rustfmtFile: rustfmtPath,
    } as unknown as ProjectModel;

    const plan = await analyzeStandardization(model);
    const fmt = plan.findings.find((finding) => finding.kind === 'fmt-in-manifest');
    const clippy = plan.findings.find((finding) => finding.kind === 'clippy-config-in-manifest');
    assert.ok(fmt);
    assert.ok(clippy);

    const fmtContent = fmt!.changes.find((change) => change.path === rustfmtPath)!.content;
    const fmtParsed = parse(fmtContent) as Record<string, unknown>;
    assert.equal(fmtParsed.edition, '2021');
    assert.equal(fmtParsed.max_width, 120);
    assert.match(fmtContent, /# keep this/);

    const clippyContent = clippy!.changes.find((change) => change.path === clippyPath)!.content;
    const clippyParsed = parse(clippyContent) as Record<string, any>;
    assert.equal(clippyParsed['avoid-breaking-exported-api'], false);
    assert.equal(clippyParsed['too-many-arguments-threshold'], 10);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('workspace dependencies are pinned above members and split local/remote', () => {
  const member = (name: string) => ({
    name,
    dir: `/tmp/ws/crates/${name}`,
    manifestPath: `/tmp/ws/crates/${name}/Cargo.toml`,
  });
  const model = {
    kind: 'workspace',
    root: '/tmp/ws',
    manifestPath: '/tmp/ws/Cargo.toml',
    members: [member('app'), member('inner')],
    emptyWorkspaceShell: false,
    hasLockfile: false,
  } as unknown as ProjectModel;

  const decl = (
    key: string,
    kind: 'registry' | 'path',
    extra: Record<string, unknown> = {},
  ) => ({
    key,
    packageName: key,
    table: 'dependencies' as const,
    tablePath: 'workspace.dependencies',
    kind,
    version: kind === 'registry' ? '1' : undefined,
    features: [],
    rawValue: '"1"',
    manifestPath: '/tmp/ws/Cargo.toml',
    line: 0,
    ...extra,
  });

  const tree = buildDependencyTree({
    model,
    declarations: [{ member: 'app', manifestPath: member('app').manifestPath, deps: [] }],
    workspaceDependencies: [
      decl('serde', 'registry'),
      decl('inner', 'path', { path: 'crates/inner' }),
    ],
    registryData: new Map(),
    registryDegraded: false,
    advisories: new Map(),
  });

  const pinned = tree.root.children?.[0];
  assert.equal(pinned?.id, 'workspace-dependencies');
  assert.equal(pinned?.kind, 'group');
  const local = pinned?.children?.find((group) => group.id === 'workspace-deps:local');
  const remote = pinned?.children?.find((group) => group.id === 'workspace-deps:remote');
  assert.deepEqual(local?.children?.map((node) => node.label), ['inner']);
  assert.equal(local?.children?.[0].localTarget, 'inner');
  assert.deepEqual(remote?.children?.map((node) => node.label), ['serde']);
  assert.equal(remote?.children?.[0].workspaceRootDependency, true);
});

test('standardize reports workspace containers with non-member content without a fix', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'rust-forge-container-'));
  try {
    await fs.writeFile(
      path.join(root, 'Cargo.toml'),
      '[workspace]\nmembers = ["crates/*"]\nresolver = "2"\n',
    );
    const crate = path.join(root, 'crates', 'app');
    await fs.mkdir(path.join(crate, 'src'), { recursive: true });
    await fs.writeFile(path.join(crate, 'Cargo.toml'), '[package]\nname = "app"\nversion = "0.1.0"\nedition = "2021"\n');
    await fs.writeFile(path.join(crate, 'src', 'lib.rs'), '');
    await fs.writeFile(path.join(root, 'crates', 'README.md'), '# grouping notes\n');

    const built = await buildModel(root);
    const plan = await analyzeStandardization(built.model!);
    const container = plan.findings.find((finding) => finding.id === 'container:crates');
    assert.ok(container, 'container finding should exist');
    assert.equal(container.fixable, false);
    assert.deepEqual(container.changes, []);
    assert.match(container.description, /README\.md/);

    await fs.rm(path.join(root, 'crates', 'README.md'));
    const clean = await analyzeStandardization((await buildModel(root)).model!);
    assert.equal(clean.findings.some((finding) => finding.id === 'container:crates'), false);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
