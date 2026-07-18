import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';
import type { Server } from 'node:http';

import { createApp } from '../src/app.js';
import { createNotesStore } from '../src/stores/notesStore.js';

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
  let tick = 0;
  const notesStore = createNotesStore({
    now: () => new Date(Date.UTC(2026, 0, 1, 0, 0, tick++))
  });
  const server = createApp({ notesStore }).listen(0, '127.0.0.1');
  servers.push(server);
  await new Promise<void>((resolve) => server.once('listening', resolve));

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Test server did not expose a TCP port');
  }
  return `http://127.0.0.1:${address.port}/api/v1/notes`;
}

describe('notes REST API', () => {
  test('supports the complete create, list, read, replace, and delete flow', async () => {
    const path = await startApi();
    const createdResponse = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: ' First note ', content: ' Initial content ' })
    });
    const created = (await createdResponse.json()) as {
      data: { id: string; title: string; content: string; createdAt: string };
    };

    assert.equal(createdResponse.status, 201);
    assert.deepEqual(created.data, {
      id: 'note-000001',
      title: 'First note',
      content: 'Initial content',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    });

    const listResponse = await fetch(path);
    const list = (await listResponse.json()) as { data: unknown[] };
    assert.equal(listResponse.status, 200);
    assert.equal(list.data.length, 1);

    const readResponse = await fetch(`${path}/${created.data.id}`);
    assert.equal(readResponse.status, 200);

    const replacedResponse = await fetch(`${path}/${created.data.id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Replaced note', content: 'New content' })
    });
    const replaced = (await replacedResponse.json()) as {
      data: { title: string; updatedAt: string };
    };
    assert.equal(replacedResponse.status, 200);
    assert.equal(replaced.data.title, 'Replaced note');
    assert.equal(replaced.data.updatedAt, '2026-01-01T00:00:01.000Z');

    const deletedResponse = await fetch(`${path}/${created.data.id}`, {
      method: 'DELETE'
    });
    assert.equal(deletedResponse.status, 204);
    assert.equal(await deletedResponse.text(), '');

    const missingResponse = await fetch(`${path}/${created.data.id}`);
    assert.equal(missingResponse.status, 404);
  });

  test('rejects malformed, extra, and out-of-range payload data', async () => {
    const path = await startApi();
    const invalidPayload = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: ' ', content: '', extra: true })
    });
    const malformedJson = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{'
    });

    assert.equal(invalidPayload.status, 400);
    assert.equal(malformedJson.status, 400);
    assert.deepEqual(await malformedJson.json(), {
      error: {
        code: 'INVALID_JSON',
        message: 'Request body must contain valid JSON.'
      }
    });
  });

  test('returns stable not-found responses for update and delete', async () => {
    const path = await startApi();
    const replacement = await fetch(`${path}/note-999999`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Missing', content: '' })
    });
    const deletion = await fetch(`${path}/note-999999`, { method: 'DELETE' });

    assert.equal(replacement.status, 404);
    assert.equal(deletion.status, 404);
  });
});
