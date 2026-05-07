import * as SQLite from "expo-sqlite";
import type { Note, NoteInput, NoteViewModel } from "../types/note";

const DATABASE_NAME = "personal_knowledge.db";

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function getDatabase() {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DATABASE_NAME);
  }

  const db = await dbPromise;

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      image_path TEXT,
      category TEXT,
      tags TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  return db;
}

function toNoteViewModel(note: Note): NoteViewModel {
  let parsedTags: string[] = [];

  try {
    const value = JSON.parse(note.tags);
    parsedTags = Array.isArray(value) ? value.map(String) : [];
  } catch {
    parsedTags = [];
  }

  return {
    ...note,
    tags: parsedTags,
  };
}

export async function insertNote(note: NoteInput): Promise<number> {
  const db = await getDatabase();

  const result = await db.runAsync(
    `INSERT INTO notes (title, content, image_path, category, tags, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      note.title.trim(),
      note.content.trim(),
      note.image_path ?? null,
      note.category ?? null,
      JSON.stringify(note.tags ?? []),
      new Date().toISOString(),
    ],
  );

  return result.lastInsertRowId;
}

export async function getAllNotes(): Promise<NoteViewModel[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Note>(
    "SELECT * FROM notes ORDER BY created_at DESC",
  );

  return rows.map(toNoteViewModel);
}

export async function searchNotes(keyword: string): Promise<NoteViewModel[]> {
  const db = await getDatabase();
  const normalizedKeyword = keyword.trim();

  if (!normalizedKeyword) {
    return getAllNotes();
  }

  const likeKeyword = `%${normalizedKeyword}%`;
  const rows = await db.getAllAsync<Note>(
    `SELECT * FROM notes
     WHERE title LIKE ? OR content LIKE ?
     ORDER BY created_at DESC`,
    [likeKeyword, likeKeyword],
  );

  return rows.map(toNoteViewModel);
}

