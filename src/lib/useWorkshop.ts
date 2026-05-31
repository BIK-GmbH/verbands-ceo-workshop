import { useCallback, useSyncExternalStore } from "react";
import {
  type CaptureEntry,
  type CaptureKind,
  type WorkshopMeta,
  getEntry,
  setEntry,
  getMeta,
  setMeta,
  getAllEntries,
  subscribe,
} from "./workshop-store";

/** Live list of all captured entries (re-renders on any store change). */
export function useAllEntries(): CaptureEntry[] {
  return useSyncExternalStore(subscribe, getAllEntries, getAllEntries);
}

/** Live workshop meta (title/date/participants). */
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
      setEntry({
        id: cfg.id,
        module: cfg.module,
        slideId: cfg.slideId,
        kind: cfg.kind,
        prompt: cfg.prompt,
        value: v,
      });
    },
    [cfg.id, cfg.module, cfg.slideId, cfg.kind, cfg.prompt],
  );

  const fallback: CaptureEntry["value"] = cfg.kind === "checklist" ? [] : "";
  return [value ?? fallback, set];
}
