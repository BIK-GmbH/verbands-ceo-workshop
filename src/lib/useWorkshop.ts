import { useCallback, useSyncExternalStore } from "react";
import {
  type CaptureEntry,
  type CaptureKind,
  type WorkshopMeta,
  getEntry,
  setEntry,
  removeEntry,
  getMeta,
  setMeta,
  getAllEntries,
  subscribe,
} from "./workshop-store";

/** Live list of all captured entries (re-renders on any store change). */
export function useAllEntries(): CaptureEntry[] {
  return useSyncExternalStore(subscribe, getAllEntries, getAllEntries);
}

/** Live workshop meta (title/date/participants/participantsList). */
export function useWorkshopMeta(): [WorkshopMeta, (p: Partial<WorkshopMeta>) => void] {
  const meta = useSyncExternalStore(subscribe, getMeta, getMeta);
  return [meta, setMeta];
}

interface CaptureConfig {
  id: string;
  module: number;
  slideId: string;
  kind: CaptureKind;
  prompt: string;
  /**
   * When true, clearing the field (empty string / empty array) deletes the
   * entry entirely instead of storing an empty value. Used for notes and the
   * structured exercise fields so "clear the text" means "remove the
   * contribution". Ad-hoc questions set this false — they persist (the prompt
   * is the content) and are removed via an explicit delete action.
   */
  removeWhenEmpty?: boolean;
}

function isEmpty(v: CaptureEntry["value"]): boolean {
  return Array.isArray(v) ? v.length === 0 : v.trim() === "";
}

/**
 * Bind a capture field to the store. Returns the current value and a setter.
 * `value` is "" or [] until the user enters something.
 */
export function useCapture(
  cfg: CaptureConfig,
): [CaptureEntry["value"], (v: CaptureEntry["value"]) => void] {
  const snapshot = useCallback(() => getEntry(cfg.id)?.value, [cfg.id]);
  const value = useSyncExternalStore(subscribe, snapshot, snapshot);

  const set = useCallback(
    (v: CaptureEntry["value"]) => {
      if (cfg.removeWhenEmpty && isEmpty(v)) {
        removeEntry(cfg.id);
        return;
      }
      setEntry({
        id: cfg.id,
        module: cfg.module,
        slideId: cfg.slideId,
        kind: cfg.kind,
        prompt: cfg.prompt,
        value: v,
      });
    },
    [cfg.id, cfg.module, cfg.slideId, cfg.kind, cfg.prompt, cfg.removeWhenEmpty],
  );

  const fallback: CaptureEntry["value"] = cfg.kind === "checklist" ? [] : "";
  return [value ?? fallback, set];
}
