"use client";

import Image, { type ImageProps } from "next/image";
import { useMemo, useState } from "react";

const FALLBACK_IMAGE = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="800" height="1200" viewBox="0 0 800 1200">
    <rect width="100%" height="100%" fill="#121214"/>
    <rect x="32" y="32" width="736" height="1136" rx="32" fill="#1a1a1e" stroke="#2d2d35" stroke-width="4"/>
    <circle cx="400" cy="430" r="140" fill="#222226"/>
    <path d="M270 760c34-120 128-188 260-188 86 0 154 36 190 94" stroke="#38bdf8" stroke-width="24" fill="none" stroke-linecap="round"/>
    <text x="400" y="980" text-anchor="middle" font-family="Arial, sans-serif" font-size="56" fill="#f4f4f5">Anime</text>
  </svg>
`)}`;

function normalizeSrc(src: ImageProps["src"] | string | null | undefined): string {
  if (typeof src !== "string") return FALLBACK_IMAGE;

  const value = src.trim();
  if (!value) return FALLBACK_IMAGE;

  if (value.startsWith("data:image") || value.startsWith("http://") || value.startsWith("https://") || value.startsWith("/")) {
    return value;
  }

  return value;
}

export default function SafeImage(props: ImageProps) {
  const { src, alt, ...rest } = props;
  const [currentSrc, setCurrentSrc] = useState<string>(normalizeSrc(src));

  const normalizedSrc = useMemo(() => normalizeSrc(src), [src]);
  const resolvedSrc = currentSrc === normalizedSrc ? currentSrc : normalizedSrc;

  return (
    <Image
      {...rest}
      src={resolvedSrc}
      alt={alt}
      onError={() => setCurrentSrc(FALLBACK_IMAGE)}
      unoptimized
    />
  );
}
