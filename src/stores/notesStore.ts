export interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface NoteInput {
  title: string;
  content: string;
}

export function createNotesStore(options: { now?: () => Date } = {}) {
  const notes = new Map<string, Note>();
  const now = options.now ?? (() => new Date());
  let nextId = 1;

  return {
    list() {
      return [...notes.values()];
    },
    find(id: string) {
      return notes.get(id);
    },
    create(input: NoteInput) {
      const timestamp = now().toISOString();
      const note: Note = {
        id: `note-${String(nextId).padStart(6, '0')}`,
        ...input,
        createdAt: timestamp,
        updatedAt: timestamp
      };
      nextId += 1;
      notes.set(note.id, note);
      return note;
    },
    replace(id: string, input: NoteInput) {
      const current = notes.get(id);
      if (!current) return undefined;

      const note: Note = {
        ...current,
        ...input,
        updatedAt: now().toISOString()
      };
      notes.set(id, note);
      return note;
    },
    remove(id: string) {
      return notes.delete(id);
    }
  };
}

export type NotesStore = ReturnType<typeof createNotesStore>;
