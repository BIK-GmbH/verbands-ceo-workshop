/**
 * Contribution order = slide order.
 *
 * Entry ids are "<slideId>:<field>", so sorting them as strings orders the
 * contributions of a slide by their field *name* — an order nobody can follow.
 * This module reads the slide sources themselves and remembers in which order
 * the capture blocks appear on each slide, so the record, the PDF/Word exports
 * and the report prompt list the answers exactly as the slide asks for them.
 * Field names are never touched, so already captured contributions stay
 * attached to their field.
 *
 * Captured are all blocks that carry a `field` attribute in the MDX — today
 * <WorkshopInput>, <CardCollector>, <BarometerVotes> and <AiSuggest>. Ids that
 * no slide declares (notes and ad-hoc questions from the live record, entries
 * written by the interview evaluation, poster drafts) sort behind the declared
 * fields of the same slide, alphabetically among themselves so the order stays
 * reproducible. The exception are entries derived from a declared field
 * ("<field>-stimmen", "<field>-analyse"): they sort directly under the field
 * they belong to, so an evaluation never drifts away from its question.
 */
import { ALL_SLIDES } from "./manifest";
import { isDiscussionEntry } from "./discussion-entry";

/** Everything the comparison needs; `CaptureEntry` satisfies it structurally. */
export interface OrderedEntry {
  /** "<slideId>:<field>", e.g. "04.02:wilma-lernen" */
  id: string;
  slideId: string;
}

/** Sorts behind every known slide / field, and never overflows when added to. */
const UNKNOWN = Number.MAX_SAFE_INTEGER;

/**
 * `field="…"`, `field='…'` or `field={"…"}` of any block. The lookbehind keeps
 * suffixed attributes (`data-field=`, `sourceField=`) out.
 */
const FIELD_RE = /(?<![\w-])field\s*=\s*(?:"([^"]*)"|'([^']*)'|\{\s*["']([^"']*)["']\s*\})/g;

const slideSources = import.meta.glob<string>("../content/**/*.mdx", {
  query: "?raw",
  eager: true,
  import: "default",
});

/** Filename "04-02-wilma-lernen.mdx" → slide id "04.02"; null when it does not match. */
function slideIdOf(path: string): string | null {
  const file = path.split("/").pop() ?? "";
  const m = /^(\d{2})-(\d{2})/.exec(file);
  return m ? `${m[1]}.${m[2]}` : null;
}

/** slideId → field name → position on the slide (0 = topmost). */
const FIELD_RANKS: Map<string, Map<string, number>> = (() => {
  const out = new Map<string, Map<string, number>>();
  for (const [path, source] of Object.entries(slideSources)) {
    const slideId = slideIdOf(path);
    if (!slideId || typeof source !== "string") continue;
    const ranks = new Map<string, number>();
    for (const m of source.matchAll(FIELD_RE)) {
      const field = m[1] ?? m[2] ?? m[3];
      // A field can be referenced twice (e.g. a read-only echo); the first one wins.
      if (field && !ranks.has(field)) ranks.set(field, ranks.size);
    }
    out.set(slideId, ranks);
  }
  return out;
})();

/** slideId → position in the deck (manifest order, not the id string). */
const SLIDE_RANKS: Map<string, number> = new Map(ALL_SLIDES.map((s, i) => [s.id, i]));

/** Position of the entry's slide in the deck; unknown slides sort to the end. */
export function slideRank(slideId: string): number {
  return SLIDE_RANKS.get(slideId) ?? UNKNOWN;
}

/**
 * Position of the entry's field on its slide — smaller = further up. Fields no
 * slide declares get `UNKNOWN` and are separated by the id anchor in
 * `compareEntries`.
 */
export function fieldRank(entryId: string): number {
  const sep = entryId.indexOf(":");
  if (sep === -1) return UNKNOWN;
  const ranks = FIELD_RANKS.get(entryId.slice(0, sep));
  if (!ranks) return UNKNOWN;
  const field = entryId.slice(sep + 1);
  const declared = ranks.get(field);
  if (declared !== undefined) return declared;
  // Entries derived from a declared field ("<field>-stimmen", "<field>-analyse")
  // belong directly under it, not behind every other field of the slide — in the
  // record the evaluation would otherwise sit far from the question it evaluates.
  // The longest matching prefix wins, and the half step keeps the derivation
  // ahead of the next declared field; several derivations of one field tie and
  // are separated by the id anchor in `compareEntries`.
  let rank = UNKNOWN;
  let longest = -1;
  for (const [name, declaredRank] of ranks) {
    if (name.length > longest && field.startsWith(`${name}-`)) {
      longest = name.length;
      rank = declaredRank + 0.5;
    }
  }
  return rank;
}

/**
 * Deck order for captured contributions: slide position first, then the field's
 * position on that slide, with the entry id as the final, stable anchor.
 */
export function compareEntries(a: OrderedEntry, b: OrderedEntry): number {
  return (
    slideRank(a.slideId) - slideRank(b.slideId) ||
    // The summary of the recorded discussion closes a slide, after everything the room captured itself.
    Number(isDiscussionEntry(a.id)) - Number(isDiscussionEntry(b.id)) ||
    fieldRank(a.id) - fieldRank(b.id) ||
    a.id.localeCompare(b.id)
  );
}
