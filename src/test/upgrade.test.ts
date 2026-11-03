/**
 * Upgrade Planner 2.0: planning split (manifest vs lock-only), format
 * preservation, and the informational feature/MSRV helpers.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { parse as parseToml } from 'smol-toml';
import { parseDependencies } from '../core/cargo/manifestDeps.js';
import { planUpgrades } from '../core/deps/write.js';
import {
  changeModeFor,
  compareTargetMsrv,
  diffCrateFeatures,
} from '../core/deps/upgradePlan.js';
import { classifyUpgrade } from '../core/deps/versions.js';

const manifestPath = '/tmp/upgrade/Cargo.toml';

function declarationFor(text: string, file = manifestPath) {
  const declaration = parseDependencies(text, file)[0];
  assert.ok(declaration, `no declaration parsed from:\n${text}`);
  return declaration;
}

test('a target already inside the requirement plans a lock-only precise refresh', () => {
  const text = '[dependencies]\nserde = "^1"\n';
  const declaration = declarationFor(text);
  const plan = planUpgrades(
    [{ manifestPath, declaration, newRequirement: '^1', targetVersion: '1.0.220', lockOnly: true }],
    new Map([[manifestPath, text]]),
  );

  assert.equal(plan.files.size, 0);
  assert.deepEqual(plan.manifestUpdates, []);
  assert.deepEqual(plan.lockOnly, [{ name: 'serde', targetVersion: '1.0.220' }]);
  assert.deepEqual(plan.updateSpecs, ['serde@1.0.220']);
});

test('a rewritten requirement plans a manifest file and a package refresh', () => {
  const text = '[dependencies]\nserde = "^1.0.100"\n';
  const declaration = declarationFor(text);
  const plan = planUpgrades(
    [{ manifestPath, declaration, newRequirement: '^1.0.220', targetVersion: '1.0.220' }],
    new Map([[manifestPath, text]]),
  );

  assert.match(plan.files.get(manifestPath) ?? '', /serde = "\^1\.0\.220"/);
  assert.deepEqual(plan.manifestUpdates, [{ name: 'serde', targetVersion: '1.0.220' }]);
  assert.deepEqual(plan.lockOnly, []);
});

test('rewrites preserve comments, key order and CRLF, and never edit workspace stubs', () => {
  const rootPath = '/tmp/upgrade/ws/Cargo.toml';
  const memberPath = '/tmp/upgrade/ws/app/Cargo.toml';
  const rootText = [
    '# workspace manifest',
    '[workspace]',
    'members = ["app"]',
    '',
    '[workspace.dependencies]',
    '# pinned intentionally',
    'serde = "1.0.100"   # trailing comment',
    'anyhow = "1"  # stays second',
    '',
  ].join('\r\n');
  const memberText = '[dependencies]\r\nserde = { workspace = true } # inherited\r\n';

  const rootDeclaration = {
    key: 'serde',
    packageName: 'serde',
    table: 'dependencies' as const,
    tablePath: 'workspace.dependencies',
    version: '1.0.100',
    kind: 'registry' as const,
    features: [],
    rawValue: '"1.0.100"',
    manifestPath: rootPath,
    line: 6,
  };
  const memberDeclaration = {
    key: 'serde',
    packageName: 'serde',
    table: 'dependencies' as const,
    version: undefined,
    kind: 'workspace' as const,
    features: [],
    rawValue: '{ workspace = true }',
    manifestPath: memberPath,
    line: 1,
  };

  const plan = planUpgrades(
    [
      // The workspace root node and the member node both resolve to the same
      // root table entry; it must be applied once.
      {
        manifestPath: rootPath,
        declaration: rootDeclaration,
        newRequirement: '^1.0.220',
        targetVersion: '1.0.220',
        workspaceDependency: true,
      },
      {
        manifestPath: memberPath,
        declaration: memberDeclaration,
        newRequirement: '^1.0.220',
        targetVersion: '1.0.220',
      },
      {
        manifestPath: rootPath,
        declaration: { ...rootDeclaration },
        newRequirement: '^1.0.220',
        targetVersion: '1.0.220',
        workspaceDependency: true,
      },
    ],
    new Map([
      [rootPath, rootText],
      [memberPath, memberText],
    ]),
  );

  assert.equal(plan.files.has(memberPath), false, 'workspace = true stubs are never edited');
  const updated = plan.files.get(rootPath);
  assert.ok(updated);
  assert.ok(updated.includes('# workspace manifest'));
  assert.ok(updated.includes('# pinned intentionally'));
  assert.ok(updated.includes('serde = "^1.0.220"   # trailing comment'));
  assert.ok(updated.includes('# stays second'));
  assert.ok(updated.indexOf('serde') < updated.indexOf('anyhow'), 'key order must survive');
  assert.ok(!/(^|[^\r])\n/.test(updated), 'line endings must stay CRLF');
  assert.doesNotThrow(() => parseToml(updated));
  assert.deepEqual(plan.manifestUpdates, [{ name: 'serde', targetVersion: '1.0.220' }]);
  assert.deepEqual(plan.lockOnly, [], 'the manifest refresh subsumes the stub lock spec');
});

test('feature diffs are informational and order-insensitive', () => {
  const change = diffCrateFeatures(
    { features: { default: ['std', 'alloc'], derive: [], alloc: [] } },
    { features: { default: ['alloc', 'std'], derive: [], alloc: [], serde: [] } },
  );
  assert.deepEqual(change, { added: ['serde'], removed: [], defaultChanged: false });

  const defaultChanged = diffCrateFeatures(
    { features: { default: ['std'] } },
    { features: { default: ['std', 'extra'] } },
  );
  assert.equal(defaultChanged?.defaultChanged, true);

  assert.equal(diffCrateFeatures(undefined, { features: {} }), undefined);
  assert.equal(diffCrateFeatures({ features: {} }, undefined), undefined);
});

test('MSRV comparison only violates when both versions parse and the target is newer', () => {
  assert.deepEqual(compareTargetMsrv('1.80', '1.75.0'), { violated: true, unknown: false });
  assert.deepEqual(compareTargetMsrv('1.75', '1.80.0'), { violated: false, unknown: false });
  assert.deepEqual(compareTargetMsrv('1.75', undefined), { violated: false, unknown: false });
  assert.deepEqual(compareTargetMsrv(undefined, '1.80.0'), { violated: false, unknown: true });
});

test('new crate features never reclassify a safe minor bump', () => {
  const before = { features: { default: ['std'], derive: [] } };
  const after = { features: { default: ['std'], derive: [], alloc: [] } };
  assert.deepEqual(diffCrateFeatures(before, after), {
    added: ['alloc'],
    removed: [],
    defaultChanged: false,
  });

  // The tree deliberately keeps passing `latestFeatures: undefined`, so a new
  // feature is display-only and the classification stays safe.
  const assessment = classifyUpgrade({
    declared: '1.2',
    locked: '1.2.0',
    latest: '1.3.0',
    currentFeatures: ['derive'],
    latestFeatures: undefined,
  });
  assert.equal(assessment.classification, 'safe');
});

test('a lock-only row at another target survives a manifest rewrite of the same package', () => {
  const rootPath = '/tmp/upgrade/ws/Cargo.toml';
  const memberPath = '/tmp/upgrade/ws/app/Cargo.toml';
  const rootText = '[workspace.dependencies]\nfoo = "1"\n';
  const memberText = '[dependencies]\nfoo = "1.2"\n';
  const rootDeclaration = {
    key: 'foo',
    packageName: 'foo',
    table: 'dependencies' as const,
    tablePath: 'workspace.dependencies',
    version: '1',
    kind: 'registry' as const,
    features: [],
    rawValue: '"1"',
    manifestPath: rootPath,
    line: 1,
  };
  const memberDeclaration = declarationFor(memberText, memberPath);

  const plan = planUpgrades(
    [
      {
        manifestPath: rootPath,
        declaration: rootDeclaration,
        newRequirement: '^2',
        targetVersion: '2.0.0',
        workspaceDependency: true,
      },
      {
        manifestPath: memberPath,
        declaration: memberDeclaration,
        newRequirement: '1.2',
        targetVersion: '1.5.0',
        lockOnly: true,
      },
    ],
    new Map([
      [rootPath, rootText],
      [memberPath, memberText],
    ]),
  );

  assert.deepEqual(plan.manifestUpdates, [{ name: 'foo', targetVersion: '2.0.0' }]);
  // The same package at a different target is a separate intent; only the
  // exact package@version duplicate is subsumed by the manifest refresh.
  assert.deepEqual(plan.lockOnly, [{ name: 'foo', targetVersion: '1.5.0' }]);
});

test('change mode distinguishes manifest rewrites from lockfile-only updates', () => {
  assert.equal(
    changeModeFor('^1', { classification: 'safe', lockOnly: true, newRequirement: '^1' }),
    'lock-only',
  );
  assert.equal(
    changeModeFor('^1.2', { classification: 'safe', lockOnly: false, newRequirement: '^1.5' }),
    'manifest',
  );
  assert.equal(
    changeModeFor('^1', { classification: 'not-applicable', lockOnly: false }),
    'none',
  );
});
