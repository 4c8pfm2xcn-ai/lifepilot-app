"use client";

/* eslint-disable @next/next/no-img-element -- short-lived signed URLs / local previews */

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { ImageIcon, PlusIcon, TrashIcon } from "@/components/ui/icons";
import { Notice } from "@/components/ui/notice";
import { apiFetch } from "@/lib/client/api";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function NewProjectForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<{ id: string }>("/api/projects", { method: "POST", json: { name, description: description || null } });
      router.push(`/projects/${res.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create project.");
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} icon={<PlusIcon size={16} />}>
        New project
      </Button>
    );
  }
  return (
    <form onSubmit={onSubmit} className="surface w-full space-y-3 rounded-2xl p-4 sm:w-96 animate-fade-up">
      <div>
        <label htmlFor="project-name" className="mb-1.5 block text-sm text-fog-200">Name</label>
        <input id="project-name" className="field" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required autoFocus />
      </div>
      <div>
        <label htmlFor="project-description" className="mb-1.5 block text-sm text-fog-200">Description <span className="text-fog-600">(optional)</span></label>
        <textarea id="project-description" className="field" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} />
      </div>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <div className="flex gap-2">
        <Button type="submit" loading={busy} disabled={!name.trim()}>Create</Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </form>
  );
}

export function ProjectSettings({
  id,
  name: initialName,
  description: initialDescription,
  coverUrl,
}: {
  id: string;
  name: string;
  description: string | null;
  coverUrl: string | null;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy("save");
    setError(null);
    setSaved(false);
    try {
      await apiFetch(`/api/projects/${id}`, { method: "PATCH", json: { name, description: description || null } });
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(null);
    }
  }

  async function uploadCover(file: File) {
    setBusy("cover");
    setError(null);
    try {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Use a JPG, PNG or WebP image.");
      if (file.size > 5 * 1024 * 1024) throw new Error("Images must be 5 MB or smaller.");
      const signed = await apiFetch<{ bucket: string; path: string; token: string }>("/api/uploads", {
        method: "POST",
        json: { purpose: "cover", contentType: file.type, size: file.size },
      });
      const { error: upErr } = await createSupabaseBrowserClient()
        .storage.from(signed.bucket)
        .uploadToSignedUrl(signed.path, signed.token, file, { contentType: file.type });
      if (upErr) throw new Error("Upload failed. Please try again.");
      await apiFetch(`/api/projects/${id}`, { method: "PATCH", json: { coverPath: signed.path } });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update cover.");
    } finally {
      setBusy(null);
    }
  }

  async function removeCover() {
    setBusy("cover");
    try {
      await apiFetch(`/api/projects/${id}`, { method: "PATCH", json: { coverPath: null } });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove cover.");
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    setBusy("delete");
    try {
      await apiFetch(`/api/projects/${id}`, { method: "DELETE" });
      router.push("/projects");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete project.");
      setBusy(null);
    }
  }

  return (
    <div className="surface space-y-5 rounded-2xl p-5">
      <form onSubmit={save} className="space-y-3">
        <div>
          <label htmlFor="edit-name" className="mb-1.5 block text-sm text-fog-200">Name</label>
          <input id="edit-name" className="field" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required />
        </div>
        <div>
          <label htmlFor="edit-description" className="mb-1.5 block text-sm text-fog-200">Description</label>
          <textarea id="edit-description" className="field" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} />
        </div>
        <Button type="submit" size="sm" loading={busy === "save"} disabled={!name.trim()}>Save</Button>
        {saved ? <span className="ml-3 text-sm text-success">Saved</span> : null}
      </form>

      <div className="border-t hairline pt-5">
        <p className="mb-2 text-sm text-fog-200">Cover image</p>
        {coverUrl ? <img src={coverUrl} alt="Project cover" className="mb-3 aspect-video w-full rounded-xl object-cover" /> : null}
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border hairline px-3 text-sm text-fog-200 hover:bg-white/5 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-aurora-violet">
            <ImageIcon size={15} /> {busy === "cover" ? "Uploading…" : coverUrl ? "Replace" : "Upload cover"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              disabled={busy === "cover"}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadCover(f);
                e.target.value = "";
              }}
            />
          </label>
          {coverUrl ? <Button size="sm" variant="ghost" onClick={removeCover} disabled={busy === "cover"}>Remove</Button> : null}
        </div>
      </div>

      <div className="border-t hairline pt-5">
        {confirmDelete ? (
          <div className="space-y-2">
            <p className="text-sm text-fog-400">Delete this project? Its videos stay in your library.</p>
            <div className="flex gap-2">
              <Button size="sm" variant="danger" onClick={remove} loading={busy === "delete"}>Delete project</Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(true)} icon={<TrashIcon size={15} />}>
            Delete project
          </Button>
        )}
      </div>
      {error ? <Notice tone="danger">{error}</Notice> : null}
    </div>
  );
}
