/** Module key visuals in public/brand/modules — one light (on white) and one dark (on black) variant each. */
const ART_MODULES = new Set([0, 1, 2, 3, 4, 5, 6, 7, 99]);

export type ArtVariant = "light" | "dark" | "thumb";

export function moduleArtSrc(module: number, variant: ArtVariant): string | null {
  if (!ART_MODULES.has(module)) return null;
  return `${import.meta.env.BASE_URL}brand/modules/m${module}-${variant}.webp`;
}

/** Phase overview slides (first slide of modules 1–7) carry the prominent illustration; the cover 00.01 keeps its own layout. */
export function isPhaseOverview(module: number, slide: number): boolean {
  return slide === 1 && module >= 1 && module <= 7;
}
