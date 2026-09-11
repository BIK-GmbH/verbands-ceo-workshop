import { useState } from "react";
import { AudioLines, CheckCircle2, KeyRound, Sparkles } from "lucide-react";
import type { Lang } from "@/types/slide";
import { AiKeySetup } from "@/components/ProtocolAi";
import { setApiKey, useApiKey } from "@/lib/ai-assist";
import { isPlausibleOpenAiKey, setOpenAiKey, useOpenAiKey } from "@/lib/transcribe";
import { BTN_SM, ERROR_COLOR, card, field, muted, outline } from "./ui";

/** One-time, per-device setup of the OpenAI key used for transcription. */
function OpenAiKeySetup({ lang }: { lang: Lang }) {
  const de = lang === "de";
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  const submit = () => {
    const key = value.trim();
    if (!isPlausibleOpenAiKey(key)) {
      setError(
        de
          ? "Das sieht nicht nach einem OpenAI-API-Schlüssel aus (beginnt mit „sk-“, nicht mit „sk-ant-“)."
          : "That doesn't look like an OpenAI API key (starts with “sk-”, not “sk-ant-”).",
      );
      return;
    }
    try {
      setOpenAiKey(key);
      setValue("");
      setError("");
    } catch {
      setError(de ? "Der Schlüssel konnte in diesem Browser nicht gespeichert werden." : "The key could not be stored in this browser.");
    }
  };

  return (
    <div className="rounded-md p-2.5 space-y-2 text-xs" style={{ background: "var(--bg)", border: "1px dashed var(--border)" }}>
      <div className="flex items-center gap-1.5 font-semibold">
        <KeyRound size={14} style={{ color: "var(--workshop-accent)" }} />
        {de ? "OpenAI-Schlüssel einrichten" : "Set up OpenAI key"}
      </div>
      <div className="flex gap-1.5">
        <input
          type="password"
          autoComplete="off"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="sk-…"
          aria-label={de ? "OpenAI-API-Schlüssel" : "OpenAI API key"}
          className="flex-1 min-w-0 rounded-md p-1.5"
          style={field}
        />
        <button
          type="button"
          onClick={submit}
          className="px-2.5 rounded-md font-medium shrink-0"
          style={{ background: "var(--workshop-accent)", color: "white" }}
        >
          {de ? "Speichern" : "Save"}
        </button>
      </div>
      {error && <p style={{ color: ERROR_COLOR }}>{error}</p>}
    </div>
  );
}

function KeyStatus({ lang, onRemove }: { lang: Lang; onRemove: () => void }) {
  const de = lang === "de";
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="inline-flex items-center gap-1 font-medium" style={{ color: "var(--workshop-accent)" }}>
        <CheckCircle2 size={14} /> {de ? "Schlüssel hinterlegt (nur in diesem Browser)" : "Key stored (this browser only)"}
      </span>
      <button type="button" onClick={onRemove} className={`${BTN_SM} ml-auto`} style={outline}>
        {de ? "Entfernen" : "Remove"}
      </button>
    </div>
  );
}

function removeSafely(remove: (k: string) => void) {
  try {
    remove("");
  } catch (err) {
    console.error("[interviews] removing API key failed", err);
  }
}

export function InterviewSetup({ lang }: { lang: Lang }) {
  const de = lang === "de";
  const openAiKey = useOpenAiKey();
  const claudeKey = useApiKey();

  return (
    <section className="grid md:grid-cols-2 gap-3" aria-label={de ? "Einrichtung" : "Setup"}>
      <div className="rounded-md p-3 space-y-2" style={card}>
        <div className="flex items-center gap-2 text-sm font-semibold">
          <AudioLines size={16} style={{ color: "var(--workshop-accent)" }} />
          {de ? "Transkription · OpenAI" : "Transcription · OpenAI"}
        </div>
        <p className="text-xs leading-snug" style={muted}>
          {de
            ? "Zum Transkribieren wird die Audiodatei an die OpenAI-API übertragen (gpt-4o-transcribe). Der Schlüssel bleibt nur in diesem Browser. Nur auf einem Gerät der Moderation einrichten."
            : "For transcription the audio file is sent to the OpenAI API (gpt-4o-transcribe). The key stays in this browser only. Set up only on a facilitator's device."}
        </p>
        {openAiKey ? <KeyStatus lang={lang} onRemove={() => removeSafely(setOpenAiKey)} /> : <OpenAiKeySetup lang={lang} />}
      </div>
      <div className="rounded-md p-3 space-y-2" style={card}>
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles size={16} style={{ color: "var(--workshop-accent)" }} />
          {de ? "Meinungsbilder · Claude" : "Opinion pictures · Claude"}
        </div>
        <p className="text-xs leading-snug" style={muted}>
          {de
            ? "Für die Meinungsbilder wird das Transkript (ohne Pseudonym) an die Claude-API (Anthropic) übertragen. Derselbe Schlüssel dient auch der KI-Überarbeitung im Protokoll."
            : "For the opinion pictures the transcript (without pseudonym) is sent to the Claude API (Anthropic). The same key also powers AI rewording in the record."}
        </p>
        {claudeKey ? <KeyStatus lang={lang} onRemove={() => removeSafely(setApiKey)} /> : <AiKeySetup lang={lang} />}
      </div>
    </section>
  );
}
