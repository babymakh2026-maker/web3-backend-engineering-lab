import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';
import type { Server } from 'node:http';
import type { Address, Hash } from 'viem';

import { createApp } from '../src/app.js';
import {
  createMessageRegistryService,
  type MessageRegistryAdapter,
  type MessageRegistryService
} from '../src/services/messageRegistry.js';

const contractAddress = '0x0000000000000000000000000000000000000001';
const ownerAddress = '0x0000000000000000000000000000000000000002';
const transactionHash = `0x${'ab'.repeat(32)}` as Hash;
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

function createAdapter() {
  let message = 'Initial message';
  const calls: string[] = [];
  const adapter: MessageRegistryAdapter = {
    async readMessage(address: Address) {
      calls.push(`read:${address}`);
      return message;
    },
    async readOwner() {
      return ownerAddress;
    },
    async submitMessage(_address, nextMessage) {
      calls.push(`write:${nextMessage}`);
      message = nextMessage;
      return transactionHash;
    },
    async waitForReceipt(hash) {
      calls.push(`receipt:${hash}`);
      return { status: 'success', blockNumber: 12345n, gasUsed: 45678n };
    }
  };
  return { adapter, calls };
}

async function startApi(service: MessageRegistryService, writeToken?: string) {
  const server = createApp({
    messageRegistryService: service,
    ...(writeToken === undefined ? {} : { portfolioWriteToken: writeToken })
  }).listen(0, '127.0.0.1');
  servers.push(server);
  await new Promise<void>((resolve) => server.once('listening', resolve));

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Test server did not expose a TCP port');
  }
  return `http://127.0.0.1:${address.port}`;
}

describe('MessageRegistry integration', () => {
  test('reads, submits, confirms, and re-reads contract state', async () => {
    const { adapter, calls } = createAdapter();
    const service = createMessageRegistryService({
      address: contractAddress,
      adapter
    });

    const before = await service.readState();
    const transaction = await service.writeMessage('Updated message');

    assert.equal(before.values.message, 'Initial message');
    assert.equal(transaction.state.values.message, 'Updated message');
    assert.deepEqual(calls, [
      `read:${contractAddress}`,
      `write:Updated message`,
      `receipt:${transactionHash}`,
      `read:${contractAddress}`
    ]);
  });

  test('exposes public reads through the API', async () => {
    const { adapter } = createAdapter();
    const service = createMessageRegistryService({
      address: contractAddress,
      adapter
    });
    const baseUrl = await startApi(service);
    const response = await fetch(
      `${baseUrl}/api/v1/contracts/message-registry`
    );
    const body = (await response.json()) as {
      data: { values: { message: string } };
    };

    assert.equal(response.status, 200);
    assert.equal(body.data.values.message, 'Initial message');
  });

  test('protects writes and returns confirmed transaction evidence', async () => {
    const { adapter } = createAdapter();
    const service = createMessageRegistryService({
      address: contractAddress,
      adapter
    });
    const baseUrl = await startApi(service, 'a'.repeat(32));
    const path = `${baseUrl}/api/v1/contracts/message-registry`;

    const unauthorized = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'Updated message' })
    });
    assert.equal(unauthorized.status, 401);

    const invalid = await fetch(path, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-portfolio-write-token': 'a'.repeat(32)
      },
      body: JSON.stringify({ message: ' ', unexpected: true })
    });
    assert.equal(invalid.status, 400);

    const response = await fetch(path, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-portfolio-write-token': 'a'.repeat(32)
      },
      body: JSON.stringify({ message: ' Updated message ' })
    });
    const body = (await response.json()) as {
      data: { status: string; message: string; state: { values: { message: string } } };
    };

    assert.equal(response.status, 200);
    assert.equal(body.data.status, 'success');
    assert.equal(body.data.message, 'Updated message');
    assert.equal(body.data.state.values.message, 'Updated message');
  });
});
