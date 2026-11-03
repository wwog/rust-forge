import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import test from 'node:test';
import {
  BUILTIN_MIRRORS,
  MIRROR_SOURCE_NAME,
  allCargoMirrors,
  customMirrorId,
  installMirrorArgs,
  mirrorConfigArgs,
  mirrorIndexError,
  normalizeMirrorIndex,
  resolveCargoMirror,
} from '../core/cargo/mirror.js';
import { CargoService } from '../core/cargo/cargo.js';

test('built-in mirrors carry the documented sparse indexes', () => {
  const byId = new Map(BUILTIN_MIRRORS.map((mirror) => [mirror.id, mirror]));
  assert.equal(byId.get('official')?.index, undefined);
  assert.equal(
    byId.get('tuna')?.index,
    'sparse+https://mirrors.tuna.tsinghua.edu.cn/crates.io-index/',
  );
  assert.equal(
    byId.get('aliyun')?.index,
    'sparse+https://mirrors.aliyun.com/crates.io-index/',
  );
  assert.equal(
    byId.get('ustc')?.index,
    'sparse+https://mirrors.ustc.edu.cn/crates.io-index/',
  );
  assert.equal(byId.get('rsproxy')?.index, 'sparse+https://rsproxy.cn/index/');
});

test('official selection adds no cargo arguments', () => {
  assert.deepEqual(mirrorConfigArgs(undefined), []);
  const service = new CargoService({ mirrorIndex: undefined });
  assert.deepEqual(service.mirrorArgs(), []);
});

test('a mirror becomes two global --config arguments', () => {
  const index = 'sparse+https://mirrors.tuna.tsinghua.edu.cn/crates.io-index/';
  assert.deepEqual(mirrorConfigArgs(index), [
    '--config',
    `source.crates-io.replace-with=${JSON.stringify(MIRROR_SOURCE_NAME)}`,
    '--config',
    `source.${MIRROR_SOURCE_NAME}.registry=${JSON.stringify(index)}`,
  ]);
  assert.deepEqual(new CargoService({ mirrorIndex: index }).mirrorArgs(), mirrorConfigArgs(index));
});

test('custom mirrors resolve by id and fall back to official', () => {
  const custom = [{ name: 'Company', index: 'sparse+https://mirror.example.com/index/' }];
  assert.equal(resolveCargoMirror('official', custom).id, 'official');
  assert.equal(resolveCargoMirror('aliyun', custom).id, 'aliyun');
  assert.equal(resolveCargoMirror(customMirrorId('Company'), custom).name, 'Company');
  assert.equal(resolveCargoMirror('Company', custom).name, 'Company');
  assert.equal(resolveCargoMirror('missing', custom).id, 'official');
  assert.deepEqual(
    allCargoMirrors(custom).map((mirror) => mirror.id).slice(-1),
    [customMirrorId('Company')],
  );
});

test('cargo install gets an explicit --index', () => {
  const index = 'sparse+https://mirrors.tuna.tsinghua.edu.cn/crates.io-index/';
  assert.deepEqual(installMirrorArgs(['install', 'cargo-audit'], index), [
    'install',
    '--index',
    index,
    'cargo-audit',
  ]);
  // Other subcommands rely on source replacement, not --index.
  assert.deepEqual(installMirrorArgs(['check'], index), ['check']);
  // --list / --path / --git do not contact a registry index.
  assert.deepEqual(installMirrorArgs(['install', '--list'], index), ['install', '--list']);
  assert.deepEqual(installMirrorArgs(['install', '--path', '.'], index), ['install', '--path', '.']);
  // Explicit user index is preserved.
  assert.deepEqual(installMirrorArgs(['install', '--index', 'https://x'], index), [
    'install',
    '--index',
    'https://x',
  ]);
  // Official adds nothing.
  assert.deepEqual(installMirrorArgs(['install', 'cargo-audit'], undefined), ['install', 'cargo-audit']);
});

test('sparse URLs are normalized and validated', () => {
  assert.equal(normalizeMirrorIndex(' sparse+https://x.test/index '), 'sparse+https://x.test/index/');
  assert.equal(normalizeMirrorIndex('https://x.test/index'), 'https://x.test/index');
  assert.equal(mirrorIndexError(''), 'empty');
  assert.equal(mirrorIndexError('ftp://x'), 'invalid');
  assert.equal(mirrorIndexError('sparse+https://x.test/index/'), undefined);
  assert.equal(mirrorIndexError('https://x.test/index'), undefined);
  assert.equal(mirrorIndexError('sparse+https://x.test/index?mirror=1'), undefined);
  assert.equal(mirrorIndexError('sparse+https://x.test/a"b'), 'invalid');
  assert.equal(normalizeMirrorIndex('sparse+https://x.test/index?mirror=1'), 'sparse+https://x.test/index?mirror=1');
});

test(
  'cargo accepts the generated mirror configuration',
  { skip: process.env.RF_SKIP_CARGO_TESTS === '1' },
  async () => {
    const service = new CargoService({
      mirrorIndex: 'sparse+https://mirrors.tuna.tsinghua.edu.cn/crates.io-index/',
      timeoutMs: 60_000,
    });
    if (!(await service.isAvailable())) return;

    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'rust-forge-mirror-'));
    try {
      await fs.writeFile(
        path.join(root, 'Cargo.toml'),
        '[package]\nname = "mirror-check"\nversion = "0.1.0"\nedition = "2021"\n',
      );
      await fs.mkdir(path.join(root, 'src'));
      await fs.writeFile(path.join(root, 'src', 'lib.rs'), '');

      const result = await service.metadata(root, { noDeps: true });
      assert.ok(result.ok, result.error ?? 'cargo metadata failed');
      assert.match(result.result.command, /--config/);
      assert.match(result.result.command, /crates-io\.replace-with/);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  },
);
