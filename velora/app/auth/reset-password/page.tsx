import type { Metadata } from "next";

import { requestPasswordResetAction } from "@/app/auth/actions";
import { AuthForm, AuthLink } from "@/components/auth/auth-form";
import { AuthHeading } from "@/components/auth/auth-heading";

export const metadata: Metadata = { title: "Reset password" };

export default function ResetPasswordPage() {
  return (
    <>
      <AuthHeading title="Reset password" subtitle="We'll email you a link to choose a new password." />
      <AuthForm
        action={requestPasswordResetAction}
        submitLabel="Send reset link"
        fields={[{ name: "email", label: "Email", type: "email", autoComplete: "email", placeholder: "you@example.com" }]}
        footer={<AuthLink href="/auth/sign-in">Back to sign in</AuthLink>}
      />
    </>
  );
}
