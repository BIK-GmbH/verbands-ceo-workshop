import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { useAllEntries, useWorkshopMeta } from "@/lib/useWorkshop";
import { usePosterDrafts } from "@/lib/poster-store";
import { useInterviews } from "@/lib/interview-store";
import { describeAiError, useApiKey } from "@/lib/ai-assist";
import { getEntry, setEntry } from "@/lib/workshop-store";
import {
  draftDayRecap,
  hasRecapMaterial,
  moodBefore,
  openForTomorrow,
  openQuestions,
  recapCounts,
  recapPhases,
  toLines,
  type MoodPicture,
  type RecapPhase,
  type RecapSlot,
} from "@/lib/day-recap";
import type { Lang } from "@/types/slide";

interface Props {
  /** Slide id this block sits on, e.g. "04.00" */
  slideId: string;
  /** Field the AI summary is written to — the <WorkshopInput> with this field on the same slide edits it. */
  summaryField: string;
  /** Prompt of that field, so the entry reads the same in the record whoever wrote it. */
  summaryPrompt: string;
  /** Print view: the recap without the AI controls. */
  readOnly?: boolean;
}

const muted: CSSProperties = { color: "var(--fg-muted)" };
const card: CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: 12,
  background: "var(--bg-elev)",
  padding: "1rem 1.1rem",
  breakInside: "avoid",
};
const eyebrow: CSSProperties = {
  fontSize: "0.72rem",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

/** Long poster lists stay readable on the projector: the rest is on the poster itself. */
const MAX_LINES = 5;

/**
 * Start of day 2: what we worked out on day 1, read live from the record — the
 * poster results of phases 1–3, the kickoff barometer, a few counts and the
 * questions still open. Optionally the AI condenses day 1 into five sentences;
 * the result is a normal record entry, edited in the field below the block.
 */
export function DayRecap({ slideId, summaryField, summaryPrompt, readOnly = false }: Props) {
  const [lang] = useLang();
  const de = lang === "de";
  const entries = useAllEntries();
  const drafts = usePosterDrafts();
  const [meta] = useWorkshopMeta();
  const { interviews } = useInterviews();

  const phases = useMemo(() => recapPhases(entries, drafts), [entries, drafts]);
  const mood = useMemo(() => moodBefore(entries), [entries]);
  const counts = useMemo(() => recapCounts(entries, meta.participantsList), [entries, meta.participantsList]);
  const questions = useMemo(() => openQuestions(entries), [entries]);
  const openText = openForTomorrow(entries);

  const stats = [
    { n: counts.contributions, label: de ? "Beiträge" : "Contributions" },
    { n: counts.cards, label: de ? "Karten" : "Cards" },
    { n: interviews.length, label: de ? "KI-Interviews" : "AI interviews" },
    { n: counts.participants, label: de ? "Teilnehmende" : "Participants" },
  ];

  return (
    <div className="my-5 space-y-4" data-day-recap>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "0.6rem" }}>
        {stats.map((s) => (
          <div
            key={s.label}
            className="flex items-baseline gap-2"
            style={{ ...card, padding: "0.45rem 0.9rem" }}
            data-recap-stat={s.label}
          >
            <span
              className="tabular-nums"
              style={{ fontSize: "1.6rem", fontWeight: 700, lineHeight: 1.2, color: s.n ? "var(--workshop-accent)" : "var(--fg-muted)" }}
            >
              {s.n}
            </span>
            <span style={{ fontSize: "0.9rem", ...muted }}>{s.label}</span>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "0.8rem" }}>
        {phases.map((p) => (
          <PhaseCard key={p.key} phase={p} lang={lang} readOnly={readOnly} />
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "0.8rem" }}>
        <MoodCard mood={mood} lang={lang} />
        <OpenCard questions={questions} openText={openText} lang={lang} />
      </div>

      {!readOnly && <SummaryBar slideId={slideId} field={summaryField} prompt={summaryPrompt} lang={lang} />}
    </div>
  );
}

function SlideRef({ id, readOnly }: { id: string; readOnly: boolean }) {
  if (readOnly) return <span style={muted}>{id}</span>;
  return (
    <a href={`#/s/${id}`} style={{ ...muted, textDecoration: "none" }}>
      {id} →
    </a>
  );
}

function SlotText({ slot, big }: { slot: RecapSlot; big: boolean }) {
  const lines = toLines(slot.text);
  if (lines.length <= 1) {
    return <p style={{ fontSize: big ? "1.2rem" : "1.05rem", fontWeight: big ? 600 : 400, lineHeight: 1.4, margin: 0 }}>{lines[0]}</p>;
  }
  const shown = lines.slice(0, MAX_LINES);
  return (
    <ul style={{ fontSize: big ? "1.1rem" : "1.05rem", lineHeight: 1.35, margin: 0, paddingLeft: "1.1rem", listStyle: "disc" }}>
      {shown.map((l, i) => (
        <li key={i} style={{ marginBottom: "0.2rem" }}>
          {l}
        </li>
      ))}
      {lines.length > shown.length && (
        <li style={{ listStyle: "none", fontSize: "0.85rem", ...muted }}>+ {lines.length - shown.length}</li>
      )}
    </ul>
  );
}

function PhaseCard({ phase, lang, readOnly }: { phase: RecapPhase; lang: Lang; readOnly: boolean }) {
  const de = lang === "de";
  const filled = phase.slots.some((s) => s.text);
  return (
    <section style={{ ...card, borderTop: "3px solid var(--workshop-accent)" }} data-recap-phase={phase.key}>
      <div className="flex items-baseline justify-between gap-2" style={{ fontSize: "0.8rem" }}>
        <span style={{ ...eyebrow, color: "var(--workshop-accent)" }}>Phase {phase.phase}</span>
        <SlideRef id={phase.slideId} readOnly={readOnly} />
      </div>
      <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0.15rem 0 0.7rem", lineHeight: 1.25 }}>{phase.title[lang]}</h3>

      {filled ? (
        <div className="space-y-3">
          {phase.slots
            .filter((s) => s.text)
            .map((s, i) => (
              <div key={s.entryId}>
                <div style={{ ...eyebrow, ...muted, marginBottom: "0.2rem" }}>{s.label[lang]}</div>
                <SlotText slot={s} big={i === 0} />
              </div>
            ))}
        </div>
      ) : (
        <p style={{ fontSize: "0.95rem", margin: 0, ...muted }}>
          {de
            ? `Hier erscheint ${phase.slots.map((s) => `„${s.label.de}“`).join(" und ")}, sobald das Poster auf Folie ${phase.slideId} gefüllt ist.`
            : `${phase.slots.map((s) => `“${s.label.en}”`).join(" and ")} will appear here once the poster on slide ${phase.slideId} is filled in.`}
        </p>
      )}

      {phase.status?.text && (
        <div
          className="inline-block"
          style={{
            marginTop: "0.8rem",
            fontSize: "0.85rem",
            fontWeight: 600,
            padding: "0.25rem 0.6rem",
            borderRadius: 999,
            color: "var(--fg)",
            border: "1px solid var(--workshop-accent)",
            background: "color-mix(in oklch, var(--workshop-accent) 12%, transparent)",
          }}
          title={phase.status.label[lang]}
        >
          {phase.status.text}
        </div>
      )}
    </section>
  );
}

function MoodCard({ mood, lang }: { mood: MoodPicture; lang: Lang }) {
  const de = lang === "de";
  const max = Math.max(1, ...mood.counts);
  const tendency = mood.mean === null ? "" : mood.options[Math.round(mood.mean)];
  return (
    <section style={card} data-recap-mood>
      <CardHead title={de ? "Unsere Stimmung zu Beginn" : "Our mood at the start"} aside="Barometer 00.08" />
      {mood.total === 0 ? (
        <p style={{ fontSize: "0.95rem", margin: 0, ...muted }}>
          {de
            ? "Hier erscheint die Verteilung aus dem Barometer „Fiktion oder Realität?“ vom Auftakt."
            : "The distribution from the kickoff barometer “fiction or reality?” will appear here."}
        </p>
      ) : (
        <>
          <div className="space-y-1.5">
            {mood.options.map((o, i) => (
              <div key={o} className="flex items-center gap-2" style={{ fontSize: "0.95rem" }}>
                <span className="shrink-0" style={{ width: "7.5rem" }}>
                  {o}
                </span>
                <div className="flex-1 rounded-full overflow-hidden" style={{ height: "0.8rem", background: "var(--border)" }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(mood.counts[i] / max) * 100}%`, background: "var(--workshop-accent)", opacity: mood.counts[i] ? 1 : 0 }}
                  />
                </div>
                <span className="tabular-nums text-right shrink-0" style={{ width: "1.6rem", fontWeight: 600 }}>
                  {mood.counts[i]}
                </span>
              </div>
            ))}
          </div>
          <p style={{ fontSize: "0.9rem", margin: "0.6rem 0 0", ...muted }}>
            {de
              ? `${mood.total} ${mood.total === 1 ? "Stimme" : "Stimmen"} · Tendenz: `
              : `${mood.total} ${mood.total === 1 ? "vote" : "votes"} · tendency: `}
            <strong style={{ color: "var(--fg)" }}>{tendency}</strong>
          </p>
        </>
      )}
    </section>
  );
}

function OpenCard({ questions, openText, lang }: { questions: { id: string; slideId: string; question: string }[]; openText: string; lang: Lang }) {
  const de = lang === "de";
  const openLines = toLines(openText);
  const empty = questions.length === 0 && openLines.length === 0;
  return (
    <section style={card} data-recap-open>
      <CardHead
        title={de ? "Offen für heute" : "Open for today"}
        aside={
          questions.length === 0
            ? undefined
            : de
              ? `${questions.length} ${questions.length === 1 ? "eigene Frage" : "eigene Fragen"} ohne Antwort`
              : `${questions.length} own ${questions.length === 1 ? "question" : "questions"} without an answer`
        }
      />
      {empty ? (
        <p style={{ fontSize: "0.95rem", margin: 0, ...muted }}>
          {de
            ? "Hier erscheinen unsere eigenen Fragen aus dem Live-Protokoll, die noch keine Antwort haben, und was wir in der Tagesbilanz (03.06) für heute offen gelassen haben."
            : "Our own questions from the live record that have no answer yet will appear here, along with what we left open for today in the wrap-up (03.06)."}
        </p>
      ) : (
        <ul style={{ fontSize: "1rem", lineHeight: 1.4, margin: 0, paddingLeft: "1.1rem", listStyle: "disc" }}>
          {openLines.map((l, i) => (
            <li key={`o-${i}`} style={{ marginBottom: "0.25rem" }}>
              {l}
            </li>
          ))}
          {questions.map((q) => (
            <li key={q.id} style={{ marginBottom: "0.25rem" }} data-recap-question>
              {q.question} <span style={{ fontSize: "0.8rem", ...muted }}>· {q.slideId}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CardHead({ title, aside }: { title: string; aside?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2" style={{ marginBottom: "0.6rem" }}>
      <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0 }}>{title}</h3>
      {aside && <span style={{ fontSize: "0.8rem", ...muted }}>{aside}</span>}
    </div>
  );
}

/** „Rückblick in fünf Sätzen": writes the AI draft into the summary field; the field below edits it. */
function SummaryBar({ slideId, field, prompt, lang }: { slideId: string; field: string; prompt: string; lang: Lang }) {
  const de = lang === "de";
  const entries = useAllEntries();
  const drafts = usePosterDrafts();
  const apiKey = useApiKey();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);

  const id = `${slideId}:${field}`;
  const current = entries.find((e) => e.id === id)?.value;
  const hasText = typeof current === "string" && current.trim().length > 0;
  const material = hasRecapMaterial(entries);
  const disabled = busy || !apiKey || !material;

  const generate = async () => {
    setConfirmOverwrite(false);
    setBusy(true);
    setError("");
    try {
      const text = await draftDayRecap(entries, drafts);
      const previous = getEntry(id);
      const replaced = typeof previous?.value === "string" ? previous.value : "";
      setEntry({
        id,
        module: Number.parseInt(slideId, 10),
        slideId,
        kind: "text",
        prompt,
        value: text,
        // The first hand-written version stays restorable in the record.
        raw: previous?.raw ?? (replaced.trim() ? replaced : undefined),
      });
    } catch (err) {
      setError(describeAiError(err, lang));
    } finally {
      setBusy(false);
    }
  };

  const onClick = () => {
    if (disabled) return;
    if (hasText) setConfirmOverwrite(true);
    else void generate();
  };

  const hint = !apiKey
    ? de
      ? "Für den KI-Rückblick braucht es einen Claude-API-Schlüssel in den Einstellungen. Ohne Schlüssel halten wir die fünf Sätze direkt im Feld darunter fest."
      : "The AI recap needs a Claude API key in the settings. Without a key we write the five sentences straight into the field below."
    : !material
      ? de
        ? "Sobald Beiträge aus Tag 1 im Protokoll stehen, fasst die KI sie hier in fünf Sätzen zusammen."
        : "As soon as day 1 contributions are in the record, the AI condenses them into five sentences here."
      : de
        ? "Die KI liest Poster und Beiträge von Tag 1 und schreibt fünf Sätze ins Feld darunter. Dort passen wir sie gemeinsam an."
        : "The AI reads the day 1 posters and contributions and writes five sentences into the field below. We adjust them together there.";

  return (
    <div className="no-print flex flex-wrap items-center gap-x-3 gap-y-2" data-recap-summary-bar>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ background: "var(--workshop-accent-deep)", color: "white" }}
        data-recap-ai
      >
        {busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
        {hasText
          ? de
            ? "Rückblick neu formulieren"
            : "Reword the recap"
          : de
            ? "Rückblick in fünf Sätzen"
            : "Recap in five sentences"}
      </button>
      <span className="flex-1 min-w-[16rem]" style={{ fontSize: "0.8rem", ...muted }}>
        {!apiKey ? (
          <>
            {hint}{" "}
            <a href="#/einstellungen" style={{ color: "var(--workshop-accent)" }}>
              {de ? "Zu den Einstellungen" : "Open settings"}
            </a>
          </>
        ) : (
          hint
        )}
      </span>
      {confirmOverwrite && (
        <div
          role="alertdialog"
          className="w-full flex flex-wrap items-center gap-2 rounded-md p-2 text-xs"
          style={{ background: "var(--bg)", border: "1px dashed var(--workshop-accent)" }}
        >
          <span className="flex-1">
            {de
              ? "Im Feld steht schon ein Rückblick. Durch einen neuen Vorschlag ersetzen? Die erste Fassung bleibt im Protokoll wiederherstellbar."
              : "The field already holds a recap. Replace it with a new draft? The first version stays restorable in the record."}
          </span>
          <button
            type="button"
            onClick={() => void generate()}
            className="px-2.5 py-1 rounded-md font-medium"
            style={{ background: "var(--workshop-accent)", color: "white" }}
          >
            {de ? "Ersetzen" : "Replace"}
          </button>
          <button
            type="button"
            onClick={() => setConfirmOverwrite(false)}
            className="px-2.5 py-1 rounded-md"
            style={{ border: "1px solid var(--border)", color: "var(--fg)" }}
          >
            {de ? "Abbrechen" : "Cancel"}
          </button>
        </div>
      )}
      {error && (
        <span className="w-full" style={{ fontSize: "0.8rem", color: "var(--workshop-accent)" }} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
