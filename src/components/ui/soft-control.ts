import type { CSSProperties } from "react";

/**
 * Quiet surface shared by the header controls — adapts to light and dark theme.
 * Lives in its own module so the header and the controls it hosts (e.g. the
 * recorder menu) use one definition instead of two copies that drift apart.
 */
export const SOFT: CSSProperties = {
  background: "color-mix(in oklch, var(--fg) 6%, transparent)",
  border: "1px solid color-mix(in oklch, var(--fg) 8%, transparent)",
};

export const SOFT_HOVER =
  "hover:bg-[color-mix(in_oklch,var(--fg)_11%,transparent)] active:bg-[color-mix(in_oklch,var(--fg)_16%,transparent)]";
