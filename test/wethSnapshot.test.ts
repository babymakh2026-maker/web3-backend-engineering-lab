import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';
import type { Server } from 'node:http';

import { createApp } from '../src/app.js';
import {
  createWethSnapshotService,
  type WethSnapshotService
} from '../src/services/wethSnapshot.js';

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

async function startApi(service: WethSnapshotService) {
  const server = createApp({ wethSnapshotService: service }).listen(
    0,
    '127.0.0.1'
  );
  servers.push(server);
  await new Promise<void>((resolve) => server.once('listening', resolve));

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Test server did not expose a TCP port');
  }
  return `http://127.0.0.1:${address.port}`;
}

describe('fixed-block WETH snapshot', () => {
  test('serializes the four contract values deterministically', async () => {
    const calls: string[] = [];
    const values: Record<string, string | bigint> = {
      name: 'Wrapped Ether',
      symbol: 'WETH',
      decimals: 18n,
      totalSupply: 123_456_789n
    };
    const service = createWethSnapshotService({
      readFunction: async (functionName) => {
        calls.push(functionName);
        return values[functionName];
      }
    });

    const snapshot = await service.getSnapshot();

    assert.deepEqual(calls, ['name', 'symbol', 'decimals', 'totalSupply']);
    assert.equal(snapshot.contract.blockNumber, '20000000');
    assert.deepEqual(snapshot.values, {
      name: 'Wrapped Ether',
      symbol: 'WETH',
      decimals: 18,
      totalSupplyWei: '123456789'
    });
  });

  test('returns the snapshot through the HTTP API', async () => {
    const service = createWethSnapshotService({
      readFunction: async (functionName) =>
        ({
          name: 'Wrapped Ether',
          symbol: 'WETH',
          decimals: 18n,
          totalSupply: 123n
        })[functionName]
    });
    const baseUrl = await startApi(service);
    const response = await fetch(
      `${baseUrl}/api/v1/ethereum/weth-snapshot`
    );
    const body = (await response.json()) as {
      data: { contract: { blockNumber: string } };
    };

    assert.equal(response.status, 200);
    assert.equal(body.data.contract.blockNumber, '20000000');
  });

  test('maps provider failures to a controlled gateway error', async () => {
    const service = createWethSnapshotService({
      readFunction: async () => {
        throw new Error('provider unavailable');
      }
    });
    const baseUrl = await startApi(service);
    const response = await fetch(
      `${baseUrl}/api/v1/ethereum/weth-snapshot`
    );

    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), {
      error: {
        code: 'ETHEREUM_READ_FAILED',
        message: 'Unable to read the configured Ethereum contract.'
      }
    });
  });
});
