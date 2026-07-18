import crypto from 'node:crypto';

import { Router } from 'express';
import { z } from 'zod';

import {
  WriteSignerUnavailableError,
  type MessageRegistryService
} from '../services/messageRegistry.js';

const messageSchema = z
  .strictObject({
    message: z
      .string()
      .trim()
      .min(1, 'message must not be empty')
      .max(280, 'message must not exceed 280 characters')
  });

function tokensMatch(actual: string | undefined, expected: string) {
  if (actual === undefined) return false;

  const actualHash = crypto.createHash('sha256').update(actual).digest();
  const expectedHash = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(actualHash, expectedHash);
}

export function createMessageRegistryRouter(options: {
  service: MessageRegistryService;
  writeToken?: string;
}) {
  const router = Router();

  router.get('/', async (_request, response) => {
    try {
      response.status(200).json({ data: await options.service.readState() });
    } catch {
      response.status(502).json({
        error: {
          code: 'SEPOLIA_READ_FAILED',
          message: 'Unable to read the MessageRegistry deployment.'
        }
      });
    }
  });

  router.post('/', async (request, response) => {
    if (options.writeToken === undefined) {
      response.status(503).json({
        error: {
          code: 'CONTRACT_WRITE_DISABLED',
          message: 'Contract writes are disabled on this server.'
        }
      });
      return;
    }
    if (
      !tokensMatch(
        request.header('x-portfolio-write-token'),
        options.writeToken
      )
    ) {
      response.status(401).json({
        error: {
          code: 'CONTRACT_WRITE_UNAUTHORIZED',
          message: 'A valid portfolio write token is required.'
        }
      });
      return;
    }

    const parsed = messageSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'The message payload is invalid.',
          details: parsed.error.issues.map(({ message }) => message)
        }
      });
      return;
    }

    try {
      const transaction = await options.service.writeMessage(
        parsed.data.message
      );
      response.status(200).json({ data: transaction });
    } catch (error) {
      if (error instanceof WriteSignerUnavailableError) {
        response.status(503).json({
          error: {
            code: 'CONTRACT_SIGNER_UNAVAILABLE',
            message: 'The Sepolia write signer is not configured.'
          }
        });
        return;
      }

      response.status(502).json({
        error: {
          code: 'SEPOLIA_WRITE_FAILED',
          message: 'Unable to update the MessageRegistry deployment.'
        }
      });
    }
  });

  return router;
}
