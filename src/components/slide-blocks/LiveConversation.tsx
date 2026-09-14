import { useEffect, useRef, useState } from "react";
import { AudioLines, Check, Download, Loader2, Mic, MicOff, PhoneOff, Play } from "lucide-react";
import type { Lang } from "@/types/slide";
import { useLang } from "@/lib/i18n";
import { useOpenAiKey } from "@/lib/transcribe";
import { describeAiError, useApiKey } from "@/lib/ai-assist";
import { LIVE_PRICE_PER_MINUTE_USD, LiveError, startLiveSession, type CloseReason, type LiveController, type LiveErrorCode, type TranscriptFragment } from "@/lib/live-session";
import { cleanTranscript, removedLabel, type CleanResult } from "@/lib/transcript-filter";
import { getEntry, setEntry } from "@/lib/workshop-store";
import { localDateStamp } from "@/lib/local-date";
import { BTN, ERROR_COLOR, Notice, downloadBlob, muted, outline, primary } from "@/components/interviews/ui";

interface Role {
  id: string;
  label: { de: string; en: string };
  /** What the room does in this role-play */
  setup: { de: string; en: string };
  instructions: string;
  greeting: string;
}

const COMMON = `Sprich ausschließlich Deutsch, natürlich und in ruhigem Tempo, in kurzen Sätzen wie am Telefon.
Dies ist ein Rollenspiel in einem Workshop des Fachverbands Betonbohren und -sägen Deutschland e. V. (FBS). Die Anwesenden erleben, wie ein Gespräch mit einer KI heute klingt, und bewerten es danach gemeinsam.
Erfinde keine Fakten über den FBS: keine Beschlüsse, Zahlen, Preise, Termine, Normstellen oder Namen. Wenn du etwas nicht sicher weißt, sag das offen und nenne, was geprüft werden müsste.
Frage nicht nach persönlichen Daten. Wenn jemand Vertrauliches oder Persönliches erzählt, lenke freundlich zurück zum Thema.
Backchannel policy: Verwende sparsame, natürliche Rückmeldesignale, ohne der anderen Seite ins Wort zu fallen.
Interruption policy: Wenn dich jemand unterbricht, hör sofort auf zu sprechen und hör zu.
Keep listening while the user pauses to think. Do not treat a cough, laughter or side conversations in the room as a new request.
Delegation policy: Es gibt keine Werkzeuge und keinen Zugriff auf Unterlagen. Delegiere nie.`;

const ROLES: Role[] = [
  {
    id: "geschaeftsstelle",
    label: { de: "KI nimmt eine Mitgliederanfrage an", en: "AI takes a member's enquiry" },
    setup: {
      de: "Eine Person aus der Runde ruft als Mitgliedsbetrieb in der Geschäftsstelle an, zum Beispiel mit einer Frage zu einem Seminar, zu Arbeitsschutz oder zu einem Merkblatt. Die KI antwortet.",
      en: "Someone from the room calls the office as a member company, for example with a question about a seminar, occupational safety or a guidance note. The AI answers.",
    },
    instructions: `${COMMON}
Deine Rolle: Du bist eine digitale Assistenz, die in der Geschäftsstelle des FBS Anrufe von Mitgliedsbetrieben entgegennimmt. Du hast keinen Zugriff auf Verbandsunterlagen und antwortest nur aus Allgemeinwissen. Hilf, so gut es ehrlich geht, fasse das Anliegen zusammen und sag klar, was die Geschäftsführung klären oder nachschlagen müsste. Versprich keine Zusagen im Namen des Verbands.`,
    greeting: "Fachverband Betonbohren und -sägen, hier spricht die digitale Assistenz der Geschäftsstelle. Was kann ich für Sie tun?",
  },
  {
    id: "skeptisches-mitglied",
    label: { de: "KI spielt ein skeptisches Mitglied", en: "AI plays a sceptical member" },
    setup: {
      de: "Die KI ruft als Inhaber eines Betriebs für Kernbohrungen an, der nach Wilma wenig von Digitalisierungsprojekten hält. Eine Person aus der Runde spricht als Geschäftsführung und versucht zu überzeugen.",
      en: "The AI calls as the owner of a core drilling company who thinks little of digitalisation projects after Wilma. Someone from the room speaks as the management and tries to convince.",
    },
    instructions: `${COMMON}
Deine Rolle: Du bist Inhaber eines mittelständischen Betriebs für Kernbohrungen und Betonsägen mit rund zwölf Beschäftigten und seit vielen Jahren Mitglied im FBS. Das frühere Digitalisierungsprojekt „Wilma“ hat dich nicht überzeugt: viel Aufwand, wenig Nutzen. Jetzt hörst du, dass der Verband über KI nachdenkt. Du bist skeptisch, aber fair und grundsätzlich überzeugbar. Bleib höflich und sachlich. Du bist die anrufende Person, nicht die Assistenz.

Deine Bedenken, eins nach dem anderen: 1. Was habe ich als Betrieb konkret davon? 2. Was kostet es den Verband und uns Mitglieder? 3. Was passiert mit unseren Daten? 4. Wie viel Aufwand bedeutet es für meinen Betrieb? 5. Warum soll es diesmal anders laufen als bei Wilma?

So verläuft das Gespräch:
- Bring pro Wortmeldung höchstens ein Bedenken ein und bleib dabei, bis es beantwortet ist. Erfinde keine weiteren Einwände über diese Liste hinaus.
- Eine Antwort überzeugt dich, wenn sie konkret und glaubwürdig ist: ein Beispiel aus dem Alltag, eine klare Zusage, eine ehrliche Einschränkung oder ein kleiner erster Schritt. Schlagworte wie „Effizienz“ oder „Zukunft“ allein überzeugen dich nicht; dann frag einmal konkret nach.
- Wenn ein Bedenken überzeugend beantwortet ist, sag das ausdrücklich, zum Beispiel „Okay, das leuchtet mir ein“, und komm nicht mehr darauf zurück.
- Mit jedem ausgeräumten Bedenken wirst du hörbar offener und freundlicher.
- Sind drei Bedenken überzeugend beantwortet, oder merkst du, dass die Geschäftsführung Wilma ehrlich aufarbeitet und die Betriebe einbeziehen will, lässt du dich überzeugen: Du sagst klar, dass du dabei bist, etwa bei einem kleinen Test oder einer Pilotgruppe, und nennst höchstens eine letzte, erfüllbare Bedingung.
- Bleibt es nach mehreren Nachfragen bei Schlagworten, bleibst du freundlich skeptisch und sagst, was dich noch überzeugen würde.`,
    greeting: "Ja, guten Tag, hier ist ein Mitgliedsbetrieb aus dem Kernbohren. Ich hab gehört, der Verband will jetzt was mit KI machen? Nach Wilma frag ich mich ehrlich gesagt, was das diesmal bringen soll.",
  },
  {
    id: "sparring",
    label: { de: "KI als Sparringspartner", en: "AI as a sparring partner" },
    setup: {
      de: "Die Runde bereitet mit der KI eine Vorstandssitzung oder ein Rundschreiben vor. Die KI stellt Rückfragen, strukturiert und bringt Gegenargumente, entscheidet aber nichts.",
      en: "The room prepares a board meeting or a circular with the AI. The AI asks questions, structures and raises counter-arguments, but decides nothing.",
    },
    instructions: `${COMMON}
Deine Rolle: Du bist ein Sparringspartner für die Geschäftsführung des FBS. Du hilfst, Gedanken zu ordnen: Du stellst gezielte Rückfragen, fasst zusammen, schlägst eine Gliederung vor und bringst mögliche Einwände ein. Du triffst keine Entscheidungen und bewertest nicht, was gut für den Verband ist. Halte deine Beiträge kurz und gib der Runde Raum.`,
    greeting: "Hallo zusammen. Woran wollen wir heute gemeinsam arbeiten?",
  },
];

const LIMITS_MIN = [3, 5, 10];

interface Row {
  id: number;
  speaker: TranscriptFragment["speaker"];
  text: string;
  endMs: number;
}

/** A new caption row once the other side spoke or after a longer pause. */
const ROW_GAP_MS = 1500;

type Phase = "idle" | "connecting" | "live" | "closing" | "ended";

const ERROR_TEXT: Record<LiveErrorCode, { de: string; en: string }> = {
  "no-key": { de: "Kein OpenAI-Schlüssel hinterlegt. Bitte in den Einstellungen eintragen.", en: "No OpenAI key set. Please add it in the settings." },
  "no-mic": { de: "Kein Zugriff auf das Mikrofon. Bitte im Browser erlauben.", en: "No access to the microphone. Please allow it in the browser." },
  auth: { de: "Der OpenAI-Schlüssel wurde abgelehnt.", en: "The OpenAI key was rejected." },
  access: { de: "Dieses OpenAI-Konto hat (noch) keinen Zugang zu GPT-Live. Kostenlose Konten sind ausgeschlossen.", en: "This OpenAI account has no access to GPT-Live (yet). Free accounts are excluded." },
  rate: { de: "Gerade zu viele gleichzeitige Gespräche. Bitte kurz warten.", en: "Too many concurrent sessions right now. Please wait a moment." },
  quota: { de: "Das OpenAI-Kontingent ist aufgebraucht.", en: "The OpenAI quota is used up." },
  network: { de: "Keine Verbindung zu OpenAI. Bitte Internet prüfen.", en: "Cannot reach OpenAI. Please check the internet connection." },
  connection: { de: "Die Sprachverbindung kam nicht zustande (Netzwerk oder Firewall).", en: "The voice connection could not be established (network or firewall)." },
  api: { de: "Das Gespräch konnte nicht gestartet werden. Bitte erneut versuchen.", en: "The conversation could not be started. Please retry." },
};

const CLOSE_TEXT: Partial<Record<CloseReason, { de: string; en: string }>> = {
  expired: { de: "Die maximale Gesprächsdauer von OpenAI ist erreicht.", en: "OpenAI's maximum session length was reached." },
  content: { de: "Der Sicherheitsfilter von OpenAI hat das Gespräch beendet.", en: "OpenAI's safety filter ended the conversation." },
  connection_lost: { de: "Die Verbindung ist abgebrochen.", en: "The connection was lost." },
  unconfirmed: { de: "Die Verbindung wurde getrennt, ohne dass OpenAI das Ende bestätigt hat.", en: "The connection closed without OpenAI confirming the end." },
};

function transcriptText(rows: Row[], role: Role, lang: Lang): string {
  const who = (s: Row["speaker"]) => (s === "user" ? (lang === "de" ? "Runde" : "Room") : "KI");
  return [
    `Rolle: ${role.label.de}`,
    "",
    ...rows.map((r) => `${who(r.speaker)}: ${r.text.trim()}`),
  ].join("\n");
}

const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.max(0, Math.floor(sec % 60))).padStart(2, "0")}`;

interface Props {
  /** Slide the optional note is saved to, e.g. "02.06" */
  slideId: string;
  /** Print view: description only */
  readOnly?: boolean;
}

/**
 * Optional live demo: a spoken role-play with GPT-Live. Runs only on an explicit
 * start with the room's consent, stops at a time limit, and keeps nothing unless
 * the facilitator saves the cleaned transcript as a note.
 */
export function LiveConversation({ slideId, readOnly = false }: Props) {
  const [lang] = useLang();
  const de = lang === "de";
  const openAiKey = useOpenAiKey();
  const claudeKey = useApiKey();

  const [roleId, setRoleId] = useState(ROLES[0].id);
  const role = ROLES.find((r) => r.id === roleId) ?? ROLES[0];
  const [limitMin, setLimitMin] = useState(5);
  const [consent, setConsent] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [endNote, setEndNote] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [billedSec, setBilledSec] = useState(0);
  const [muted_, setMuted] = useState(false);
  const [saving, setSaving] = useState<"note" | "download" | null>(null);
  const [saved, setSaved] = useState("");

  const audioRef = useRef<HTMLAudioElement>(null);
  const controller = useRef<LiveController | null>(null);
  const rowId = useRef(0);
  const startedAt = useRef(0);
  /** Cleaning costs a Claude call; the same transcript is cleaned once for note and download. */
  const cleanedFor = useRef<{ source: string; result: CleanResult } | null>(null);

  // Leaving the slide ends the conversation: nothing may keep listening in the background.
  useEffect(() => () => void controller.current?.close(), []);

  useEffect(() => {
    if (phase !== "live") return;
    const timer = window.setInterval(() => {
      const sec = (Date.now() - startedAt.current) / 1000;
      setElapsed(sec);
      if (sec >= limitMin * 60) void stop();
    }, 500);
    return () => window.clearInterval(timer);
    // stop() only reads refs; restarting the timer on every render is not wanted.
  }, [phase, limitMin]);

  if (readOnly) {
    return (
      <div className="my-4 text-sm">
        <strong>{de ? "Live-Gespräch mit einer KI (Rollenspiel)" : "Live conversation with an AI (role-play)"}</strong>
        <ul className="list-disc pl-5 text-xs mt-1">
          {ROLES.map((r) => (
            <li key={r.id}>{r.label[lang]}</li>
          ))}
        </ul>
      </div>
    );
  }

  function addFragment(f: TranscriptFragment) {
    setRows((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.speaker === f.speaker && f.startMs - last.endMs < ROW_GAP_MS) {
        return [...prev.slice(0, -1), { ...last, text: last.text + f.text, endMs: Math.max(last.endMs, f.endMs) }];
      }
      return [...prev, { id: ++rowId.current, speaker: f.speaker, text: f.text, endMs: f.endMs }];
    });
  }

  async function start() {
    if (!audioRef.current || phase === "connecting" || phase === "live") return;
    setError("");
    setWarning("");
    setEndNote("");
    setSaved("");
    setRows([]);
    setElapsed(0);
    setBilledSec(0);
    setMuted(false);
    setPhase("connecting");
    try {
      controller.current = await startLiveSession({ instructions: role.instructions, greeting: role.greeting }, audioRef.current, {
        onStarted: () => {
          startedAt.current = Date.now();
          setPhase("live");
        },
        onTranscript: addFragment,
        onUsage: setBilledSec,
        onWarning: (msg) =>
          setWarning(
            msg === "autoplay"
              ? de
                ? "Der Browser hat die Wiedergabe blockiert. Bitte einmal in die Seite klicken."
                : "The browser blocked playback. Please click into the page once."
              : de
                ? "OpenAI hat eine Antwort unterbrochen. Das Gespräch läuft weiter."
                : "OpenAI interrupted a reply. The conversation continues.",
          ),
        onClosed: (reason) => {
          controller.current = null;
          setPhase("ended");
          const note = CLOSE_TEXT[reason];
          if (note) setEndNote(note[lang]);
        },
      });
    } catch (err) {
      controller.current = null;
      setPhase("idle");
      setError(ERROR_TEXT[err instanceof LiveError ? err.code : "api"][lang]);
    }
  }

  async function stop() {
    if (!controller.current) return;
    setPhase("closing");
    await controller.current.close();
  }

  function toggleMute() {
    const next = !muted_;
    controller.current?.setMuted(next);
    setMuted(next);
  }

  const fileBase = `live-gespraech-${role.id}-${localDateStamp()}`;

  /** Note and download go through the same cleaning as every other transcript. */
  async function cleaned(): Promise<CleanResult> {
    const source = transcriptText(rows, role, "de");
    if (cleanedFor.current?.source === source) return cleanedFor.current.result;
    const result = await cleanTranscript(source, "session", `live ${role.id}`);
    cleanedFor.current = { source, result };
    return result;
  }

  async function download() {
    if (!rows.length || saving) return;
    setSaving("download");
    setError("");
    try {
      const { text } = await cleaned();
      const md = `# Live-Gespräch mit der KI (Rollenspiel)\n\n${text.trim().replace(/\n/g, "\n\n")}\n`;
      downloadBlob(new Blob([md], { type: "text/markdown;charset=utf-8" }), `${fileBase}.md`);
    } catch (err) {
      setError(describeAiError(err, lang));
    } finally {
      setSaving(null);
    }
  }

  async function saveAsNote() {
    if (!rows.length || saving) return;
    setSaving("note");
    setError("");
    try {
      const result = await cleaned();
      const id = `${slideId}:live-gespraech`;
      const previous = getEntry(id)?.value;
      const block = result.text.trim();
      setEntry({
        id,
        module: Number.parseInt(slideId, 10),
        slideId,
        kind: "text",
        prompt: "Live-Gespräch mit der KI (Rollenspiel, Mitschrift)",
        value: typeof previous === "string" && previous.trim() ? `${previous.trim()}\n\n---\n\n${block}` : block,
      });
      const removed = removedLabel(result.removed, lang);
      setSaved(de ? `Als Notiz im Protokoll gespeichert${removed ? ` · ${removed}` : ""}.` : `Saved as a note in the record${removed ? ` · ${removed}` : ""}.`);
    } catch (err) {
      setError(describeAiError(err, lang));
    } finally {
      setSaving(null);
    }
  }

  const running = phase === "connecting" || phase === "live" || phase === "closing";
  const remaining = Math.max(0, limitMin * 60 - elapsed);
  const costHint = (min: number) => (de ? `≈ ${(min * LIVE_PRICE_PER_MINUTE_USD).toFixed(2).replace(".", ",")} $` : `≈ $${(min * LIVE_PRICE_PER_MINUTE_USD).toFixed(2)}`);

  return (
    <section className="ws-input-block my-4 rounded-md p-4 space-y-3 not-prose" data-live-conversation={slideId}>
      <header className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded" style={primary}>
          <AudioLines size={11} aria-hidden /> {de ? "Live" : "Live"}
        </span>
        <span className="text-sm font-semibold flex-1">{de ? "Im Gespräch mit einer KI" : "In conversation with an AI"}</span>
        {phase === "live" && (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium tabular-nums" role="status" style={{ color: "var(--workshop-accent)" }}>
            <span className="size-2 rounded-full animate-pulse" style={{ background: "var(--workshop-accent)" }} aria-hidden />
            {de ? "läuft" : "live"} · {mmss(elapsed)} / {limitMin}:00
          </span>
        )}
      </header>

      <fieldset className="space-y-1.5" disabled={running}>
        <legend className="text-xs mb-1" style={muted}>
          {de ? "Rolle der KI" : "Role of the AI"}
        </legend>
        {ROLES.map((r) => (
          <label key={r.id} className="flex items-start gap-2 text-sm cursor-pointer">
            <input type="radio" name={`live-role-${slideId}`} checked={r.id === roleId} onChange={() => setRoleId(r.id)} className="mt-1 accent-[var(--workshop-accent)]" />
            <span>
              <span className="font-medium">{r.label[lang]}</span>
              <span className="block text-xs" style={muted}>
                {r.setup[lang]}
              </span>
            </span>
          </label>
        ))}
      </fieldset>

      {!running && (
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <label className="inline-flex items-center gap-1.5">
            {de ? "Höchstens" : "At most"}
            <select value={limitMin} onChange={(e) => setLimitMin(Number(e.target.value))} className="rounded px-1.5 py-1" style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--fg)" }}>
              {LIMITS_MIN.map((m) => (
                <option key={m} value={m}>
                  {m} {de ? "Minuten" : "minutes"}
                </option>
              ))}
            </select>
          </label>
          <span style={muted}>
            {de ? "Kosten bei OpenAI höchstens" : "OpenAI cost at most"} {costHint(limitMin)}
          </span>
        </div>
      )}

      {!running && (
        <label className="flex items-start gap-2 text-xs cursor-pointer">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 size-4 accent-[var(--workshop-accent)] shrink-0" />
          <span>
            {de
              ? "Alle im Raum wissen: Was ab jetzt gesprochen wird, geht live an OpenAI. Wir nennen keine vertraulichen oder persönlichen Daten."
              : "Everyone in the room knows: what is said from now on goes to OpenAI live. We mention no confidential or personal data."}
          </span>
        </label>
      )}

      {!openAiKey && (
        <Notice tone="warn">
          {de ? "Für das Live-Gespräch fehlt der OpenAI-Schlüssel. " : "The OpenAI key is missing for the live conversation. "}
          <a href="#/einstellungen" style={{ color: "var(--workshop-accent)" }}>
            {de ? "Zu den Einstellungen" : "To the settings"}
          </a>
        </Notice>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {!running ? (
          <button type="button" onClick={() => void start()} disabled={!consent || !openAiKey} className={BTN} style={primary} data-testid="live-start">
            <Play size={16} /> {de ? "Gespräch starten" : "Start conversation"}
          </button>
        ) : (
          <>
            <button type="button" onClick={() => void stop()} disabled={phase !== "live"} className={BTN} style={{ background: ERROR_COLOR, color: "white" }} data-testid="live-stop">
              {phase === "live" ? <PhoneOff size={16} /> : <Loader2 size={16} className="animate-spin" />}
              {phase === "connecting" ? (de ? "Verbinde …" : "Connecting …") : phase === "closing" ? (de ? "Beende …" : "Ending …") : de ? "Gespräch beenden" : "End conversation"}
            </button>
            {phase === "live" && (
              <button type="button" onClick={toggleMute} className={BTN} style={outline} aria-pressed={muted_}>
                {muted_ ? <MicOff size={16} /> : <Mic size={16} />} {muted_ ? (de ? "Mikrofon an" : "Unmute") : de ? "Mikrofon stumm" : "Mute"}
              </button>
            )}
            {phase === "live" && (
              <span className="text-xs tabular-nums" style={muted}>
                {de ? "noch" : "left"} {mmss(remaining)}
              </span>
            )}
          </>
        )}
      </div>
      <audio ref={audioRef} autoPlay className="hidden" />

      {error && <Notice tone="error">{error}</Notice>}
      {warning && <Notice tone="warn">{warning}</Notice>}
      {endNote && <Notice tone="warn">{endNote}</Notice>}

      {rows.length > 0 && (
        <div className="rounded-md p-3 space-y-1.5 max-h-72 overflow-y-auto text-sm" style={{ background: "var(--bg)", border: "1px solid var(--border)" }} aria-live="polite" data-testid="live-captions">
          {rows.map((r) => (
            <p key={r.id} className="leading-snug">
              <span className="text-[10px] uppercase tracking-wider font-semibold mr-1.5" style={{ color: r.speaker === "assistant" ? "var(--workshop-accent)" : "var(--fg-muted)" }}>
                {r.speaker === "assistant" ? "KI" : de ? "Runde" : "Room"}
              </span>
              {r.text}
            </p>
          ))}
        </div>
      )}

      {phase === "ended" && rows.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs" style={muted}>
            {de
              ? `Gesprächsdauer laut OpenAI: ${mmss(billedSec)}. Die Mitschrift bleibt nur auf dieser Folie, bis ihr sie speichert.`
              : `Duration according to OpenAI: ${mmss(billedSec)}. The transcript stays only on this slide until you save it.`}
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void saveAsNote()} disabled={saving !== null || !claudeKey} className={BTN} style={primary} data-testid="live-save">
              {saving === "note" ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              {de ? "Bereinigt als Notiz übernehmen" : "Save cleaned as a note"}
            </button>
            <button type="button" onClick={() => void download()} disabled={saving !== null || !claudeKey} className={BTN} style={outline} data-testid="live-download">
              {saving === "download" ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
              {de ? "Bereinigt herunterladen" : "Download cleaned"}
            </button>
          </div>
          {!claudeKey && (
            <p className="text-xs" style={muted}>
              {de
                ? "Zum Übernehmen und Herunterladen braucht es den Claude-Schlüssel: Die Mitschrift wird vorher von privaten und unangemessenen Passagen bereinigt."
                : "Saving and downloading need the Claude key: the transcript is cleaned of private and inappropriate passages first."}
            </p>
          )}
          {saved && <Notice tone="ok">{saved}</Notice>}
        </div>
      )}
    </section>
  );
}
