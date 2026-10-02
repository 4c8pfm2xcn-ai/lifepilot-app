import { Suspense } from "react";
import { InboxScreen } from "@/components/screens/inbox";

export const metadata = { title: "Inbox" };

export default function Page() {
  return (
    <Suspense>
      <InboxScreen />
    </Suspense>
  );
}
