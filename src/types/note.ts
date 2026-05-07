export type NoteInput = {
  title: string;
  content: string;
  image_path?: string | null;
  category?: string | null;
  tags?: string[];
};

export type Note = {
  id: number;
  title: string;
  content: string;
  image_path: string | null;
  category: string | null;
  tags: string;
  created_at: string;
};

export type NoteViewModel = Omit<Note, "tags"> & {
  tags: string[];
};

export type KnowledgeAnalysis = {
  suggested_title: string;
  category: string;
  summary: string;
};

export type KnowledgeMetadata = {
  title: string;
  summary: string;
  category: string;
  tags: string[];
};

