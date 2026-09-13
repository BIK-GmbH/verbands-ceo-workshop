import { useState } from "react";
import { CheckCircle2, CircleAlert, CircleHelp, Loader2, ShieldQuestion } from "lucide-react";
import type { Lang } from "@/types/slide";
import { useApiKey } from "@/lib/ai-assist";
import { useOpenAiKey } from "@/lib/transcribe";
import {
  KEY_STATE_LABEL,
  anthropicStoredState,
  checkAnthropicKey,
  checkOpenAiKey,
  keyTone,
  maskKey,
  openAiStoredState,
  type KeyStatus,
} from "@/lib/key-check";

const TONE_COLOR = { ok: "#15803d", warn: "#b45309", bad: "#dc2626" } as const;

/**
 * Shows per provider whether a key is stored and — on request — whether it
 * actually works. The live check is a click, never automatic: it would send
 * requests nobody asked for, and a stored key can be valid while the account
 * has no credit left. Reading the model list costs no tokens.
 */
export function ApiKeyStatus({ provider, lang }: { provider: "anthropic" | "openai"; lang: Lang }) {
  const de = lang === "de";
  const claudeKey = useApiKey();
  const openAiKey = useOpenAiKey();
  const key = provider === "anthropic" ? claudeKey : openAiKey;
  const stored = provider === "anthropic" ? anthropicStoredState(key) : openAiStoredState(key);

  const [checked, setChecked] = useState<KeyStatus | null>(null);
  const [busy, setBusy] = useState(false);

  // A new key invalidates an earlier verdict.
  const [lastKey, setLastKey] = useState(key);
  if (lastKey !== key) {
    setLastKey(key);
    setChecked(null);
  }

  const status = checked ?? stored;
  const tone = keyTone(status.state);
  const color = TONE_COLOR[tone];
  const name = provider === "anthropic" ? "Claude (Anthropic)" : "OpenAI";

  const run = async () => {
    setBusy(true);
    try {
      setChecked(provider === "anthropic" ? await checkAnthropicKey(key) : await checkOpenAiKey(key));
    } finally {
      setBusy(false);
    }
  };

  const Icon =
    tone === "ok" ? CheckCircle2 : status.state === "missing" ? CircleHelp : tone === "warn" ? ShieldQuestion : CircleAlert;

  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-md px-3 py-2 text-sm"
      style={{ background: "var(--bg-elev)", border: "1px solid var(--border)" }}
      data-testid={`key-status-${provider}`}
    >
      <span className="font-medium">{name}</span>
      <span className="inline-flex items-center gap-1.5" style={{ color }}>
        <Icon size={15} />
        {KEY_STATE_LABEL[status.state][lang]}
      </span>
      {key && (
        <span className="font-mono text-xs" style={{ color: "var(--fg-muted)" }}>
          {maskKey(key)}
        </span>
      )}
      {status.detail && (
        <span className="text-xs" style={{ color: "var(--fg-muted)" }}>
          {status.detail}
        </span>
      )}
      {key && (
        <button
          type="button"
          onClick={() => void run()}
          disabled={busy}
          title={
            de
              ? "Fragt beim Anbieter die Modell-Liste ab. Das verbraucht keine Token und kostet nichts."
              : "Asks the provider for its model list. This uses no tokens and costs nothing."
          }
          className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium disabled:opacity-60"
          style={{ border: "1px solid var(--workshop-accent)", color: "var(--workshop-accent)", background: "var(--bg)" }}
        >
          {busy && <Loader2 size={13} className="animate-spin" />}
          {de ? "Jetzt prüfen" : "Check now"}
        </button>
      )}
    </div>
  );
}
