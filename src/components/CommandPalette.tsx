import { Command } from "cmdk";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { MANIFEST } from "@/lib/slides";
import { pick, t } from "@/lib/i18n";
import type { Lang } from "@/types/slide";

interface Props {
  open: boolean;
  onClose: () => void;
  lang: Lang;
}

export function CommandPalette({ open, onClose, lang }: Props) {
  const nav = useNavigate();
  if (!open) return null;

  return (
    <div
      data-command-palette-overlay
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4"
      style={{ background: "rgba(0,0,0,0.4)" }}
      onClick={onClose}
    >
      <div
        className="w-[min(640px,92vw)] rounded-lg shadow-xl overflow-hidden border"
        style={{ background: "var(--bg)", borderColor: "var(--border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <Command label="Workshop search">
          <div
            className="flex items-center gap-2 px-4 border-b"
            style={{ borderColor: "var(--border)" }}
          >
            <Search size={16} strokeWidth={2.25} style={{ color: "var(--fg-muted)" }} />
            <Command.Input
              placeholder={t("search", lang)}
              className="flex-1 py-3 outline-none text-sm bg-transparent"
              style={{ color: "var(--fg)" }}
              autoFocus
            />
          </div>
          <Command.List className="max-h-[60vh] overflow-y-auto p-2">
            <Command.Empty className="px-4 py-6 text-sm text-center" style={{ color: "var(--fg-muted)" }}>
              —
            </Command.Empty>
            {MANIFEST.map((m) => (
              <Command.Group
                key={m.index}
                heading={`${m.index === 99 ? "Anhang" : `${t("module", lang)} ${m.index}`} · ${pick(m.title, lang)}`}
                className="text-xs uppercase tracking-wider px-2 py-1"
              >
                {m.slides.map((s) => (
                  <Command.Item
                    key={s.id}
                    value={`${s.id} ${pick(s.title, lang)}`}
                    onSelect={() => {
                      nav(`/s/${s.id}`);
                      onClose();
                    }}
                    className="px-3 py-2 rounded text-sm cursor-pointer flex items-center gap-3 data-[selected=true]:bg-black/5"
                  >
                    <span className="font-mono text-xs" style={{ color: "var(--fg-muted)" }}>
                      {s.id}
                    </span>
                    <span>{pick(s.title, lang)}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            ))}
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
