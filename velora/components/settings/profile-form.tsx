"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { apiFetch } from "@/lib/client/api";

export function ProfileForm({ displayName }: { displayName: string }) {
  const router = useRouter();
  const [name, setName] = useState(displayName);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ tone: "success" | "danger"; text: string } | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      await apiFetch("/api/profile", { method: "PATCH", json: { displayName: name } });
      setStatus({ tone: "success", text: "Profile updated." });
      router.refresh();
    } catch (err) {
      setStatus({ tone: "danger", text: err instanceof Error ? err.message : "Could not update profile." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <label htmlFor="display-name" className="mb-1.5 block text-sm text-fog-200">Display name</label>
        <input id="display-name" className="field max-w-sm" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required autoComplete="name" />
      </div>
      <Button type="submit" size="sm" loading={busy} disabled={!name.trim() || name === displayName}>Save</Button>
      {status ? <Notice tone={status.tone} className="max-w-sm">{status.text}</Notice> : null}
    </form>
  );
}
