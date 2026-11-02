import assert from 'node:assert/strict';
import * as os from 'node:os';
import test from 'node:test';
import { run } from '../core/process.js';

/** A process that ignores SIGTERM, like a proxy whose child keeps the pipes. */
const IGNORE_TERM = 'process.on("SIGTERM", () => {}); setInterval(() => {}, 1000);';

test('captures output from a normal command', async () => {
  const result = await run(process.execPath, ['-e', 'console.log("hello")'], { cwd: os.tmpdir() });
  assert.equal(result.code, 0);
  assert.match(result.stdout, /hello/);
  assert.equal(result.timedOut, false);
  assert.equal(result.cancelled, false);
});

test('a timeout settles even when the process ignores SIGTERM', async () => {
  const started = Date.now();
  const result = await run(process.execPath, ['-e', IGNORE_TERM], { cwd: os.tmpdir(), timeoutMs: 300 });
  assert.equal(result.timedOut, true);
  assert.equal(result.code, 124);
  assert.ok(Date.now() - started < 5_000, 'run() must not wait for the process to report close');
});

test('cancellation escalates and settles', async () => {
  const token = { isCancellationRequested: false };
  setTimeout(() => {
    token.isCancellationRequested = true;
  }, 100);

  const started = Date.now();
  const result = await run(process.execPath, ['-e', IGNORE_TERM], { cwd: os.tmpdir(), token });
  assert.equal(result.cancelled, true);
  assert.equal(result.code, 130);
  assert.ok(Date.now() - started < 8_000, 'cancellation must not hang on an unresponsive child');
});
