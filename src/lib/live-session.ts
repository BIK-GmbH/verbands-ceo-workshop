/**
 * Spoken conversation with GPT-Live (OpenAI) straight from the browser — for
 * the optional live demo, never running in the background.
 *
 * Connection (see developers.openai.com/api/docs/guides/voice-webrtc?api=live):
 * the browser builds a WebRTC offer with the microphone track and a data
 * channel, posts it to `POST /v1/live/sessions` and applies the SDP answer.
 * Speech travels on the media tracks, transcripts and control events on the
 * data channel. OpenAI recommends creating the session on a server; this app
 * has none, so the request carries the facilitator's OpenAI key from this
 * device — the same trust model as transcription (key only in localStorage of
 * the moderation laptop). The endpoint allows CORS for exactly that call.
 *
 * No delegation backend: the demo shows the conversation itself. Should the
 * model still hand a task over, it gets a short spoken "no documents here".
 */
import { getOpenAiKey } from "./transcribe";

const ENDPOINT = "https://api.openai.com/v1/live/sessions";
export const LIVE_MODEL = "gpt-live-1";
/** Published price per minute of voice session (USD), for the cost hint in the UI. */
export const LIVE_PRICE_PER_MINUTE_USD = 0.05;
const ICE_TIMEOUT_MS = 10_000;
const CLOSE_TIMEOUT_MS = 15_000;

export type LiveErrorCode = "no-key" | "no-mic" | "auth" | "access" | "rate" | "quota" | "network" | "connection" | "api";

export class LiveError extends Error {
  readonly code: LiveErrorCode;
  constructor(code: LiveErrorCode, detail?: string) {
    super(detail ?? code);
    this.name = "LiveError";
    this.code = code;
  }
}

export type Speaker = "user" | "assistant";

export interface TranscriptFragment {
  speaker: Speaker;
  text: string;
  startMs: number;
  endMs: number;
}

export type CloseReason = "close_requested" | "expired" | "content" | "remote_hangup" | "connection_lost" | "unconfirmed";

export interface LiveCallbacks {
  onStarted: () => void;
  onTranscript: (fragment: TranscriptFragment) => void;
  onUsage: (seconds: number) => void;
  /** Recoverable problem inside a running session (e.g. moderation cut off a reply). */
  onWarning: (message: string) => void;
  onClosed: (reason: CloseReason) => void;
}

export interface LiveOptions {
  instructions: string;
  /** Spoken right after the start, before anyone in the room says something. */
  greeting?: string;
  voice?: string;
}

export interface LiveController {
  /** Graceful end: waits for the final event, then releases microphone and connection. */
  close: () => Promise<void>;
  setMuted: (muted: boolean) => void;
}

function errorFor(status: number, message: string): LiveError {
  if (status === 401) return new LiveError("auth", message);
  if (status === 403 || status === 404) return new LiveError("access", message);
  if (status === 429) return new LiveError(/quota/i.test(message) ? "quota" : "rate", message);
  return new LiveError("api", `${status} ${message}`.trim());
}

async function waitForIce(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === "complete") return;
  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      pc.removeEventListener("icegatheringstatechange", onState);
      reject(new LiveError("connection", "ICE gathering timed out"));
    }, ICE_TIMEOUT_MS);
    function onState() {
      if (pc.iceGatheringState !== "complete") return;
      window.clearTimeout(timeout);
      pc.removeEventListener("icegatheringstatechange", onState);
      resolve();
    }
    pc.addEventListener("icegatheringstatechange", onState);
  });
}

/**
 * Opens a live session. Resolves once the connection is negotiated; the model
 * is ready when `onStarted` fires. Throws LiveError for setup failures.
 */
export async function startLiveSession(
  options: LiveOptions,
  audio: HTMLAudioElement,
  cb: LiveCallbacks,
): Promise<LiveController> {
  const apiKey = getOpenAiKey();
  if (!apiKey) throw new LiveError("no-key");

  let microphone: MediaStream;
  try {
    microphone = await navigator.mediaDevices.getUserMedia({
      // Echo cancellation keeps the model from hearing its own voice from the room speakers.
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
  } catch (err) {
    throw new LiveError("no-mic", err instanceof Error ? err.message : String(err));
  }

  const pc = new RTCPeerConnection();
  let closed = false;
  let finalReason: CloseReason | null = null;
  let closeTimer: number | null = null;
  let resolveClosed: (() => void) | null = null;
  let eventCounter = 0;
  const nextId = (prefix: string) => `${prefix}_${++eventCounter}`;

  const release = (reason: CloseReason) => {
    if (closed) return;
    closed = true;
    if (closeTimer !== null) window.clearTimeout(closeTimer);
    microphone.getTracks().forEach((t) => t.stop());
    try {
      events.close();
    } catch {
      /* already closed */
    }
    pc.close();
    audio.srcObject = null;
    cb.onClosed(reason);
    resolveClosed?.();
  };

  pc.addEventListener("track", (e) => {
    audio.srcObject = new MediaStream([e.track]);
    void audio.play().catch(() => cb.onWarning("autoplay"));
  });
  for (const track of microphone.getAudioTracks()) pc.addTrack(track, microphone);

  // The channel and its listeners must exist before the offer is created.
  const events = pc.createDataChannel("oai-events");
  const send = (payload: Record<string, unknown>) => {
    if (events.readyState === "open") events.send(JSON.stringify(payload));
  };

  events.addEventListener("message", ({ data }) => {
    let event: Record<string, unknown>;
    try {
      event = JSON.parse(String(data)) as Record<string, unknown>;
    } catch {
      console.error("[live-session] unreadable event");
      return;
    }
    switch (event.type) {
      case "session.started":
        cb.onStarted();
        if (options.greeting) {
          send({
            type: "session.instructions.append",
            event_id: nextId("greeting"),
            delegation_id: null,
            content: `Begrüße jetzt sofort auf Deutsch, ohne auf die andere Seite zu warten, und höre danach zu. Sinngemäß: ${options.greeting}`,
          });
        }
        break;
      case "session.input_transcript.delta":
      case "session.output_transcript.delta":
        if (typeof event.delta === "string" && event.delta) {
          cb.onTranscript({
            speaker: event.type === "session.input_transcript.delta" ? "user" : "assistant",
            text: event.delta,
            startMs: typeof event.start_ms === "number" ? event.start_ms : 0,
            endMs: typeof event.end_ms === "number" ? event.end_ms : 0,
          });
        }
        break;
      case "session.usage.updated": {
        const seconds = (event.usage as { seconds?: unknown } | undefined)?.seconds;
        if (typeof seconds === "number") cb.onUsage(seconds);
        break;
      }
      case "session.delegation.created": {
        // No backend in this demo — say so instead of leaving the task hanging.
        const delegationId = typeof event.delegation_id === "string" ? event.delegation_id : (event.delegation as { id?: string } | undefined)?.id;
        if (delegationId) {
          send({
            type: "session.commentary.append",
            event_id: nextId("no_backend"),
            delegation_id: delegationId,
            content: "In dieser Demo habe ich keinen Zugriff auf Unterlagen oder Werkzeuge. Das müsste ich in echt nachschlagen lassen.",
          });
        }
        break;
      }
      case "error": {
        const err = event.error as { message?: string; code?: string | null } | undefined;
        // Moderation may cut off a reply without ending the session; the message is shown, never logged with content.
        console.error("[live-session] session error", { code: err?.code ?? null });
        cb.onWarning(err?.message ?? "error");
        break;
      }
      case "session.closed": {
        const reason = typeof event.reason === "string" ? (event.reason as CloseReason) : "close_requested";
        const usage = (event.usage as { seconds?: unknown } | undefined)?.seconds;
        if (typeof usage === "number") cb.onUsage(usage);
        finalReason = reason;
        release(reason);
        break;
      }
      default:
        break;
    }
  });
  events.addEventListener("close", () => {
    if (!closed) release(finalReason ?? "unconfirmed");
  });

  try {
    await pc.setLocalDescription(await pc.createOffer());
    await waitForIce(pc);
    const sdp = pc.localDescription?.sdp;
    if (!sdp) throw new LiveError("connection", "missing local SDP offer");

    const voice = options.voice;
    let res: Response;
    try {
      res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          session: {
            model: LIVE_MODEL,
            instructions: options.instructions,
            ...(voice ? { audio: { output: { voice } } } : {}),
          },
          transport: { type: "webrtc", sdp },
        }),
      });
    } catch (err) {
      throw new LiveError("network", err instanceof Error ? err.message : String(err));
    }
    if (!res.ok) {
      let message = "";
      try {
        message = ((await res.json()) as { error?: { message?: string } }).error?.message ?? "";
      } catch {
        /* no JSON body */
      }
      throw errorFor(res.status, message);
    }
    const body = (await res.json()) as { transport?: { sdp?: string } };
    const answer = body.transport?.sdp;
    if (!answer) throw new LiveError("api", "missing SDP answer");
    await pc.setRemoteDescription({ type: "answer", sdp: answer });
  } catch (err) {
    const liveErr = err instanceof LiveError ? err : new LiveError("connection", err instanceof Error ? err.message : String(err));
    console.error("[live-session] start failed", { code: liveErr.code, detail: liveErr.message });
    closed = true;
    microphone.getTracks().forEach((t) => t.stop());
    pc.close();
    throw liveErr;
  }

  return {
    close: () => {
      if (closed) return Promise.resolve();
      return new Promise<void>((resolve) => {
        resolveClosed = resolve;
        if (events.readyState !== "open") {
          release("unconfirmed");
          return;
        }
        // Keep media and channel alive until session.closed arrives with the final usage.
        send({ type: "session.close", event_id: nextId("close") });
        closeTimer = window.setTimeout(() => release("unconfirmed"), CLOSE_TIMEOUT_MS);
      });
    },
    setMuted: (muted) => {
      // Muting the local track stops sending speech; the session and the model's speech keep running.
      microphone.getAudioTracks().forEach((t) => (t.enabled = !muted));
    },
  };
}
