import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "react-router-dom";
import { AlertTriangle, FileDown, FolderSync, Loader2, X } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { MANIFEST } from "@/lib/manifest";
import { downloadBackup } from "@/lib/backup";
import { describeProblem, regrantFolder, startAutoBackup, useAutoBackup, type Problem } from "@/lib/auto-backup";
import { Tooltip } from "@/components/ui/Tooltip";
import { ERROR_COLOR, formatBytes } from "@/components/interviews/ui";

/**
 * Runs the automatic backups on every route and shows their few notices in
 * the bottom-left corner: re-granting the backup folder after a browser
 * restart, a failed backup, and the end-of-day reminder. Nothing here ever
 * blocks the page; every notice can be closed.
 */

/** Last slide of the last module of each workshop day — derived from the manifest ("Tag 1 · …"). */
const DAY_END_SLIDES: ReadonlySet<string> = (() => {
  const lastByDay = new Map<string, string>();
  for (const m of MANIFEST) {
    const day = /^Tag\s+(\d+)/.exec(m.description?.de ?? "")?.[1];
    const last = m.slides[m.slides.length - 1];
    if (day && last) lastByDay.set(day, last.id);
  }
  return new Set(lastByDay.values());
})();

const REMINDER_KEY = "verbands-ceo.autobackup.reminder.v1";
/** "Later" on the folder hint: back after an hour, so the folder is not forgotten for the whole day. */
const REGRANT_SNOOZE_MS = 60 * 60 * 1000;

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function readReminderDay(): string | null {
  try {
    return window.localStorage.getItem(REMINDER_KEY);
  } catch {
    return null;
  }
}

function rememberReminderDay() {
  try {
    window.localStorage.setItem(REMINDER_KEY, today());
  } catch (err) {
    console.error("[auto-backup] remembering the reminder failed", err);
  }
}

const CARD = {
  background: "var(--bg-elev)",
  color: "var(--fg)",
  border: "1px solid var(--border)",
  boxShadow: "0 8px 24px color-mix(in oklch, var(--fg) 14%, transparent)",
} as const;

function CloseButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="size-7 shrink-0 grid place-items-center rounded-md transition-colors hover:bg-[color-mix(in_oklch,var(--fg)_10%,transparent)]"
      style={{ color: "var(--fg-muted)" }}
      aria-label={label}
    >
      <X size={14} strokeWidth={2.25} />
    </button>
  );
}

export function AutoBackup() {
  const [lang] = useLang();
  const de = lang === "de";
  const { pathname } = useLocation();
  const st = useAutoBackup();

  useEffect(() => {
    startAutoBackup();
  }, []);

  /* ------------------------------------------------ end-of-day reminder */
  const [reminder, setReminder] = useState(false);
  const [reminderBusy, setReminderBusy] = useState(false);
  const [reminderDone, setReminderDone] = useState("");
  const [reminderError, setReminderError] = useState("");

  const slideId = /^\/[sp]\/([^/?#]+)/.exec(pathname)?.[1];
  useEffect(() => {
    if (!slideId || !DAY_END_SLIDES.has(slideId)) return;
    if (readReminderDay() === today()) return;
    // Once per day: counted when it appears, it stays until closed.
    rememberReminderDay();
    setReminderDone("");
    setReminderError("");
    setReminder(true);
  }, [slideId]);

  async function downloadNow() {
    setReminderBusy(true);
    setReminderError("");
    try {
      const { fileName, bytes } = await downloadBackup({ includeAudio: true });
      setReminderDone(
        de
          ? `Heruntergeladen: ${fileName} (${formatBytes(bytes, lang)}). Am besten zusätzlich auf einen USB-Stick kopieren.`
          : `Downloaded: ${fileName} (${formatBytes(bytes, lang)}). Best copy it to a USB stick as well.`,
      );
    } catch (err) {
      console.error("[auto-backup] end-of-day download failed", err);
      setReminderError(
        de
          ? "Die Sicherung ließ sich nicht erstellen. Bitte in den Einstellungen ohne Aufnahmen herunterladen."
          : "The backup could not be created. Please download it without recordings in the settings.",
      );
    } finally {
      setReminderBusy(false);
    }
  }

  /* ---------------------------------------------------- folder re-grant */
  const [snoozedUntil, setSnoozedUntil] = useState(0);
  const [regrantBusy, setRegrantBusy] = useState(false);
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!snoozedUntil) return;
    const t = window.setTimeout(() => setTick((n) => n + 1), Math.max(0, snoozedUntil - Date.now()) + 50);
    return () => window.clearTimeout(t);
  }, [snoozedUntil]);

  /* ------------------------------------------------------------ problems */
  const [dismissed, setDismissed] = useState<string[]>([]);

  const onSettings = pathname.startsWith("/einstellungen");
  // Nothing on paper, and nothing on the projector in front of the room: a reminder
  // raised in presentation mode waits and shows once the working view is back.
  if (pathname.startsWith("/print") || pathname.startsWith("/p/")) return null;

  const needsRegrant = Boolean(st.folder && st.folder.permission === "prompt") && Date.now() >= snoozedUntil && !onSettings;
  const problems = [st.snapshotProblem, st.folderProblem].filter(
    (p): p is Problem => Boolean(p) && p?.kind !== "folder-permission" && !dismissed.includes(`${p?.kind}@${p?.at}`),
  );
  const showProblems = !onSettings && problems.length > 0;

  if (!reminder && !needsRegrant && !showProblems) return null;

  // Above the slide footer on slides, otherwise close to the edge.
  const bottom = /^\/s\//.test(pathname) ? "calc(var(--footer-height) + 12px)" : "16px";

  return createPortal(
    <div
      data-testid="auto-backup-notices"
      className="no-print fixed left-3 z-40 flex flex-col items-start gap-2"
      style={{ bottom, maxWidth: "min(360px, calc(100vw - 24px))" }}
    >
      {showProblems &&
        problems.map((p) => (
          <div
            key={`${p.kind}@${p.at}`}
            role="alert"
            data-testid="auto-backup-problem"
            className="flex items-start gap-2 rounded-lg pl-3 pr-1.5 py-2 text-xs leading-snug"
            style={{ ...CARD, borderColor: ERROR_COLOR }}
          >
            <AlertTriangle size={15} className="mt-px shrink-0" style={{ color: ERROR_COLOR }} aria-hidden />
            <div className="space-y-1">
              <p>{describeProblem(p, lang)}</p>
              <Link to="/einstellungen" className="font-semibold" style={{ color: "var(--workshop-accent)" }}>
                {de ? "Zu den Einstellungen" : "Open settings"}
              </Link>
            </div>
            <CloseButton
              label={de ? "Hinweis schließen" : "Close notice"}
              onClick={() => setDismissed((d) => [...d, `${p.kind}@${p.at}`])}
            />
          </div>
        ))}

      {needsRegrant && st.folder && (
        <div
          data-testid="auto-backup-regrant"
          className="flex items-center gap-1 rounded-full pl-1 pr-1 py-1 text-xs"
          style={CARD}
        >
          <Tooltip
            content={
              de
                ? `Nach einem Neustart fragt der Browser einmal nach, ob die App weiter in den Sicherungsordner${st.folder.name ? ` „${st.folder.name}“` : ""} schreiben darf. Bis dahin sichert sie nur im Browser.`
                : `After a restart the browser asks once whether the app may keep writing to the backup folder${st.folder.name ? ` “${st.folder.name}”` : ""}. Until then it only backs up inside the browser.`
            }
          >
          <button
            type="button"
            disabled={regrantBusy}
            onClick={async () => {
              setRegrantBusy(true);
              try {
                await regrantFolder();
              } finally {
                setRegrantBusy(false);
              }
            }}
            className="inline-flex items-center gap-1.5 h-7 pl-2 pr-2.5 rounded-full font-semibold transition-colors hover:bg-[color-mix(in_oklch,var(--workshop-accent)_12%,transparent)] disabled:opacity-60"
            style={{ color: "var(--workshop-accent)" }}
          >
            {regrantBusy ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <FolderSync size={14} aria-hidden />}
            {de ? "Sicherungsordner wieder freigeben" : "Re-allow backup folder"}
          </button>
          </Tooltip>
          <CloseButton
            label={de ? "Später erinnern (in einer Stunde)" : "Remind me later (in an hour)"}
            onClick={() => setSnoozedUntil(Date.now() + REGRANT_SNOOZE_MS)}
          />
        </div>
      )}

      {reminder && (
        <div
          role="status"
          data-testid="auto-backup-reminder"
          className="rounded-lg p-3 pr-1.5 text-xs leading-snug flex items-start gap-2"
          style={{ ...CARD, borderColor: "var(--workshop-accent)" }}
        >
          <FileDown size={16} className="mt-px shrink-0" style={{ color: "var(--workshop-accent)" }} aria-hidden />
          <div className="space-y-2 min-w-0">
            <div className="text-sm font-semibold">{de ? "Tagesende: Sicherung als Datei" : "End of day: backup file"}</div>
            {!reminderDone && (
              <p style={{ color: "var(--fg-muted)" }}>
                {de
                  ? "Die App sichert laufend im Browser. Zum Tagesende zusätzlich alles als Datei mitnehmen, inklusive Interview-Aufnahmen."
                  : "The app keeps backing up inside the browser. At the end of the day, also take everything along as a file, including interview recordings."}
              </p>
            )}
            {reminderDone && <p data-testid="auto-backup-reminder-done">{reminderDone}</p>}
            {reminderError && (
              <p role="alert" style={{ color: ERROR_COLOR }}>
                {reminderError}
              </p>
            )}
            {!reminderDone && (
              <button
                type="button"
                onClick={downloadNow}
                disabled={reminderBusy}
                data-testid="auto-backup-reminder-download"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold disabled:opacity-60"
                style={{ background: "var(--workshop-accent)", color: "white" }}
              >
                {reminderBusy ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <FileDown size={14} aria-hidden />}
                {de ? "Sicherung jetzt herunterladen" : "Download backup now"}
              </button>
            )}
          </div>
          <CloseButton label={de ? "Erinnerung schließen" : "Close reminder"} onClick={() => setReminder(false)} />
        </div>
      )}
    </div>,
    document.body,
  );
}
