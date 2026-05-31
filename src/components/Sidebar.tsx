import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import clsx from "clsx";
import { ChevronDown, ChevronLeft, ChevronRight, Menu, X } from "lucide-react";
import { MANIFEST } from "@/lib/slides";
import { pick, t } from "@/lib/i18n";
import type { Lang } from "@/types/slide";

const ICON = { strokeWidth: 2.25 } as const;
const DRAWER_EXIT_MS = 220;

interface Props {
  lang: Lang;
  /** Desktop: collapsed (icon-only). Ignored on mobile. */
  collapsed: boolean;
  onToggleCollapse: () => void;
  /** Mobile drawer open state */
  mobileOpen: boolean;
  /** Close drawer (called on backdrop click + slide click) */
  onMobileClose: () => void;
}

export function Sidebar({
  lang,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onMobileClose,
}: Props) {
  const params = useParams<{ slideId: string }>();
  const activeId = params.slideId;
  const activeModule = activeId ? Number(activeId.split(".")[0]) : 0;

  const [openModules, setOpenModules] = useState<Set<number>>(
    () => new Set([activeModule]),
  );

  // Auto-expand active module when slide changes
  useEffect(() => {
    setOpenModules((prev) => new Set([...prev, activeModule]));
  }, [activeModule]);

  // Drawer lifecycle: keep mounted during exit animation, then unmount.
  const [drawerMounted, setDrawerMounted] = useState(false);
  const [drawerExiting, setDrawerExiting] = useState(false);
  useEffect(() => {
    if (mobileOpen) {
      setDrawerExiting(false);
      setDrawerMounted(true);
      return;
    }
    if (drawerMounted) {
      setDrawerExiting(true);
      const t = setTimeout(() => {
        setDrawerMounted(false);
        setDrawerExiting(false);
      }, DRAWER_EXIT_MS);
      return () => clearTimeout(t);
    }
  }, [mobileOpen, drawerMounted]);

  function toggleModule(idx: number) {
    setOpenModules((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  // Mobile collapsed-icon view doesn't make sense; on mobile we only render
  // when mobileOpen is true (as drawer).
  // Desktop: render collapsed icon-strip if collapsed.
  if (collapsed) {
    return (
      <aside
        data-workshop-sidebar
        data-collapsed="1"
        className="hidden md:flex border-r flex-col items-center py-3"
        style={{ borderColor: "var(--border)", background: "var(--bg-elev)", width: 48 }}
      >
        <button
          onClick={onToggleCollapse}
          className="size-8 grid place-items-center rounded-md hover:bg-black/5 transition-colors"
          aria-label="Expand sidebar"
          title="Expand sidebar"
        >
          <Menu size={18} {...ICON} />
        </button>
      </aside>
    );
  }

  const sidebarBody = (
    <>
      <div
        className="px-4 py-3 border-b flex items-center justify-between"
        style={{ borderColor: "var(--border)" }}
      >
        <span
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: "var(--fg-muted)" }}
        >
          {t("module", lang)}e
        </span>
        <div className="flex items-center gap-1">
          {/* Desktop collapse */}
          <button
            onClick={onToggleCollapse}
            className="hidden md:grid size-7 place-items-center rounded-md hover:bg-black/5 transition-colors"
            title="Collapse sidebar"
            aria-label="Collapse sidebar"
          >
            <ChevronLeft size={16} {...ICON} />
          </button>
          {/* Mobile close */}
          <button
            onClick={onMobileClose}
            className="md:hidden size-9 grid place-items-center rounded-md hover:bg-black/5 active:bg-black/10 transition-colors"
            title="Schließen"
            aria-label="Schließen"
          >
            <X size={18} {...ICON} />
          </button>
        </div>
      </div>

      <nav className="py-2 overflow-y-auto flex-1">
        {MANIFEST.map((m) => {
          const isActive = m.index === activeModule;
          const isOpen = openModules.has(m.index);
          return (
            <div key={m.index} className="mb-1">
              <button
                onClick={() => toggleModule(m.index)}
                data-testid={`module-toggle-${m.index}`}
                className={clsx(
                  "w-full text-left px-4 py-2 flex items-center gap-2 text-sm font-medium",
                  "hover:bg-black/5 active:bg-black/10",
                  isActive && "border-l-2",
                )}
                style={isActive ? { borderColor: "var(--workshop-accent)" } : undefined}
                aria-expanded={isOpen}
              >
                <span
                  className="text-xs font-mono w-7 shrink-0"
                  style={{ color: "var(--fg-muted)" }}
                >
                  {m.index === 99 ? "Anh" : String(m.index).padStart(2, "0")}
                </span>
                <span className="flex-1 truncate">{pick(m.title, lang)}</span>
                <span className="opacity-50 shrink-0">
                  {isOpen ? (
                    <ChevronDown size={14} {...ICON} />
                  ) : (
                    <ChevronRight size={14} {...ICON} />
                  )}
                </span>
              </button>

              <div
                className="accordion-content"
                data-open={isOpen ? "true" : "false"}
                aria-hidden={!isOpen}
              >
                <div>
                  <ul className="pl-11 pr-3 pb-1">
                    {m.slides.map((s) => {
                      const slideActive = s.id === activeId;
                      return (
                        <li key={s.id}>
                          <Link
                            to={`/s/${s.id}`}
                            data-testid={`slide-link-${s.id}`}
                            onClick={onMobileClose}
                            tabIndex={isOpen ? 0 : -1}
                            className={clsx(
                              "block py-2 text-sm rounded px-2 -mx-2",
                              slideActive
                                ? "font-semibold"
                                : "hover:bg-black/5 active:bg-black/10",
                            )}
                            style={
                              slideActive
                                ? { color: "var(--workshop-accent)" }
                                : undefined
                            }
                            aria-current={slideActive ? "page" : undefined}
                          >
                            {pick(s.title, lang)}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            </div>
          );
        })}
      </nav>
    </>
  );

  return (
    <>
      {/* Desktop: inline static sidebar */}
      <aside
        data-workshop-sidebar
        className="hidden md:flex flex-col border-r"
        style={{
          borderColor: "var(--border)",
          background: "var(--bg-elev)",
          width: "var(--sidebar-width)",
        }}
      >
        {sidebarBody}
      </aside>

      {/* Mobile: drawer + backdrop. Mounted while open OR animating-out so
          enter/exit transitions can play. Unmounted afterwards to keep
          desktop test-ids unique. */}
      {drawerMounted && (
        <>
          <div
            data-backdrop
            data-exit={drawerExiting ? "1" : undefined}
            className="md:hidden fixed inset-0 z-40"
            style={{ background: "rgba(0,0,0,0.45)" }}
            onClick={onMobileClose}
            data-testid="sidebar-backdrop"
          />
          <aside
            data-drawer
            data-exit={drawerExiting ? "1" : undefined}
            data-workshop-sidebar-mobile
            className="md:hidden fixed top-0 left-0 z-50 h-full flex flex-col shadow-xl"
            style={{
              borderRight: "1px solid var(--border)",
              background: "var(--bg-elev)",
              width: "min(85vw, 320px)",
            }}
          >
            {sidebarBody}
          </aside>
        </>
      )}
    </>
  );
}
