"use client";

import Link from "next/link";

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
  const ratingDisplay =
    typeof weighted_rating === "number"
      ? weighted_rating.toFixed(2)
      : weighted_rating;

  return (
    <Link href={`/anime/${id}`} className="flex flex-col gap-1.5 group cursor-pointer transition-all">
      <div className="relative aspect-[3/4] rounded-lg overflow-hidden bg-[#1a1a1e] border border-[#222226] group-hover:border-sky-400/30 transition-all">
        <div className="absolute top-2 left-2 bg-black/80 border border-[#222226] text-[10px] font-bold text-sky-400 px-1.5 py-0.5 rounded z-10">
          ★ {ratingDisplay}
        </div>
        <div className="absolute top-2 right-2 bg-black/80 border border-[#222226] text-[10px] font-bold text-gray-300 px-1.5 py-0.5 rounded z-10">
          {age_rating}
        </div>
        <img
          src={image_url}
          alt={title}
          className="w-full h-full object-cover group-hover:scale-[1.02] transition-all duration-300"
          loading="lazy"
        />
        {total_episodes > 0 && (
          <div className="absolute bottom-2 right-2 bg-black/80 text-[9px] font-bold text-gray-300 px-1.5 py-0.5 rounded border border-[#222226] z-10">
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
