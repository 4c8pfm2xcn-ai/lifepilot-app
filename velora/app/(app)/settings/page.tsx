import type { Metadata } from "next";

import { signOutAction } from "@/app/auth/actions";
import { ProfileForm } from "@/components/settings/profile-form";
import { Button, LinkButton } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/card";
import { formatDateTime } from "@/components/ui/format";
import { CheckIcon, LogoutIcon, XIcon } from "@/components/ui/icons";
import { requireUserOrRedirect } from "@/lib/auth";
import { costTable } from "@/lib/credits/pricing";
import { getCreditBalance, getProfile, getUsageSummary, listCreditTransactions } from "@/lib/data/queries";
import { enhancerStatus } from "@/lib/prompts";
import { listProviderStatus } from "@/lib/video/registry";

export const metadata: Metadata = { title: "Settings" };

const TX_LABELS: Record<string, string> = {
  signup_grant: "Welcome credits",
  generation_charge: "Generation",
  generation_refund: "Refund",
  adjustment: "Adjustment",
};

function Section({ id, title, description, children }: { id: string; title: string; description?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 grid gap-4 border-t hairline py-8 md:grid-cols-[240px_1fr]">
      <div>
        <h2 className="text-base font-medium text-fog-50">{title}</h2>
        {description ? <p className="mt-1 text-sm text-fog-500">{description}</p> : null}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

function StatusRow({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <li className="flex items-start justify-between gap-4 py-3">
      <div>
        <p className="text-sm text-fog-50">{label}</p>
        <p className="mt-0.5 text-xs text-fog-500">{detail}</p>
      </div>
      <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs ${ok ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>
        {ok ? <CheckIcon size={13} /> : <XIcon size={13} />} {ok ? "Configured" : "Not configured"}
      </span>
    </li>
  );
}

export default async function SettingsPage() {
  const user = await requireUserOrRedirect("/settings");
  const [profile, balance, usage, transactions] = await Promise.all([
    getProfile(),
    getCreditBalance(),
    getUsageSummary(),
    listCreditTransactions(25),
  ]);
  const providers = listProviderStatus();
  const enhancer = enhancerStatus();

  return (
    <>
      <PageHeader title="Settings" description="Manage your profile, usage and credits." />

      <Section id="profile" title="Profile">
        <ProfileForm displayName={profile?.display_name ?? ""} />
      </Section>

      <Section id="account" title="Account">
        <dl className="space-y-1 text-sm">
          <dt className="text-fog-500">Email</dt>
          <dd className="text-fog-50">{user.email ?? "—"}</dd>
        </dl>
        <div className="mt-4 flex flex-wrap gap-2">
          <LinkButton href="/auth/reset-password" variant="secondary" size="sm">Change password</LinkButton>
          <form action={signOutAction}>
            <Button type="submit" variant="ghost" size="sm" icon={<LogoutIcon size={15} />}>Sign out</Button>
          </form>
        </div>
      </Section>

      <Section id="usage" title="Usage">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Total", usage.total],
            ["Completed", usage.completed],
            ["Failed / cancelled", usage.failed],
            ["Credits used", usage.creditsSpent],
          ].map(([label, value]) => (
            <div key={label} className="surface rounded-xl px-4 py-3">
              <dd className="text-xl font-semibold tabular-nums text-fog-50">{Number(value).toLocaleString()}</dd>
              <dt className="mt-0.5 text-xs text-fog-500">{label}</dt>
            </div>
          ))}
        </dl>
      </Section>

      <Section id="credits" title="Credits" description="Credits are reserved when a generation starts and refunded automatically if it fails.">
        <p className="text-3xl font-semibold tabular-nums text-fog-50">
          {balance.toLocaleString()} <span className="text-base font-normal text-fog-500">credits</span>
        </p>
        <p className="mt-1 text-xs text-fog-500">Purchasing credits is not available yet.</p>

        <h3 className="mt-6 text-sm font-medium text-fog-200">Pricing</h3>
        <ul className="mt-2 space-y-1 text-sm text-fog-400">
          {providers.flatMap(({ definition }) =>
            definition.models.map((m) => {
              const durations = [...new Set(Object.values(m.modes).flatMap((c) => c?.durations ?? []))].sort((a, b) => a - b);
              const costs = costTable(definition.id, m.id, durations);
              return (
                <li key={`${definition.id}:${m.id}`}>
                  <span className="text-fog-200">{m.displayName}</span>: {durations.map((d) => `${d}s = ${costs[d]}`).join(" · ")} credits
                </li>
              );
            }),
          )}
        </ul>

        <h3 className="mt-6 text-sm font-medium text-fog-200">History</h3>
        {transactions.length > 0 ? (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="text-left text-xs text-fog-500">
                  <th className="py-2 font-normal">Date</th>
                  <th className="py-2 font-normal">Type</th>
                  <th className="py-2 text-right font-normal">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {transactions.map((t) => (
                  <tr key={t.id}>
                    <td className="py-2.5 text-fog-400">{formatDateTime(t.created_at)}</td>
                    <td className="py-2.5 text-fog-200">{TX_LABELS[t.type] ?? t.type}</td>
                    <td className={`py-2.5 text-right tabular-nums ${t.amount > 0 ? "text-success" : "text-fog-200"}`}>
                      {t.amount > 0 ? `+${t.amount}` : t.amount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-2 text-sm text-fog-500">No transactions yet.</p>
        )}
      </Section>

      <Section id="providers" title="Providers" description="Server configuration status. Secret values are never shown.">
        <ul className="divide-y divide-white/[0.05]">
          {providers.map((p) => (
            <StatusRow
              key={p.definition.id}
              ok={p.configured}
              label={`${p.definition.displayName} video`}
              detail={
                p.configured
                  ? `Models: ${p.definition.models.map((m) => m.displayName).join(", ")} · status via ${p.definition.supportsWebhooks ? "webhooks" : "polling"}`
                  : `Set ${p.missingEnv.join(", ")} on the server.`
              }
            />
          ))}
          <StatusRow
            ok={enhancer.configured}
            label="Prompt enhancement"
            detail={enhancer.configured ? `LLM provider: ${enhancer.provider}` : `Set ${enhancer.missingEnv.join(", ")} on the server.`}
          />
        </ul>
      </Section>
    </>
  );
}
