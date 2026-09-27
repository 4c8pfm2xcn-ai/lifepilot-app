import Link from "next/link";

export function Logo({ href = "/", className = "" }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={`group inline-flex items-center gap-2.5 ${className}`} aria-label="Velora home">
      <span
        aria-hidden="true"
        className="relative grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-aurora-violet via-aurora-blue to-aurora-rose p-px"
      >
        <span className="grid h-full w-full place-items-center rounded-[7px] bg-ink-950">
          <span className="h-0 w-0 translate-x-[1px] border-y-[5px] border-l-[8px] border-y-transparent border-l-fog-50" />
        </span>
      </span>
      <span className="text-[15px] font-semibold tracking-[0.32em] text-fog-50">VELORA</span>
    </Link>
  );
}
