import { Suspense } from "react";
import { CalendarScreen } from "@/components/screens/calendar";

export const metadata = { title: "Calendar" };

export default function Page() {
  return (
    <Suspense>
      <CalendarScreen />
    </Suspense>
  );
}
