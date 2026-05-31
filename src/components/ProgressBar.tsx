import { neighbours } from "@/lib/slides";

interface Props {
  slideId: string;
}

/** Thin progress bar — % of deck completed. Sticky right under the header. */
export function ProgressBar({ slideId }: Props) {
  const { index, total } = neighbours(slideId);
  const pct = total > 0 ? ((index + 1) / total) * 100 : 0;

  return (
    <div
      data-progress-bar
      className="sticky z-30 h-[3px] no-print"
      style={{
        top: "var(--header-height)",
        background: "var(--border)",
      }}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={index + 1}
      aria-label="Slide progress"
    >
      <div
        className="h-full transition-[width] duration-300 ease-out"
        style={{ width: `${pct}%`, background: "var(--workshop-accent)" }}
      />
    </div>
  );
}
