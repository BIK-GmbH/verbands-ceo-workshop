import { useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from "react";
import { useLang } from "@/lib/i18n";
import "@/styles/resize.css";

interface Props {
  /** The bar being resized — its rendered width is the starting point of a drag. */
  target: RefObject<HTMLElement | null>;
  /** Edge of the bar the handle sits on: "right" for the left sidebar, "left" for the right panel. */
  edge: "left" | "right";
  min: number;
  max: number;
  /** Current effective width, or undefined while the default applies. */
  width: number | undefined;
  onResize: (px: number, persist: boolean) => void;
  onReset: () => void;
  label: { de: string; en: string };
}

const STEP = 16;
const BIG_STEP = 64;

/**
 * Drag handle on the inner edge of a side bar. Pointer drag (mouse, touch, pen),
 * double-click resets to the default width, arrow keys resize in steps.
 */
export function ResizeHandle({ target, edge, min, max, width, onResize, onReset, label }: Props) {
  const [lang] = useLang();
  const drag = useRef<{ x: number; w: number; last: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const rendered = () => target.current?.getBoundingClientRect().width ?? width ?? min;
  // Dragging towards the slide makes the bar wider.
  const grow = edge === "right" ? 1 : -1;

  function end(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    setDragging(false);
    document.documentElement.removeAttribute("data-resizing");
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (d.last !== d.w) onResize(d.last, true);
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const current = rendered();
    let next: number | null = null;
    const step = e.shiftKey ? BIG_STEP : STEP;
    if (e.key === "ArrowRight") next = current + step * grow;
    else if (e.key === "ArrowLeft") next = current - step * grow;
    else if (e.key === "Home") next = min;
    else if (e.key === "End") next = max;
    else if (e.key === "Enter") {
      onReset();
    } else return;
    // Otherwise the arrow keys would also page through the deck.
    e.preventDefault();
    e.stopPropagation();
    if (next !== null) onResize(next, true);
  }

  return (
    <div
      className="resize-handle no-print"
      data-edge={edge}
      data-dragging={dragging ? "1" : undefined}
      role="separator"
      aria-orientation="vertical"
      aria-label={label[lang]}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={Math.round(width ?? rendered())}
      tabIndex={0}
      title={
        lang === "de"
          ? "Ziehen ändert die Breite · Doppelklick: Standardbreite"
          : "Drag to change the width · double-click: default width"
      }
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        const w = rendered();
        drag.current = { x: e.clientX, w, last: w };
        setDragging(true);
        document.documentElement.setAttribute("data-resizing", "1");
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        d.last = d.w + (e.clientX - d.x) * grow;
        onResize(d.last, false);
      }}
      onPointerUp={end}
      onPointerCancel={end}
      onDoubleClick={onReset}
      onKeyDown={onKeyDown}
    />
  );
}
