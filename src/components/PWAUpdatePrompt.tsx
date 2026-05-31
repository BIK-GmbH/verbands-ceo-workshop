import { useEffect, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { RefreshCw, X } from "lucide-react";
import { useLang } from "@/lib/i18n";

const ICON = { strokeWidth: 2.25 } as const;

/** Floating banner: appears when a new SW version is available, or once on first install. */
export function PWAUpdatePrompt() {
  const [lang] = useLang();
  const [installed, setInstalled] = useState(false);
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onRegisteredSW(_, registration) {
      // Periodic update check (every 60 min while session is open)
      if (!registration) return;
      setInterval(() => registration.update(), 60 * 60 * 1000);
    },
    onRegisterError(err) {
      // Common in dev or first-load — fail silent.
      console.warn("[pwa] SW register failed:", err);
    },
  });

  useEffect(() => {
    if (offlineReady && !installed) {
      setInstalled(true);
      // Auto-dismiss the offline-ready toast after a few seconds
      const t = setTimeout(() => setOfflineReady(false), 4000);
      return () => clearTimeout(t);
    }
  }, [offlineReady, installed, setOfflineReady]);

  if (!needRefresh && !offlineReady) return null;

  const isUpdate = needRefresh;

  return (
    <div
      data-pwa-prompt
      className="fixed bottom-[calc(var(--footer-height)+12px)] left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-3 py-2 rounded-lg shadow-lg max-w-[92vw] no-print"
      style={{
        background: "var(--workshop-accent)",
        color: "white",
      }}
      role="status"
    >
      {isUpdate ? (
        <RefreshCw size={16} {...ICON} />
      ) : (
        <span aria-hidden>✓</span>
      )}
      <span className="text-sm">
        {isUpdate
          ? lang === "de"
            ? "Neue Version verfügbar"
            : "New version available"
          : lang === "de"
          ? "Bereit für Offline-Nutzung"
          : "Ready for offline use"}
      </span>
      {isUpdate && (
        <button
          onClick={() => updateServiceWorker(true)}
          className="text-xs px-2.5 py-1 rounded-md font-medium"
          style={{ background: "rgba(255,255,255,0.22)" }}
        >
          {lang === "de" ? "Aktualisieren" : "Update"}
        </button>
      )}
      <button
        onClick={() => {
          setNeedRefresh(false);
          setOfflineReady(false);
        }}
        className="size-7 grid place-items-center rounded-md hover:bg-white/15"
        aria-label={lang === "de" ? "Schließen" : "Close"}
      >
        <X size={14} {...ICON} />
      </button>
    </div>
  );
}
