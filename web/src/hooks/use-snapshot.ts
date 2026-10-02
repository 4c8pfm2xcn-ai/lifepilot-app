"use client";
import { useMemo } from "react";
import { useData } from "@/providers/data-provider";
import type { SnapshotSource } from "@/lib/client-api";
import { DEFAULT_PREFERENCES } from "@/lib/types";

/** The data slice AI routes need (only transmitted in demo mode). */
export function useSnapshotSource(): SnapshotSource {
  const { profile, tasks, events, goals, goal_milestones, inbox_items } = useData();
  return useMemo(
    () => ({ name: profile?.full_name ?? "", preferences: profile?.preferences ?? DEFAULT_PREFERENCES, tasks, events, goals, goal_milestones, inbox_items }),
    [profile, tasks, events, goals, goal_milestones, inbox_items],
  );
}
