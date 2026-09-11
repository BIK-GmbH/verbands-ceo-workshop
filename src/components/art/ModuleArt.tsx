import { moduleArtSrc } from "./module-art";
import "@/styles/slide-art.css";

/** Prominent module illustration for phase overview slides — floats top-right so the heading and cards wrap around it. */
export function ModuleArt({ module }: { module: number }) {
  const light = moduleArtSrc(module, "light");
  const dark = moduleArtSrc(module, "dark");
  if (!light || !dark) return null;
  return (
    <figure className="module-art" aria-hidden="true">
      <img src={light} alt="" className="theme-img-light" decoding="async" />
      <img src={dark} alt="" className="theme-img-dark" decoding="async" />
    </figure>
  );
}
