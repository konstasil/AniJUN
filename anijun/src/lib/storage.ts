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
  let owner = "anon";
  try {
    const { data } = await supabase.auth.getSession();
    if (data.session?.user?.id) owner = data.session.user.id;
  } catch {}

  const ext = payload.name.split(".").pop() || "bin";
  const safeExt = /^[a-z0-9]+$/i.test(ext) ? ext : "bin";
  const base = `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${safeExt}`;
  const folders = owner === "anon" ? [prefix, "shared", base] : [owner, prefix, base];

  let lastError = "Bucket not found";
  for (const bucket of CANDIDATES) {
    const { error } = await supabase.storage.from(bucket).upload(folders.join("/"), payload, { upsert: false, contentType: payload.type });
    if (error) { lastError = error.message; continue; }
    const { data } = supabase.storage.from(bucket).getPublicUrl(folders.join("/"));
    if (await isPubliclyReadable(data.publicUrl)) {
      return { url: data.publicUrl, bucket };
    }
    await supabase.storage.from(bucket).remove([folders.join("/")]).catch(() => {});
    lastError = "Бакет не публичный";
  }
  throw new Error(lastError);
}

async function isPubliclyReadable(url: string) {
  try {
    const res = await fetch(url, { method: "GET", headers: { Range: "bytes=0-0" }, cache: "no-store" });
    if (res.status === 200 || res.status === 206) return true;
    if (res.status >= 400 && res.status < 500) return false;
    return true;
  } catch {
    return true;
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
