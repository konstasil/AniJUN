import { createClient } from "@/lib/supabase/client";

const MAX_BYTES = 1024 * 1024;
const CANDIDATES = ["posts", "Anime"];

export async function compressImageFile(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size <= MAX_BYTES) return file;
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  const scale = Math.sqrt(MAX_BYTES / file.size);
  const w = scale < 1 ? Math.round(bitmap.width * scale) : bitmap.width;
  const h = scale < 1 ? Math.round(bitmap.height * scale) : bitmap.height;
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, w, h);
  let quality = 0.85;
  let blob: Blob | null = null;
  for (let i = 0; i < 4; i++) {
    blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", quality));
    if (blob && blob.size <= MAX_BYTES) break;
    quality -= 0.15;
  }
  if (!blob) return file;
  return new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" });
}

export async function uploadMedia(file: File, prefix = "media"): Promise<{ url: string; bucket: string }> {
  let payload = file;
  if (payload.type.startsWith("image/")) {
    try { payload = await compressImageFile(payload); } catch {}
  }
  if (payload.size > MAX_BYTES) throw new Error("Максимум 1 МБ");

  const supabase = createClient();
  const { data: buckets } = await supabase.storage.listBuckets();
  const names = buckets?.map((b) => b.name) || [];
  const existing = CANDIDATES.filter((c) => names.includes(c));
  const list = existing.length ? existing : CANDIDATES;

  const ext = payload.name.split(".").pop() || "bin";
  const safeExt = /^[a-z0-9]+$/i.test(ext) ? ext : "bin";
  const base = `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  let lastError = "Bucket not found";
  for (const bucket of list) {
    const path = `${base}.${safeExt}`;
    const { error } = await supabase.storage.from(bucket).upload(path, payload, { upsert: false, contentType: payload.type });
    if (error) { lastError = error.message; continue; }
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    if (await isPubliclyReadable(data.publicUrl)) {
      return { url: data.publicUrl, bucket };
    }
    await supabase.storage.from(bucket).remove([path]).catch(() => {});
    lastError = "Бакет не публичный";
  }
  throw new Error(lastError);
}

async function isPubliclyReadable(url: string) {
  try {
    const res = await fetch(url, { method: "HEAD", cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}

export async function removeMedia(url: string | null | undefined) {
  if (!url) return;
  const m = url.match(/\/storage\/v1\/object\/(?:public\/)?([^/]+)\/(.+?)(?:\?|$)/);
  if (!m) return;
  const [, bucket, rawPath] = m;
  try {
    const supabase = createClient();
    await supabase.storage.from(bucket).remove([decodeURIComponent(rawPath)]);
  } catch {}
}
