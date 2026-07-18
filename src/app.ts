import express, { type ErrorRequestHandler } from 'express';

import { createMessageRegistryRouter } from './routes/messageRegistry.js';
import { createNotesRouter } from './routes/notes.js';
import { createWethSnapshotRouter } from './routes/wethSnapshot.js';
import {
  createMessageRegistryService,
  type MessageRegistryService
} from './services/messageRegistry.js';
import {
  createWethSnapshotService,
  type WethSnapshotService
} from './services/wethSnapshot.js';
import {
  createNotesStore,
  type NotesStore
} from './stores/notesStore.js';

export interface AppOptions {
  messageRegistryService?: MessageRegistryService;
  notesStore?: NotesStore;
  portfolioWriteToken?: string;
  wethSnapshotService?: WethSnapshotService;
}

export function createApp(options: AppOptions = {}) {
  const app = express();
  const ethereumRpcUrl = process.env.ETHEREUM_RPC_URL;
  const wethSnapshotService =
    options.wethSnapshotService ??
    createWethSnapshotService(
      ethereumRpcUrl === undefined ? {} : { rpcUrl: ethereumRpcUrl }
    );
  const messageRegistryService =
    options.messageRegistryService ??
    createMessageRegistryService({
      ...(process.env.SEPOLIA_RPC_URL === undefined
        ? {}
        : { rpcUrl: process.env.SEPOLIA_RPC_URL }),
      ...(process.env.PORTFOLIO_SIGNER_PRIVATE_KEY === undefined
        ? {}
        : { privateKey: process.env.PORTFOLIO_SIGNER_PRIVATE_KEY })
    });
  const portfolioWriteToken =
    options.portfolioWriteToken ?? process.env.PORTFOLIO_WRITE_TOKEN;

  app.disable('x-powered-by');
  app.use(express.json({ limit: '16kb' }));

  app.get('/health', (_request, response) => {
    response.status(200).json({ status: 'ok' });
  });

  app.use(
    '/api/v1/ethereum/weth-snapshot',
    createWethSnapshotRouter(wethSnapshotService)
  );
  app.use(
    '/api/v1/contracts/message-registry',
    createMessageRegistryRouter({
      service: messageRegistryService,
      ...(portfolioWriteToken === undefined
        ? {}
        : { writeToken: portfolioWriteToken })
    })
  );
  app.use('/api/v1/notes', createNotesRouter(options.notesStore ?? createNotesStore()));

  app.use((_request, response) => {
    response.status(404).json({
      error: {
        code: 'ROUTE_NOT_FOUND',
        message: 'The requested route does not exist.'
      }
    });
  });

  const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
    if (error instanceof SyntaxError && 'body' in error) {
      response.status(400).json({
        error: {
          code: 'INVALID_JSON',
          message: 'Request body must contain valid JSON.'
        }
      });
      return;
    }

    response.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred.'
      }
    });
  };
  app.use(errorHandler);

  return app;
}
