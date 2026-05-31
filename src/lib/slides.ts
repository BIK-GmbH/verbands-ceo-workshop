import type { ComponentType } from "react";
import type { ModuleMeta, SlideMeta } from "@/types/slide";
import { MANIFEST as STUB_MANIFEST, ALL_SLIDES as STUB_SLIDES } from "./manifest";

/** Each MDX module exports a default Component plus frontmatter. */
interface MdxModule {
  default: ComponentType;
  frontmatter?: Partial<SlideMeta> & {
    title?: SlideMeta["title"];
    researchedOn?: string;
    sources?: string[];
  };
}

/** Eager-import all MDX content under src/content. */
const modules = import.meta.glob<MdxModule>("../content/**/*.mdx", { eager: true });

/** Map slide-id ("01.02") → MDX module. */
export const SLIDE_COMPONENTS: Record<string, MdxModule> = {};

for (const [path, mod] of Object.entries(modules)) {
  // Filename pattern: 01-02-some-title.mdx → id "01.02"
  const file = path.split("/").pop()!.replace(/\.mdx$/, "");
  const m = file.match(/^(\d{2})-(\d{2})/);
  if (!m) continue;
  const id = `${m[1]}.${m[2]}`;
  SLIDE_COMPONENTS[id] = mod;
}

/** Effective manifest = stub structure, with MDX frontmatter overrides applied where present. */
export const MANIFEST: ModuleMeta[] = STUB_MANIFEST.map((m) => ({
  ...m,
  slides: m.slides.map((s) => {
    const mdx = SLIDE_COMPONENTS[s.id];
    if (!mdx?.frontmatter) return s;
    return {
      ...s,
      ...mdx.frontmatter,
      title: mdx.frontmatter.title ?? s.title,
    };
  }),
}));

export const ALL_SLIDES: SlideMeta[] = MANIFEST.flatMap((m) => m.slides);

export function getSlideComponent(id: string): ComponentType | null {
  return SLIDE_COMPONENTS[id]?.default ?? null;
}

export function findSlide(id: string) {
  return ALL_SLIDES.find((s) => s.id === id);
}

export function findModule(index: number) {
  return MANIFEST.find((m) => m.index === index);
}

export function neighbours(id: string) {
  const i = ALL_SLIDES.findIndex((s) => s.id === id);
  return {
    prev: i > 0 ? ALL_SLIDES[i - 1] : null,
    next: i >= 0 && i < ALL_SLIDES.length - 1 ? ALL_SLIDES[i + 1] : null,
    index: i,
    total: ALL_SLIDES.length,
  };
}

// Re-export for legacy imports during transition
export { STUB_MANIFEST, STUB_SLIDES };
