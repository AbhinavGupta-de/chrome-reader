export interface VocabContext {
  bookHash: string;
  bookTitle: string;
  chapterIndex: number;
  sentence: string;
  savedAt: number;
}

export interface VocabDefinition {
  partOfSpeech: string;
  definition: string;
  example?: string;
}

export type LeitnerStage = 0 | 1 | 2 | 3 | 4 | 5;
export type LeitnerRating = "again" | "hard" | "good" | "easy";

export interface LeitnerState {
  stage: LeitnerStage;
  mastered: boolean;
  nextReviewAt: number;
  lastReviewAt?: number;
  correctStreak: number;
}

export interface VocabWord extends LeitnerState {
  id: string;
  word: string;
  phonetic?: string;
  audioUrl?: string;
  definitions: VocabDefinition[];
  contexts: VocabContext[];
  createdAt: number;
  updatedAt: number;
  syncedAt?: number;
  deleted?: boolean;
}
