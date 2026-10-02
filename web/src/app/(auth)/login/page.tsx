import { Suspense } from "react";
import { LoginScreen } from "@/components/screens/login";
export const metadata = { title: "Sign in" };
export default function Page() {
  return (
    <Suspense>
      <LoginScreen />
    </Suspense>
  );
}
