import Link from "next/link";

import { CoinIcon } from "@/components/ui/icons";

export function CreditsPill({ balance }: { balance: number }) {
  return (
    <Link
      href="/settings#credits"
      className="inline-flex items-center gap-1.5 rounded-full border hairline bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-fog-200 hover:bg-white/[0.06]"
      aria-label={`${balance} credits available`}
    >
      <CoinIcon size={14} className="text-aurora-violet" />
      <span className="tabular-nums">{balance.toLocaleString()}</span>
      <span className="text-fog-500">credits</span>
    </Link>
  );
}
