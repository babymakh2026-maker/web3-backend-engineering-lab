import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';
import type { Server } from 'node:http';

import { createApp } from '../src/app.js';

const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        })
    )
  );
});

async function startApi() {
  const server = createApp().listen(0, '127.0.0.1');
  servers.push(server);
  await new Promise<void>((resolve) => server.once('listening', resolve));

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Test server did not expose a TCP port');
  }
  return `http://127.0.0.1:${address.port}`;
}

describe('service foundation', () => {
  test('reports health without framework disclosure', async () => {
    const baseUrl = await startApi();
    const response = await fetch(`${baseUrl}/health`);

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-powered-by'), null);
    assert.deepEqual(await response.json(), { status: 'ok' });
  });

  test('returns a stable error for unknown routes', async () => {
    const baseUrl = await startApi();
    const response = await fetch(`${baseUrl}/missing`);

    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), {
      error: {
        code: 'ROUTE_NOT_FOUND',
        message: 'The requested route does not exist.'
      }
    });
  });
});
