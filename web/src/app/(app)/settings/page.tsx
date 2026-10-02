import { Suspense } from "react";
import { SettingsScreen } from "@/components/screens/settings";

export const metadata = { title: "Settings" };

export default function Page() {
  return (
    <Suspense>
      <SettingsScreen />
    </Suspense>
  );
}
