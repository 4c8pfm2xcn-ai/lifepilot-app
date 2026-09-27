import type { Metadata } from "next";

import { signInAction } from "@/app/auth/actions";
import { AuthForm, AuthLink } from "@/components/auth/auth-form";
import { AuthHeading } from "@/components/auth/auth-heading";
import { MissingEnvNotice, Notice } from "@/components/ui/notice";
import { isSupabaseAuthConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage(props: PageProps<"/auth/sign-in">) {
  const params = await props.searchParams;
  const next = typeof params.next === "string" ? params.next : "/dashboard";
  const linkError = params.error === "link";
  return (
    <>
      <AuthHeading title="Welcome back" subtitle="Sign in to continue creating." />
      {!isSupabaseAuthConfigured() ? (
        <MissingEnvNotice what="Supabase Auth" names={["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]} />
      ) : null}
      {linkError ? (
        <Notice tone="warning" className="mb-4">
          That link is invalid or has expired. Please try again.
        </Notice>
      ) : null}
      <AuthForm
        action={signInAction}
        hidden={{ next }}
        submitLabel="Sign in"
        fields={[
          { name: "email", label: "Email", type: "email", autoComplete: "email", placeholder: "you@example.com" },
          { name: "password", label: "Password", type: "password", autoComplete: "current-password" },
        ]}
        aside={
          <div className="text-right text-sm">
            <AuthLink href="/auth/reset-password">Forgot password?</AuthLink>
          </div>
        }
        footer={
          <>
            New to Velora? <AuthLink href="/auth/sign-up">Create an account</AuthLink>
          </>
        }
      />
    </>
  );
}
