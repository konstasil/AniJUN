"use client";

import { createClient } from "@/lib/supabase/client";
import { useRef, useState } from "react";

interface ImageUploadProps {
  bucket: "users" | "Anime";
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

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError("Максимум 5 МБ");
      return;
    }

    setError(null);
    setUploading(true);

    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);

    const ext = file.name.split(".").pop() || "jpg";
    // Для bucket 'users' используем timestamp в имени файла, чтобы каждый новый аватар имел уникальный URL
    // Это решает проблему кеширования Next.js Image Optimization
    const timestamp = Date.now();
    const path = bucket === "users" && userId ? `${userId}/avatar_${timestamp}.${ext}` : `${timestamp}.${ext}`;

    // Auto-create bucket if it doesn't exist
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = (buckets || []).some(b => b.name === bucket);
    if (!bucketExists) {
      await supabase.storage.createBucket(bucket, { public: true });
    }

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, file, { upsert: false, contentType: file.type });

    if (uploadError) {
      setError("Ошибка загрузки: " + uploadError.message);
      setUploading(false);
      return;
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
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
        accept="image/*"
        onChange={handleChange}
        className="hidden"
      />
    </div>
  );
}
