import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import test from 'node:test';
import { parse } from 'smol-toml';
import { buildTopologySnapshot, planTopologyEdit } from '../core/topology/model.js';
import { planMemberMove, validateMemberTarget } from '../core/topology/move.js';
import { buildModel, type ProjectModel } from '../core/cargo/project.js';
import { CargoService } from '../core/cargo/cargo.js';

const ROOT = path.join(path.sep, 'ws');

function member(name: string, relative: string): { name: string; dir: string; manifestPath: string } {
  const dir = path.join(ROOT, ...relative.split('/'));
  return { name, dir, manifestPath: path.join(dir, 'Cargo.toml') };
}

function modelOf(members: ReturnType<typeof member>[]): ProjectModel {
  return {
    kind: 'workspace',
    root: ROOT,
    manifestPath: path.join(ROOT, 'Cargo.toml'),
    members,
    emptyWorkspaceShell: false,
    hasLockfile: false,
  };
}

function workspaceOf(text: string): Record<string, any> {
  return (parse(text) as { workspace?: Record<string, any> }).workspace ?? {};
}

const APP = member('app', 'crates/app');
const LIB = member('lib', 'crates/lib');

// ------------------------------------------------------------------ snapshot

test('an explicit member wins over exclude', () => {
  const model = modelOf([member('app', 'crates/app')]);
  const snapshot = buildTopologySnapshot({
    model,
    rootText: '[workspace]\nmembers = ["crates/app"]\nexclude = ["crates"]\n',
  });

  assert.equal(snapshot.members[0]?.excluded, false);
  assert.ok(snapshot.issues.some((issue) => issue.id === 'exclude-explicit:crates:crates/app'));
});

test('glob members report the covering pattern and excluded directories', () => {
  const model = modelOf([member('app', 'crates/app')]);
  const snapshot = buildTopologySnapshot({
    model,
    rootText: '[workspace]\nmembers = ["crates/*"]\nexclude = ["crates/skip"]\n',
  });

  const app = snapshot.members[0]!;
  assert.equal(app.coveredByGlob, true);
  assert.equal(app.memberPattern, 'crates/*');
  assert.equal(app.excluded, false);

  const pattern = snapshot.patterns[0]!;
  assert.equal(pattern.glob, true);
  assert.deepEqual(pattern.resolved, ['crates/app']);
  assert.deepEqual(pattern.excluded, ['crates/skip']);
});

test('all members are default when default-members is absent', () => {
  const snapshot = buildTopologySnapshot({
    model: modelOf([APP, LIB]),
    rootText: '[workspace]\nmembers = ["crates/app", "crates/lib"]\n',
  });
  assert.equal(snapshot.hasDefaultMembers, false);
  assert.ok(snapshot.members.every((member) => member.isDefault));
});

test('a default-members entry that resolves to no member is an error', () => {
  const snapshot = buildTopologySnapshot({
    model: modelOf([APP]),
    rootText: '[workspace]\nmembers = ["crates/app"]\ndefault-members = ["crates/missing"]\n',
  });
  const issue = snapshot.issues.find((candidate) => candidate.id === 'default-member-missing:crates/missing');
  assert.equal(issue?.severity, 'error');
  assert.equal(snapshot.members[0]?.isDefault, false);
});

test('a package name in default-members is invalid just like cargo', () => {
  const snapshot = buildTopologySnapshot({
    model: modelOf([APP]),
    rootText: '[workspace]\nmembers = ["crates/app"]\ndefault-members = ["app"]\n',
  });
  // Cargo rejects `default-members = ["app"]` when the crate lives in
  // crates/app; only paths and globs are accepted.
  const issue = snapshot.issues.find((candidate) => candidate.id === 'default-member-missing:app');
  assert.equal(issue?.severity, 'error');
  assert.equal(snapshot.members[0]?.isDefault, false);

  const plan = planTopologyEdit(
    '[workspace]\nmembers = ["crates/app"]\ndefault-members = ["crates/app"]\n',
    { defaultMembers: ['app'], exclude: [] },
    { members: [{ name: 'app', relative: 'crates/app' }] },
  );
  assert.equal(plan.changed, false);
  assert.ok(plan.issues.some((candidate) => candidate.severity === 'error'));
});

// ------------------------------------------------------------------- editing

test('selecting every member removes default-members', () => {
  const text = '[workspace]\nmembers = ["crates/app", "crates/lib"]\ndefault-members = ["crates/app", "crates/lib"]\n';
  const plan = planTopologyEdit(
    text,
    { defaultMembers: ['crates/app', 'crates/lib'], exclude: [] },
    { members: [APP, LIB].map((entry) => ({ name: entry.name, relative: `crates/${entry.name}` })) },
  );

  assert.equal(plan.changed, true);
  assert.equal(workspaceOf(plan.text)['default-members'], undefined);
  assert.deepEqual(workspaceOf(plan.text).members, ['crates/app', 'crates/lib']);
});

test('a partial default-members selection is written as directories', () => {
  const text = '[workspace]\nmembers = ["crates/app", "crates/lib"]\n';
  const plan = planTopologyEdit(
    text,
    { defaultMembers: ['crates/app'], exclude: [] },
    {
      members: [
        { name: 'app', relative: 'crates/app' },
        { name: 'lib', relative: 'crates/lib' },
      ],
    },
  );

  assert.equal(plan.changed, true);
  assert.deepEqual(workspaceOf(plan.text)['default-members'], ['crates/app']);
});

test('deselecting every member writes an explicit empty default-members list', () => {
  const text = '[workspace]\nmembers = ["crates/app", "crates/lib"]\n';
  const plan = planTopologyEdit(
    text,
    { defaultMembers: [], exclude: [] },
    {
      members: [
        { name: 'app', relative: 'crates/app' },
        { name: 'lib', relative: 'crates/lib' },
      ],
    },
  );

  assert.equal(plan.changed, true);
  assert.deepEqual(workspaceOf(plan.text)['default-members'], []);
});

test('excluding a default member drops it and removes a now-redundant list', () => {
  const text =
    '[workspace]\nmembers = ["crates/*"]\ndefault-members = ["crates/app", "crates/lib"]\n';
  const plan = planTopologyEdit(
    text,
    { defaultMembers: ['crates/app', 'crates/lib'], exclude: ['crates/app'] },
    {
      members: [
        { name: 'app', relative: 'crates/app' },
        { name: 'lib', relative: 'crates/lib' },
      ],
    },
  );

  assert.ok(plan.issues.some((issue) => issue.id === 'default-excluded:crates/app'));
  assert.ok(plan.issues.some((issue) => issue.severity === 'warning'));
  // Only crates/lib survives and it is still selected, which is the default
  // set for the workspace, so the explicit key is dropped instead of writing
  // an invalid entry for the excluded crate.
  assert.equal(workspaceOf(plan.text)['default-members'], undefined);
});

test('absolute and parent-traversing exclude entries are rejected', () => {
  for (const entry of ['/tmp/vendor', '../vendor', 'crates/../../outside']) {
    const plan = planTopologyEdit(
      '[workspace]\nmembers = ["crates/*"]\n',
      { defaultMembers: [], exclude: [entry] },
      { members: [{ name: 'app', relative: 'crates/app' }] },
    );
    assert.equal(plan.changed, false, entry);
    assert.ok(plan.issues.some((issue) => issue.severity === 'error'), entry);
  }
});

test('an invalid default member is rejected without touching the text', () => {
  const text = '[workspace]\nmembers = ["crates/app"]\n';
  const plan = planTopologyEdit(
    text,
    { defaultMembers: ['crates/missing'], exclude: [] },
    { members: [{ name: 'app', relative: 'crates/app' }] },
  );

  assert.equal(plan.changed, false);
  assert.equal(plan.text, text);
  assert.ok(plan.issues.some((issue) => issue.severity === 'error' && issue.id === 'invalid-default:crates/missing'));
});

test('exclude entries are normalized and de-duplicated', () => {
  const text = '[workspace]\nmembers = ["crates/app"]\n';
  const plan = planTopologyEdit(
    text,
    { defaultMembers: [], exclude: ['vendor\\lib/', './vendor/lib', 'vendor/lib'] },
    { members: [{ name: 'app', relative: 'crates/app' }] },
  );

  assert.equal(plan.changed, true);
  assert.deepEqual(workspaceOf(plan.text).exclude, ['vendor/lib']);
});

test('an exclude that matches an explicit member is reported but kept', () => {
  const text = '[workspace]\nmembers = ["crates/app"]\n';
  const plan = planTopologyEdit(
    text,
    { defaultMembers: [], exclude: ['crates/app'] },
    { members: [{ name: 'app', relative: 'crates/app' }] },
  );

  assert.deepEqual(workspaceOf(plan.text).exclude, ['crates/app']);
  assert.ok(plan.issues.some((issue) => issue.severity === 'warning' && issue.id === 'exclude-explicit:crates/app:crates/app'));
});

// ---------------------------------------------------------------------- move

function moveApp(rootText: string, memberTexts: Record<string, string>, targetRelative = 'crates/core/app') {
  const model = modelOf([APP, LIB]);
  return {
    model,
    plan: planMemberMove({
      model,
      member: 'app',
      targetRelative,
      rootText,
      memberTexts: {
        app: memberTexts.app ?? '[package]\nname = "app"\nversion = "0.1.0"\nedition = "2021"\n',
        lib: memberTexts.lib ?? '[package]\nname = "lib"\nversion = "0.1.0"\nedition = "2021"\n',
      },
    }),
  };
}

test('move rewrites the explicit members entry in place', () => {
  const { plan, model } = moveApp('[workspace]\nmembers = ["crates/app", "crates/lib"]\n', {});
  assert.deepEqual(plan.errors, []);
  assert.deepEqual(plan.moves, [{ from: APP.dir, to: path.join(ROOT, 'crates', 'core', 'app') }]);

  const updated = plan.files[model.manifestPath]!;
  assert.deepEqual(workspaceOf(updated).members, ['crates/core/app', 'crates/lib']);
});

test('a glob-covered move leaves members unchanged when the glob still matches', () => {
  const model = modelOf([APP]);
  const plan = planMemberMove({
    model,
    member: 'app',
    targetRelative: 'crates/app2',
    rootText: '[workspace]\nmembers = ["crates/*"]\n',
    memberTexts: { app: '[package]\nname = "app"\nversion = "0.1.0"\n' },
  });

  assert.deepEqual(plan.errors, []);
  assert.deepEqual(plan.files, {});
});

test('a glob-covered move outside the glob adds an explicit member entry', () => {
  const model = modelOf([APP]);
  const plan = planMemberMove({
    model,
    member: 'app',
    targetRelative: 'tools/app',
    rootText: '[workspace]\nmembers = ["crates/*"]\n',
    memberTexts: { app: '[package]\nname = "app"\nversion = "0.1.0"\n' },
  });

  assert.deepEqual(workspaceOf(plan.files[model.manifestPath]!).members, ['crates/*', 'tools/app']);
});

test('move rewrites default-members and exclude', () => {
  const { plan, model } = moveApp(
    '[workspace]\nmembers = ["crates/app", "crates/lib"]\ndefault-members = ["crates/app"]\nexclude = ["crates/app"]\n',
    {},
  );

  const updated = workspaceOf(plan.files[model.manifestPath]!);
  assert.deepEqual(updated['default-members'], ['crates/core/app']);
  assert.deepEqual(updated.exclude, ['crates/core/app']);
});

test('move rewrites [workspace.dependencies] path entries and keeps siblings', () => {
  const { plan, model } = moveApp(
    [
      '[workspace]',
      'members = ["crates/app", "crates/lib"]',
      '',
      '[workspace.dependencies]',
      'app = { version = "0.1.0", path = "crates/app", features = ["std"] }',
      'lib = { path = "crates/lib" }',
      '',
    ].join('\n'),
    {},
  );

  const deps = workspaceOf(plan.files[model.manifestPath]!).dependencies;
  assert.equal(deps.app.version, '0.1.0');
  assert.equal(deps.app.path, 'crates/core/app');
  assert.deepEqual([...deps.app.features], ['std']);
  assert.equal(deps.lib.path, 'crates/lib');
});

test('move rewrites [workspace.dependencies] sub-table path entries', () => {
  const { plan, model } = moveApp(
    [
      '[workspace]',
      'members = ["crates/app", "crates/lib"]',
      '',
      '[workspace.dependencies.app]',
      'path = "crates/app"',
      '',
    ].join('\n'),
    {},
  );

  const deps = workspaceOf(plan.files[model.manifestPath]!).dependencies;
  assert.equal(deps.app.path, 'crates/core/app');
});

test('move rewrites target-specific and build path dependencies in another member', () => {
  const libText = [
    '[package]',
    'name = "lib"',
    'version = "0.1.0"',
    'edition = "2021"',
    '',
    "[target.'cfg(unix)'.dependencies]",
    'app = { path = "../app", features = ["x"] }',
    '',
    '[build-dependencies]',
    'app = { path = "../app" }',
    '',
  ].join('\n');

  const { plan } = moveApp('[workspace]\nmembers = ["crates/app", "crates/lib"]\n', { lib: libText });
  const updated = parse(plan.files[LIB.manifestPath]!) as Record<string, any>;

  assert.equal(updated.target['cfg(unix)'].dependencies.app.path, '../core/app');
  assert.deepEqual(updated.target['cfg(unix)'].dependencies.app.features, ['x']);
  assert.equal(updated['build-dependencies'].app.path, '../core/app');
});

test("the moved member's own outbound path dependencies are recomputed", () => {
  const appText = [
    '[package]',
    'name = "app"',
    'version = "0.1.0"',
    'edition = "2021"',
    '',
    '[dependencies]',
    'lib = { path = "../lib", default-features = false }',
    'inner = { path = "inner/pkg" }',
    '',
  ].join('\n');

  const { plan } = moveApp('[workspace]\nmembers = ["crates/app", "crates/lib"]\n', { app: appText });
  const newManifest = plan.files[path.join(ROOT, 'crates', 'core', 'app', 'Cargo.toml')];
  assert.ok(newManifest, 'the moved manifest is keyed at its new path');

  const updated = parse(newManifest!) as Record<string, any>;
  assert.equal(updated.dependencies.lib.path, '../../lib');
  assert.equal(updated.dependencies.lib['default-features'], false);
  assert.equal(updated.dependencies.inner.path, 'inner/pkg');
});

test('quoted path keys in inline declarations are rewritten', () => {
  const appText = [
    '[package]',
    'name = "app"',
    'version = "0.1.0"',
    'edition = "2021"',
    '',
    '[dependencies]',
    'lib = { "path" = "../lib", version = "0.1.0" }',
    '',
  ].join('\n');

  const { plan } = moveApp('[workspace]\nmembers = ["crates/app", "crates/lib"]\n', { app: appText });
  const newManifest = plan.files[path.join(ROOT, 'crates', 'core', 'app', 'Cargo.toml')];
  assert.ok(newManifest);
  const updated = parse(newManifest!) as Record<string, any>;
  assert.equal(updated.dependencies.lib.path, '../../lib');
  assert.equal(updated.dependencies.lib.version, '0.1.0');
});

test('package readme and license paths outside the member are recomputed', () => {
  const appText = [
    '[package]',
    'name = "app"',
    'version = "0.1.0"',
    'edition = "2021"',
    'readme = "../../README.md"',
    'license-file = "../LICENSE"',
    'build = "build.rs"',
    '',
  ].join('\n');

  const { plan } = moveApp('[workspace]\nmembers = ["crates/app", "crates/lib"]\n', { app: appText });
  const newManifest = plan.files[path.join(ROOT, 'crates', 'core', 'app', 'Cargo.toml')];
  assert.ok(newManifest);
  const updated = parse(newManifest!) as Record<string, any>;
  assert.equal(updated.package.readme, '../../../README.md');
  assert.equal(updated.package['license-file'], '../../LICENSE');
  // A build script inside the member moves with it.
  assert.equal(updated.package.build, 'build.rs');
});

test('comments and CRLF line endings survive a move', () => {
  const rootText = [
    '[workspace]',
    '# keep this comment',
    'members = ["crates/app", "crates/lib"]',
    'default-members = ["crates/app"]',
    '',
  ].join('\r\n');

  const { plan, model } = moveApp(rootText, {});
  const updated = plan.files[model.manifestPath]!;

  assert.ok(updated.includes('# keep this comment\r\n'));
  for (const line of updated.split('\n')) {
    if (line === '') continue;
    assert.ok(line.endsWith('\r'), `line should end with CRLF: ${JSON.stringify(line)}`);
  }
  assert.deepEqual(workspaceOf(updated).members, ['crates/core/app', 'crates/lib']);
});

test('moving a member inside another member is rejected', () => {
  const validation = validateMemberTarget({ model: modelOf([APP, LIB]), member: 'app', targetRelative: 'crates/lib/app' });
  assert.equal(validation.errors.length > 0, true);
});

test('moving a member to an occupied destination is rejected', () => {
  const validation = validateMemberTarget({
    model: modelOf([APP, LIB]),
    member: 'app',
    targetRelative: 'crates/core/app',
    destinationExists: true,
  });
  assert.ok(validation.errors.some((error) => error.includes('already exists')));
});

test(
  'a planned move produces a layout cargo accepts',
  { skip: process.env.RF_SKIP_CARGO_TESTS === '1' },
  async () => {
    const cargo = new CargoService({ timeoutMs: 60_000 });
    if (!(await cargo.isAvailable())) return;

    const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'rust-forge-move-')));
    const write = async (file: string, text: string) => {
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, text, 'utf8');
    };
    try {
      await write(
        path.join(root, 'Cargo.toml'),
        '[workspace]\nmembers = ["crates/app", "crates/lib"]\nresolver = "2"\n',
      );
      await write(
        path.join(root, 'crates', 'app', 'Cargo.toml'),
        [
          '[package]',
          'name = "app"',
          'version = "0.1.0"',
          'edition = "2021"',
          '',
          '[dependencies]',
          'lib = { path = "../lib" }',
          '',
          "[target.'cfg(unix)'.dependencies]",
          'lib = { path = "../lib" }',
          '',
        ].join('\n'),
      );
      await write(path.join(root, 'crates', 'app', 'src', 'main.rs'), 'fn main() {}\n');
      await write(
        path.join(root, 'crates', 'lib', 'Cargo.toml'),
        '[package]\nname = "lib"\nversion = "0.1.0"\nedition = "2021"\n',
      );
      await write(path.join(root, 'crates', 'lib', 'src', 'lib.rs'), '');

      const built = await buildModel(root);
      assert.ok(built.model, built.error ?? 'model discovery failed');
      const model = built.model!;
      const memberTexts: Record<string, string> = {};
      for (const entry of model.members) {
        memberTexts[entry.name] = await fs.readFile(entry.manifestPath, 'utf8');
      }

      const plan = planMemberMove({
        model,
        member: 'lib',
        targetRelative: 'libs/lib',
        rootText: await fs.readFile(model.manifestPath, 'utf8'),
        memberTexts,
        destinationExists: false,
      });
      assert.deepEqual(plan.errors, []);

      await fs.mkdir(path.join(root, 'libs'), { recursive: true });
      await fs.rename(path.join(root, 'crates', 'lib'), path.join(root, 'libs', 'lib'));
      for (const [file, text] of Object.entries(plan.files)) {
        await write(file, text);
      }

      const result = await cargo.metadata(root, { noDeps: true });
      assert.ok(result.ok, result.error ?? 'cargo metadata failed');
      const lib = result.metadata!.packages.find((pkg) => pkg.name === 'lib');
      assert.ok(lib, 'moved crate is missing from metadata');
      assert.equal(path.resolve(lib!.manifest_path), path.resolve(root, 'libs', 'lib', 'Cargo.toml'));

      const appManifest = await fs.readFile(path.join(root, 'crates', 'app', 'Cargo.toml'), 'utf8');
      const app = parse(appManifest) as Record<string, any>;
      assert.equal(app.dependencies.lib.path, '../../libs/lib');
      assert.equal(app.target['cfg(unix)'].dependencies.lib.path, '../../libs/lib');
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  },
);
