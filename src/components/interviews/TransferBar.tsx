import { useRef, useState } from "react";
import { FileDown, FileUp, Loader2, Trash2 } from "lucide-react";
import type { Lang } from "@/types/slide";
import {
  InterviewImportError,
  deleteAllAudio,
  exportInterviews,
  importInterviews,
  updateInterview,
  type Interview,
} from "@/lib/interview-store";
import { writeInterviewToProtocol } from "@/lib/interview-opinion";
import { downloadFile } from "@/lib/workshop-store";
import { BTN, Notice, card, danger, muted, outline } from "./ui";
import { Tooltip } from "@/components/ui/Tooltip";

/** Generous cap: 20 five-minute interviews with audio stay far below it. */
const MAX_IMPORT_BYTES = 300 * 1024 * 1024;

/** Hand-over between devices (side-room laptop → moderation laptop) and audio clean-up. */
export function TransferBar({ interviews, lang }: { interviews: Interview[]; lang: Lang }) {
  const de = lang === "de";
  const [includeAudio, setIncludeAudio] = useState(false);
  const [busy, setBusy] = useState<"export" | "import" | "audio" | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const audioCount = interviews.filter((iv) => iv.audio).length;

  function reset() {
    setNotice("");
    setError("");
  }

  async function doExport() {
    reset();
    setBusy("export");
    try {
      const json = await exportInterviews(includeAudio);
      const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
      downloadFile(`ki-interviews-${stamp}${includeAudio ? "-mit-audio" : ""}.json`, json, "application/json");
      setNotice(
        de
          ? `${interviews.length} Interviews exportiert${includeAudio ? " (mit Audio)" : ""}. Die Datei auf dem Moderationsrechner importieren.`
          : `${interviews.length} interviews exported${includeAudio ? " (with audio)" : ""}. Import the file on the facilitator's computer.`,
      );
    } catch (err) {
      console.error("[interviews] export failed", { includeAudio, err });
      setError(de ? "Der Export ist fehlgeschlagen. Bitte ohne Audio erneut versuchen." : "Export failed. Please retry without audio.");
    } finally {
      setBusy(null);
    }
  }

  async function doImport(file: File) {
    reset();
    if (file.size > MAX_IMPORT_BYTES) {
      setError(de ? "Die Datei ist zu groß für den Import (max. 300 MB)." : "The file is too large to import (max. 300 MB).");
      return;
    }
    setBusy("import");
    try {
      const { added, skipped } = await importInterviews(await file.text());
      // Imported opinions are finished results: they belong in this device's protocol right away.
      const withOpinion = added.filter((iv) => iv.opinion?.trim());
      for (const iv of withOpinion) await updateInterview(iv.id, writeInterviewToProtocol(iv));
      setNotice(
        de
          ? `${added.length} importiert, ${skipped} übersprungen (bereits vorhanden oder ungültig).${withOpinion.length ? ` ${withOpinion.length} Meinungsbilder stehen jetzt im Protokoll.` : ""}`
          : `${added.length} imported, ${skipped} skipped (already present or invalid).${withOpinion.length ? ` ${withOpinion.length} opinion pictures are now in the record.` : ""}`,
      );
    } catch (err) {
      if (err instanceof InterviewImportError) {
        setError(
          err.message === "not-json"
            ? de
              ? "Die Datei ist keine gültige JSON-Datei."
              : "The file is not valid JSON."
            : de
              ? "Das ist keine Interview-Exportdatei dieser App."
              : "This is not an interview export file from this app.",
        );
      } else {
        console.error("[interviews] import failed", { file: file.name, size: file.size, err });
        setError(de ? "Der Import ist fehlgeschlagen (Speicher voll oder blockiert?)." : "Import failed (storage full or blocked?).");
      }
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function doDeleteAudio() {
    reset();
    if (
      !window.confirm(
        de
          ? `Alle ${audioCount} Audiodateien auf diesem Gerät endgültig löschen? Transkripte und Meinungsbilder bleiben erhalten.`
          : `Permanently delete all ${audioCount} audio files on this device? Transcripts and opinion pictures are kept.`,
      )
    ) {
      return;
    }
    setBusy("audio");
    try {
      const n = await deleteAllAudio();
      setNotice(de ? `${n} Audiodateien gelöscht.` : `${n} audio files deleted.`);
    } catch (err) {
      console.error("[interviews] deleting audio failed", err);
      setError(de ? "Die Audiodaten konnten nicht gelöscht werden." : "The audio data could not be deleted.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="rounded-md p-3 sm:p-4 space-y-3" style={card} aria-label={de ? "Export und Import" : "Export and import"}>
      <div className="text-sm font-semibold">{de ? "Zwischen Rechnern übertragen" : "Transfer between computers"}</div>
      <p className="text-xs leading-snug" style={muted}>
        {de
          ? "Jeder Rechner speichert nur lokal. Interviews aus dem Nebenraum exportieren und auf dem Moderationsrechner importieren; vorhandene Interviews werden dabei übersprungen."
          : "Each computer stores locally only. Export interviews from the side room and import them on the facilitator's computer; existing interviews are skipped."}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Tooltip
          content={
            de
              ? "Alle Interviews dieses Rechners als Datei sichern, um sie auf dem Moderationsrechner zu importieren"
              : "Save all interviews on this computer as a file to import them on the facilitator's computer"
          }
        >
          <button type="button" onClick={doExport} disabled={busy !== null || !interviews.length} className={BTN} style={outline}>
            {busy === "export" ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />}
            {de ? "Interviews exportieren" : "Export interviews"}
          </button>
        </Tooltip>
        <Tooltip
          content={
            de
              ? "Audio mitexportieren: nötig, wenn erst auf dem anderen Rechner transkribiert wird. Die Datei wird dadurch deutlich größer."
              : "Include audio: needed if transcription happens on the other computer. The file gets considerably larger."
          }
        >
          <label className="inline-flex items-center gap-1.5 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={includeAudio}
              onChange={(e) => setIncludeAudio(e.target.checked)}
              className="size-4 accent-[var(--workshop-accent)]"
            />
            {de ? "inkl. Audio" : "incl. audio"}
          </label>
        </Tooltip>
        <Tooltip
          content={
            de
              ? "Exportdatei eines anderen Rechners einlesen. Bereits vorhandene Interviews werden übersprungen."
              : "Read in an export file from another computer. Interviews already present are skipped."
          }
        >
          <button type="button" onClick={() => fileRef.current?.click()} disabled={busy !== null} className={BTN} style={outline}>
            {busy === "import" ? <Loader2 size={16} className="animate-spin" /> : <FileUp size={16} />}
            {de ? "Interviews importieren" : "Import interviews"}
          </button>
        </Tooltip>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          data-testid="interview-import-input"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void doImport(f);
          }}
        />
        <Tooltip
          content={
            de
              ? "Löscht nur die Aufnahmen, Transkripte und Meinungsbilder bleiben. Empfohlen nach dem Workshop aus Datenschutzgründen."
              : "Deletes the recordings only; transcripts and opinion pictures stay. Recommended after the workshop for data protection."
          }
        >
          <button
            type="button"
            onClick={doDeleteAudio}
            disabled={busy !== null || audioCount === 0}
            className={`${BTN} sm:ml-auto`}
            style={danger}
          >
            {busy === "audio" ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
            {de ? `Alle Audiodaten löschen (${audioCount})` : `Delete all audio (${audioCount})`}
          </button>
        </Tooltip>
      </div>
      {notice && <Notice tone="ok">{notice}</Notice>}
      {error && <Notice tone="error">{error}</Notice>}
    </section>
  );
}
