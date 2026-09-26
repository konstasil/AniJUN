"use client";

import { createClient } from "@/lib/supabase/client";
import { useRef, useState } from "react";
import { uploadMedia } from "@/lib/storage";

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

    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);

    try {
      if (bucket === "users") {
        const compressed = file.type.startsWith("image/") ? await compressImage(file) : file;
        if (compressed.size > 1024 * 1024) throw new Error("Максимум 1 МБ после сжатия");
        const ext = compressed.name.split(".").pop() || "jpg";
        const path = userId ? `${userId}/avatar_${Date.now()}.${ext}` : `${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from("users").upload(path, compressed, { upsert: false, contentType: compressed.type });
        if (error) throw new Error(error.message);
        if (currentUrl && currentUrl.includes("/storage/v1/object/public/users/")) {
          const oldPath = currentUrl.split("/storage/v1/object/public/users/")[1]?.split("?")[0];
          if (oldPath && oldPath !== path) {
            try { await supabase.storage.from("users").remove([oldPath]); } catch {}
          }
        }
        const { data } = supabase.storage.from("users").getPublicUrl(path);
        setUploading(false);
        setPreview(null);
        onUploaded(data.publicUrl);
        return;
      }

      const { url } = await uploadMedia(file, "img");
      if (currentUrl && currentUrl.includes("/storage/v1/object/public/")) {
        const parts = currentUrl.split("/storage/v1/object/public/")[1]?.split("/");
        const oldBucket = parts?.[0];
        const oldPath = parts?.slice(1).join("/").split("?")[0];
        if (oldBucket && oldPath) {
          try { await supabase.storage.from(oldBucket).remove([oldPath]); } catch {}
        }
      }
      setUploading(false);
      setPreview(null);
      onUploaded(url);
    } catch (err) {
      setError("Ошибка загрузки: " + (err instanceof Error ? err.message : "неизвестно"));
      setUploading(false);
    }
  }

  const displayUrl = preview || currentUrl;
  const isVideo = displayUrl ? /\.(mp4|mov|webm|mkv|avi)$/i.test(displayUrl.split("?")[0]) || preview?.startsWith("data:video") : false;
  const isAudio = displayUrl ? /\.(mp3|ogg|wav|flac)$/i.test(displayUrl.split("?")[0]) || preview?.startsWith("data:audio") : false;

  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      <div
        onClick={handleClick}
        className="relative cursor-pointer group overflow-hidden rounded-xl border-2 border-dashed border-[#2d2d35] hover:border-sky-500/50 transition-colors"
        style={{ width: size, height: size }}
      >
        {displayUrl ? (
          isVideo ? (
            <video src={displayUrl} className="w-full h-full object-cover" muted playsInline />
          ) : isAudio ? (
            <div className="w-full h-full bg-[#121214] flex items-center justify-center"><i className="fa-solid fa-music text-sky-400 text-xl"></i></div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={displayUrl} alt="Preview" className="w-full h-full object-cover" />
          )
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
