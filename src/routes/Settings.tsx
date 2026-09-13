import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowLeft, Check, FileDown, FileUp, Home, Info, Loader2, Trash2 } from "lucide-react";
import type { Lang } from "@/types/slide";
import { useLang } from "@/lib/i18n";
import { lastSlidePath } from "@/lib/last-slide";
import { InterviewSetup } from "@/components/interviews/InterviewSetup";
import { ApiKeyStatus } from "@/components/ApiKeyStatus";
import { Tooltip } from "@/components/ui/Tooltip";
import { BTN, ERROR_COLOR, Notice, card, formatBytes, formatDate, muted, outline } from "@/components/interviews/ui";
import {
  applyBackup,
  describeBackupError,
  downloadBackup,
  parseBackup,
  resetContents,
  type BackupFile,
  type BackupSummary,
  summarize,
} from "@/lib/backup";
import { useGlossary } from "@/lib/glossary";
import { useInterviews } from "@/lib/interview-store";
import { usePosterDrafts } from "@/lib/poster-store";
import { useAllEntries } from "@/lib/useWorkshop";

/** Generous cap: a two-day workshop including interview audio stays far below it. */
const MAX_BACKUP_BYTES = 300 * 1024 * 1024;

interface Counts {
  entries: number;
  interviews: number;
  posterFields: number;
  glossaryTerms: number;
}

interface Preview {
  file: BackupFile;
  summary: BackupSummary;
  name: string;
}

/**
 * Backup and reset of all workshop content. Everything is stored in this
 * browser only, so a file is the only way to survive a cleared cache, a new
 * device or a reset — and the reset offers to write that file first.
 */
function BackupSection({ lang }: { lang: Lang }) {
  const de = lang === "de";
  const entries = useAllEntries();
  const glossary = useGlossary();
  const drafts = usePosterDrafts();
  const { interviews } = useInterviews();

  const current: Counts = {
    entries: entries.length,
    interviews: interviews.length,
    posterFields: Object.values(drafts).reduce((n, d) => n + Object.keys(d?.fields ?? {}).length, 0),
    glossaryTerms: glossary.terms.length,
  };

  const [includeAudio, setIncludeAudio] = useState(false);
  const [busy, setBusy] = useState<"download" | "read" | "apply" | "reset" | null>(null);
  const [done, setDone] = useState("");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [backupFirst, setBackupFirst] = useState(true);
  const [alsoKeys, setAlsoKeys] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const clearNotices = () => {
    setDone("");
    setError("");
  };

  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

  const countLine = (c: Counts) =>
    (de
      ? [
          plural(c.entries, "Beitrag", "Beiträge"),
          plural(c.interviews, "Interview", "Interviews"),
          plural(c.posterFields, "Posterfeld", "Posterfelder"),
          plural(c.glossaryTerms, "Glossarbegriff", "Glossarbegriffe"),
        ]
      : [
          plural(c.entries, "contribution", "contributions"),
          plural(c.interviews, "interview", "interviews"),
          plural(c.posterFields, "poster field", "poster fields"),
          plural(c.glossaryTerms, "glossary term", "glossary terms"),
        ]
    ).join(" · ");

  async function doDownload() {
    clearNotices();
    setBusy("download");
    try {
      const { fileName, bytes } = await downloadBackup({ includeAudio });
      setDone(
        de
          ? `Sicherung heruntergeladen: ${fileName} (${formatBytes(bytes, lang)}).`
          : `Backup downloaded: ${fileName} (${formatBytes(bytes, lang)}).`,
      );
    } catch (err) {
      console.error("[settings] backup failed", { includeAudio, err });
      setError(
        de
          ? "Die Sicherung konnte nicht erstellt werden. Bitte ohne Interview-Aufnahmen erneut versuchen."
          : "The backup could not be created. Please retry without interview recordings.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function doRead(file: File) {
    clearNotices();
    setPreview(null);
    if (file.size > MAX_BACKUP_BYTES) {
      setError(de ? "Die Datei ist zu groß (max. 300 MB)." : "The file is too large (max. 300 MB).");
      return;
    }
    setBusy("read");
    try {
      const parsed = parseBackup(await file.text());
      setPreview({ file: parsed, summary: summarize(parsed), name: file.name });
    } catch (err) {
      console.error("[settings] reading the backup failed", { file: file.name, err });
      setError(describeBackupError(err, lang));
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function doApply() {
    if (!preview) return;
    clearNotices();
    setBusy("apply");
    try {
      const s = await applyBackup(preview.file);
      setPreview(null);
      setDone(
        de
          ? `Sicherung eingelesen: ${countLine(s)}. Der bisherige Stand wurde ersetzt.`
          : `Backup restored: ${countLine(s)}. The previous state was replaced.`,
      );
    } catch (err) {
      console.error("[settings] applying the backup failed", err);
      setError(describeBackupError(err, lang));
    } finally {
      setBusy(null);
    }
  }

  async function doReset() {
    clearNotices();
    setBusy("reset");
    try {
      // A failing backup must abort the reset — never delete without the file.
      const saved = backupFirst ? await downloadBackup({ includeAudio }) : null;
      await resetContents({ alsoKeys });
      setConfirmReset(false);
      setDone(
        [
          de ? "Alle Inhalte wurden zurückgesetzt." : "All content has been reset.",
          saved && (de ? `Vorher gesichert als ${saved.fileName}.` : `Saved as ${saved.fileName} beforehand.`),
          alsoKeys &&
            (de
              ? "API-Schlüssel und Anmeldung sind entfernt — beim nächsten Laden fragt die Anmeldung wieder."
              : "API keys and login are removed — the login will ask again on the next load."),
        ]
          .filter(Boolean)
          .join(" "),
      );
    } catch (err) {
      console.error("[settings] reset failed", err);
      setError(
        de
          ? "Es wurde nichts gelöscht: die Sicherung ließ sich nicht erstellen. Bitte ohne Interview-Aufnahmen erneut versuchen."
          : "Nothing was deleted: the backup could not be created. Please retry without interview recordings.",
      );
    } finally {
      setBusy(null);
    }
  }

  const checkbox = "size-4 accent-[var(--workshop-accent)] shrink-0";
  const subHead = "text-sm font-semibold";

  return (
    <section className="rounded-lg p-4 sm:p-5 space-y-5" style={card} aria-labelledby="backup-heading">
      <div className="space-y-2">
        <h2 id="backup-heading" className={subHead}>
          {de ? "Sicherung & Zurücksetzen" : "Backup & reset"}
        </h2>
        <p className="text-xs leading-snug" style={muted}>
          {de
            ? "Alle Inhalte des Workshops liegen nur in diesem Browser auf diesem Gerät — kein Server, keine Cloud. Sie bleiben erhalten, wenn Tab und Browser geschlossen werden, und auch über Updates der App hinweg. Verloren gehen sie, wenn die Browserdaten gelöscht werden, im privaten Fenster gearbeitet wird oder das Gerät bzw. der Browser wechselt. Dagegen hilft nur eine Sicherung als Datei."
            : "All workshop content lives in this browser on this device only — no server, no cloud. It survives closing the tab and the browser, and app updates too. It is lost when the browser data is cleared, when working in a private window, or when the device or browser changes. Only a backup file protects against that."}
        </p>
        <p className="text-xs" style={muted}>
          {de ? "Aktuell gespeichert: " : "Currently stored: "}
          <span style={{ color: "var(--fg)" }}>{countLine(current)}</span>
        </p>
      </div>

      {/* ------------------------------------------------------- download */}
      <div className="space-y-2 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
        <div className={subHead}>{de ? "Sicherung herunterladen" : "Download backup"}</div>
        <p className="text-xs leading-snug" style={muted}>
          {de
            ? "Schreibt Beiträge, Interviews, Poster, Glossar und Ergebnisbericht in eine JSON-Datei mit Datum und Uhrzeit im Namen. Ohne Häkchen werden Interviews mit Transkript, Skalenwerten und Meinungsbild gesichert, aber ohne die Tonaufnahmen."
            : "Writes contributions, interviews, posters, glossary and results report into a JSON file with date and time in its name. Without the tick, interviews are saved with transcript, scale values and opinion picture, but without the recordings."}
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <button type="button" onClick={doDownload} disabled={busy !== null} className={BTN} style={outline}>
            {busy === "download" ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />}
            {de ? "Sicherung herunterladen" : "Download backup"}
          </button>
          <label className="inline-flex items-start gap-1.5 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={includeAudio}
              onChange={(e) => setIncludeAudio(e.target.checked)}
              className={`${checkbox} mt-0.5`}
            />
            <span>
              {de ? "Interview-Aufnahmen einschließen (große Datei)" : "Include interview recordings (large file)"}
            </span>
          </label>
        </div>
      </div>

      {/* --------------------------------------------------------- import */}
      <div className="space-y-2 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
        <div className={subHead}>{de ? "Sicherung einlesen" : "Restore backup"}</div>
        <p className="text-xs leading-snug" style={muted}>
          {de
            ? "Datei auswählen, Inhalt prüfen, dann einlesen. Der aktuelle Stand auf diesem Gerät wird dabei vollständig ersetzt."
            : "Pick a file, check its content, then restore. The current state on this device is replaced completely."}
        </p>
        <button type="button" onClick={() => fileRef.current?.click()} disabled={busy !== null} className={BTN} style={outline}>
          {busy === "read" ? <Loader2 size={16} className="animate-spin" /> : <FileUp size={16} />}
          {de ? "Sicherung auswählen" : "Choose backup"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          data-testid="backup-import-input"
          aria-label={de ? "Sicherungsdatei auswählen" : "Choose backup file"}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void doRead(f);
          }}
        />

        {preview && (
          <div
            className="rounded-md p-3 space-y-2 text-xs"
            style={{ background: "var(--bg)", border: "1px solid var(--workshop-accent)" }}
            role="group"
            aria-label={de ? "Vorschau der Sicherung" : "Backup preview"}
            data-testid="backup-preview"
          >
            <div className="font-semibold break-all" style={{ color: "var(--fg)" }}>
              {preview.name}
            </div>
            <dl className="space-y-1" style={muted}>
              <div className="flex flex-wrap gap-x-2">
                <dt>{de ? "Gesichert am:" : "Saved on:"}</dt>
                <dd style={{ color: "var(--fg)" }}>
                  {preview.summary.createdAt ? formatDate(preview.summary.createdAt, lang) : de ? "unbekannt" : "unknown"}
                </dd>
              </div>
              <div className="flex flex-wrap gap-x-2">
                <dt>{de ? "Inhalt:" : "Content:"}</dt>
                <dd style={{ color: "var(--fg)" }}>{countLine(preview.summary)}</dd>
              </div>
              <div className="flex flex-wrap gap-x-2">
                <dt>{de ? "Zusätzlich:" : "Also:"}</dt>
                <dd style={{ color: "var(--fg)" }}>
                  {[
                    preview.summary.hasReport
                      ? de
                        ? "Ergebnisbericht"
                        : "results report"
                      : de
                        ? "kein Ergebnisbericht"
                        : "no results report",
                    preview.summary.withAudio
                      ? de
                        ? "mit Interview-Aufnahmen"
                        : "with interview recordings"
                      : de
                        ? "ohne Interview-Aufnahmen"
                        : "without interview recordings",
                  ].join(" · ")}
                </dd>
              </div>
            </dl>
            <p className="flex items-start gap-1.5 font-medium" style={{ color: ERROR_COLOR }}>
              <AlertTriangle size={14} className="mt-px shrink-0" aria-hidden />
              <span>
                {de
                  ? `Einlesen ersetzt den aktuellen Stand (${countLine(current)}) vollständig. Das lässt sich nicht rückgängig machen.`
                  : `Restoring replaces the current state (${countLine(current)}) completely. This cannot be undone.`}
              </span>
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={doApply}
                disabled={busy !== null}
                className={BTN}
                style={{ background: "var(--workshop-accent)", color: "white" }}
              >
                {busy === "apply" ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                {de ? "Einlesen und ersetzen" : "Restore and replace"}
              </button>
              <button type="button" onClick={() => setPreview(null)} disabled={busy !== null} className={BTN} style={outline}>
                {de ? "Abbrechen" : "Cancel"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ---------------------------------------------------------- reset */}
      <div className="space-y-2 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
        <div className={subHead} style={{ color: ERROR_COLOR }}>
          {de ? "Alles zurücksetzen" : "Reset everything"}
        </div>
        <p className="text-xs leading-snug" style={muted}>
          {de
            ? "Leert dieses Gerät für einen neuen Durchlauf. API-Schlüssel, Anmeldung, Sprache und Design bleiben dabei erhalten."
            : "Empties this device for a fresh run. API keys, login, language and theme are kept."}
        </p>
        {!confirmReset && (
          <button
            type="button"
            onClick={() => {
              clearNotices();
              setConfirmReset(true);
            }}
            disabled={busy !== null}
            className={BTN}
            style={{ border: `1px solid ${ERROR_COLOR}`, color: ERROR_COLOR, background: "var(--bg)" }}
          >
            <Trash2 size={16} />
            {de ? "Alles zurücksetzen" : "Reset everything"}
          </button>
        )}

        {confirmReset && (
          <div
            className="rounded-md p-3 space-y-2.5 text-xs"
            style={{ background: "var(--bg)", border: `1px dashed ${ERROR_COLOR}` }}
            role="alertdialog"
            aria-labelledby="reset-confirm-heading"
            data-testid="reset-confirm"
          >
            <p id="reset-confirm-heading" className="flex items-start gap-1.5 font-semibold" style={{ color: ERROR_COLOR }}>
              <AlertTriangle size={14} className="mt-px shrink-0" aria-hidden />
              <span>
                {de
                  ? `Wirklich alle Inhalte löschen? (${countLine(current)})`
                  : `Really delete all content? (${countLine(current)})`}
              </span>
            </p>
            <ul className="list-disc pl-5 space-y-0.5" style={muted}>
              {(de
                ? [
                    "alle Beiträge der Folien und das Protokoll",
                    "alle Interviews samt Aufnahmen, Transkripten und Meinungsbildern",
                    "Posterfassungen und hochgeladene Bilder",
                    "Glossarbegriffe und den KI-Ergebnisbericht",
                  ]
                : [
                    "all slide contributions and the record",
                    "all interviews including recordings, transcripts and opinion pictures",
                    "poster versions and uploaded images",
                    "glossary terms and the AI results report",
                  ]
              ).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <label className="flex items-start gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={backupFirst}
                onChange={(e) => setBackupFirst(e.target.checked)}
                className={`${checkbox} mt-0.5`}
              />
              <span>{de ? "Vorher Sicherung herunterladen" : "Download a backup first"}</span>
            </label>
            <label className="flex items-start gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={alsoKeys}
                onChange={(e) => setAlsoKeys(e.target.checked)}
                className={`${checkbox} mt-0.5`}
                data-testid="reset-also-keys"
              />
              <span>
                {de ? "Auch API-Schlüssel und Anmeldung entfernen" : "Also remove API keys and login"}
                <span style={muted}>
                  {de
                    ? " — nur nach dem Workshop; danach muss beides neu eingegeben werden."
                    : " — only after the workshop; both have to be entered again afterwards."}
                </span>
              </span>
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={doReset}
                disabled={busy !== null}
                className={BTN}
                style={{ background: ERROR_COLOR, color: "white" }}
                data-testid="reset-confirm-button"
              >
                {busy === "reset" ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                {de ? "Endgültig zurücksetzen" : "Reset permanently"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                disabled={busy !== null}
                className={BTN}
                style={outline}
              >
                {de ? "Abbrechen" : "Cancel"}
              </button>
            </div>
          </div>
        )}
      </div>

      {done && <Notice tone="ok">{done}</Notice>}
      {error && <Notice tone="error">{error}</Notice>}
    </section>
  );
}

/**
 * Central place for the two AI keys and for backing up or clearing the
 * workshop content. Both used to be reachable only from inside the protocol
 * and interview pages, which facilitators could not find.
 */
export function Settings() {
  const [lang] = useLang();
  const de = lang === "de";
  const navigate = useNavigate();
  const canGoBack = ((window.history.state as { idx?: number } | null)?.idx ?? 0) > 0;
  const goBack = () => (canGoBack ? navigate(-1) : navigate(lastSlidePath()));

  const facts = de
    ? [
        ["Claude-Key (Anthropic)", "Für Glätten und Umformulieren im Protokoll, den Ergebnisbericht, die Meinungsbilder der Interviews und das Verdichten der Poster. Erstellen unter console.anthropic.com → API Keys (beginnt mit „sk-ant-“)."],
        ["OpenAI-Key", "Nur für die Transkription der Interview-Aufnahmen. Erstellen unter platform.openai.com → API keys (beginnt mit „sk-“)."],
        ["Wo sie gespeichert werden", "Nur in diesem Browser auf diesem Gerät, nie auf einem Server und nie im Code. Sie bleiben über Updates der App hinweg erhalten, bis ihr sie hier entfernt oder die Browserdaten löscht. Im privaten Fenster gehen sie beim Schließen verloren."],
        ["Wo die Workshop-Inhalte liegen", "Genauso lokal: Beiträge, Interviews, Poster, Glossar und Bericht bleiben in diesem Browser, auch wenn Tab und Browser geschlossen werden und über App-Updates hinweg. Sie gehen verloren, wenn die Browserdaten gelöscht werden, im privaten Fenster gearbeitet wird oder das Gerät bzw. der Browser wechselt — deshalb am Ende jedes Tages eine Sicherung herunterladen."],
        ["Zweiter Rechner", "Jeder Rechner, auf dem transkribiert oder zusammengefasst wird, braucht die Keys separat. Ein Rechner, der nur aufnimmt und exportiert, braucht keine."],
        ["Nach dem Workshop", "Keys hier entfernen und in der jeweiligen Console sperren oder neu erzeugen. Tipp: einen eigenen Workspace mit Ausgabelimit nur für den Workshop anlegen."],
      ]
    : [
        ["Claude key (Anthropic)", "For polishing and rewording in the record, the results report, the interview opinion pictures and condensing posters. Create it at console.anthropic.com → API Keys (starts with “sk-ant-”)."],
        ["OpenAI key", "Only for transcribing interview recordings. Create it at platform.openai.com → API keys (starts with “sk-”)."],
        ["Where they are stored", "Only in this browser on this device, never on a server and never in the code. They survive app updates until you remove them here or clear the browser data. In a private window they are lost when it closes."],
        ["Where the workshop content lives", "Just as locally: contributions, interviews, posters, glossary and report stay in this browser, also when tab and browser are closed and across app updates. They are lost when the browser data is cleared, when working in a private window or when the device or browser changes — so download a backup at the end of every day."],
        ["Second computer", "Every computer that transcribes or summarises needs the keys separately. A computer that only records and exports needs none."],
        ["After the workshop", "Remove the keys here and revoke or rotate them in the respective console. Tip: create a dedicated workspace with a spending limit just for the workshop."],
      ];

  return (
    <div style={{ background: "var(--bg)", color: "var(--fg)", minHeight: "100svh" }}>
      <header
        className="sticky top-0 z-10 flex items-center gap-2 sm:gap-3 px-4 sm:px-6 border-b"
        style={{ height: "var(--header-height)", background: "var(--bg)", color: "var(--fg)", borderColor: "var(--border)" }}
      >
        <button
          type="button"
          onClick={goBack}
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
        <div className="ml-auto text-sm font-semibold">{de ? "Einstellungen" : "Settings"}</div>
      </header>

      <main className="max-w-3xl mx-auto px-5 sm:px-8 py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-semibold mb-2" style={{ color: "var(--workshop-accent)" }}>
            {de ? "Einstellungen" : "Settings"}
          </h1>
          <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
            {de
              ? "Hier tragt ihr die beiden API-Keys einmal pro Gerät ein und sichert den Stand des Workshops. Ohne Keys funktioniert die App vollständig, nur die KI-Funktionen sind dann aus."
              : "Enter the two API keys here once per device and back up the state of the workshop. Without keys the app works fully, only the AI features are off."}
          </p>
        </div>

        {/* Status first: whether a key is stored, and on request whether it really works. */}
        <section className="space-y-2">
          <ApiKeyStatus provider="anthropic" lang={lang} />
          <ApiKeyStatus provider="openai" lang={lang} />
        </section>

        <InterviewSetup lang={lang} />

        <BackupSection lang={lang} />

        <section
          className="rounded-lg p-4 space-y-3 text-sm"
          style={{ background: "var(--bg-elev)", border: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-2 font-semibold">
            <Info size={16} style={{ color: "var(--workshop-accent)" }} />
            {de ? "Gut zu wissen" : "Good to know"}
          </div>
          <dl className="space-y-2.5">
            {facts.map(([term, text]) => (
              <div key={term}>
                <dt className="font-medium">{term}</dt>
                <dd style={{ color: "var(--fg-muted)" }}>{text}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>
    </div>
  );
}
