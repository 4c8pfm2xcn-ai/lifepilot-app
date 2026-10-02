import { Suspense } from "react";
import { TodayScreen } from "@/components/screens/today";

export const metadata = { title: "Today" };

export default function Page() {
  return (
    <Suspense>
      <TodayScreen />
    </Suspense>
  );
}
