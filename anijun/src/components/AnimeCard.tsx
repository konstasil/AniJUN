"use client";

import Link from "next/link";
import Image from "next/image";
import { useRef } from "react";

interface AnimeCardProps {
  id: number;
  title: string;
  image_url: string;
  genres: string[];
  season_info: string;
  age_rating: string;
  weighted_rating: number | string;
  watched_episodes?: number;
  total_episodes?: number;
}

export default function AnimeCard({
  id,
  title,
  image_url,
  season_info,
  age_rating,
  weighted_rating,
  watched_episodes = 0,
  total_episodes = 0,
}: AnimeCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  const ratingDisplay =
    typeof weighted_rating === "number"
      ? weighted_rating.toFixed(2)
      : weighted_rating;

  const isFullyWatched =
    total_episodes > 0 && watched_episodes === total_episodes;

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const rotateY = (x / rect.width - 0.5) * 30;
    const rotateX = (0.5 - y / rect.height) * 30;

    card.style.transform = `rotateY(${rotateY}deg) rotateX(${rotateX}deg) scale(1.02)`;

    const holo = card.querySelector(".holo-layer") as HTMLElement;
    if (holo) {
      holo.style.backgroundPosition = `${(x / rect.width) * 100}% ${(y / rect.height) * 100}%`;
    }
  }

  function handleMouseLeave() {
    const card = cardRef.current;
    if (!card) return;
    card.style.transform = `rotateY(0deg) rotateX(0deg) scale(1)`;
  }

  return (
    <Link
      href={`/anime/${id}`}
      className="card-wrapper flex flex-col gap-1.5 group cursor-pointer transition-all"
    >
      <div
        ref={cardRef}
        className="holo-container relative aspect-[3/4] rounded-lg overflow-hidden bg-[#1a1a1e] border border-[#222226] group-hover:border-sky-400/30 transition-all"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <div className="absolute top-2 left-2 bg-black/80 border border-[#222226] text-[10px] font-bold text-sky-400 px-1.5 py-0.5 rounded z-20">
          ★ {ratingDisplay}
        </div>
        <div className="absolute top-2 right-2 bg-black/80 border border-[#222226] text-[10px] font-bold text-gray-300 px-1.5 py-0.5 rounded z-20">
          {age_rating}
        </div>
        <Image
          src={image_url}
          alt={title}
          fill
          className="object-cover group-hover:scale-[1.02] transition-all duration-300"
          sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 20vw"
        />
        {isFullyWatched && <div className="holo-layer" />}
        {total_episodes > 0 && (
          <div className="absolute bottom-2 right-2 bg-black/80 text-[9px] font-bold text-gray-300 px-1.5 py-0.5 rounded border border-[#222226] z-20">
            {watched_episodes}/{total_episodes} сер
          </div>
        )}
      </div>
      <div className="px-0.5">
        <h4 className="font-bold text-gray-200 text-xs truncate group-hover:text-sky-400 transition-colors">
          {title}
        </h4>
        <span className="text-[9px] text-gray-500 block">{season_info}</span>
      </div>
    </Link>
  );
}
