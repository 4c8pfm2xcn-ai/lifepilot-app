import { NextResponse } from "next/server";
import { AI_MODEL, isAIConfigured } from "@/lib/ai/anthropic";
import { isSupabaseConfigured } from "@/lib/config";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ ai: isAIConfigured(), model: isAIConfigured() ? AI_MODEL : null, backend: isSupabaseConfigured ? "supabase" : "demo" });
}
