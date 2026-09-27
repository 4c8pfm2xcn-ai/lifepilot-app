export function AuthHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-8">
      <h1 className="font-display text-4xl tracking-tight text-fog-50">{title}</h1>
      <p className="mt-2 text-sm text-fog-400">{subtitle}</p>
    </div>
  );
}
