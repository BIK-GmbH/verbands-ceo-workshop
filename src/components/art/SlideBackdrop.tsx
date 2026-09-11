import { moduleArtSrc } from "./module-art";
import "@/styles/slide-art.css";

/*
 * Decorative slide backdrop: exposed-concrete formwork joints with tie holes, a perspective
 * "solid ground" grid, faint circuit traces with slow light pulses (the AI layer) and a soft red
 * aura — plus the module motif as a watermark. Everything sits behind the content, is masked away
 * from the text column and kept at a few percent opacity so readability always wins.
 */

/* Circuit traces entering from the top-right edge: orthogonal runs with 45° bends, ending in nodes. */
const TRACES = [
  "M640 36 H500 L468 68 H356 L334 90 H250",
  "M468 68 V142 L446 164 H372",
  "M640 104 H548 L516 136 H430",
  "M640 172 H590 L556 206 V258 L534 280 H452",
  "M640 244 H616 L596 264 V330 L574 352 H506",
  "M556 206 H500 L480 226 V300",
];
const NODES: Array<[number, number]> = [
  [250, 90], [372, 164], [430, 136], [452, 280], [506, 352], [480, 300], [356, 68], [548, 104],
];

interface Props {
  module: number;
  /** Show the module motif as watermark (off on the cover and on phase overviews, which show it prominently). */
  watermark: boolean;
}

export function SlideBackdrop({ module, watermark }: Props) {
  const light = watermark ? moduleArtSrc(module, "light") : null;
  const dark = watermark ? moduleArtSrc(module, "dark") : null;

  return (
    <div className="sb-layer" aria-hidden="true">
      <div className="sb-aura" />
      <div className="sb-formwork" />
      <div className="sb-ground">
        <div className="sb-ground-grid" />
      </div>
      <svg className="sb-circuit" viewBox="0 0 640 400" preserveAspectRatio="xMaxYMin meet">
        <g className="sb-traces">
          {TRACES.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
        <g className="sb-pulses">
          {TRACES.map((d, i) => (
            <path key={d} d={d} style={{ animationDelay: `${-i * 7}s` }} />
          ))}
        </g>
        <g className="sb-nodes">
          {NODES.map(([x, y]) => (
            <g key={`${x}-${y}`}>
              <circle cx={x} cy={y} r={6.5} className="sb-node-ring" />
              <circle cx={x} cy={y} r={2.6} className="sb-node-dot" />
            </g>
          ))}
        </g>
      </svg>
      {light && dark && (
        <div className="sb-watermark">
          <img src={light} alt="" className="theme-img-light" decoding="async" loading="lazy" />
          <img src={dark} alt="" className="theme-img-dark" decoding="async" loading="lazy" />
        </div>
      )}
    </div>
  );
}
