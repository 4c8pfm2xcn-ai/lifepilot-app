"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { Button, LinkButton, buttonClasses } from "@/components/ui/button";
import { DownloadIcon, HeartIcon, RefreshIcon, TrashIcon, WandIcon } from "@/components/ui/icons";
import { Notice } from "@/components/ui/notice";
import { apiFetch, newIdempotencyKey } from "@/lib/client/api";

export function GenerationActions({
  id,
  status,
  isFavorite,
  projectId,
  projects,
}: {
  id: string;
  status: string;
  isFavorite: boolean;
  projectId: string | null;
  projects: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [favorite, setFavorite] = useState(isFavorite);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const regenKey = useRef(newIdempotencyKey());
  const completed = status === "completed";
  const active = status === "queued" || status === "processing";

  async function run(name: string, fn: () => Promise<void>) {
    setBusy(name);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  const toggleFavorite = () =>
    run("favorite", async () => {
      const next = !favorite;
      setFavorite(next);
      try {
        await apiFetch(`/api/generation/${id}/favorite`, { method: next ? "POST" : "DELETE" });
      } catch (e) {
        setFavorite(!next);
        throw e;
      }
    });

  const regenerate = () =>
    run("regenerate", async () => {
      const res = await apiFetch<{ generationId: string }>(`/api/generation/${id}/regenerate`, {
        method: "POST",
        headers: { "Idempotency-Key": regenKey.current },
      });
      regenKey.current = newIdempotencyKey();
      router.push(`/generations/${res.generationId}`);
    });

  const remove = () =>
    run("delete", async () => {
      await apiFetch(`/api/generation/${id}`, { method: "DELETE" });
      router.push("/library");
      router.refresh();
    });

  const moveToProject = (value: string) =>
    run("project", async () => {
      await apiFetch(`/api/generation/${id}`, { method: "PATCH", json: { projectId: value || null } });
      router.refresh();
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {completed ? (
          <a href={`/api/generation/${id}/download`} className={buttonClasses("primary", "md")} download>
            <DownloadIcon size={16} /> Download
          </a>
        ) : null}
        <Button
          variant="secondary"
          onClick={toggleFavorite}
          disabled={busy === "favorite"}
          aria-pressed={favorite}
          icon={<HeartIcon size={16} filled={favorite} className={favorite ? "text-aurora-rose" : undefined} />}
        >
          {favorite ? "Favorited" : "Favorite"}
        </Button>
        {!active ? (
          <Button variant="secondary" onClick={regenerate} loading={busy === "regenerate"} icon={<RefreshIcon size={16} />}>
            Regenerate
          </Button>
        ) : null}
        <LinkButton href={`/create?from=${id}`} variant="ghost" icon={<WandIcon size={16} />}>
          Edit &amp; regenerate
        </LinkButton>
        {confirmDelete ? (
          <span className="flex items-center gap-2">
            <Button variant="danger" onClick={remove} loading={busy === "delete"}>
              Confirm delete
            </Button>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Keep
            </Button>
          </span>
        ) : (
          <Button variant="ghost" onClick={() => setConfirmDelete(true)} icon={<TrashIcon size={16} />}>
            Delete
          </Button>
        )}
      </div>
      {projects.length > 0 ? (
        <div className="flex items-center gap-3">
          <label htmlFor="move-project" className="text-sm text-fog-500">
            Project
          </label>
          <select
            id="move-project"
            className="field max-w-xs py-2 text-sm"
            defaultValue={projectId ?? ""}
            disabled={busy === "project"}
            onChange={(e) => moveToProject(e.target.value)}
          >
            <option value="">No project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {confirmDelete && active ? (
        <p className="text-xs text-fog-500">Deleting an in-progress generation cancels it and refunds your credits.</p>
      ) : null}
    </div>
  );
}
