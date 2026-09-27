"use client";

import { useRef } from "react";

/** Lightweight preview: loads only metadata until hovered/focused, then plays muted. */
export function HoverVideo({ src, poster }: { src: string; poster: string | null }) {
  const ref = useRef<HTMLVideoElement>(null);
  const play = () => {
    const v = ref.current;
    if (!v) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    void v.play().catch(() => undefined);
  };
  const stop = () => {
    const v = ref.current;
    if (!v) return;
    v.pause();
  };
  return (
    <video
      ref={ref}
      src={`${src}#t=0.1`}
      poster={poster ?? undefined}
      muted
      loop
      playsInline
      preload="metadata"
      aria-hidden="true"
      tabIndex={-1}
      onMouseEnter={play}
      onMouseLeave={stop}
      className="h-full w-full object-cover"
    />
  );
}
