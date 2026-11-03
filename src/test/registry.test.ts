import assert from 'node:assert/strict';
import test from 'node:test';
import { RegistryClient } from '../core/deps/registry.js';

const originalFetch = globalThis.fetch;
const globalFetch = globalThis as unknown as { fetch: typeof fetch };

async function withFetch(impl: typeof fetch, fn: () => Promise<void>): Promise<void> {
  globalFetch.fetch = impl;
  try {
    await fn();
  } finally {
    globalFetch.fetch = originalFetch;
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

test('a fresh client is not degraded', () => {
  const client = new RegistryClient();
  assert.equal(client.degraded, false);
  assert.equal(client.networkError, undefined);
});

test('a network failure degrades the client and a later success clears it', async () => {
  const client = new RegistryClient();

  await withFetch(
    async () => {
      throw new Error('network down');
    },
    async () => {
      assert.equal(await client.crate('demo'), undefined);
      assert.equal(client.degraded, true);
      assert.ok(client.networkError);
      assert.match(client.networkError ?? '', /network down/);
    },
  );

  await withFetch(
    async () =>
      jsonResponse({
        crate: { name: 'demo-ok', max_version: '1.0.0', max_stable_version: '1.0.0' },
        versions: [],
      }),
    async () => {
      const detail = await client.crate('demo-ok');
      assert.equal(detail?.name, 'demo-ok');
      assert.equal(client.degraded, false);
      assert.equal(client.networkError, undefined);
    },
  );
});

test('404 means the network is reachable and does not degrade the client', async () => {
  const client = new RegistryClient();

  await withFetch(
    async () => new Response('', { status: 404 }),
    async () => {
      assert.equal(await client.crate('missing-crate'), undefined);
      assert.equal(client.degraded, false);
      assert.equal(client.networkError, undefined);
    },
  );
});

test('a non-404 HTTP error degrades the client', async () => {
  const client = new RegistryClient();

  await withFetch(
    async () => new Response('', { status: 500 }),
    async () => {
      assert.equal(await client.crate('broken-crate'), undefined);
      assert.equal(client.degraded, true);
      assert.equal(client.networkError, 'HTTP 500');
    },
  );
});

test('an offline client is always degraded', () => {
  const client = new RegistryClient({ offline: true });
  assert.equal(client.degraded, true);
});
