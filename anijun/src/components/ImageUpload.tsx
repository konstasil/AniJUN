"use client";

import { createClient } from "@/lib/supabase/client";
import { useRef, useState } from "react";

interface ImageUploadProps {
  bucket: "users" | "Anime" | "posts";
  currentUrl?: string;
  onUploaded: (url: string) => void;
  size?: number;
  label?: string;
  className?: string;
  userId?: string;
}

export default function ImageUpload({
  bucket,
  currentUrl,
  onUploaded,
  size = 120,
  label = "Изменить фото",
  className = "",
  userId,
}: ImageUploadProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  function handleClick() {
    fileRef.current?.click();
  }

  async function compressImage(file: File): Promise<File> {
    if (!file.type.startsWith("image/") || file.size <= 1024 * 1024) return file;
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    let w = bitmap.width;
    let h = bitmap.height;
    const scale = Math.sqrt((1024 * 1024) / file.size);
    if (scale < 1) { w = Math.round(w * scale); h = Math.round(h * scale); }
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0, w, h);
    let quality = 0.85;
    let blob: Blob | null = null;
    for (let i = 0; i < 4; i++) {
      blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", quality));
      if (blob && blob.size <= 1024 * 1024) break;
      quality -= 0.15;
    }
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" });
  }

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    let file = e.target.files?.[0];
    if (!file) return;

    if (!file.type) file = new File([file], file.name, { type: "application/octet-stream" });

    setError(null);
    setUploading(true);

    if (file.type.startsWith("image/")) {
      try { file = await compressImage(file); } catch {}
    }
    if (file.size > 1024 * 1024) {
      setError("Максимум 1 МБ после сжатия");
      setUploading(false);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);

    const ext = file.name.split(".").pop() || "jpg";
    const timestamp = Date.now();
    const safeBucket = bucket === "posts" ? "Anime" : bucket;
    const path = safeBucket === "users" && userId ? `${userId}/avatar_${timestamp}.${ext}` : `${timestamp}.${ext}`;

    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = (buckets || []).some(b => b.name === safeBucket);
    if (!bucketExists) {
      await supabase.storage.createBucket(safeBucket, { public: true });
    }

    const { error: uploadError } = await supabase.storage
      .from(safeBucket)
      .upload(path, file, { upsert: false, contentType: file.type });

    if (uploadError) {
      setError("Ошибка загрузки: " + uploadError.message);
      setUploading(false);
      return;
    }

    const { data } = supabase.storage.from(safeBucket).getPublicUrl(path);
    if (currentUrl && currentUrl.includes(`/storage/v1/object/public/${safeBucket}/`)) {
      const oldPath = currentUrl.split(`/storage/v1/object/public/${safeBucket}/`)[1]?.split("?")[0];
      if (oldPath && oldPath !== path) {
        try { await supabase.storage.from(safeBucket).remove([oldPath]); } catch {}
      }
    }
    setUploading(false);
    setPreview(null);
    onUploaded(data.publicUrl);
  }

  const displayUrl = preview || currentUrl;

  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      <div
        onClick={handleClick}
        className="relative cursor-pointer group overflow-hidden rounded-xl border-2 border-dashed border-[#2d2d35] hover:border-sky-500/50 transition-colors"
        style={{ width: size, height: size }}
      >
        {displayUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- превью может быть blob: URL (object URL), next/image его не поддерживает
          <img
            src={displayUrl}
            alt="Preview"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-[#121214] flex items-center justify-center">
            <i className="fa-solid fa-camera text-gray-600 text-xl"></i>
          </div>
        )}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          {uploading ? (
            <i className="fa-solid fa-spinner fa-spin text-white text-sm"></i>
          ) : (
            <i className="fa-solid fa-pen text-white text-sm"></i>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={handleClick}
        disabled={uploading}
        className="text-[10px] font-bold text-sky-400 hover:text-sky-300 transition-colors disabled:opacity-50"
      >
        {uploading ? "Загрузка..." : label}
      </button>
      {error && (
        <span className="text-[10px] text-red-400">{error}</span>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*,video/*,audio/*,.gif,.mp3,.mov,.mp4,.webm,.ogg,.wav,.flac,.mkv,.avi"
        onChange={handleChange}
        className="hidden"
      />
    </div>
  );
}
