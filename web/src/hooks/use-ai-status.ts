"use client";
import { useEffect, useState } from "react";

export interface AIStatus {
  ai: boolean;
  model: string | null;
  backend: "supabase" | "demo";
}

let cached: AIStatus | null = null;
let inflight: Promise<AIStatus> | null = null;

export function fetchAIStatus() {
  if (cached) return Promise.resolve(cached);
  if (process.env.NEXT_PUBLIC_STATIC_PREVIEW === "1") return Promise.resolve((cached = { ai: false, model: null, backend: "demo" }));
  inflight ??= fetch("/api/ai/status")
    .then((r) => r.json())
    .then((s: AIStatus) => (cached = s))
    .catch(() => ({ ai: false, model: null, backend: "demo" }) as AIStatus);
  return inflight;
}

export function useAIStatus() {
  const [status, setStatus] = useState<AIStatus | null>(cached);
  useEffect(() => {
    let alive = true;
    fetchAIStatus().then((s) => alive && setStatus(s));
    return () => {
      alive = false;
    };
  }, []);
  return status;
}
