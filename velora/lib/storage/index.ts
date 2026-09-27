import "server-only";

import { randomUUID } from "node:crypto";

import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { sniffImageType } from "@/lib/security/image";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { IMAGE_EXTENSIONS, MAX_IMAGE_BYTES, type AllowedImageType } from "@/lib/validation/schemas";

export const BUCKETS = {
  inputImages: "input-images",
  generatedVideos: "generated-videos",
  thumbnails: "thumbnails",
} as const;

export type BucketName = (typeof BUCKETS)[keyof typeof BUCKETS];

/** Signed URL lifetime for viewing media in the app. */
export const VIEW_URL_TTL_SECONDS = 60 * 60;
/** Signed URL lifetime handed to the provider to fetch the input image. */
export const PROVIDER_FETCH_TTL_SECONDS = 60 * 60;
/** Upper bound on generated video size we will copy into storage. */
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

export function isOwnedPath(path: string, userId: string): boolean {
  return path.startsWith(`${userId}/`) && !path.includes("..");
}

export async function createImageUploadUrl(
  userId: string,
  purpose: "input" | "cover",
  contentType: AllowedImageType,
): Promise<{ bucket: BucketName; path: string; token: string }> {
  const ext = IMAGE_EXTENSIONS[contentType];
  const bucket = purpose === "input" ? BUCKETS.inputImages : BUCKETS.thumbnails;
  const path = purpose === "input" ? `${userId}/${randomUUID()}.${ext}` : `${userId}/covers/${randomUUID()}.${ext}`;
  const { data, error } = await getSupabaseAdmin().storage.from(bucket).createSignedUploadUrl(path);
  if (error || !data) {
    logger.error("storage.createSignedUploadUrl", error);
    throw new AppError("internal", "Could not prepare the upload. Please try again.");
  }
  return { bucket, path: data.path, token: data.token };
}

/**
 * Downloads an uploaded image and verifies ownership, size and real file type.
 * Invalid files are deleted. Returns the verified bytes and type.
 */
export async function verifyUploadedImage(
  bucket: BucketName,
  path: string,
  userId: string,
): Promise<{ bytes: Uint8Array; contentType: AllowedImageType }> {
  if (!isOwnedPath(path, userId)) throw new AppError("forbidden", "That image does not belong to you.");

  const storage = getSupabaseAdmin().storage.from(bucket);
  const { data, error } = await storage.download(path);
  if (error || !data) throw new AppError("invalid_upload", "The uploaded image could not be found. Please upload it again.");

  const bytes = new Uint8Array(await data.arrayBuffer());
  const detected = sniffImageType(bytes);
  const expectedExt = path.split(".").pop();
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_IMAGE_BYTES || !detected || IMAGE_EXTENSIONS[detected] !== expectedExt) {
    await storage.remove([path]);
    throw new AppError("invalid_upload", "The uploaded file is not a valid JPG, PNG or WebP image under 5 MB.");
  }
  return { bytes, contentType: detected };
}

export async function createSignedUrl(bucket: BucketName, path: string, ttlSeconds = VIEW_URL_TTL_SECONDS, download?: string) {
  const { data, error } = await getSupabaseAdmin()
    .storage.from(bucket)
    .createSignedUrl(path, ttlSeconds, download ? { download } : undefined);
  if (error || !data) {
    logger.warn("storage.createSignedUrl", { bucket, message: error?.message });
    return null;
  }
  return data.signedUrl;
}

/** Batch-signs paths (one request). Returns a map path -> signed URL. */
export async function createSignedUrls(bucket: BucketName, paths: string[], ttlSeconds = VIEW_URL_TTL_SECONDS) {
  const unique = [...new Set(paths.filter(Boolean))];
  const map = new Map<string, string>();
  if (unique.length === 0) return map;
  const { data, error } = await getSupabaseAdmin().storage.from(bucket).createSignedUrls(unique, ttlSeconds);
  if (error || !data) {
    logger.warn("storage.createSignedUrls", { bucket, message: error?.message });
    return map;
  }
  for (const item of data) {
    if (item.path && item.signedUrl) map.set(item.path, item.signedUrl);
  }
  return map;
}

/**
 * Produces a URL the provider can fetch. Uses a short-lived signed HTTPS URL when
 * Supabase is publicly reachable; for local development (http://127.0.0.1) the
 * provider cannot reach it, so fall back to a base64 data URI (Runway accepts up
 * to 5 MB data URIs).
 */
export async function providerFetchableImageUrl(
  path: string,
  verified: { bytes: Uint8Array; contentType: AllowedImageType },
): Promise<string> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const isPublicHttps = supabaseUrl.startsWith("https://");
  if (isPublicHttps) {
    const signed = await createSignedUrl(BUCKETS.inputImages, path, PROVIDER_FETCH_TTL_SECONDS);
    if (signed) return signed;
  }
  const dataUri = `data:${verified.contentType};base64,${Buffer.from(verified.bytes).toString("base64")}`;
  if (dataUri.length > 5 * 1024 * 1024) {
    throw new AppError("invalid_upload", "This image is too large to send to the provider. Please use an image under 3.5 MB.");
  }
  return dataUri;
}

/**
 * Copies a provider output (expiring URL) into the private generated-videos bucket.
 * Enforces a size cap while streaming.
 */
export async function persistGeneratedVideo(userId: string, generationId: string, sourceUrl: string): Promise<string> {
  const url = new URL(sourceUrl);
  if (url.protocol !== "https:") throw new Error("Provider output URL is not HTTPS");

  const response = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!response.ok || !response.body) throw new Error(`Output download failed with status ${response.status}`);
  const declared = Number(response.headers.get("content-length") ?? "0");
  if (declared > MAX_VIDEO_BYTES) throw new Error("Output video exceeds size limit");

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_VIDEO_BYTES) {
      await reader.cancel();
      throw new Error("Output video exceeds size limit");
    }
    chunks.push(value);
  }
  const body = Buffer.concat(chunks);
  const path = `${userId}/${generationId}.mp4`;
  const { error } = await getSupabaseAdmin()
    .storage.from(BUCKETS.generatedVideos)
    .upload(path, body, { contentType: "video/mp4", upsert: true });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  return path;
}

export async function removeObjects(bucket: BucketName, paths: (string | null | undefined)[]): Promise<void> {
  const list = paths.filter((p): p is string => Boolean(p));
  if (list.length === 0) return;
  const { error } = await getSupabaseAdmin().storage.from(bucket).remove(list);
  if (error) logger.warn("storage.remove", { bucket, message: error.message });
}
