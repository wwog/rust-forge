import assert from 'node:assert/strict';
import test from 'node:test';
import { parse } from 'smol-toml';
import { updateArgs } from '../core/cargo/cargo.js';
import {
  planInstall,
  resolveRequestedRequirement,
  workspaceReferenceValue,
  type InstallRequest,
} from '../core/deps/write.js';

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

test('cargo update specs use -p and --precise', () => {
  assert.deepEqual(updateArgs(['serde@1.0.200', 'anyhow']), [
    'update',
    '-p',
    'serde',
    '--precise',
    '1.0.200',
    'anyhow',
  ]);
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
