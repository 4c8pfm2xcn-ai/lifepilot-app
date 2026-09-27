"use client";

import Link from "next/link";
import { useActionState, type ReactNode } from "react";

import type { AuthFormState } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";

export interface AuthField {
  name: string;
  label: string;
  type: "email" | "password" | "text";
  autoComplete: string;
  placeholder?: string;
}

export function AuthForm({
  action,
  fields,
  submitLabel,
  hidden,
  footer,
  aside,
}: {
  action: (prev: AuthFormState, data: FormData) => Promise<AuthFormState>;
  fields: AuthField[];
  submitLabel: string;
  hidden?: Record<string, string>;
  footer?: ReactNode;
  aside?: ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="space-y-4" noValidate>
      {hidden ? Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />) : null}
      {fields.map((f) => (
        <div key={f.name}>
          <label htmlFor={f.name} className="mb-1.5 block text-sm font-medium text-fog-200">
            {f.label}
          </label>
          <input
            id={f.name}
            name={f.name}
            type={f.type}
            autoComplete={f.autoComplete}
            placeholder={f.placeholder}
            required
            className="field"
          />
        </div>
      ))}
      {aside}
      {state.error ? <Notice tone="danger">{state.error}</Notice> : null}
      {state.message ? <Notice tone="success">{state.message}</Notice> : null}
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        {submitLabel}
      </Button>
      {footer ? <div className="pt-2 text-center text-sm text-fog-500">{footer}</div> : null}
    </form>
  );
}

export function AuthLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="font-medium text-fog-200 underline-offset-4 hover:text-fog-50 hover:underline">
      {children}
    </Link>
  );
}
