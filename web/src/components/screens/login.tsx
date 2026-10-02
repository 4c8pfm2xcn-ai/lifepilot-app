"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { useAuth } from "@/providers/auth-provider";
import { useDemoLogin } from "@/hooks/use-demo-login";
import { AuthShell, DemoNotice } from "./auth-shell";

const schema = z.object({ email: z.string().trim().email("Enter a valid email"), password: z.string().min(1, "Enter your password") });

function safeNext(n: string | null) {
  return n && n.startsWith("/") && !n.startsWith("//") ? n : "/today";
}

export function LoginScreen() {
  const { auth, user, loading } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [error, setError] = useState<string | null>(params.get("error") === "link" ? "That link is invalid or has expired. Please try again." : null);
  const demo = useDemoLogin();
  const { register, handleSubmit, formState } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!loading && user) router.replace(next);
  }, [loading, user, router, next]);

  const onSubmit = handleSubmit(async (v) => {
    setError(null);
    try {
      await auth.signIn(v);
      router.replace(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign in failed.");
    }
  });

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to pick up where you left off."
      footer={
        <>
          New to DAYZERO?{" "}
          <Link href="/signup" className="font-medium text-fg hover:text-accent">
            Create an account
          </Link>
        </>
      }
    >
      {auth.mode === "demo" && <DemoNotice />}
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Email" error={formState.errors.email?.message}>
          {(p) => <Input {...p} type="email" autoComplete="email" {...register("email")} className="h-10" />}
        </Field>
        <Field label="Password" error={formState.errors.password?.message}>
          {(p) => <Input {...p} type="password" autoComplete="current-password" {...register("password")} className="h-10" />}
        </Field>
        <div className="flex justify-end">
          <Link href="/forgot-password" className="text-xs text-muted hover:text-fg">
            Forgot password?
          </Link>
        </div>
        {error && (
          <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        <Button type="submit" variant="primary" size="lg" className="w-full" loading={formState.isSubmitting} data-testid="login-submit">
          Sign in
        </Button>
      </form>
      {auth.mode === "demo" && (
        <>
          <div className="my-5 flex items-center gap-3 text-2xs uppercase tracking-wider text-subtle">
            <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
          </div>
          <Button variant="secondary" size="lg" className="w-full" onClick={demo.start} loading={demo.loading}>
            <FlaskConical className="h-4 w-4" /> Explore with sample data
          </Button>
        </>
      )}
    </AuthShell>
  );
}
