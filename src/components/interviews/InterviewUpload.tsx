import { useRef, useState, type DragEvent } from "react";
import { FileAudio, Loader2, Upload, X } from "lucide-react";
import type { Lang } from "@/types/slide";
import { newInterviewId, saveInterview, type Interview } from "@/lib/interview-store";
import { DOWNLOAD_GAP_MS, autoSaveInterviewAudio, wait } from "@/lib/auto-export";
import { ACCEPT_ATTRIBUTE, MAX_AUDIO_BYTES, fileExtension, isAcceptedAudioName } from "@/lib/transcribe";
import { BTN, ERROR_COLOR, Notice, card, field, formatBytes, muted, outline, primary } from "./ui";
import { Tooltip } from "@/components/ui/Tooltip";

interface Staged {
  key: string;
  file: File;
  pseudonym: string;
  error?: string;
}

const MIME_BY_EXT: Record<string, string> = {
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  wav: "audio/wav",
  webm: "audio/webm",
  ogg: "audio/ogg",
};

/** Best-effort duration from the file's metadata; undefined when the browser can't tell. */
function probeDuration(blob: Blob): Promise<number | undefined> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio();
    const done = (value: number | undefined) => {
      window.clearTimeout(timer);
      URL.revokeObjectURL(url);
      resolve(value);
    };
    const timer = window.setTimeout(() => done(undefined), 4000);
    audio.preload = "metadata";
    audio.onloadedmetadata = () => done(Number.isFinite(audio.duration) ? Math.round(audio.duration) : undefined);
    audio.onerror = () => done(undefined);
    audio.src = url;
  });
}

function validate(file: File, lang: Lang): string | undefined {
  const de = lang === "de";
  if (!isAcceptedAudioName(file.name)) {
    return de ? "Dateityp nicht unterstützt (erlaubt: mp3, m4a, wav, webm, ogg)." : "File type not supported (allowed: mp3, m4a, wav, webm, ogg).";
  }
  if (file.size === 0) return de ? "Die Datei ist leer." : "The file is empty.";
  if (file.size > MAX_AUDIO_BYTES) {
    return de
      ? "Größer als 25 MB – zu groß für die Transkription. Bitte kürzen oder als komprimiertes mp3 speichern."
      : "Larger than 25 MB – too large for transcription. Please shorten it or save as a compressed mp3.";
  }
  return undefined;
}

export function InterviewUpload({
  lang,
  nextNumber,
  onShowList,
}: {
  lang: Lang;
  nextNumber: number;
  onShowList: () => void;
}) {
  const de = lang === "de";
  const [staged, setStaged] = useState<Staged[]>([]);
  const [consent, setConsent] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const valid = staged.filter((s) => !s.error);

  function addFiles(list: FileList | File[]) {
    setNotice("");
    setError("");
    setStaged((prev) => {
      let n = nextNumber + prev.filter((s) => !s.error).length;
      const added = Array.from(list).map((file) => {
        const err = validate(file, lang);
        return {
          key: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 7)}`,
          file,
          pseudonym: err ? "" : `Teilnehmer ${n++}`,
          error: err,
        };
      });
      return [...prev, ...added];
    });
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  }

  /** With auto-save on, uploads land in the backup folder too; spaced, because Chrome drops rapid downloads. */
  async function autoSaveAll(list: Interview[]) {
    for (const [i, iv] of list.entries()) {
      if (i > 0) await wait(DOWNLOAD_GAP_MS);
      await autoSaveInterviewAudio(iv);
    }
  }

  async function importAll() {
    if (!consent || !valid.length || busy) return;
    setBusy(true);
    setError("");
    let done = 0;
    const failed: Staged[] = [];
    const added: Interview[] = [];
    for (const s of valid) {
      const ext = fileExtension(s.file.name);
      const mimeType = s.file.type || MIME_BY_EXT[ext] || "application/octet-stream";
      try {
        const durationSec = await probeDuration(s.file);
        const interview: Interview = {
          id: newInterviewId(),
          pseudonym: s.pseudonym.trim() || `Teilnehmer ${nextNumber + done}`,
          source: "uploaded",
          createdAt: new Date().toISOString(),
          consentAt: new Date().toISOString(),
          fileName: s.file.name,
          mimeType,
          size: s.file.size,
          durationSec,
          // Store a plain Blob: the File's name and timestamps are not needed.
          audio: s.file.slice(0, s.file.size, mimeType),
          markers: [],
        };
        await saveInterview(interview);
        added.push(interview);
        done++;
      } catch (err) {
        console.error("[interview-upload] saving failed", { file: s.file.name, size: s.file.size, err });
        failed.push(s);
      }
    }
    setBusy(false);
    void autoSaveAll(added);
    setStaged((prev) => prev.filter((s) => s.error || failed.includes(s)));
    if (done) {
      setNotice(de ? `${done} ${done === 1 ? "Interview" : "Interviews"} übernommen.` : `${done} ${done === 1 ? "interview" : "interviews"} added.`);
      setConsent(false);
    }
    if (failed.length) {
      setError(
        de
          ? `${failed.length} ${failed.length === 1 ? "Datei konnte" : "Dateien konnten"} nicht gespeichert werden (Speicher voll oder blockiert).`
          : `${failed.length} ${failed.length === 1 ? "file" : "files"} could not be saved (storage full or blocked).`,
      );
    }
  }

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className="rounded-lg p-6 sm:p-8 text-center"
        style={{
          border: `2px dashed ${dragOver ? "var(--workshop-accent)" : "var(--border)"}`,
          background: dragOver ? "color-mix(in oklch, var(--workshop-accent) 6%, var(--bg))" : "var(--bg-elev)",
        }}
      >
        <Upload size={28} className="mx-auto mb-2" style={{ color: "var(--workshop-accent)" }} />
        <p className="text-sm font-medium">{de ? "Audiodateien hierher ziehen" : "Drag audio files here"}</p>
        <p className="text-xs mt-1 mb-3" style={muted}>
          {de ? "mp3, m4a, wav, webm oder ogg · max. 25 MB pro Datei · mehrere möglich" : "mp3, m4a, wav, webm or ogg · max. 25 MB per file · multiple allowed"}
        </p>
        <button type="button" onClick={() => inputRef.current?.click()} className={BTN} style={outline}>
          <FileAudio size={16} /> {de ? "Dateien auswählen" : "Choose files"}
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT_ATTRIBUTE}
          className="hidden"
          data-testid="interview-file-input"
          onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {staged.length > 0 && (
        <div className="space-y-2">
          {staged.map((s) => (
            <div key={s.key} className="rounded-md p-2.5 flex flex-wrap items-center gap-2" style={card}>
              <FileAudio size={16} className="shrink-0" style={muted} />
              <div className="min-w-0 flex-1 basis-40">
                <div className="text-sm truncate" title={s.file.name}>
                  {s.file.name}
                </div>
                <div className="text-[11px]" style={s.error ? { color: ERROR_COLOR } : muted}>
                  {s.error ?? formatBytes(s.file.size, lang)}
                </div>
              </div>
              {!s.error && (
                <input
                  type="text"
                  value={s.pseudonym}
                  maxLength={60}
                  aria-label={de ? `Pseudonym für ${s.file.name}` : `Pseudonym for ${s.file.name}`}
                  onChange={(e) => setStaged((prev) => prev.map((p) => (p.key === s.key ? { ...p, pseudonym: e.target.value } : p)))}
                  className="rounded-md p-1.5 text-sm w-full sm:w-48"
                  style={field}
                />
              )}
              <Tooltip content={de ? "Datei aus der Auswahl entfernen, nichts wird gelöscht" : "Remove the file from the selection, nothing is deleted"}>
                <button
                  type="button"
                  onClick={() => setStaged((prev) => prev.filter((p) => p.key !== s.key))}
                  className="size-8 grid place-items-center rounded-md shrink-0"
                  style={outline}
                  aria-label={de ? "Entfernen" : "Remove"}
                >
                  <X size={14} />
                </button>
              </Tooltip>
            </div>
          ))}

          <label className="flex items-start gap-2.5 rounded-md p-3 text-sm cursor-pointer" style={card}>
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 size-4 shrink-0 accent-[var(--workshop-accent)]"
            />
            <span className="leading-snug">
              <strong>{de ? "Einwilligung bestätigen: " : "Confirm consent: "}</strong>
              {de
                ? "Die befragten Personen haben der Aufnahme und der Verarbeitung zugestimmt (Speicherung auf diesem Gerät, Transkription über OpenAI, Zusammenfassung über Anthropic, Löschung nach dem Workshop)."
                : "The interviewees agreed to the recording and its processing (storage on this device, transcription via OpenAI, summarisation via Anthropic, deletion after the workshop)."}
            </span>
          </label>

          <button type="button" onClick={importAll} disabled={!consent || !valid.length || busy} className={BTN} style={primary}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            {de
              ? `${valid.length} ${valid.length === 1 ? "Datei" : "Dateien"} übernehmen`
              : `Add ${valid.length} ${valid.length === 1 ? "file" : "files"}`}
          </button>
        </div>
      )}

      {notice && (
        <Notice tone="ok">
          {notice}{" "}
          <button type="button" onClick={onShowList} className="underline font-medium">
            {de ? "Zu den Meinungsbildern" : "Go to opinion pictures"}
          </button>
        </Notice>
      )}
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  );
}
