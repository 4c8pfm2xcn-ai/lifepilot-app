"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { useAuth } from "@/providers/auth-provider";
import { AuthShell, DemoNotice } from "./auth-shell";

const schema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(120),
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(8, "Use at least 8 characters").max(72, "Use at most 72 characters"),
});

export function SignupScreen() {
  const { auth, user, loading } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!loading && user && !sentTo) router.replace("/today");
  }, [loading, user, router, sentTo]);

  const onSubmit = handleSubmit(async (v) => {
    setError(null);
    try {
      const res = await auth.signUp(v);
      if (res.needsConfirmation) setSentTo(v.email);
      else router.replace("/onboarding");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign up failed.");
    }
  });

  if (sentTo) {
    return (
      <AuthShell title="Check your email" subtitle={<>We sent a confirmation link to <span className="text-fg">{sentTo}</span>. Open it to finish creating your account.</>}>
        <div className="flex justify-center py-6">
          <MailCheck className="h-10 w-10 text-accent" strokeWidth={1.5} />
        </div>
        <Link href="/login" className="block text-center text-sm text-muted hover:text-fg">
          Back to sign in
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Start organizing in under a minute."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-fg hover:text-accent">
            Sign in
          </Link>
        </>
      }
    >
      {auth.mode === "demo" && <DemoNotice />}
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Name" error={formState.errors.name?.message}>
          {(p) => <Input {...p} autoComplete="name" {...register("name")} className="h-10" />}
        </Field>
        <Field label="Email" error={formState.errors.email?.message}>
          {(p) => <Input {...p} type="email" autoComplete="email" {...register("email")} className="h-10" />}
        </Field>
        <Field label="Password" error={formState.errors.password?.message} hint="At least 8 characters">
          {(p) => <Input {...p} type="password" autoComplete="new-password" {...register("password")} className="h-10" />}
        </Field>
        {error && (
          <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        <Button type="submit" variant="primary" size="lg" className="w-full" loading={formState.isSubmitting} data-testid="signup-submit">
          Create account
        </Button>
        <p className="text-center text-2xs text-subtle">Your data is private to your account. You can export or delete it any time.</p>
      </form>
    </AuthShell>
  );
}
