import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Home,
  ImagePlus,
  LayoutGrid,
  Loader2,
  Maximize,
  Minimize,
  Pencil,
  Printer,
  RotateCcw,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import "@/styles/poster.css";
import type { Lang } from "@/types/slide";
import { useLang } from "@/lib/i18n";
import { useAllEntries, useWorkshopMeta } from "@/lib/useWorkshop";
import { describeAiError, useApiKey } from "@/lib/ai-assist";
import { AiKeySetup } from "@/components/ProtocolAi";
import { PosterSheet } from "@/components/PosterSheet";
import { POSTERS, SHEET_PX, findPoster, pageMm, type Orientation, type PaperFormat, type PosterDef } from "@/lib/posters";
import {
  resetPosterFields,
  setPosterField,
  setPosterFields,
  setPosterImage,
  setPosterPrefs,
  usePosterDrafts,
  usePosterPrefs,
  type PosterDraft,
} from "@/lib/poster-store";
import { condensePoster } from "@/lib/poster-ai";
import { Tooltip } from "@/components/ui/Tooltip";

type Mode = "content" | "blank";

const ERROR_COLOR = "#dc2626";
const FORMATS: PaperFormat[] = ["A4", "A3", "A2", "A1", "A0"];
const MAX_IMAGE_PX = 1600;
const MAX_UPLOAD_BYTES = 30 * 1024 * 1024;
/** Above this the data URL starts to eat a noticeable share of the ~5 MB localStorage quota. */
const WARN_IMAGE_BYTES = 1.2 * 1024 * 1024;
const MM_TO_PX = 96 / 25.4;

function useProtocolValues(): Record<string, string> {
  const entries = useAllEntries();
  return useMemo(
    () => Object.fromEntries(entries.map((e) => [e.id, Array.isArray(e.value) ? e.value.join(", ") : e.value])),
    [entries],
  );
}

/** Poster wording wins over the record; a blank template shows nothing at all. */
function posterValues(def: PosterDef, protocol: Record<string, string>, draft: PosterDraft | undefined, mode: Mode) {
  const out: Record<string, string> = {};
  for (const f of def.fields) {
    out[f.entryId] = mode === "blank" ? "" : (draft?.fields[f.entryId] ?? protocol[f.entryId] ?? "");
  }
  return out;
}

const filledCount = (def: PosterDef, values: Record<string, string>) =>
  def.fields.filter((f) => values[f.entryId]?.trim()).length;

function displayDate(iso: string, lang: Lang): string {
  const d = iso ? new Date(`${iso}T12:00:00`) : null;
  if (d && !Number.isNaN(d.getTime())) {
    return d.toLocaleDateString(lang === "de" ? "de-DE" : "en-GB", { day: "numeric", month: "long", year: "numeric" });
  }
  return lang === "de" ? "16./17. September 2026" : "16–17 September 2026";
}

/** Downscales to at most `max` px on the long side and re-encodes as JPEG (keeps localStorage small). */
async function downscaleImage(file: File, max: number): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("image decode failed"));
      i.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas unavailable");
    // JPEG has no alpha: paint transparent PNG areas white instead of black.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function PageHeader({ lang, fallback, title, children }: { lang: Lang; fallback: string; title: string; children?: ReactNode }) {
  const navigate = useNavigate();
  const de = lang === "de";
  // Same behaviour as the record page: back into the deck if we came from there.
  const canGoBack = ((window.history.state as { idx?: number } | null)?.idx ?? 0) > 0;
  return (
    <header
      className="poster-chrome sticky top-0 z-20 flex items-center gap-2 sm:gap-3 px-4 sm:px-6 border-b shrink-0"
      style={{ height: "var(--header-height)", background: "var(--bg)", color: "var(--fg)", borderColor: "var(--border)" }}
    >
      <button
        type="button"
        onClick={() => (canGoBack ? navigate(-1) : navigate(fallback))}
        className="inline-flex items-center gap-2 text-sm font-medium rounded-md px-2.5 h-9 transition-colors hover:bg-[color-mix(in_oklch,var(--fg)_11%,transparent)]"
        style={{ background: "color-mix(in oklch, var(--fg) 6%, transparent)", border: "1px solid var(--border)" }}
      >
        <ArrowLeft size={18} /> {de ? "Zurück" : "Back"}
      </button>
      <Tooltip content={de ? "Zur Startseite des Workshops" : "To the workshop start page"}>
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm rounded-md px-2.5 h-9 transition-colors hover:bg-[color-mix(in_oklch,var(--fg)_8%,transparent)]"
          style={{ color: "var(--fg)" }}
          aria-label={de ? "Zur Startseite" : "To start"}
        >
          <Home size={16} /> <span className="hidden sm:inline">Start</span>
        </Link>
      </Tooltip>
      {children}
      <div className="ml-auto text-sm font-semibold truncate">{title}</div>
    </header>
  );
}

function Gallery({ lang }: { lang: Lang }) {
  const de = lang === "de";
  const protocol = useProtocolValues();
  const drafts = usePosterDrafts();
  const [meta] = useWorkshopMeta();
  const date = displayDate(meta.date, lang);

  return (
    <div className="poster-page" style={{ background: "var(--bg)", color: "var(--fg)", minHeight: "100svh" }}>
      <PageHeader lang={lang} fallback="/s/07.05" title={de ? "Poster-Galerie" : "Poster gallery"} />
      <main className="max-w-6xl mx-auto px-5 sm:px-8 py-8">
        <h1 className="text-3xl font-semibold mb-2" style={{ color: "var(--workshop-accent)" }}>
          {de ? "Die sieben Poster" : "The seven posters"}
        </h1>
        <p className="text-sm mb-2 max-w-3xl" style={{ color: "var(--fg)" }}>
          <strong>
            {de
              ? "Die Poster halten wir in jeder Phase gemeinsam fest – hier die digitale Reinzeichnung."
              : "We capture the posters together in every phase – this is the clean digital version."}
          </strong>
        </p>
        <p className="text-sm mb-7 max-w-3xl" style={{ color: "var(--fg-muted)" }}>
          {de
            ? "Jede Phase endet mit einem Poster. Die Inhalte kommen aus den Eingaben auf den Poster-Folien und dem Protokoll. Jedes Poster lässt sich mit Inhalten oder als leere Vorlage zum Ausfüllen an der Wand drucken, von A4 bis A0."
            : "Every phase ends with a poster. The content comes from the inputs on the poster slides and the record. Each poster can be printed with content or as a blank template to fill in on the wall, from A4 to A0."}
        </p>
        <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
          {POSTERS.map((def) => {
            const values = posterValues(def, protocol, drafts[def.key], "content");
            const filled = filledCount(def, values);
            const total = def.fields.length;
            return (
              <Link
                key={def.key}
                to={`/poster/${def.key}`}
                data-poster-tile={def.key}
                className="rounded-lg border overflow-hidden flex flex-col transition-shadow hover:shadow-lg hover:no-underline"
                style={{ borderColor: "var(--border)", background: "var(--bg-elev)", color: "var(--fg)" }}
              >
                <div
                  className="flex justify-center py-4"
                  style={{ background: "color-mix(in oklch, var(--fg) 6%, var(--bg-elev))", pointerEvents: "none" }}
                  aria-hidden="true"
                >
                  <PosterSheet
                    def={def}
                    lang={lang}
                    orientation="portrait"
                    values={values}
                    image={drafts[def.key]?.image}
                    editing={false}
                    date={date}
                    zoom={0.2}
                  />
                </div>
                <div className="p-4 flex flex-col gap-1.5 flex-1">
                  <div className="text-xs font-bold tracking-wider uppercase" style={{ color: "var(--workshop-accent)" }}>
                    Phase {def.phase}
                  </div>
                  <div className="font-semibold leading-snug">{def.title[lang]}</div>
                  <div className="text-sm leading-snug" style={{ color: "var(--fg-muted)" }}>
                    {def.question[lang]}
                  </div>
                  <div className="mt-auto pt-3">
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                      <div style={{ width: `${(filled / total) * 100}%`, height: "100%", background: "var(--workshop-accent)" }} />
                    </div>
                    <div className="text-xs mt-1.5" style={{ color: "var(--fg-muted)" }} data-fill={`${filled}/${total}`}>
                      {de ? `${filled} von ${total} Feldern gefüllt` : `${filled} of ${total} fields filled`}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; hint?: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-md overflow-hidden border shrink-0" style={{ borderColor: "var(--border)" }}>
      {options.map((o) => (
        <Tooltip key={o.value} content={o.hint}>
          <button
            type="button"
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
            className="px-2.5 h-8 text-xs font-medium transition-colors"
            style={value === o.value ? { background: "var(--workshop-accent)", color: "white" } : { color: "var(--fg)" }}
          >
            {o.label}
          </button>
        </Tooltip>
      ))}
    </div>
  );
}

function ToolButton({
  onClick,
  disabled,
  active,
  primary,
  title,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  primary?: boolean;
  title?: string;
  children: ReactNode;
}) {
  const style = primary
    ? { background: "var(--workshop-accent)", color: "white", border: "1px solid var(--workshop-accent)" }
    : active
      ? { background: "color-mix(in oklch, var(--workshop-accent) 14%, transparent)", color: "var(--workshop-accent)", border: "1px solid var(--workshop-accent)" }
      : { color: "var(--fg)", border: "1px solid var(--border)" };
  return (
    <Tooltip content={title}>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-pressed={active}
        className="inline-flex items-center gap-1.5 px-2.5 h-8 rounded-md text-xs font-medium shrink-0 disabled:opacity-50 transition-colors"
        style={style}
      >
        {children}
      </button>
    </Tooltip>
  );
}

function PosterView({ def, lang }: { def: PosterDef; lang: Lang }) {
  const de = lang === "de";
  const protocol = useProtocolValues();
  const drafts = usePosterDrafts();
  const draft = drafts[def.key];
  const prefs = usePosterPrefs();
  const [meta] = useWorkshopMeta();
  const apiKey = useApiKey();
  const [mode, setMode] = useState<Mode>("content");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [keySetup, setKeySetup] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [avail, setAvail] = useState({ w: 800, h: 600 });
  const stageRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const values = posterValues(def, protocol, draft, mode);
  const overrides = Object.keys(draft?.fields ?? {}).length;
  const [sw, sh] = SHEET_PX[prefs.orientation];
  const [pw, ph] = pageMm(prefs.format, prefs.orientation);
  // A hair under the page box so rounding can never spill onto a second page.
  const printZoom = Math.min((pw * MM_TO_PX) / sw, (ph * MM_TO_PX) / sh) * 0.995;
  const fitWidth = avail.w / sw;
  const zoom = Math.max(0.15, editing && !fullscreen ? Math.min(fitWidth, 1.25) : Math.min(fitWidth, avail.h / sh));

  const index = POSTERS.findIndex((p) => p.key === def.key);
  const prev = POSTERS[index - 1];
  const next = POSTERS[index + 1];

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => setAvail({ w: el.clientWidth - 48, h: el.clientHeight - 48 });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === stageRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const storageError = de
    ? "Konnte nicht gespeichert werden: Der Browser-Speicher ist voll oder gesperrt. Ein kleineres Bild hilft."
    : "Could not be saved: browser storage is full or blocked. A smaller image helps.";

  const save = (fn: () => void): boolean => {
    try {
      fn();
      return true;
    } catch {
      setError(storageError);
      return false;
    }
  };

  const onEdit = (entryId: string, value: string) => {
    save(() => setPosterField(def.key, entryId, value));
  };

  const changePrefs = (patch: Parameters<typeof setPosterPrefs>[0]) => {
    save(() => setPosterPrefs(patch));
  };

  const print = () => {
    setError("");
    // Textareas must not end up on paper: leave edit mode before the print snapshot.
    flushSync(() => setEditing(false));
    window.print();
  };

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await stageRef.current?.requestFullscreen();
    } catch {
      setError(de ? "Vollbild ist in diesem Browser nicht verfügbar." : "Fullscreen is not available in this browser.");
    }
  };

  const condense = async () => {
    setError("");
    setNotice("");
    if (!apiKey) {
      setKeySetup(true);
      return;
    }
    const inputs = def.fields
      .filter((f) => f.kind === "text")
      .map((f) => ({ entryId: f.entryId, text: (protocol[f.entryId] ?? "").trim() }))
      .filter((i) => i.text);
    if (inputs.length === 0) {
      setError(de ? "Für dieses Poster gibt es noch keine Texte im Protokoll." : "There is no text in the record for this poster yet.");
      return;
    }
    if (
      overrides > 0 &&
      !window.confirm(de ? "Die bisherige Posterfassung wird durch die KI-Fassung ersetzt. Fortfahren?" : "The current poster wording will be replaced by the AI version. Continue?")
    ) {
      return;
    }
    setBusy(true);
    try {
      const out = await condensePoster(def, inputs);
      if (save(() => setPosterFields(def.key, out))) {
        setMode("content");
        const n = Object.keys(out).length;
        setNotice(
          de
            ? `${n} ${n === 1 ? "Feld" : "Felder"} verdichtet. Über „Bearbeiten“ direkt auf dem Poster anpassbar; das Protokoll bleibt unverändert.`
            : `${n} ${n === 1 ? "field" : "fields"} condensed. Adjust directly on the poster via “Edit”; the record stays unchanged.`,
        );
      }
    } catch (err) {
      setError(describeAiError(err, lang));
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    if (!window.confirm(de ? "Posterfassung verwerfen und wieder den Protokollstand zeigen?" : "Discard the poster wording and show the record again?")) return;
    if (save(() => resetPosterFields(def.key))) {
      setNotice(de ? "Posterfassung verworfen – das Poster zeigt wieder den Protokollstand." : "Poster wording discarded – the poster shows the record again.");
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError("");
    setNotice("");
    if (!file.type.startsWith("image/")) {
      setError(de ? "Bitte eine Bilddatei wählen (JPG, PNG, WebP)." : "Please choose an image file (JPG, PNG, WebP).");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError(de ? "Die Datei ist zu groß (höchstens 30 MB)." : "The file is too large (30 MB max).");
      return;
    }
    let dataUrl: string;
    try {
      dataUrl = await downscaleImage(file, MAX_IMAGE_PX);
    } catch {
      setError(de ? "Das Bild konnte nicht gelesen werden. Bitte ein anderes Format versuchen." : "The image could not be read. Please try another format.");
      return;
    }
    const bytes = Math.round(dataUrl.length * 0.75);
    if (!save(() => setPosterImage(def.key, dataUrl))) return;
    const size = bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
    setNotice(
      bytes > WARN_IMAGE_BYTES
        ? de
          ? `Bild gespeichert (${size}). Achtung: Der Browser-Speicher ist auf wenige MB begrenzt; bei Problemen ein kleineres Bild verwenden.`
          : `Image saved (${size}). Note: browser storage is limited to a few MB; use a smaller image if problems occur.`
        : de
          ? `Bild gespeichert (${size}, auf max. ${MAX_IMAGE_PX} px verkleinert).`
          : `Image saved (${size}, scaled to max. ${MAX_IMAGE_PX} px).`,
    );
  };

  return (
    <div className="poster-page flex flex-col" style={{ background: "var(--bg)", color: "var(--fg)", height: "100svh" }}>
      <style>{`@page { size: ${pw}mm ${ph}mm; margin: 0; }`}</style>

      <PageHeader lang={lang} fallback={`/s/${def.slideId}`} title={`Phase ${def.phase} · ${def.title[lang]}`}>
        <Link
          to="/poster"
          className="inline-flex items-center gap-2 text-sm rounded-md px-2.5 h-9 transition-colors hover:bg-[color-mix(in_oklch,var(--fg)_8%,transparent)]"
          style={{ color: "var(--fg)" }}
        >
          <LayoutGrid size={16} /> <span className="hidden sm:inline">{de ? "Galerie" : "Gallery"}</span>
        </Link>
      </PageHeader>

      <div className="poster-chrome border-b px-4 sm:px-6 py-2 space-y-2 shrink-0" style={{ borderColor: "var(--border)", background: "var(--bg-elev)" }}>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1 shrink-0">
            {prev ? (
              <Tooltip content={`${de ? "Vorheriges Poster" : "Previous poster"}: Phase ${prev.phase} · ${prev.title[lang]}`}>
                <Link to={`/poster/${prev.key}`} className="size-8 grid place-items-center rounded-md border" style={{ borderColor: "var(--border)", color: "var(--fg)" }} aria-label={prev.title[lang]}>
                  <ChevronLeft size={16} />
                </Link>
              </Tooltip>
            ) : (
              <span className="size-8" />
            )}
            <span className="text-xs font-semibold px-1 tabular-nums">
              {def.phase} / {POSTERS.length}
            </span>
            {next ? (
              <Tooltip content={`${de ? "Nächstes Poster" : "Next poster"}: Phase ${next.phase} · ${next.title[lang]}`}>
                <Link to={`/poster/${next.key}`} className="size-8 grid place-items-center rounded-md border" style={{ borderColor: "var(--border)", color: "var(--fg)" }} aria-label={next.title[lang]}>
                  <ChevronRight size={16} />
                </Link>
              </Tooltip>
            ) : (
              <span className="size-8" />
            )}
          </div>
          <Segmented<PaperFormat>
            label={de ? "Papierformat" : "Paper size"}
            value={prefs.format}
            options={FORMATS.map((f) => ({
              value: f,
              label: f,
              hint:
                f === "A4" || f === "A3"
                  ? de
                    ? `${f}: direkt am Bürodrucker druckbar, z. B. als Handout`
                    : `${f}: prints directly on an office printer, e.g. as a handout`
                  : de
                    ? `${f}: Wandposter. Als PDF speichern und in der Druckerei ausgeben lassen.`
                    : `${f}: wall poster. Save as PDF and have it printed by a print shop.`,
            }))}
            onChange={(format) => changePrefs({ format })}
          />
          <Segmented<Orientation>
            label={de ? "Ausrichtung" : "Orientation"}
            value={prefs.orientation}
            options={[
              { value: "portrait", label: de ? "Hoch" : "Portrait" },
              { value: "landscape", label: de ? "Quer" : "Landscape" },
            ]}
            onChange={(orientation) => changePrefs({ orientation })}
          />
          <Segmented<Mode>
            label={de ? "Inhalt" : "Content"}
            value={mode}
            options={[
              {
                value: "content",
                label: de ? "Mit Inhalten" : "With content",
                hint: de
                  ? "Zeigt die Beiträge aus den Poster-Folien und dem Protokoll bzw. die Posterfassung"
                  : "Shows the contributions from the poster slides and the record, or the poster wording",
              },
              {
                value: "blank",
                label: de ? "Leere Vorlage" : "Blank template",
                hint: de
                  ? "Poster nur mit Struktur und Leitfragen, ohne Inhalte: zum Ausfüllen von Hand an der Wand"
                  : "Poster with structure and guiding questions only, no content: to fill in by hand on the wall",
              },
            ]}
            onChange={(m) => {
              setMode(m);
              if (m === "blank") setEditing(false);
            }}
          />
          <ToolButton onClick={() => setEditing((e) => !e)} active={editing} disabled={mode === "blank"} title={de ? "Posterfassung direkt auf dem Poster bearbeiten" : "Edit the poster wording directly on the poster"}>
            <Pencil size={14} /> {editing ? (de ? "Fertig" : "Done") : de ? "Bearbeiten" : "Edit"}
          </ToolButton>
          <ToolButton
            onClick={condense}
            disabled={busy}
            title={
              de
                ? "Claude kürzt die Protokolltexte je Feld auf posterreife Stichworte. Das Ergebnis ist eine eigene Posterfassung; das Protokoll bleibt unverändert."
                : "Claude shortens the record texts per field to poster-ready keywords. The result is a separate poster wording; the record stays unchanged."
            }
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {busy ? (de ? "Verdichte …" : "Condensing …") : de ? "Mit KI verdichten" : "Condense with AI"}
          </ToolButton>
          <ToolButton
            onClick={reset}
            disabled={overrides === 0}
            title={
              de
                ? "Posterfassung verwerfen: Das Poster zeigt wieder die Texte aus dem Protokoll."
                : "Discard the poster wording: the poster shows the record texts again."
            }
          >
            <RotateCcw size={14} /> {de ? "Auf Protokollstand zurücksetzen" : "Reset to record"}
          </ToolButton>
          {def.layout === "target" && (
            <>
              <ToolButton onClick={() => fileRef.current?.click()} title={de ? "Bild für das Zielbild hochladen" : "Upload an image for the target picture"}>
                <ImagePlus size={14} /> {draft?.image ? (de ? "Bild ersetzen" : "Replace image") : de ? "Bild hochladen" : "Upload image"}
              </ToolButton>
              {draft?.image && (
                <ToolButton onClick={() => save(() => setPosterImage(def.key, undefined))} title={de ? "Bild entfernen" : "Remove image"}>
                  <Trash2 size={14} /> {de ? "Bild entfernen" : "Remove image"}
                </ToolButton>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  void onFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </>
          )}
          <div className="ml-auto flex items-center gap-2">
            <ToolButton onClick={toggleFullscreen} title={de ? "Beamer-Ansicht im Vollbild" : "Fullscreen projector view"}>
              {fullscreen ? <Minimize size={14} /> : <Maximize size={14} />} {de ? "Vollbild" : "Fullscreen"}
            </ToolButton>
            <ToolButton
              onClick={print}
              primary
              title={
                de
                  ? `Genau eine Seite im gewählten Format (${prefs.format}). Im Druckdialog Skalierung „Standard“ und Hintergrundgrafiken aktivieren.`
                  : `Exactly one page in the chosen format (${prefs.format}). In the print dialog use default scaling and enable background graphics.`
              }
            >
              <Printer size={14} /> {de ? "Drucken / Als PDF speichern" : "Print / save as PDF"}
            </ToolButton>
          </div>
        </div>

        {keySetup && !apiKey && (
          <div className="flex items-start gap-2 max-w-xl">
            <div className="flex-1">
              <AiKeySetup lang={lang} />
            </div>
            <button type="button" onClick={() => setKeySetup(false)} className="size-7 grid place-items-center rounded-md" style={{ color: "var(--fg-muted)" }} aria-label={de ? "Schließen" : "Close"}>
              <X size={14} />
            </button>
          </div>
        )}
        {error && (
          <p className="text-xs" style={{ color: ERROR_COLOR }} role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="text-xs" style={{ color: "var(--workshop-accent)" }} role="status">
            {notice}
          </p>
        )}
        <p className="text-[11px]" style={{ color: "var(--fg-muted)" }}>
          {mode === "blank"
            ? de
              ? "Leere Vorlage: zum Ausfüllen an der Wand drucken."
              : "Blank template: print it to fill in on the wall."
            : overrides > 0
              ? de
                ? `Posterfassung aktiv: ${overrides} ${overrides === 1 ? "Feld weicht" : "Felder weichen"} vom Protokoll ab (nur hier, das Protokoll bleibt unverändert).`
                : `Poster wording active: ${overrides} ${overrides === 1 ? "field differs" : "fields differ"} from the record (here only; the record stays unchanged).`
              : de
                ? "Das Poster zeigt den aktuellen Protokollstand."
                : "The poster shows the current record."}{" "}
          {de
            ? `Druck: ${prefs.format} ${prefs.orientation === "portrait" ? "hoch" : "quer"}, genau eine Seite. Im Druckdialog Skalierung „Standard“ und Hintergrundgrafiken aktivieren; A2–A0 als PDF speichern und in der Druckerei ausgeben.`
            : `Print: ${prefs.format} ${prefs.orientation}, exactly one page. In the print dialog use default scaling and enable background graphics; save A2–A0 as PDF for a print shop.`}
        </p>
      </div>

      <div
        ref={stageRef}
        className={`poster-stage flex-1 min-h-0 overflow-auto flex justify-center p-6 ${fullscreen ? "items-center" : "items-start"}`}
        style={{ background: "color-mix(in oklch, var(--fg) 7%, var(--bg))" }}
      >
        <PosterSheet
          def={def}
          lang={lang}
          orientation={prefs.orientation}
          values={values}
          image={mode === "blank" ? undefined : draft?.image}
          editing={editing && mode === "content"}
          onEdit={onEdit}
          date={displayDate(meta.date, lang)}
          zoom={zoom}
          printZoom={printZoom}
        />
      </div>
    </div>
  );
}

/** Poster generator: gallery at /poster, one printable poster at /poster/:phase (key or phase number). */
export function Poster() {
  const [lang] = useLang();
  const { phase } = useParams<{ phase?: string }>();
  if (!phase) return <Gallery lang={lang} />;
  const def = findPoster(phase) ?? POSTERS.find((p) => String(p.phase) === phase);
  if (!def) return <Navigate to="/poster" replace />;
  return <PosterView key={def.key} def={def} lang={lang} />;
}
