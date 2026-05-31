import { useOutletContext } from "react-router-dom";
import type { Lang, SlideMeta } from "@/types/slide";
import { SlideRenderer } from "@/components/SlideRenderer";

interface Ctx {
  lang: Lang;
  current: SlideMeta;
}

export function Slide() {
  const { lang, current } = useOutletContext<Ctx>();
  return <SlideRenderer slideId={current.id} lang={lang} />;
}
