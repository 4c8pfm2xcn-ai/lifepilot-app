export function VideoPlayer({ src, poster, label }: { src: string; poster?: string | null; label: string }) {
  return (
    <div className="overflow-hidden rounded-3xl border hairline bg-black glow-ring">
      <video
        className="mx-auto max-h-[72vh] w-full bg-black object-contain"
        src={src}
        poster={poster ?? undefined}
        controls
        playsInline
        loop
        preload="metadata"
        aria-label={label}
      />
    </div>
  );
}
