import { Router } from 'express';
import { z } from 'zod';

import type { NotesStore } from '../stores/notesStore.js';

const noteSchema = z.strictObject({
  title: z
    .string()
    .trim()
    .min(1, 'title must not be empty')
    .max(120, 'title must not exceed 120 characters'),
  content: z
    .string()
    .trim()
    .max(4_000, 'content must not exceed 4000 characters')
});

function sendNotFound(response: Parameters<Parameters<Router['get']>[1]>[1]) {
  response.status(404).json({
    error: {
      code: 'NOTE_NOT_FOUND',
      message: 'The requested note does not exist.'
    }
  });
}

export function createNotesRouter(store: NotesStore) {
  const router = Router();

  router.get('/', (_request, response) => {
    response.status(200).json({ data: store.list() });
  });

  router.post('/', (request, response) => {
    const parsed = noteSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'The note payload is invalid.',
          details: parsed.error.issues.map(({ message }) => message)
        }
      });
      return;
    }

    response.status(201).json({ data: store.create(parsed.data) });
  });

  router.get('/:id', (request, response) => {
    const note = store.find(request.params.id);
    if (!note) {
      sendNotFound(response);
      return;
    }
    response.status(200).json({ data: note });
  });

  router.put('/:id', (request, response) => {
    const parsed = noteSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'The note payload is invalid.',
          details: parsed.error.issues.map(({ message }) => message)
        }
      });
      return;
    }

    const note = store.replace(request.params.id, parsed.data);
    if (!note) {
      sendNotFound(response);
      return;
    }
    response.status(200).json({ data: note });
  });

  router.delete('/:id', (request, response) => {
    if (!store.remove(request.params.id)) {
      sendNotFound(response);
      return;
    }
    response.status(204).send();
  });

  return router;
}
