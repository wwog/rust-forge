import assert from 'node:assert/strict';
import test from 'node:test';
import type { CargoMetadata } from '../core/cargo/types.js';
import { parseCargoTreeDuplicates } from '../core/deps/duplicates.js';

function metadata(
  packages: { name: string; version: string; dependencies: { name: string; req: string }[] }[],
): CargoMetadata {
  return {
    packages: packages.map((pkg) => ({
      name: pkg.name,
      version: pkg.version,
      dependencies: pkg.dependencies.map((dependency) => ({
        name: dependency.name,
        req: dependency.req,
        kind: null,
        source: null,
        rename: null,
        optional: false,
        uses_default_features: true,
        features: [],
        target: null,
        registry: null,
      })),
    })),
  } as unknown as CargoMetadata;
}

const members = [
  { name: 'app', dir: '/ws/crates/app' },
  { name: 'cli', dir: '/ws/crates/cli' },
  { name: 'other', dir: '/ws/crates/other' },
];

test('parses duplicate versions and explains incompatible requirements', () => {
  const output = `0getrandom v0.1.16
1rand v0.7.3
2app v0.1.0 (/ws/crates/app)

0getrandom v0.2.17
1rand_core v0.6.4
2rand v0.8.8
3cli v0.1.0 (/ws/crates/cli)
`;
  const groups = parseCargoTreeDuplicates(output, {
    members,
    metadata: metadata([
      { name: 'rand', version: '0.7.3', dependencies: [{ name: 'getrandom', req: '^0.1.16' }] },
      { name: 'rand_core', version: '0.6.4', dependencies: [{ name: 'getrandom', req: '^0.2.17' }] },
    ]),
  });

  assert.equal(groups.length, 1);
  const group = groups[0];
  assert.equal(group.name, 'getrandom');
  assert.deepEqual(group.versions.map((version) => version.version), ['0.1.16', '0.2.17']);
  assert.equal(group.incompatible, true);
  assert.equal(group.reason, 'incompatible-requirements');

  const older = group.versions.find((version) => version.version === '0.1.16')!;
  assert.equal(older.sources.length, 1);
  assert.equal(older.sources[0].package, 'rand');
  assert.equal(older.sources[0].requirement, '^0.1.16');
  assert.equal(older.sources[0].member, 'app');
  assert.deepEqual(
    older.sources[0].chain.map((node) => node.name),
    ['getrandom', 'rand', 'app'],
  );
});

test('direct workspace dependents are marked and their requirements explain the split', () => {
  const output = `0anyhow v1.0.0
1app v0.1.0 (/ws/crates/app)

0anyhow v2.0.0
1other v0.1.0 (/ws/crates/other)
`;
  const groups = parseCargoTreeDuplicates(output, {
    members,
    metadata: metadata([
      { name: 'app', version: '0.1.0', dependencies: [{ name: 'anyhow', req: '^1' }] },
      { name: 'other', version: '0.1.0', dependencies: [{ name: 'anyhow', req: '^2' }] },
    ]),
  });

  assert.equal(groups.length, 1);
  assert.equal(groups[0].name, 'anyhow');
  assert.equal(groups[0].incompatible, true);
  assert.equal(groups[0].versions.every((version) => version.direct), true);
  assert.deepEqual(
    groups[0].requirements.map((requirement) => `${requirement.parent}:${requirement.requirement}`).sort(),
    ['app:^1', 'other:^2'],
  );
});

test('overlapping requirements are reported separately from hard conflicts', () => {
  const output = `0foo v1.0.0
1app v0.1.0 (/ws/crates/app)

0foo v1.1.0
1cli v0.1.0 (/ws/crates/cli)
`;
  const groups = parseCargoTreeDuplicates(output, {
    members,
    metadata: metadata([
      { name: 'app', version: '0.1.0', dependencies: [{ name: 'foo', req: '^1.0' }] },
      { name: 'cli', version: '0.1.0', dependencies: [{ name: 'foo', req: '>=1.0, <2' }] },
    ]),
  });
  assert.equal(groups[0].incompatible, false);
  assert.equal(groups[0].reason, 'overlapping-requirements');
});

test('missing metadata leaves duplicate groups usable but unexplained', () => {
  const output = `0foo v1.0.0
1app v0.1.0 (/ws/crates/app)

0foo v1.1.0
1cli v0.1.0 (/ws/crates/cli)
`;
  const groups = parseCargoTreeDuplicates(output, { members });
  assert.equal(groups.length, 1);
  assert.equal(groups[0].incompatible, false);
  assert.equal(groups[0].reason, 'unknown-requirements');
  assert.equal(groups[0].requirements.length, 0);
});

test('deduplicated markers are stripped and single-version blocks are ignored', () => {
  const output = `0foo v1.0.0
1app v0.1.0 (/ws/crates/app)

0foo v1.0.0 (*)
`;
  const groups = parseCargoTreeDuplicates(output, { members });
  assert.deepEqual(groups, []);
});

test('a parent with normal and build requirements selects the matching version', () => {
  const output = `0rand v0.7.3
1app v0.1.0 (/ws/crates/app)

0rand v0.8.8
1app v0.1.0 (/ws/crates/app)
`;
  const groups = parseCargoTreeDuplicates(output, {
    members,
    metadata: metadata([
      {
        name: 'app',
        version: '0.1.0',
        dependencies: [
          { name: 'rand', req: '^0.8' },
          { name: 'rand', req: '^0.7' },
        ],
      },
    ]),
  });
  const requirements = new Map(groups[0].requirements.map((entry) => [entry.version, entry.requirement]));
  assert.equal(requirements.get('0.7.3'), '^0.7');
  assert.equal(requirements.get('0.8.8'), '^0.8');
});

test('multiple member paths through the same dependent are kept as separate sources', () => {
  const output = `0foo v1.0.0
1mid v0.5.0
2app v0.1.0 (/ws/crates/app)

0foo v2.0.0
1mid v0.6.0
2app v0.1.0 (/ws/crates/app)
3cli v0.1.0 (/ws/crates/cli)
`;
  const groups = parseCargoTreeDuplicates(output, { members });
  const older = groups[0].versions.find((version) => version.version === '1.0.0')!;
  const newer = groups[0].versions.find((version) => version.version === '2.0.0')!;
  assert.equal(older.sources[0].member, 'app');
  assert.equal(newer.sources.some((source) => source.member === 'cli'), true);
});
