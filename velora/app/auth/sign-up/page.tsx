import type { Metadata } from "next";

import { signUpAction } from "@/app/auth/actions";
import { AuthForm, AuthLink } from "@/components/auth/auth-form";
import { AuthHeading } from "@/components/auth/auth-heading";
import { MissingEnvNotice } from "@/components/ui/notice";
import { isSupabaseAuthConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Create account" };

export default function SignUpPage() {
  return (
    <>
      <AuthHeading title="Create your account" subtitle="Start turning ideas into video." />
      {!isSupabaseAuthConfigured() ? (
        <MissingEnvNotice what="Supabase Auth" names={["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]} />
      ) : null}
      <AuthForm
        action={signUpAction}
        submitLabel="Create account"
        fields={[
          { name: "displayName", label: "Name", type: "text", autoComplete: "name", placeholder: "Your name" },
          { name: "email", label: "Email", type: "email", autoComplete: "email", placeholder: "you@example.com" },
          { name: "password", label: "Password", type: "password", autoComplete: "new-password", placeholder: "At least 8 characters" },
        ]}
        footer={
          <>
            Already have an account? <AuthLink href="/auth/sign-in">Sign in</AuthLink>
          </>
        }
      />
    </>
  );
}
