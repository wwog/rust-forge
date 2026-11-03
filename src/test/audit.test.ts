import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import test from 'node:test';
import { AuditService, lockFingerprint } from '../core/audit.js';
import { readLockfile } from '../core/cargo/lockfile.js';
import type { LockfileInfo, LockedPackage } from '../core/cargo/lockfile.js';

function lockOf(packages: LockedPackage[]): LockfileInfo {
  return { path: 'Cargo.lock', version: 3, packages, versions: new Map() };
}

const SERDE: LockedPackage = {
  name: 'serde',
  version: '1.0.203',
  source: 'registry+https://github.com/rust-lang/crates.io-index',
};
const ANYHOW: LockedPackage = {
  name: 'anyhow',
  version: '1.0.86',
  source: 'registry+https://github.com/rust-lang/crates.io-index',
};

test('the fingerprint is stable for the same lockfile contents', () => {
  const first = lockFingerprint(lockOf([SERDE, ANYHOW]));
  const second = lockFingerprint(lockOf([{ ...SERDE }, { ...ANYHOW }]));
  assert.equal(first, second);
  assert.match(first, /^[0-9a-f]{16}$/);
});

test('a version change changes the fingerprint', () => {
  const before = lockFingerprint(lockOf([SERDE, ANYHOW]));
  const after = lockFingerprint(lockOf([{ ...SERDE, version: '1.0.204' }, ANYHOW]));
  assert.notEqual(before, after);
});

test('a source change changes the fingerprint', () => {
  const before = lockFingerprint(lockOf([SERDE, ANYHOW]));
  const after = lockFingerprint(lockOf([{ ...SERDE, source: 'git+https://example.com/serde' }, ANYHOW]));
  assert.notEqual(before, after);
});

test('package order does not affect the fingerprint', () => {
  const forward = lockFingerprint(lockOf([SERDE, ANYHOW]));
  const reversed = lockFingerprint(lockOf([ANYHOW, SERDE]));
  assert.equal(forward, reversed);
});

test('force bypasses a warm audit cache', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'rust-forge-audit-'));
  const cacheDir = path.join(root, '.audit-cache');
  try {
    await fs.writeFile(
      path.join(root, 'Cargo.lock'),
      `version = 3

[[package]]
name = "serde"
version = "1.0.203"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "abc"
`,
    );
    const lock = await readLockfile(root);
    assert.ok(lock);

    const key = Buffer.from(root).toString('base64url').slice(0, 40);
    const cacheFile = path.join(cacheDir, `${key}-${lockFingerprint(lock!)}.json`);
    await fs.mkdir(cacheDir, { recursive: true });
    await fs.writeFile(
      cacheFile,
      JSON.stringify({
        fetchedAt: Date.now(),
        advisories: [{ id: 'RUSTSEC-0000-0000', title: 'demo', packageName: 'serde', severity: 'low' }],
      }),
    );

    const audit = new AuditService({ offline: true, cacheDir });
    const cached = await audit.run(root, false);
    assert.equal(cached.source, 'cache');
    assert.equal(cached.advisories.length, 1);

    const forced = await audit.run(root, false, { force: true });
    assert.equal(forced.source, 'unavailable');
    assert.equal(forced.error, 'offline');
    assert.equal(forced.advisories.length, 0);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
