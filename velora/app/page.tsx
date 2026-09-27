import Link from "next/link";

import { LinkButton } from "@/components/ui/button";
import { ArrowRightIcon, FolderIcon, ImageIcon, LibraryIcon, RefreshIcon, SparkIcon, WandIcon } from "@/components/ui/icons";
import { Logo } from "@/components/ui/logo";
import { getSessionUser } from "@/lib/auth";

const FEATURES = [
  { icon: SparkIcon, title: "Text to video", body: "Describe a shot in plain language and generate a short video clip from it." },
  { icon: ImageIcon, title: "Image to video", body: "Upload a reference image to use as the opening frame and bring it to life." },
  { icon: WandIcon, title: "Prompt enhancement", body: "Turn a one-line idea into a detailed prompt covering camera, lighting and motion — then edit it." },
  { icon: LibraryIcon, title: "Library", body: "Every generation is saved. Search, filter, favorite, download and regenerate." },
  { icon: FolderIcon, title: "Projects", body: "Group related generations into projects for a campaign, story or client." },
  { icon: RefreshIcon, title: "Fair credits", body: "Credits are reserved when you generate and refunded automatically if a generation fails." },
];

const STEPS = [
  { n: "01", title: "Describe", body: "Write your idea, optionally add a reference image, and pick a style and camera move." },
  { n: "02", title: "Configure", body: "Choose a model, duration and aspect ratio. Only options the model supports are shown." },
  { n: "03", title: "Generate", body: "Velora sends the job to the video provider and tracks it until your video is ready." },
];

export default async function LandingPage() {
  const user = await getSessionUser();
  const primaryHref = user ? "/create" : "/auth/sign-up";

  return (
    <div className="relative overflow-hidden">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[720px]">
        <div className="absolute left-1/2 top-[-180px] h-[560px] w-[1000px] -translate-x-1/2 rounded-full bg-aurora-violet/[0.12] blur-[140px]" />
        <div className="absolute left-[18%] top-[220px] h-[300px] w-[420px] rounded-full bg-aurora-blue/[0.07] blur-[120px]" />
      </div>

      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-5 py-6 sm:px-8">
        <Logo />
        <nav aria-label="Primary" className="flex items-center gap-2">
          {user ? (
            <LinkButton href="/dashboard" variant="secondary" size="sm">Dashboard</LinkButton>
          ) : (
            <>
              <LinkButton href="/auth/sign-in" variant="ghost" size="sm">Sign in</LinkButton>
              <LinkButton href="/auth/sign-up" size="sm">Get started</LinkButton>
            </>
          )}
        </nav>
      </header>

      <main className="relative">
        <section className="mx-auto max-w-6xl px-5 pb-20 pt-16 text-center sm:px-8 sm:pt-24">
          <p className="mx-auto inline-flex items-center gap-2 rounded-full border hairline bg-white/[0.03] px-3 py-1 text-xs text-fog-400 animate-fade-up">
            <span className="h-1.5 w-1.5 rounded-full bg-aurora-violet" aria-hidden="true" /> AI video creation studio
          </p>
          <h1 className="mx-auto mt-6 max-w-4xl font-display text-[3.4rem] leading-[0.95] tracking-tight text-fog-50 sm:text-8xl animate-fade-up [animation-delay:60ms]">
            Turn ideas <br className="hidden sm:block" />
            into <em className="text-aurora">video.</em>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-fog-400 sm:text-lg animate-fade-up [animation-delay:120ms]">
            Velora transforms your ideas into cinematic AI-generated videos with a simple creative workflow.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3 animate-fade-up [animation-delay:180ms]">
            <LinkButton href={primaryHref} size="lg" icon={<SparkIcon size={17} />}>Create a Video</LinkButton>
            {!user ? <LinkButton href="/auth/sign-in" size="lg" variant="secondary">Sign In</LinkButton> : null}
          </div>

          <figure className="mx-auto mt-16 max-w-4xl animate-fade-up [animation-delay:240ms]">
            <ProductIllustration />
            <figcaption className="mt-3 text-xs text-fog-600">Illustration of the Velora creation interface.</figcaption>
          </figure>
        </section>

        <section aria-labelledby="features-heading" className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
          <h2 id="features-heading" className="max-w-lg font-display text-4xl tracking-tight text-fog-50 sm:text-5xl">
            A focused workflow, from idea to clip.
          </h2>
          <ul className="mt-12 grid gap-px overflow-hidden rounded-3xl border hairline bg-white/[0.06] sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <li key={title} className="bg-ink-950 p-7">
                <Icon size={20} className="text-aurora-violet" />
                <h3 className="mt-4 font-medium text-fog-50">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-fog-500">{body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="how-heading" className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
          <h2 id="how-heading" className="font-display text-4xl tracking-tight text-fog-50 sm:text-5xl">How it works</h2>
          <ol className="mt-12 grid gap-8 md:grid-cols-3">
            {STEPS.map((s) => (
              <li key={s.n} className="border-t hairline pt-6">
                <span className="font-mono text-xs text-aurora-violet">{s.n}</span>
                <h3 className="mt-3 text-lg font-medium text-fog-50">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-fog-500">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mx-auto max-w-6xl px-5 pb-24 pt-8 sm:px-8">
          <div className="relative overflow-hidden rounded-3xl border hairline bg-ink-900 px-6 py-14 text-center sm:px-12">
            <div aria-hidden="true" className="absolute left-1/2 top-0 h-60 w-[600px] -translate-x-1/2 rounded-full bg-aurora-violet/15 blur-[100px]" />
            <h2 className="relative font-display text-4xl tracking-tight text-fog-50 sm:text-5xl">Start with a single sentence.</h2>
            <p className="relative mx-auto mt-3 max-w-md text-sm text-fog-400">New accounts receive free starter credits.</p>
            <div className="relative mt-8">
              <LinkButton href={primaryHref} size="lg">
                Create a Video <ArrowRightIcon size={16} />
              </LinkButton>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t hairline">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-8 text-sm text-fog-600 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <Logo />
          <p>Videos are generated by third-party AI providers through their official APIs.</p>
          <nav aria-label="Footer" className="flex gap-4">
            <Link href="/auth/sign-in" className="hover:text-fog-200">Sign in</Link>
            <Link href="/auth/sign-up" className="hover:text-fog-200">Sign up</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

/** A static, clearly-labelled illustration of the UI — not a generated video. */
function ProductIllustration() {
  return (
    <div className="glow-ring overflow-hidden rounded-3xl border hairline bg-ink-900 text-left" aria-hidden="true">
      <div className="flex items-center gap-1.5 border-b hairline px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
      </div>
      <div className="grid gap-4 p-4 sm:grid-cols-[1fr_220px] sm:p-6">
        <div className="space-y-4">
          <div className="rounded-2xl border hairline bg-ink-950/60 p-4">
            <p className="text-[11px] uppercase tracking-[0.14em] text-fog-600">Prompt</p>
            <p className="mt-2 text-sm leading-relaxed text-fog-200">
              A lone lighthouse on a rocky coast at dusk, waves crashing below, warm light sweeping through sea mist
              <span className="ml-0.5 inline-block h-4 w-px translate-y-0.5 animate-pulse-soft bg-fog-200" />
            </p>
            <div className="mt-4 flex gap-1.5">
              {["Cinematic", "Slow push-in"].map((t) => (
                <span key={t} className="rounded-full bg-aurora-violet/10 px-2.5 py-1 text-[11px] text-aurora-violet">{t}</span>
              ))}
            </div>
          </div>
          <div className="relative aspect-video overflow-hidden rounded-2xl border hairline bg-gradient-to-br from-ink-800 via-ink-850 to-ink-950">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_40%,rgba(167,139,250,0.22),transparent_60%),radial-gradient(ellipse_at_75%_65%,rgba(125,211,252,0.14),transparent_55%)]" />
            <div className="absolute bottom-4 left-4 right-4">
              <div className="h-1 overflow-hidden rounded-full bg-white/10">
                <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-aurora-violet to-aurora-blue" />
              </div>
              <p className="mt-2 text-[11px] text-fog-500">Generating · 64%</p>
            </div>
          </div>
        </div>
        <div className="space-y-3">
          {[
            ["Model", "Gen-4.5"],
            ["Duration", "5s · 10s"],
            ["Aspect", "16:9 · 9:16"],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl border hairline px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-[0.14em] text-fog-600">{k}</p>
              <p className="mt-1 text-sm text-fog-200">{v}</p>
            </div>
          ))}
          <div className="rounded-xl bg-fog-50 px-3 py-2.5 text-center text-sm font-medium text-ink-950">Generate video</div>
        </div>
      </div>
    </div>
  );
}
