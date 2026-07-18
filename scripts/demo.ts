import type { Server } from 'node:http';

import { createApp } from '../src/app.js';

interface JsonResponse {
  data?: Record<string, unknown>;
  error?: Record<string, unknown>;
}

async function request(
  baseUrl: string,
  path: string,
  init?: RequestInit
) {
  const response = await fetch(`${baseUrl}${path}`, init);
  const body = (await response.json()) as JsonResponse;
  if (!response.ok) {
    throw new Error(
      `${init?.method ?? 'GET'} ${path} returned ${response.status}: ${JSON.stringify(body)}`
    );
  }
  return { status: response.status, body };
}

async function runDemo() {
  const server: Server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));

  try {
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Demo server did not expose a TCP port');
    }
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const health = await request(baseUrl, '/health');
    const weth = await request(baseUrl, '/api/v1/ethereum/weth-snapshot');
    const createdNote = await request(baseUrl, '/api/v1/notes', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: 'Portfolio demo',
        content: 'Deterministic REST workflow verified.'
      })
    });
    const notes = await request(baseUrl, '/api/v1/notes');
    const contractBefore = await request(
      baseUrl,
      '/api/v1/contracts/message-registry'
    );

    let contractWrite: JsonResponse | { skipped: string } = {
      skipped: 'Set both signer and write token environment variables to submit a transaction.'
    };
    if (
      process.env.PORTFOLIO_SIGNER_PRIVATE_KEY &&
      process.env.PORTFOLIO_WRITE_TOKEN
    ) {
      contractWrite = (
        await request(baseUrl, '/api/v1/contracts/message-registry', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-portfolio-write-token': process.env.PORTFOLIO_WRITE_TOKEN
          },
          body: JSON.stringify({
            message: 'Portfolio API write verified on Sepolia'
          })
        })
      ).body;
    }

    process.stdout.write(
      `${JSON.stringify(
        {
          health,
          weth,
          notes: { created: createdNote, list: notes },
          contract: { before: contractBefore, write: contractWrite }
        },
        null,
        2
      )}\n`
    );
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

try {
  await runDemo();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Demo failed: ${message}\n`);
  process.exitCode = 1;
}
