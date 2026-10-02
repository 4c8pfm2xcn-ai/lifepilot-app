import Link from "next/link";
import { LogoMark } from "@/components/app/logo";

export default function NotFound() {
  return (
    <main id="main" className="grid min-h-dvh place-items-center px-6 text-center">
      <div>
        <LogoMark className="mx-auto mb-5 h-10 w-10" />
        <h1 className="text-xl font-semibold">This page doesn&apos;t exist</h1>
        <p className="mt-1 text-sm text-muted">Let&apos;s get you back to something organized.</p>
        <Link href="/today" className="mt-6 inline-flex h-9 items-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg">
          Go to Today
        </Link>
      </div>
    </main>
  );
}
