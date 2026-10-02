import { ACCEPTED_IMAGE_TYPES, MAX_UPLOAD_BYTES } from "./config";

export function validateImageFile(file: File): string | null {
  const type = file.type.toLowerCase();
  if (/heic|heif/.test(type) || /\.(heic|heif)$/i.test(file.name)) return "HEIC photos aren't supported. Take a screenshot or export the photo as JPEG/PNG.";
  if (type === "application/pdf" || /\.pdf$/i.test(file.name)) return "PDFs aren't supported yet. Take a screenshot of the page you need instead.";
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(type)) return `“${file.name}” isn't a supported image. Use PNG, JPEG, WebP or GIF.`;
  if (file.size > MAX_UPLOAD_BYTES) return `That image is ${(file.size / 1024 / 1024).toFixed(1)} MB — the limit is ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`;
  if (file.size === 0) return "That file is empty.";
  return null;
}

export function extFor(type: string) {
  return { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif" }[type] ?? "bin";
}
