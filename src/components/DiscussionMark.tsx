import { AudioLines } from "lucide-react";
import type { Lang } from "@/types/slide";
import { DISCUSSION_BADGE, DISCUSSION_NOTE, discussionEntryId } from "@/lib/discussion-entry";
import { useAllEntries } from "@/lib/useWorkshop";

/** "Mitschnitt" badge for record entries summarized from the recorded discussion. */
export function DiscussionBadge({ lang, size = "sm" }: { lang: Lang; size?: "xs" | "sm" }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded shrink-0 font-semibold uppercase tracking-wider ${
        size === "xs" ? "text-[9px] px-1 py-px" : "text-[10px] px-1.5 py-0.5"
      }`}
      style={{
        color: "var(--workshop-accent)",
        background: "color-mix(in oklch, var(--workshop-accent) 10%, var(--bg))",
        border: "1px solid color-mix(in oklch, var(--workshop-accent) 35%, var(--border))",
      }}
      data-discussion-badge
    >
      <AudioLines size={size === "xs" ? 10 : 11} aria-hidden />
      {DISCUSSION_BADGE[lang]}
    </span>
  );
}

/** Muted line under such an entry, so the origin stays readable without the badge. */
export function DiscussionNote({ lang, className = "" }: { lang: Lang; className?: string }) {
  return (
    <div className={`italic ${className}`} style={{ color: "var(--fg-muted)" }} data-discussion-note>
      {DISCUSSION_NOTE[lang]}
    </div>
  );
}

/**
 * Print view of the slides: the discussion summary of a slide below its content,
 * marked like everywhere else. Renders nothing when the slide has none.
 */
export function DiscussionPrintBlock({ slideId, lang }: { slideId: string; lang: Lang }) {
  const entry = useAllEntries().find((e) => e.id === discussionEntryId(slideId));
  const text = typeof entry?.value === "string" ? entry.value.trim() : "";
  if (!text) return null;
  return (
    <section className="mt-6 rounded-md p-3 text-sm" style={{ border: "1px solid var(--border)", borderLeft: "3px solid var(--workshop-accent)" }} data-discussion-print={slideId}>
      <div className="flex items-center gap-2 mb-1">
        <DiscussionBadge lang={lang} />
        <span className="font-semibold">{entry?.prompt}</span>
      </div>
      <DiscussionNote lang={lang} className="text-xs mb-1.5" />
      <div className="whitespace-pre-wrap">{text}</div>
    </section>
  );
}
