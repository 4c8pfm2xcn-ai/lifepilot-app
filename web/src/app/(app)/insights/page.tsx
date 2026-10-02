import { Suspense } from "react";
import { InsightsScreen } from "@/components/screens/insights";

export const metadata = { title: "Insights" };

export default function Page() {
  return (
    <Suspense>
      <InsightsScreen />
    </Suspense>
  );
}
