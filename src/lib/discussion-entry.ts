/**
 * Record entries that summarize the recorded discussion (`<slideId>:mitschnitt`).
 *
 * They are written by the assignment step (discussion-assign.ts) and marked as
 * such everywhere the record is shown or exported, so nobody mistakes a summary
 * of what was said for a contribution the room typed or decided. Kept free of
 * UI and AI imports: the store, the field order and the exports all use it.
 */
import type { Bilingual } from "@/types/slide";
import { DISCUSSION_FIELD, DISCUSSION_PROMPT } from "./session-transcript-store";

export { DISCUSSION_FIELD, DISCUSSION_PROMPT };

/** Entry id of the discussion summary of one slide. */
export const discussionEntryId = (slideId: string) => `${slideId}:${DISCUSSION_FIELD}`;

export function isDiscussionEntry(id: string): boolean {
  return id.endsWith(`:${DISCUSSION_FIELD}`);
}

export const DISCUSSION_BADGE: Bilingual = { de: "Mitschnitt", en: "Recording" };
export const DISCUSSION_NOTE: Bilingual = {
  de: "zusammengefasst aus der mitgeschnittenen Diskussion",
  en: "summarized from the recorded discussion",
};
