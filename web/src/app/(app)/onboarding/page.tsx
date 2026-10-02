import { Suspense } from "react";
import { OnboardingScreen } from "@/components/screens/onboarding";

export const metadata = { title: "Welcome" };

export default function Page() {
  return (
    <Suspense>
      <OnboardingScreen />
    </Suspense>
  );
}
