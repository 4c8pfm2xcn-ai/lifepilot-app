"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { useAuth } from "@/providers/auth-provider";
import { AuthShell } from "./auth-shell";

export function ForgotPasswordScreen() {
  const { auth } = useAuth();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<{ email: string }>({ resolver: zodResolver(z.object({ email: z.string().trim().email("Enter a valid email") })) });

  if (sent) {
    return (
      <AuthShell title="Check your email" subtitle="If an account exists for that address, we've sent a link to reset your password.">
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
    <AuthShell title="Reset your password" subtitle="Enter your email and we'll send you a reset link." footer={<Link href="/login" className="hover:text-fg">Back to sign in</Link>}>
      <form
        onSubmit={handleSubmit(async (v) => {
          setError(null);
          try {
            await auth.requestPasswordReset(v.email);
            setSent(true);
          } catch (e) {
            setError(e instanceof Error ? e.message : "Couldn't send the reset email.");
          }
        })}
        className="space-y-4"
        noValidate
      >
        <Field label="Email" error={formState.errors.email?.message}>
          {(p) => <Input {...p} type="email" autoComplete="email" {...register("email")} className="h-10" />}
        </Field>
        {error && (
          <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        <Button type="submit" variant="primary" size="lg" className="w-full" loading={formState.isSubmitting}>
          Send reset link
        </Button>
      </form>
    </AuthShell>
  );
}

const resetSchema = z.object({ password: z.string().min(8, "Use at least 8 characters").max(72), confirm: z.string() }).refine((v) => v.password === v.confirm, { message: "Passwords don't match", path: ["confirm"] });

export function ResetPasswordScreen() {
  const { auth, user, loading } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<z.infer<typeof resetSchema>>({ resolver: zodResolver(resetSchema) });

  if (!loading && !user) {
    return (
      <AuthShell title="Link expired" subtitle="This reset link is invalid or has expired.">
        <Link href="/forgot-password" className="text-sm text-accent hover:underline">
          Request a new link
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Choose a new password">
      <form
        onSubmit={handleSubmit(async (v) => {
          setError(null);
          try {
            await auth.updatePassword(v.password);
            router.replace("/today");
          } catch (e) {
            setError(e instanceof Error ? e.message : "Couldn't update your password.");
          }
        })}
        className="space-y-4"
        noValidate
      >
        <Field label="New password" error={formState.errors.password?.message}>
          {(p) => <Input {...p} type="password" autoComplete="new-password" {...register("password")} className="h-10" />}
        </Field>
        <Field label="Confirm password" error={formState.errors.confirm?.message}>
          {(p) => <Input {...p} type="password" autoComplete="new-password" {...register("confirm")} className="h-10" />}
        </Field>
        {error && (
          <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        <Button type="submit" variant="primary" size="lg" className="w-full" loading={formState.isSubmitting}>
          Update password
        </Button>
      </form>
    </AuthShell>
  );
}
