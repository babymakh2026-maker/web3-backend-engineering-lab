import { Router } from 'express';

import type { WethSnapshotService } from '../services/wethSnapshot.js';

export function createWethSnapshotRouter(service: WethSnapshotService) {
  const router = Router();

  router.get('/', async (_request, response) => {
    try {
      const snapshot = await service.getSnapshot();
      response.status(200).json({ data: snapshot });
    } catch {
      response.status(502).json({
        error: {
          code: 'ETHEREUM_READ_FAILED',
          message: 'Unable to read the configured Ethereum contract.'
        }
      });
    }
  });

  return router;
}
