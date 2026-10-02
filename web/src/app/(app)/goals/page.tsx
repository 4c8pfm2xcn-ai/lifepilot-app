import { Suspense } from "react";
import { GoalsScreen } from "@/components/screens/goals";

export const metadata = { title: "Goals" };

export default function Page() {
  return (
    <Suspense>
      <GoalsScreen />
    </Suspense>
  );
}
