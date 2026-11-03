import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import test from 'node:test';
import { ToolchainService } from '../core/toolchain.js';

// Only pure file reading is exercised here: no rustup/rustc on the host needed.
const service = new ToolchainService();

async function tempDir(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), 'rust-forge-toolchain-'));
}

test('a parent rust-toolchain.toml applies to a nested directory', async () => {
  const dir = await tempDir();
  try {
    const toml = path.join(dir, 'rust-toolchain.toml');
    await writeFile(toml, '[toolchain]\nchannel = "1.80.0"\n', 'utf8');
    const nested = path.join(dir, 'crates', 'member');
    await mkdir(nested, { recursive: true });

    const spec = await service.readToolchainFile(nested);

    assert.ok(spec);
    assert.equal(spec.path, toml);
    assert.equal(spec.channel, '1.80.0');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('rust-toolchain.toml wins over the legacy file in the same directory', async () => {
  const dir = await tempDir();
  try {
    const toml = path.join(dir, 'rust-toolchain.toml');
    await writeFile(toml, '[toolchain]\nchannel = "1.81.0"\n', 'utf8');
    await writeFile(path.join(dir, 'rust-toolchain'), '1.70.0\n', 'utf8');

    const spec = await service.readToolchainFile(dir);

    assert.ok(spec);
    assert.equal(spec.path, toml);
    assert.equal(spec.channel, '1.81.0');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('a legacy rust-toolchain file with TOML content is parsed', async () => {
  const dir = await tempDir();
  try {
    const legacy = path.join(dir, 'rust-toolchain');
    await writeFile(legacy, '[toolchain]\nchannel = "1.75.0"\ncomponents = ["rustfmt"]\n', 'utf8');

    const spec = await service.readToolchainFile(dir);

    assert.ok(spec);
    assert.equal(spec.path, legacy);
    assert.equal(spec.channel, '1.75.0');
    assert.deepEqual(spec.components, ['rustfmt']);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('a legacy rust-toolchain file with a bare channel uses the first line', async () => {
  const dir = await tempDir();
  try {
    const legacy = path.join(dir, 'rust-toolchain');
    await writeFile(legacy, '1.70.0\n', 'utf8');

    const spec = await service.readToolchainFile(dir);

    assert.ok(spec);
    assert.equal(spec.path, legacy);
    assert.equal(spec.channel, '1.70.0');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('a nested override takes precedence over the parent override', async () => {
  const dir = await tempDir();
  try {
    await writeFile(path.join(dir, 'rust-toolchain.toml'), '[toolchain]\nchannel = "1.70.0"\n', 'utf8');
    const child = path.join(dir, 'crates', 'member');
    await mkdir(child, { recursive: true });
    const childFile = path.join(child, 'rust-toolchain');
    await writeFile(childFile, '1.75.0\n', 'utf8');

    const spec = await service.readToolchainFile(child);

    assert.ok(spec);
    assert.equal(spec.path, childFile);
    assert.equal(spec.channel, '1.75.0');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('blank and comment lines are skipped in a legacy file', async () => {
  const dir = await tempDir();
  try {
    await writeFile(path.join(dir, 'rust-toolchain'), '# pinned for CI\n\nnightly-2024-01-01\n', 'utf8');

    const spec = await service.readToolchainFile(dir);

    assert.ok(spec);
    assert.equal(spec.channel, 'nightly-2024-01-01');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('a legacy TOML file with a custom path is not misread as a channel', async () => {
  const dir = await tempDir();
  try {
    await writeFile(path.join(dir, 'rust-toolchain'), 'path = "/opt/custom-rust"\n', 'utf8');

    const spec = await service.readToolchainFile(dir);

    assert.ok(spec);
    assert.equal(spec.channel, undefined);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
