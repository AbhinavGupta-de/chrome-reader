import { listAllUnsynced, markSynced, upsertVocab, listVocab, getVocab, deleteVocab as localDelete } from "./storage";
import { VocabWord, VocabContext, VocabDefinition, LeitnerStage } from "./types";
import {
  listRemoteVocab,
  putRemoteVocab,
  deleteRemoteVocab,
  isAuthenticated,
  isOnline,
} from "../api";

export async function pushPendingVocab(): Promise<void> {
  if (!isAuthenticated() || !isOnline()) return;
  const pending = await listAllUnsynced();
  for (const w of pending) {
    try {
      if (w.deleted) {
        await deleteRemoteVocab(w.id);
      } else {
        await putRemoteVocab(w.id, {
          word: w.word,
          phonetic: w.phonetic ?? null,
          audioUrl: w.audioUrl ?? null,
          definitions: w.definitions,
          contexts: w.contexts,
          stage: w.stage,
          mastered: w.mastered,
          nextReviewAt: w.nextReviewAt,
          lastReviewAt: w.lastReviewAt ?? null,
          correctStreak: w.correctStreak,
        });
      }
      await markSynced(w.id, Date.now());
    } catch (e) {
      console.warn("vocab sync push failed", w.id, e);
    }
  }
}

export async function pullVocab(): Promise<VocabWord[]> {
  if (!isAuthenticated() || !isOnline()) return listVocab();
  try {
    const remote = await listRemoteVocab();
    for (const r of remote) {
      const local = await getVocab(r.clientId);
      const remoteUpdated = new Date(r.updatedAt).getTime();
      if (local) {
        const isLocalDirty = !local.syncedAt || local.syncedAt < local.updatedAt;
        if (isLocalDirty && local.updatedAt > remoteUpdated) {
          continue;
        }
      }
      if (r.deletedAt) {
        await localDelete(r.clientId);
        continue;
      }
      const w: VocabWord = {
        id: r.clientId,
        word: r.word,
        phonetic: r.phonetic ?? undefined,
        audioUrl: r.audioUrl ?? undefined,
        definitions: r.definitions as VocabDefinition[],
        contexts: r.contexts as VocabContext[],
        stage: r.stage as LeitnerStage,
        mastered: r.mastered,
        nextReviewAt: new Date(r.nextReviewAt).getTime(),
        lastReviewAt: r.lastReviewAt ? new Date(r.lastReviewAt).getTime() : undefined,
        correctStreak: r.correctStreak,
        createdAt: new Date(r.createdAt).getTime(),
        updatedAt: remoteUpdated,
        syncedAt: Date.now(),
      };
      await upsertVocab(w);
    }
  } catch (e) {
    console.warn("vocab pull failed", e);
  }
  return listVocab();
}
