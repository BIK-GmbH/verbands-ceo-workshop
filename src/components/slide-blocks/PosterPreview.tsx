/**
 * Shows on the poster slides what the poster actually looks like: the real
 * <PosterSheet>, scaled down and not interactive, fed live from the record.
 * Underneath: the fill state and the way into the poster generator.
 * The print view uses <PosterPreviewPrint> — a single line instead of a sheet.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useLang } from "@/lib/i18n";
import { useAllEntries, useWorkshopMeta } from "@/lib/useWorkshop";
import { usePosterDrafts } from "@/lib/poster-store";
import { PosterSheet } from "@/components/PosterSheet";
import { SHEET_PX, filledCount, findPoster, posterDate, posterValues } from "@/lib/posters";
import "@/styles/poster.css";

const MAX_WIDTH = 440;
const [SHEET_W, SHEET_H] = SHEET_PX.portrait;

interface Props {
  /** Poster key, e.g. "need-to-move" (see src/lib/posters.ts). */
  poster: string;
}

export function PosterPreview({ poster }: Props) {
  const [lang] = useLang();
  const entries = useAllEntries();
  const drafts = usePosterDrafts();
  const [meta] = useWorkshopMeta();
  const boxRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(MAX_WIDTH);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => setWidth(Math.max(160, Math.min(MAX_WIDTH, el.clientWidth)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const record = useMemo(
    () => Object.fromEntries(entries.map((e) => [e.id, Array.isArray(e.value) ? e.value.join(", ") : e.value])),
    [entries],
  );

  const def = findPoster(poster);
  if (!def) return null;

  const de = lang === "de";
  const draft = drafts[def.key];
  const values = posterValues(def, record, draft?.fields);
  const filled = filledCount(def, values);
  const scale = width / SHEET_W;

  return (
    <div ref={boxRef} style={{ width: "100%", maxWidth: MAX_WIDTH, margin: "0.75rem 0 1.25rem" }}>
      <div
        aria-hidden
        style={{
          position: "relative",
          width,
          height: Math.round(SHEET_H * scale),
          overflow: "hidden",
          borderRadius: 12,
          border: "1px solid var(--border)",
          boxShadow: "0 12px 34px rgb(0 0 0 / 0.22)",
          background: def.layout === "filmplakat" ? "#05060a" : "#ffffff",
        }}
      >
        <div style={{ position: "absolute", top: 0, left: 0, transform: `scale(${scale})`, transformOrigin: "top left", pointerEvents: "none" }}>
          <PosterSheet
            def={def}
            lang={lang}
            orientation="portrait"
            values={values}
            image={draft?.image}
            editing={false}
            date={posterDate(meta.date, lang)}
            zoom={1}
          />
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.9rem", flexWrap: "wrap", marginTop: "0.7rem" }}>
        <a
          href={`#/poster/${def.key}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            background: "var(--workshop-accent)",
            color: "white",
            padding: "0.6rem 1.05rem",
            borderRadius: "10px",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          {de ? "Poster öffnen, bearbeiten und drucken →" : "Open, edit and print the poster →"}
        </a>
        <span style={{ fontSize: "0.85rem", color: "var(--fg-muted)" }} data-poster-fill={`${filled}/${def.fields.length}`}>
          {de ? `${filled} von ${def.fields.length} Feldern gefüllt` : `${filled} of ${def.fields.length} fields filled`}
        </span>
      </div>
    </div>
  );
}

/** Print/PDF: a short reference instead of a scaled-down sheet. */
export function PosterPreviewPrint({ poster }: Props) {
  const [lang] = useLang();
  const def = findPoster(poster);
  if (!def) return null;
  return (
    <p style={{ fontSize: "0.9rem", margin: "0.5rem 0", color: "#444" }}>
      <strong>{lang === "de" ? "Poster: " : "Poster: "}</strong>
      {def.title[lang]}
      {lang === "de" ? " — im Poster-Generator der App" : " — in the app's poster generator"}
    </p>
  );
}
