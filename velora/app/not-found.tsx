import { LinkButton } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
      <Logo />
      <h1 className="mt-10 font-display text-5xl text-fog-50">Not found</h1>
      <p className="mt-3 text-sm text-fog-400">This page doesn&apos;t exist, or you don&apos;t have access to it.</p>
      <LinkButton href="/dashboard" className="mt-8" variant="secondary">Go to dashboard</LinkButton>
    </div>
  );
}
