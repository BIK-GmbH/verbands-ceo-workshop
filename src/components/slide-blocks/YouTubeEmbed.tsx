import { useState, type ReactNode } from "react";
import { Play } from "lucide-react";

interface Props {
  /** YouTube URL or 11-char video id */
  url: string;
  /** Video title (rendered above the player) */
  title?: string;
  /** Channel/author name */
  author?: string;
  /** Optional duration like "11:24" or "11 min" */
  duration?: string;
  /** Optional caption / description below the player */
  children?: ReactNode;
  /** Start playback at second N */
  start?: number;
}

const ICON = { strokeWidth: 2.25 } as const;

function extractId(input: string): string {
  // Already an id?
  if (/^[A-Za-z0-9_-]{11}$/.test(input)) return input;
  // youtu.be/ID
  let m = input.match(/youtu\.be\/([A-Za-z0-9_-]{11})/);
  if (m) return m[1];
  // youtube.com/watch?v=ID
  m = input.match(/[?&]v=([A-Za-z0-9_-]{11})/);
  if (m) return m[1];
  // /embed/ID
  m = input.match(/\/embed\/([A-Za-z0-9_-]{11})/);
  if (m) return m[1];
  return input;
}

/**
 * Lazy-mount YouTube embed. First render shows a clickable thumbnail
 * (no third-party JS loaded). Click → mounts the iframe + autoplays.
 * Saves load + privacy. Uses youtube-nocookie domain.
 */
export function YouTubeEmbed({ url, title, author, duration, start, children }: Props) {
  const id = extractId(url);
  const [active, setActive] = useState(false);
  const thumb = `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`;

  const params = new URLSearchParams({
    autoplay: "1",
    rel: "0",
    modestbranding: "1",
  });
  if (start) params.set("start", String(start));
  const embedSrc = `https://www.youtube-nocookie.com/embed/${id}?${params.toString()}`;
  const watchUrl = `https://www.youtube.com/watch?v=${id}`;

  return (
    <figure className="my-5">
      {(title || author) && (
        <figcaption className="mb-2 flex items-baseline gap-2 flex-wrap">
          {title && <span className="font-semibold text-sm">{title}</span>}
          {author && (
            <span className="text-xs" style={{ color: "var(--fg-muted)" }}>
              · {author}
            </span>
          )}
          {duration && (
            <span className="text-xs" style={{ color: "var(--fg-muted)" }}>
              · {duration}
            </span>
          )}
          <a
            href={watchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs ml-auto"
            style={{ color: "var(--workshop-accent)" }}
          >
            youtu.be/{id} ↗
          </a>
        </figcaption>
      )}

      <div
        className="relative w-full overflow-hidden rounded-lg border"
        style={{
          borderColor: "var(--border)",
          background: "#0b1220",
          aspectRatio: "16/9",
        }}
      >
        {active ? (
          <iframe
            src={embedSrc}
            title={title ?? "YouTube video"}
            className="absolute inset-0 w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <button
            type="button"
            onClick={() => setActive(true)}
            data-testid={`youtube-play-${id}`}
            className="absolute inset-0 w-full h-full grid place-items-center group cursor-pointer"
            aria-label={title ? `Play: ${title}` : "Play video"}
          >
            <img
              src={thumb}
              alt=""
              loading="lazy"
              className="absolute inset-0 w-full h-full object-cover transition-opacity"
              onError={(e) => {
                // maxres may not exist for some videos → fall back to hqdefault
                const img = e.currentTarget;
                if (!img.dataset.fallback) {
                  img.dataset.fallback = "1";
                  img.src = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
                }
              }}
            />
            <span
              className="relative z-10 size-16 grid place-items-center rounded-full transition-transform group-hover:scale-110 group-active:scale-95"
              style={{
                background: "rgba(0,0,0,0.65)",
                color: "white",
                boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
              }}
            >
              <Play size={28} {...ICON} fill="currentColor" />
            </span>
          </button>
        )}
      </div>

      {children && (
        <div className="mt-3 text-sm" style={{ color: "var(--fg-muted)" }}>
          {children}
        </div>
      )}
    </figure>
  );
}
