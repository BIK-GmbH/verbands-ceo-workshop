/**
 * Technik-Check: the few questions the facilitators must answer before the
 * workshop starts — does the browser fit, is there internet, do the AI keys
 * work, does the microphone deliver sound, does dictation recognise speech,
 * can a recording be stored, is there room, does the app survive without
 * network, and is the screen set up for the projector.
 *
 * Every check is honest about what it can see: it measures, it never assumes.
 * Where a browser cannot tell (e.g. whether the speech service itself works),
 * the dictation probe in the component listens for real speech instead.
 *
 * Nothing here duplicates the app's own logic: key verification comes from
 * `key-check.ts`, the probe recording is written through `recording-store.ts`
 * (the same database the session recorder uses) and a running session
 * recording is never touched.
 *
 * Every check has a time limit; a refused permission is a result, not a crash.
 */
import type { Bilingual, Lang } from "@/types/slide";
import { getApiKey } from "@/lib/ai-assist";
import { getOpenAiKey, extensionForMime } from "@/lib/transcribe";
import { checkAnthropicKey, checkOpenAiKey, type KeyStatus } from "@/lib/key-check";
import { getRecorderState } from "@/lib/session-recorder";
import { appendChunk, assembleSession, beginSession, deleteSession, isQuotaError } from "@/lib/recording-store";
import { isDictationSupported } from "@/lib/useDictation";
import type { FontScale } from "@/lib/font-scale";

// ---------------------------------------------------------------------------
// Types

export type CheckId =
  | "browser"
  | "storage"
  | "offline"
  | "screen"
  | "internet"
  | "claude"
  | "openai"
  | "microphone"
  | "dictation"
  | "recording";

export type Verdict = "ok" | "warn" | "fail" | "skipped";

export interface CheckResult {
  verdict: Verdict;
  /** What was found — one sentence, no jargon. */
  finding: Bilingual;
  /** What to do — one concrete sentence. On "ok" it is an optional tip. */
  action?: Bilingual;
  /** Measured values, shown small and included in the copied report. */
  facts?: Bilingual[];
  /** Screen check only: the font step recommended for this window. */
  recommendedScale?: FontScale;
  /** Storage check only: persistence can still be requested. */
  canRequestPersistence?: boolean;
  checkedAt: string;
}

export interface CheckMeta {
  id: CheckId;
  title: Bilingual;
  /** What the check looks at, shown before it has run. */
  what: Bilingual;
  /** Hard upper limit for the whole check, including permission prompts. */
  timeoutMs: number;
  /** Uses the microphone — these run one after another, never in parallel. */
  usesMic: boolean;
}

export interface CheckGroup {
  id: "device" | "network" | "audio";
  title: Bilingual;
  checks: CheckId[];
}

export const CHECKS: Record<CheckId, CheckMeta> = {
  browser: {
    id: "browser",
    title: { de: "Browser", en: "Browser" },
    what: {
      de: "Chrome oder Edge, Spracherkennung, Aufnahme und Sicherungsordner verfügbar",
      en: "Chrome or Edge, speech recognition, recording and backup folder available",
    },
    timeoutMs: 3_000,
    usesMic: false,
  },
  storage: {
    id: "storage",
    title: { de: "Speicher", en: "Storage" },
    what: {
      de: "Eingaben speicherbar, Aufnahmedatenbank verfügbar, freier Platz, Schutz vor automatischem Löschen",
      en: "Entries can be saved, recording database available, free space, protection against automatic deletion",
    },
    timeoutMs: 8_000,
    usesMic: false,
  },
  offline: {
    id: "offline",
    title: { de: "Ohne Internet weiterarbeiten", en: "Working without internet" },
    what: {
      de: "App auf diesem Gerät zwischengespeichert, damit Folien und Eingaben auch bei Netzausfall laufen",
      en: "App cached on this device so slides and entries keep working if the network drops",
    },
    timeoutMs: 6_000,
    usesMic: false,
  },
  screen: {
    id: "screen",
    title: { de: "Bildschirm & Beamer", en: "Screen & projector" },
    what: {
      de: "Fenstergröße, passende Schriftstufe für den Beamer, Vollbild",
      en: "Window size, suitable font step for the projector, full screen",
    },
    timeoutMs: 3_000,
    usesMic: false,
  },
  internet: {
    id: "internet",
    title: { de: "Internet", en: "Internet" },
    what: {
      de: "Spracherkennung, Claude und OpenAI tatsächlich erreichbar, Antwortzeit",
      en: "Speech recognition, Claude and OpenAI actually reachable, response time",
    },
    timeoutMs: 10_000,
    usesMic: false,
  },
  claude: {
    id: "claude",
    title: { de: "Claude-Schlüssel", en: "Claude key" },
    what: {
      de: "Für Glätten, Ergebnisbericht und Poster: Schlüssel hinterlegt und vom Anbieter angenommen (kostet nichts)",
      en: "For polishing, results report and posters: key stored and accepted by the provider (free of charge)",
    },
    timeoutMs: 15_000,
    usesMic: false,
  },
  openai: {
    id: "openai",
    title: { de: "OpenAI-Schlüssel", en: "OpenAI key" },
    what: {
      de: "Für die Transkription der Interviews: Schlüssel hinterlegt und angenommen (kostet nichts)",
      en: "For transcribing the interviews: key stored and accepted (free of charge)",
    },
    timeoutMs: 15_000,
    usesMic: false,
  },
  microphone: {
    id: "microphone",
    title: { de: "Mikrofon", en: "Microphone" },
    what: {
      de: "Freigabe im Browser und Pegel: 4 Sekunden sprechen",
      en: "Browser permission and level: speak for 4 seconds",
    },
    timeoutMs: 30_000,
    usesMic: true,
  },
  dictation: {
    id: "dictation",
    title: { de: "Diktat-Probe", en: "Dictation test" },
    what: {
      de: "5 Sekunden sprechen, der erkannte Text erscheint hier — der einzige echte Beweis, dass das Diktat vor Ort geht",
      en: "Speak for 5 seconds, the recognised text appears here — the only real proof that dictation works on site",
    },
    timeoutMs: 20_000,
    usesMic: true,
  },
  recording: {
    id: "recording",
    title: { de: "Probeaufnahme", en: "Test recording" },
    what: {
      de: "3 Sekunden aufnehmen, speichern, wieder lesen und abspielbar prüfen; wird danach gelöscht",
      en: "Record 3 seconds, store, read back and check it plays; deleted afterwards",
    },
    timeoutMs: 30_000,
    usesMic: true,
  },
};

export const CHECK_GROUPS: CheckGroup[] = [
  { id: "network", title: { de: "Internet & KI", en: "Internet & AI" }, checks: ["internet", "claude", "openai"] },
  {
    id: "audio",
    title: { de: "Mikrofon, Diktat & Aufnahme", en: "Microphone, dictation & recording" },
    checks: ["microphone", "dictation", "recording"],
  },
  { id: "device", title: { de: "Browser & Gerät", en: "Browser & device" }, checks: ["browser", "storage", "offline", "screen"] },
];

/** Durations of the parts where somebody has to speak. */
export const MIC_LISTEN_MS = 4_000;
export const DICTATION_LISTEN_MS = 5_000;
export const RECORDING_MS = 3_000;

// ---------------------------------------------------------------------------
// Helpers

const now = () => new Date().toISOString();

function result(verdict: Verdict, finding: Bilingual, action?: Bilingual, facts?: Bilingual[]): CheckResult {
  return { verdict, finding, action, facts, checkedAt: now() };
}

const same = (s: string): Bilingual => ({ de: s, en: s });

export const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

export class CheckTimeout extends Error {
  constructor() {
    super("timeout");
    this.name = "CheckTimeout";
  }
}

/** Rejects with CheckTimeout after `ms`. The original promise keeps running; callers clean up. */
export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new CheckTimeout()), ms);
    p.then(
      (v) => {
        window.clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        window.clearTimeout(timer);
        reject(e);
      },
    );
  });
}

export function timeoutResult(id: CheckId): CheckResult {
  return result(
    "fail",
    {
      de: `Die Prüfung „${CHECKS[id].title.de}“ hat nicht rechtzeitig geantwortet.`,
      en: `The “${CHECKS[id].title.en}” check did not answer in time.`,
    },
    {
      de: "Seite neu laden und diese Prüfung einzeln wiederholen; hängt sie erneut, Browser neu starten.",
      en: "Reload the page and repeat this check on its own; if it hangs again, restart the browser.",
    },
  );
}

export function crashResult(id: CheckId, err: unknown): CheckResult {
  console.error("[system-check] check failed unexpectedly", { check: id, err });
  return result(
    "fail",
    {
      de: `Die Prüfung „${CHECKS[id].title.de}“ ist mit einem unerwarteten Fehler abgebrochen.`,
      en: `The “${CHECKS[id].title.en}” check stopped with an unexpected error.`,
    },
    {
      de: "Einzeln wiederholen; bleibt es so, das kopierte Ergebnis an Stefan schicken.",
      en: "Repeat it on its own; if it persists, send the copied result to Stefan.",
    },
  );
}

function formatMb(bytes: number, lang: Lang): string {
  const gb = bytes / 1024 ** 3;
  const text = gb >= 1 ? `${gb.toFixed(1)} GB` : `${Math.round(bytes / 1024 ** 2)} MB`;
  return lang === "de" ? text.replace(".", ",") : text;
}

const bytesText = (bytes: number): Bilingual => ({ de: formatMb(bytes, "de"), en: formatMb(bytes, "en") });

// ---------------------------------------------------------------------------
// Browser

interface BrowserInfo {
  name: string;
  version: string;
  recommended: boolean;
  os: string;
}

export function detectBrowser(): BrowserInfo {
  const ua = navigator.userAgent;
  const data = (navigator as Navigator & {
    userAgentData?: { brands?: { brand: string; version: string }[]; platform?: string };
  }).userAgentData;
  const brands = data?.brands ?? [];
  const brand = (name: string) => brands.find((b) => b.brand === name);
  const os = data?.platform || (/Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "");

  const edge = brand("Microsoft Edge") ?? (/Edg\/(\d+)/.exec(ua) ? { brand: "Edge", version: /Edg\/(\d+)/.exec(ua)![1] } : undefined);
  if (edge) return { name: "Edge", version: edge.version, recommended: true, os };
  const chrome = brand("Google Chrome");
  if (chrome) return { name: "Chrome", version: chrome.version, recommended: true, os };
  if (/Firefox\/(\d+)/.test(ua)) return { name: "Firefox", version: /Firefox\/(\d+)/.exec(ua)![1], recommended: false, os };
  if (/OPR\/(\d+)/.test(ua)) return { name: "Opera", version: /OPR\/(\d+)/.exec(ua)![1], recommended: false, os };
  if ((navigator as Navigator & { brave?: unknown }).brave) return { name: "Brave", version: "", recommended: false, os };
  if (/Chrome\/(\d+)/.test(ua)) {
    // Chromium without the Google brand (Chromium, test browsers, some embedded
    // browsers): the page works, but the speech service is usually missing.
    return { name: "Chromium", version: /Chrome\/(\d+)/.exec(ua)![1], recommended: false, os };
  }
  if (/Safari\//.test(ua)) return { name: "Safari", version: /Version\/(\d+)/.exec(ua)?.[1] ?? "", recommended: false, os };
  return { name: "unbekannt", version: "", recommended: false, os };
}

export function checkBrowser(): CheckResult {
  const b = detectBrowser();
  const speech = isDictationSupported();
  const recorder = typeof window.MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
  const folder = "showDirectoryPicker" in window;
  const secure = window.isSecureContext;
  const yes = (v: boolean): Bilingual => (v ? { de: "ja", en: "yes" } : { de: "nein", en: "no" });
  const label = `${b.name}${b.version ? ` ${b.version}` : ""}${b.os ? ` · ${b.os}` : ""}`;
  const facts: Bilingual[] = [
    same(label),
    { de: `Spracherkennung: ${yes(speech).de}`, en: `Speech recognition: ${yes(speech).en}` },
    { de: `Aufnahme: ${yes(recorder).de}`, en: `Recording: ${yes(recorder).en}` },
    { de: `Sicherungsordner: ${yes(folder).de}`, en: `Backup folder: ${yes(folder).en}` },
  ];

  if (!secure) {
    return result(
      "fail",
      {
        de: "Die Seite ist nicht über eine sichere Adresse geöffnet: Mikrofon, Diktat und Aufnahme sind gesperrt.",
        en: "The page is not opened via a secure address: microphone, dictation and recording are blocked.",
      },
      {
        de: "Die Workshop-Adresse mit https:// öffnen (Lesezeichen verwenden).",
        en: "Open the workshop address with https:// (use the bookmark).",
      },
      facts,
    );
  }
  if (!speech || !recorder) {
    return result(
      "fail",
      {
        de: `${b.name} kann ${!speech && !recorder ? "weder diktieren noch aufnehmen" : !speech ? "nicht diktieren" : "nicht aufnehmen"}.`,
        en: `${b.name} cannot ${!speech && !recorder ? "dictate or record" : !speech ? "dictate" : "record"}.`,
      },
      {
        de: "Die App in Chrome oder Edge öffnen; bis dahin Beiträge tippen oder auf Karten schreiben.",
        en: "Open the app in Chrome or Edge; until then type contributions or write cards.",
      },
      facts,
    );
  }
  if (!b.recommended) {
    return result(
      "warn",
      {
        de: `${b.name} ist nicht Chrome oder Edge: Das Diktat kann trotz vorhandener Funktion ausfallen.`,
        en: `${b.name} is not Chrome or Edge: dictation may fail even though the feature exists.`,
      },
      {
        de: "Für den Workshop Chrome oder Edge verwenden; die Diktat-Probe zeigt, ob es hier trotzdem geht.",
        en: "Use Chrome or Edge for the workshop; the dictation test shows whether it works here anyway.",
      },
      facts,
    );
  }
  if (!folder) {
    return result(
      "warn",
      {
        de: `${b.name} bietet keinen Sicherungsordner an: Die automatische Sicherung in einen Ordner fällt aus.`,
        en: `${b.name} offers no backup folder: automatic backup into a folder is unavailable.`,
      },
      {
        de: "Am Ende jedes Tages die Sicherung in den Einstellungen von Hand herunterladen.",
        en: "Download the backup manually in the settings at the end of each day.",
      },
      facts,
    );
  }
  return result(
    "ok",
    { de: `${b.name} passt: Diktat, Aufnahme und Sicherungsordner sind verfügbar.`, en: `${b.name} fits: dictation, recording and backup folder are available.` },
    undefined,
    facts,
  );
}

// ---------------------------------------------------------------------------
// Internet

interface Target {
  label: Bilingual;
  url: string;
}

const TARGETS: Target[] = [
  // Chrome's dictation runs through Google's speech service; www.google.com is
  // the closest reachable proxy for it (Edge uses Microsoft's service).
  { label: { de: "Spracherkennung", en: "Speech recognition" }, url: "https://www.google.com/generate_204" },
  { label: same("Claude"), url: "https://api.anthropic.com/" },
  { label: same("OpenAI"), url: "https://api.openai.com/" },
];

const PROBE_TIMEOUT_MS = 6_000;
const SLOW_MS = 2_000;

async function reach(url: string): Promise<number | null> {
  const started = performance.now();
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    // no-cors: any answer at all proves the host is reachable from this network;
    // the (opaque) content does not matter. Cache-busted so no stored reply counts.
    await fetch(`${url}${url.includes("?") ? "&" : "?"}_=${Date.now()}`, {
      mode: "no-cors",
      cache: "no-store",
      credentials: "omit",
      signal: controller.signal,
    });
    return Math.round(performance.now() - started);
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

export async function checkInternet(): Promise<CheckResult> {
  const times = await Promise.all(TARGETS.map((t) => reach(t.url)));
  const facts: Bilingual[] = TARGETS.map((t, i) => {
    const ms = times[i];
    return ms === null
      ? { de: `${t.label.de}: nicht erreichbar`, en: `${t.label.en}: not reachable` }
      : { de: `${t.label.de}: ${ms} ms`, en: `${t.label.en}: ${ms} ms` };
  });
  if (!navigator.onLine) facts.push({ de: "Browser meldet: offline", en: "Browser reports: offline" });

  const down = TARGETS.filter((_, i) => times[i] === null);
  if (down.length === TARGETS.length) {
    return result(
      "fail",
      {
        de: "Kein Internet: Diktat und KI-Knöpfe fallen aus, Folien und Eingaben laufen weiter.",
        en: "No internet: dictation and AI buttons are unavailable, slides and entries keep working.",
      },
      {
        de: "WLAN-Anmeldeseite im Browser bestätigen oder den Handy-Hotspot verbinden, dann erneut prüfen.",
        en: "Confirm the Wi-Fi login page in the browser or connect the phone hotspot, then check again.",
      },
      facts,
    );
  }
  if (down.length > 0) {
    const names = { de: down.map((t) => t.label.de).join(", "), en: down.map((t) => t.label.en).join(", ") };
    return result(
      "fail",
      {
        de: `Internet ist da, aber nicht erreichbar: ${names.de}. Das WLAN sperrt vermutlich diese Dienste.`,
        en: `Internet is there, but not reachable: ${names.en}. The Wi-Fi probably blocks these services.`,
      },
      {
        de: "Mit dem Handy-Hotspot erneut prüfen; klappt es dort, im Workshop den Hotspot nutzen.",
        en: "Check again on the phone hotspot; if it works there, use the hotspot in the workshop.",
      },
      facts,
    );
  }
  const slowest = Math.max(...(times as number[]));
  if (slowest > SLOW_MS) {
    return result(
      "warn",
      {
        de: `Internet ist da, aber langsam (bis ${slowest} ms): Diktat und KI antworten verzögert.`,
        en: `Internet is there, but slow (up to ${slowest} ms): dictation and AI respond with delay.`,
      },
      {
        de: "Näher an den Router gehen oder den Handy-Hotspot testen.",
        en: "Move closer to the router or try the phone hotspot.",
      },
      facts,
    );
  }
  return result(
    "ok",
    { de: "Internet steht: Spracherkennung, Claude und OpenAI sind erreichbar.", en: "Internet is up: speech recognition, Claude and OpenAI are reachable." },
    undefined,
    facts,
  );
}

// ---------------------------------------------------------------------------
// API keys — verification itself lives in key-check.ts

function keyResult(
  status: KeyStatus,
  provider: { name: string; features: Bilingual; console: string; prefix: string },
): CheckResult {
  const facts = status.detail ? [same(status.detail)] : undefined;
  switch (status.state) {
    case "valid":
      return result(
        "ok",
        { de: `${provider.name} nimmt den Schlüssel an: ${provider.features.de} funktionieren.`, en: `${provider.name} accepts the key: ${provider.features.en} work.` },
        undefined,
        facts,
      );
    case "missing":
      return result(
        "warn",
        { de: `Kein ${provider.name}-Schlüssel hinterlegt: ${provider.features.de} bleiben aus.`, en: `No ${provider.name} key stored: ${provider.features.en} stay off.` },
        {
          de: "In den Einstellungen den Schlüssel eintragen, oder bewusst ohne diese Funktionen arbeiten.",
          en: "Enter the key in the settings, or deliberately work without these features.",
        },
      );
    case "malformed":
      return result(
        "fail",
        { de: `Der hinterlegte Schlüssel ist kein ${provider.name}-Schlüssel.`, en: `The stored key is not a ${provider.name} key.` },
        {
          de: `In den Einstellungen neu eintragen (beginnt mit „${provider.prefix}“).`,
          en: `Enter it again in the settings (starts with “${provider.prefix}”).`,
        },
      );
    case "rejected":
      return result(
        "fail",
        { de: `${provider.name} lehnt den Schlüssel ab: ${provider.features.de} fallen aus.`, en: `${provider.name} rejects the key: ${provider.features.en} are unavailable.` },
        {
          de: `Unter ${provider.console} einen neuen Schlüssel erzeugen und in den Einstellungen eintragen.`,
          en: `Create a new key at ${provider.console} and enter it in the settings.`,
        },
        facts,
      );
    case "quota":
      return result(
        "fail",
        { de: `Der ${provider.name}-Schlüssel stimmt, aber das Guthaben ist aufgebraucht.`, en: `The ${provider.name} key is right, but the credit is used up.` },
        {
          de: `Unter ${provider.console} Guthaben aufladen oder das Ausgabelimit erhöhen.`,
          en: `Top up credit or raise the spending limit at ${provider.console}.`,
        },
        facts,
      );
    case "unreachable":
      return result(
        "fail",
        { de: `${provider.name} ist nicht erreichbar: ${provider.features.de} fallen aus.`, en: `${provider.name} is not reachable: ${provider.features.en} are unavailable.` },
        {
          de: "Internet prüfen (siehe oben), notfalls den Handy-Hotspot verbinden.",
          en: "Check the internet (see above), connect the phone hotspot if needed.",
        },
      );
    default:
      return result(
        "warn",
        { de: `${provider.name} hat unerwartet geantwortet; ob der Schlüssel geht, ist unklar.`, en: `${provider.name} answered unexpectedly; whether the key works is unclear.` },
        {
          de: "In ein paar Minuten erneut prüfen; bleibt es so, das Ergebnis an Stefan schicken.",
          en: "Check again in a few minutes; if it stays that way, send the result to Stefan.",
        },
        facts,
      );
  }
}

export async function checkClaude(): Promise<CheckResult> {
  return keyResult(await checkAnthropicKey(getApiKey()), {
    name: "Claude",
    features: { de: "Glätten, Ergebnisbericht und Poster-Verdichtung", en: "polishing, results report and poster condensing" },
    console: "console.anthropic.com",
    prefix: "sk-ant-",
  });
}

export async function checkOpenAi(): Promise<CheckResult> {
  return keyResult(await checkOpenAiKey(getOpenAiKey()), {
    name: "OpenAI",
    features: { de: "Interview-Transkriptionen", en: "interview transcriptions" },
    console: "platform.openai.com",
    prefix: "sk-",
  });
}

// ---------------------------------------------------------------------------
// Microphone

type MicFailure = "denied" | "no-device" | "busy" | "unsupported" | "unanswered" | "other";

/** "granted" | "denied" | "prompt", or null where the browser does not tell. */
export async function micPermissionState(): Promise<PermissionState | null> {
  try {
    const status = await withTimeout(navigator.permissions.query({ name: "microphone" as PermissionName }), 2_000);
    return status.state;
  } catch {
    return null;
  }
}

/** Asks for the microphone with a time limit; a late grant is released immediately. */
async function getMic(timeoutMs: number): Promise<{ stream: MediaStream } | { failure: MicFailure }> {
  if (!navigator.mediaDevices?.getUserMedia) return { failure: "unsupported" };
  // A blocked microphone is known without asking; some browsers otherwise
  // answer with a misleading error name.
  if ((await micPermissionState()) === "denied") return { failure: "denied" };
  const pending = navigator.mediaDevices.getUserMedia({ audio: true });
  try {
    return { stream: await withTimeout(pending, timeoutMs) };
  } catch (err) {
    if (err instanceof CheckTimeout) {
      pending.then((s) => s.getTracks().forEach((t) => t.stop())).catch(() => {});
      return { failure: "unanswered" };
    }
    const name = err instanceof DOMException ? err.name : "";
    if (name === "NotAllowedError" || name === "SecurityError" || name === "PermissionDeniedError") return { failure: "denied" };
    if (name === "NotFoundError" || name === "OverconstrainedError") return { failure: "no-device" };
    if (name === "NotReadableError" || name === "AbortError") return { failure: "busy" };
    console.error("[system-check] microphone request failed", err);
    return { failure: "other" };
  }
}

/** `consequence` is a whole clause, e.g. "Diktat und Aufnahme fallen aus". */
function micFailureResult(failure: MicFailure, consequence: Bilingual): CheckResult {
  switch (failure) {
    case "denied":
      return result(
        "fail",
        { de: `Das Mikrofon ist im Browser gesperrt: ${consequence.de}.`, en: `The microphone is blocked in the browser: ${consequence.en}.` },
        {
          de: "Links neben der Adresse auf das Symbol klicken, Mikrofon auf „Zulassen“ stellen und die Seite neu laden.",
          en: "Click the icon left of the address, set the microphone to “Allow” and reload the page.",
        },
      );
    case "no-device":
      return result(
        "fail",
        { de: `Kein Mikrofon gefunden: ${consequence.de}.`, en: `No microphone found: ${consequence.en}.` },
        {
          de: "Mikrofon anschließen oder in den Windows-Soundeinstellungen einschalten, dann erneut prüfen.",
          en: "Connect the microphone or enable it in the system sound settings, then check again.",
        },
      );
    case "busy":
      return result(
        "fail",
        { de: `Das Mikrofon ist belegt: ${consequence.de}.`, en: `The microphone is in use: ${consequence.en}.` },
        {
          de: "Teams, Zoom oder andere Programme mit Mikrofon schließen und erneut prüfen.",
          en: "Close Teams, Zoom or other programs using the microphone and check again.",
        },
      );
    case "unanswered":
      return result(
        "fail",
        { de: "Die Frage nach der Mikrofonfreigabe wurde nicht beantwortet.", en: "The microphone permission prompt was not answered." },
        {
          de: "Erneut prüfen und im Hinweis oben links auf „Zulassen“ klicken.",
          en: "Check again and click “Allow” in the prompt at the top left.",
        },
      );
    case "unsupported":
      return result(
        "fail",
        { de: `Dieser Browser gibt kein Mikrofon frei: ${consequence.de}.`, en: `This browser provides no microphone: ${consequence.en}.` },
        { de: "Die App in Chrome oder Edge öffnen.", en: "Open the app in Chrome or Edge." },
      );
    default:
      return result(
        "fail",
        { de: `Das Mikrofon ließ sich nicht öffnen: ${consequence.de}.`, en: `The microphone could not be opened: ${consequence.en}.` },
        { de: "Browser neu starten und erneut prüfen.", en: "Restart the browser and check again." },
      );
  }
}

/** dBFS below which a microphone counts as silent (room noise alone is usually above). */
const SILENT_DB = -55;
/** dBFS below which speech is probably too far away from the microphone. */
const QUIET_DB = -38;

export interface MicLevelOptions {
  /** Level 0..1 roughly 20 times per second, for the live meter. */
  onLevel: (level: number) => void;
  /** Called once the permission is granted and listening starts. */
  onListening?: () => void;
}

export async function checkMicrophone({ onLevel, onListening }: MicLevelOptions): Promise<CheckResult> {
  const consequence: Bilingual = { de: "Diktat und Aufnahme fallen aus", en: "dictation and recording are unavailable" };
  const mic = await getMic(20_000);
  if ("failure" in mic) return micFailureResult(mic.failure, consequence);

  const { stream } = mic;
  const track = stream.getAudioTracks()[0];
  const device = track?.label || "";
  let ctx: AudioContext | null = null;
  try {
    ctx = new AudioContext();
    await withTimeout(ctx.resume(), 2_000).catch(() => {});
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);
    const buf = new Float32Array(analyser.fftSize);

    onListening?.();
    let peakDb = -100;
    const started = performance.now();
    while (performance.now() - started < MIC_LISTEN_MS) {
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      const rms = Math.sqrt(sum / buf.length);
      const db = rms > 0 ? 20 * Math.log10(rms) : -100;
      peakDb = Math.max(peakDb, db);
      onLevel(Math.min(1, Math.max(0, (db + 60) / 60)));
      await sleep(50);
    }
    onLevel(0);

    const facts: Bilingual[] = [];
    if (device) facts.push({ de: `Gerät: ${device}`, en: `Device: ${device}` });
    facts.push({ de: `Spitzenpegel: ${Math.round(peakDb)} dB`, en: `Peak level: ${Math.round(peakDb)} dB` });

    if (ctx.state !== "running") {
      return result(
        "warn",
        { de: "Mikrofon ist freigegeben, der Pegel ließ sich aber nicht messen.", en: "Microphone is allowed, but the level could not be measured." },
        { de: "Die Diktat-Probe unten entscheidet, ob der Ton ankommt.", en: "The dictation test below decides whether sound arrives." },
        facts,
      );
    }
    if (peakDb < SILENT_DB) {
      return result(
        "fail",
        { de: "Mikrofon ist freigegeben, liefert aber keinen Ton.", en: "Microphone is allowed but delivers no sound." },
        {
          de: "Stummschaltung am Gerät prüfen und links neben der Adresse das richtige Mikrofon wählen, dann erneut prüfen.",
          en: "Check the mute switch and pick the right microphone left of the address, then check again.",
        },
        facts,
      );
    }
    if (peakDb < QUIET_DB) {
      return result(
        "warn",
        { de: "Mikrofon ist freigegeben, der Ton kommt aber nur leise an.", en: "Microphone is allowed, but sound arrives only quietly." },
        {
          de: "Näher ans Mikrofon gehen oder ein Konferenzmikrofon in die Tischmitte legen.",
          en: "Move closer to the microphone or put a conference microphone in the middle of the table.",
        },
        facts,
      );
    }
    return result(
      "ok",
      { de: "Mikrofon ist freigegeben und der Ton kommt gut an.", en: "Microphone is allowed and sound arrives well." },
      undefined,
      facts,
    );
  } finally {
    stream.getTracks().forEach((t) => t.stop());
    void ctx?.close().catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Dictation — the probe itself runs through useDictation in the component

export function sessionRecordingActive(): boolean {
  const s = getRecorderState();
  return s.recording || s.busy;
}

export function skippedForRecording(what: Bilingual): CheckResult {
  return result(
    "skipped",
    {
      de: `Übersprungen: Gerade läuft eine Sitzungsaufnahme, ${what.de} würde sie stören.`,
      en: `Skipped: a session recording is running, ${what.en} would disturb it.`,
    },
    {
      de: "Nach dem Ende der Aufnahme erneut prüfen.",
      en: "Check again after the recording has ended.",
    },
  );
}

export interface DictationOutcome {
  text: string;
  /** Error code reported by the speech service, if any. */
  error: string | null;
  /** How long the recogniser stayed on; 0 if it never visibly started. */
  listenedMs: number;
}

/** A recogniser that ends on its own this fast never really listened. */
const EARLY_END_MS = 1_500;

export function micBlockedForDictationResult(): CheckResult {
  return micFailureResult("denied", { de: "Das Diktat fällt aus", en: "dictation is unavailable" });
}

export function dictationUnsupportedResult(): CheckResult {
  return result(
    "fail",
    { de: "Dieser Browser kann nicht diktieren.", en: "This browser cannot dictate." },
    {
      de: "Die App in Chrome oder Edge öffnen; bis dahin Beiträge tippen oder auf Karten schreiben.",
      en: "Open the app in Chrome or Edge; until then type contributions or write cards.",
    },
  );
}

export function interpretDictation({ text, error, listenedMs }: DictationOutcome): CheckResult {
  const trimmed = text.trim();
  if (trimmed) {
    return result(
      "ok",
      { de: `Diktat funktioniert. Erkannt: „${trimmed}“`, en: `Dictation works. Recognised: “${trimmed}”` },
    );
  }
  const typing: Bilingual = {
    de: "bis dahin Beiträge tippen oder auf Karten schreiben.",
    en: "until then type contributions or write cards.",
  };
  switch (error) {
    case "not-allowed":
      return micBlockedForDictationResult();
    case "service-not-allowed":
      return result(
        "fail",
        { de: "Der Browser gibt die Spracherkennung nicht frei (Browser-Art oder Firmenrichtlinie).", en: "The browser does not allow speech recognition (browser type or company policy)." },
        { de: `Chrome oder Edge ohne Firmenrichtlinie verwenden; ${typing.de}`, en: `Use Chrome or Edge without company policy; ${typing.en}` },
      );
    case "network":
      return result(
        "fail",
        { de: "Der Spracherkennungsdienst ist nicht erreichbar: Das Diktat fällt aus.", en: "The speech recognition service is not reachable: dictation is unavailable." },
        { de: `Internet prüfen oder Handy-Hotspot verbinden; ${typing.de}`, en: `Check the internet or connect the phone hotspot; ${typing.en}` },
      );
    case "audio-capture":
      return micFailureResult("no-device", { de: "Das Diktat fällt aus", en: "dictation is unavailable" });
    case "language-not-supported":
      return result(
        "fail",
        { de: "Dieser Browser erkennt kein Deutsch.", en: "This browser does not recognise German." },
        { de: `Chrome oder Edge verwenden; ${typing.de}`, en: `Use Chrome or Edge; ${typing.en}` },
      );
  }
  if (!error && listenedMs < EARLY_END_MS) {
    return result(
      "fail",
      {
        de: "Die Spracherkennung hat sofort wieder aufgehört, ohne zuzuhören: Das Diktat geht in diesem Browser nicht.",
        en: "Speech recognition stopped at once without listening: dictation does not work in this browser.",
      },
      { de: `Die App in Chrome oder Edge öffnen und erneut prüfen; ${typing.de}`, en: `Open the app in Chrome or Edge and check again; ${typing.en}` },
    );
  }
  return result(
    "warn",
    {
      de: error && error !== "no-speech" ? `Nichts erkannt (Meldung: ${error}).` : "Nichts erkannt.",
      en: error && error !== "no-speech" ? `Nothing recognised (message: ${error}).` : "Nothing recognised.",
    },
    {
      de: "Erneut prüfen und währenddessen deutlich einen Satz sprechen; bleibt es leer, zuerst den Mikrofonpegel prüfen.",
      en: "Check again and say a sentence clearly meanwhile; if it stays empty, check the microphone level first.",
    },
  );
}

// ---------------------------------------------------------------------------
// Probe recording — through the same IndexedDB store as the session recorder

async function decodes(blob: Blob): Promise<number | null> {
  const ctx = new AudioContext();
  try {
    const audio = await withTimeout(ctx.decodeAudioData(await blob.arrayBuffer()), 5_000);
    return audio.duration;
  } catch {
    return null;
  } finally {
    void ctx.close().catch(() => {});
  }
}

export async function checkRecording(onRecording?: () => void): Promise<CheckResult> {
  const what: Bilingual = { de: "die Probeaufnahme", en: "the test recording" };
  if (sessionRecordingActive()) return skippedForRecording(what);
  if (typeof window.MediaRecorder === "undefined") {
    return result(
      "fail",
      { de: "Dieser Browser kann nicht aufnehmen.", en: "This browser cannot record." },
      { de: "Die App in Chrome oder Edge öffnen.", en: "Open the app in Chrome or Edge." },
    );
  }

  const mic = await getMic(20_000);
  if ("failure" in mic) return micFailureResult(mic.failure, { de: "Die Aufnahme fällt aus", en: "recording is unavailable" });
  const { stream } = mic;

  let sessionId: string | null = null;
  try {
    const rec = new MediaRecorder(stream);
    const parts: Blob[] = [];
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) parts.push(e.data);
    };
    const stopped = new Promise<void>((resolve) => {
      rec.onstop = () => resolve();
    });
    rec.start();
    onRecording?.();
    await sleep(RECORDING_MS);
    rec.stop();
    await withTimeout(stopped, 4_000);

    const type = rec.mimeType || parts[0]?.type || "audio/webm";
    const blob = new Blob(parts, { type });
    if (blob.size === 0) {
      return result(
        "fail",
        { de: "Die Probeaufnahme blieb leer.", en: "The test recording stayed empty." },
        { de: "Browser neu starten und erneut prüfen.", en: "Restart the browser and check again." },
      );
    }

    // A probe must never be offered as a crashed session recording, even if the
    // page dies right here: the header alone has no chunks (never offered), and
    // the chunk lands in the same transaction as `closed: true`.
    const session = await withTimeout(beginSession(type, extensionForMime(type)), 5_000);
    sessionId = session.id;
    await withTimeout(appendChunk({ ...session, closed: true }, 1, blob, RECORDING_MS / 1000), 5_000);
    const back = await withTimeout(assembleSession(session.id), 5_000);

    const facts: Bilingual[] = [
      { de: `Format: ${type}`, en: `Format: ${type}` },
      { de: `Größe: ${Math.max(1, Math.round(blob.size / 1024))} KB`, en: `Size: ${Math.max(1, Math.round(blob.size / 1024))} KB` },
    ];
    if (!back || back.blob.size !== blob.size) {
      return result(
        "fail",
        { de: "Die Aufnahme wurde gespeichert, kam aber nicht vollständig zurück.", en: "The recording was stored but did not come back completely." },
        {
          de: "Browser neu starten und erneut prüfen; bleibt es so, im Workshop mit dem Handy aufnehmen.",
          en: "Restart the browser and check again; if it persists, record with a phone in the workshop.",
        },
        facts,
      );
    }
    const duration = await decodes(back.blob);
    if (duration === null) {
      return result(
        "warn",
        { de: "Aufnahme und Speichern klappen, die Probe ließ sich hier aber nicht abspielen.", en: "Recording and storing work, but the test could not be played back here." },
        {
          de: "Vor dem Workshop eine längere Probeaufnahme machen und die Datei anhören.",
          en: "Make a longer test recording before the workshop and listen to the file.",
        },
        facts,
      );
    }
    return result(
      "ok",
      { de: "Aufnehmen, Speichern und Wiederlesen funktionieren.", en: "Recording, storing and reading back work." },
      undefined,
      facts,
    );
  } catch (err) {
    if (isQuotaError(err)) {
      return result(
        "fail",
        { de: "Der Speicher ist voll: Aufnahmen können nicht gesichert werden.", en: "Storage is full: recordings cannot be saved." },
        {
          de: "Alte Aufnahmen herunterladen und verwerfen oder Speicherplatz auf dem Laptop freigeben.",
          en: "Download and discard old recordings or free up disk space on the laptop.",
        },
      );
    }
    if (err instanceof CheckTimeout) return timeoutResult("recording");
    console.error("[system-check] probe recording failed", err);
    return result(
      "fail",
      { de: "Die Probeaufnahme ließ sich nicht speichern.", en: "The test recording could not be stored." },
      {
        de: "Nicht im privaten Fenster arbeiten, Browser neu starten und erneut prüfen.",
        en: "Do not work in a private window, restart the browser and check again.",
      },
    );
  } finally {
    stream.getTracks().forEach((t) => t.stop());
    if (sessionId) {
      const id = sessionId;
      void deleteSession(id).catch((err) => console.error("[system-check] probe cleanup failed", { sessionId: id, err }));
    }
  }
}

// ---------------------------------------------------------------------------
// Storage

const LS_PROBE_KEY = "verbands-ceo.systemcheck.probe";
const IDB_PROBE_NAME = "verbands-ceo-systemcheck";
/** A full workshop day of recording is roughly 250 MB; below this it gets tight. */
const TIGHT_BYTES = 1024 ** 3;
const FULL_BYTES = 300 * 1024 ** 2;

function localStorageWorks(): boolean {
  try {
    const value = String(Date.now());
    window.localStorage.setItem(LS_PROBE_KEY, value);
    const ok = window.localStorage.getItem(LS_PROBE_KEY) === value;
    window.localStorage.removeItem(LS_PROBE_KEY);
    return ok;
  } catch {
    return false;
  }
}

function indexedDbWorks(): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    if (typeof indexedDB === "undefined") {
      resolve(false);
      return;
    }
    try {
      const req = indexedDB.open(IDB_PROBE_NAME, 1);
      req.onsuccess = () => {
        req.result.close();
        indexedDB.deleteDatabase(IDB_PROBE_NAME);
        resolve(true);
      };
      req.onerror = () => resolve(false);
      req.onblocked = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

export async function checkStorage(): Promise<CheckResult> {
  const local = localStorageWorks();
  const idb = await withTimeout(indexedDbWorks(), 4_000).catch(() => false);
  const estimate = navigator.storage?.estimate ? await withTimeout(navigator.storage.estimate(), 3_000).catch(() => null) : null;
  const persisted = navigator.storage?.persisted ? await withTimeout(navigator.storage.persisted(), 3_000).catch(() => null) : null;

  const facts: Bilingual[] = [];
  let free: number | null = null;
  if (estimate?.quota !== undefined) {
    const used = estimate.usage ?? 0;
    free = Math.max(0, estimate.quota - used);
    facts.push({
      de: `Belegt: ${bytesText(used).de} · frei: ${bytesText(free).de}`,
      en: `Used: ${bytesText(used).en} · free: ${bytesText(free).en}`,
    });
  }
  facts.push(
    persisted === true
      ? { de: "Vor automatischem Löschen geschützt", en: "Protected against automatic deletion" }
      : persisted === false
        ? { de: "Nicht vor automatischem Löschen geschützt", en: "Not protected against automatic deletion" }
        : { de: "Schutz vor Löschen: unbekannt", en: "Protection against deletion: unknown" },
  );

  if (!local || !idb) {
    return result(
      "fail",
      {
        de: !local
          ? "Eingaben lassen sich in diesem Browser nicht speichern."
          : "Die Aufnahme- und Interviewdatenbank ist in diesem Browser gesperrt.",
        en: !local ? "Entries cannot be saved in this browser." : "The recording and interview database is blocked in this browser.",
      },
      {
        de: "Kein privates Fenster verwenden und in den Browser-Einstellungen Website-Daten erlauben, dann neu laden.",
        en: "Do not use a private window and allow site data in the browser settings, then reload.",
      },
      facts,
    );
  }
  if (free !== null && free < FULL_BYTES) {
    return result(
      "fail",
      { de: `Nur noch ${bytesText(free).de} frei: Aufnahmen brechen bald ab.`, en: `Only ${bytesText(free).en} free: recordings will stop soon.` },
      {
        de: "Auf dem Laptop Speicherplatz freigeben (Downloads, Papierkorb) und erneut prüfen.",
        en: "Free up disk space on the laptop (downloads, recycle bin) and check again.",
      },
      facts,
    );
  }
  if (free !== null && free < TIGHT_BYTES) {
    return result(
      "warn",
      { de: `Nur ${bytesText(free).de} frei: Das reicht knapp für einen Aufnahmetag.`, en: `Only ${bytesText(free).en} free: barely enough for one day of recording.` },
      {
        de: "Speicherplatz freigeben und Aufnahmen am Tagesende herunterladen und verwerfen.",
        en: "Free up space and download and discard recordings at the end of the day.",
      },
      facts,
    );
  }
  if (persisted === false) {
    return {
      ...result(
        "warn",
        {
          de: "Speicher funktioniert, aber der Browser darf die Daten bei Platzmangel selbst löschen.",
          en: "Storage works, but the browser may delete the data by itself when space runs low.",
        },
        {
          de: "Auf „Speicher schützen“ klicken und am Ende jedes Tages eine Sicherung herunterladen.",
          en: "Click “Protect storage” and download a backup at the end of every day.",
        },
        facts,
      ),
      canRequestPersistence: true,
    };
  }
  return result(
    "ok",
    { de: "Speicher funktioniert und es ist genug Platz.", en: "Storage works and there is enough space." },
    { de: "Trotzdem am Ende jedes Tages eine Sicherung herunterladen.", en: "Still download a backup at the end of every day." },
    facts,
  );
}

/** Asks the browser to keep this site's data; Chrome decides without a prompt. */
export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;
  try {
    return await withTimeout(navigator.storage.persist(), 5_000);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Offline capability

export async function checkOffline(): Promise<CheckResult> {
  if (!("serviceWorker" in navigator) || typeof caches === "undefined") {
    return result(
      "fail",
      { de: "Dieser Browser kann die App nicht zwischenspeichern: Ohne Internet bleibt die Seite leer.", en: "This browser cannot cache the app: without internet the page stays blank." },
      { de: "Die App in Chrome oder Edge öffnen.", en: "Open the app in Chrome or Edge." },
    );
  }
  const registration = await withTimeout(navigator.serviceWorker.getRegistration(), 3_000).catch(() => undefined);
  const controlled = !!navigator.serviceWorker.controller;

  let files = 0;
  let indexCached = false;
  try {
    const names = await withTimeout(caches.keys(), 3_000);
    for (const name of names.filter((n) => n.includes("precache"))) {
      const cache = await caches.open(name);
      files += (await cache.keys()).length;
    }
    const index = new URL(`${import.meta.env.BASE_URL}index.html`, window.location.origin).href;
    indexCached = !!(await withTimeout(caches.match(index, { ignoreSearch: true }), 3_000));
  } catch (err) {
    console.error("[system-check] reading the offline cache failed", err);
  }

  const facts: Bilingual[] = [
    { de: `Offline-Dienst: ${registration?.active ? "aktiv" : "nicht aktiv"}`, en: `Offline service: ${registration?.active ? "active" : "not active"}` },
    { de: `Zwischengespeicherte Dateien: ${files}`, en: `Cached files: ${files}` },
  ];

  if (!registration) {
    return result(
      "warn",
      { de: "Die App ist auf diesem Gerät nicht zwischengespeichert: Bei Netzausfall lädt sie nicht neu.", en: "The app is not cached on this device: after a network drop it will not reload." },
      {
        de: "Bei bestehender Verbindung eine Folie öffnen, die Seite neu laden und hier erneut prüfen.",
        en: "While online, open a slide, reload the page and check here again.",
      },
      facts,
    );
  }
  if (!controlled || !indexCached) {
    return result(
      "warn",
      { de: "Die Offline-Kopie wird gerade eingerichtet oder ist unvollständig.", en: "The offline copy is being set up or is incomplete." },
      { de: "Bei bestehender Verbindung die Seite neu laden und erneut prüfen.", en: "While online, reload the page and check again." },
      facts,
    );
  }
  return result(
    "ok",
    {
      de: "Die App liegt auf diesem Gerät: Folien und Eingaben laufen auch ohne Internet weiter.",
      en: "The app is stored on this device: slides and entries keep working without internet.",
    },
    {
      de: "Diktat und KI-Knöpfe brauchen trotzdem Internet.",
      en: "Dictation and AI buttons still need internet.",
    },
    facts,
  );
}

// ---------------------------------------------------------------------------
// Screen

const SCALE_NAME: Record<FontScale, Bilingual> = {
  normal: { de: "Normal", en: "Normal" },
  large: { de: "Groß", en: "Large" },
  xlarge: { de: "Sehr groß", en: "Extra large" },
};

/**
 * The projector is read from across the room, so bigger is better — as long as
 * the layout still has room for sidebar, slide and protocol panel. The step
 * therefore follows the usable window width in CSS pixels.
 */
export function recommendScale(windowWidth: number): FontScale {
  if (windowWidth >= 1600) return "xlarge";
  if (windowWidth >= 1100) return "large";
  return "normal";
}

export function checkScreen(currentScale: FontScale): CheckResult {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const dpr = window.devicePixelRatio || 1;
  const physW = Math.round(window.screen.width * dpr);
  const physH = Math.round(window.screen.height * dpr);
  const extended = (window.screen as Screen & { isExtended?: boolean }).isExtended;
  const fullscreen = !!document.fullscreenEnabled;
  const recommended = recommendScale(w);

  const facts: Bilingual[] = [
    { de: `Bildschirm: ${physW} × ${physH}`, en: `Screen: ${physW} × ${physH}` },
    { de: `Fenster: ${w} × ${h} (Skalierung ${Math.round(dpr * 100)} %)`, en: `Window: ${w} × ${h} (scaling ${Math.round(dpr * 100)}%)` },
    { de: `Schriftstufe: ${SCALE_NAME[currentScale].de}`, en: `Font step: ${SCALE_NAME[currentScale].en}` },
  ];
  if (extended !== undefined) {
    facts.push(
      extended
        ? { de: "Zweiter Bildschirm angeschlossen (erweitert)", en: "Second screen connected (extended)" }
        : { de: "Kein erweiterter zweiter Bildschirm (gespiegelt oder keiner)", en: "No extended second screen (mirrored or none)" },
    );
  }
  facts.push(fullscreen ? { de: "Vollbild verfügbar", en: "Full screen available" } : { de: "Vollbild nicht verfügbar", en: "Full screen not available" });

  const scaleTip: Bilingual =
    recommended === currentScale
      ? { de: `Die Schriftstufe „${SCALE_NAME[recommended].de}“ passt zu diesem Fenster.`, en: `The font step “${SCALE_NAME[recommended].en}” suits this window.` }
      : {
          de: `Für den Beamer die Schriftstufe „${SCALE_NAME[recommended].de}“ übernehmen und von der letzten Reihe aus prüfen.`,
          en: `For the projector apply the font step “${SCALE_NAME[recommended].en}” and check from the back row.`,
        };

  if (w < 1024 || h < 600) {
    return {
      ...result(
        "warn",
        { de: `Das Fenster ist klein (${w} × ${h}): Folie und Protokoll werden eng.`, en: `The window is small (${w} × ${h}): slide and protocol get cramped.` },
        {
          de: "Browserfenster maximieren und am Beamer mindestens 1280 × 720 einstellen (Windows-Taste + P: „Duplizieren“ oder „Erweitern“).",
          en: "Maximise the browser window and set the projector to at least 1280 × 720 (Windows key + P: “Duplicate” or “Extend”).",
        },
        facts,
      ),
      recommendedScale: recommended,
    };
  }
  if (!fullscreen) {
    return {
      ...result(
        "warn",
        { de: "Vollbild ist hier nicht möglich: Adressleiste und Tabs bleiben auf dem Beamer sichtbar.", en: "Full screen is not possible here: address bar and tabs stay visible on the projector." },
        { de: "Die App direkt in Chrome oder Edge öffnen (nicht eingebettet) und F11 drücken.", en: "Open the app directly in Chrome or Edge (not embedded) and press F11." },
        facts,
      ),
      recommendedScale: recommended,
    };
  }
  return {
    ...result(
      "ok",
      { de: `Fenster ${w} × ${h} und Vollbild passen für den Beamer.`, en: `Window ${w} × ${h} and full screen suit the projector.` },
      scaleTip,
      facts,
    ),
    recommendedScale: recommended,
  };
}

export const FONT_SCALE_NAME = SCALE_NAME;

// ---------------------------------------------------------------------------
// Report text

const VERDICT_LABEL: Record<Verdict | "open", Bilingual> = {
  ok: { de: "OK", en: "OK" },
  warn: { de: "ACHTUNG", en: "WARNING" },
  fail: { de: "PROBLEM", en: "PROBLEM" },
  skipped: { de: "ÜBERSPRUNGEN", en: "SKIPPED" },
  open: { de: "NICHT GEPRÜFT", en: "NOT CHECKED" },
};

export interface Tally {
  ok: number;
  warn: number;
  fail: number;
  skipped: number;
  open: number;
}

export function tally(results: Partial<Record<CheckId, CheckResult>>): Tally {
  const t: Tally = { ok: 0, warn: 0, fail: 0, skipped: 0, open: 0 };
  for (const group of CHECK_GROUPS) {
    for (const id of group.checks) {
      const r = results[id];
      if (r) t[r.verdict] += 1;
      else t.open += 1;
    }
  }
  return t;
}

export function formatReport(results: Partial<Record<CheckId, CheckResult>>, lang: Lang): string {
  const de = lang === "de";
  const stamp = new Date().toLocaleString(de ? "de-DE" : "en-GB", { dateStyle: "short", timeStyle: "short" });
  const b = detectBrowser();
  const t = tally(results);
  const lines: string[] = [
    `${de ? "Technik-Check FBS-Workshop" : "Tech check FBS workshop"} · ${stamp}`,
    `${b.name}${b.version ? ` ${b.version}` : ""}${b.os ? ` · ${b.os}` : ""} · ${window.innerWidth} × ${window.innerHeight}`,
    de
      ? `Ergebnis: ${t.fail} Problem(e), ${t.warn} Achtung, ${t.ok} OK${t.skipped ? `, ${t.skipped} übersprungen` : ""}${t.open ? `, ${t.open} nicht geprüft` : ""}`
      : `Result: ${t.fail} problem(s), ${t.warn} warning(s), ${t.ok} OK${t.skipped ? `, ${t.skipped} skipped` : ""}${t.open ? `, ${t.open} not checked` : ""}`,
  ];
  for (const group of CHECK_GROUPS) {
    lines.push("", group.title[lang].toUpperCase());
    for (const id of group.checks) {
      const r = results[id];
      const title = CHECKS[id].title[lang];
      if (!r) {
        lines.push(`[${VERDICT_LABEL.open[lang]}] ${title}`);
        continue;
      }
      lines.push(`[${VERDICT_LABEL[r.verdict][lang]}] ${title}: ${r.finding[lang]}`);
      if (r.action) lines.push(`  → ${r.action[lang]}`);
      if (r.facts?.length) lines.push(`  (${r.facts.map((f) => f[lang]).join(" · ")})`);
    }
  }
  return lines.join("\n");
}
