"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";

interface AnimeTop {
  id: number;
  title: string;
  genres: string[];
  season_info: string;
  weighted_rating: number | string;
}

export default function TopPage() {
  const [anime, setAnime] = useState<AnimeTop[]>([]);
  const supabase = useRef(createClient()).current;

  useEffect(() => {
    async function load() {
      const { data: allAnime } = await supabase
        .from("anime")
        .select("id, title, genres, season_info")
        .order("id");

      if (!allAnime) return;

      const { data: ratings } = await supabase.from("ratings").select("anime_id, rating");
      const { count: totalUsers } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });

      const enriched = allAnime.map((a) => {
        const animeRatings = ratings?.filter((r) => r.anime_id === a.id) || [];
        const count = animeRatings.length;
        let weightedRating: number | string = "-";
        if (count > 0) {
          const avg = animeRatings.reduce((s, r) => s + r.rating, 0) / count;
          weightedRating = parseFloat(
            (avg * Math.pow(count / Math.max(totalUsers || 1, 1), 0.5)).toFixed(2)
          );
        }
        return { ...a, weighted_rating: weightedRating };
      });

      enriched.sort((a, b) => {
        const valA = typeof a.weighted_rating === "number" ? a.weighted_rating : -1;
        const valB = typeof b.weighted_rating === "number" ? b.weighted_rating : -1;
        return valB - valA;
      });

      setAnime(enriched);
    }
    load();
  }, []);

  return (
    <div>
      <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-6">
        Самые популярные аниме по мнению AniJUN
      </h3>
      <div className="bg-[#1a1a1e] border border-[#222226] rounded-xl overflow-hidden">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-[#222226] bg-[#121214] text-gray-500">
              <th className="py-3 px-4 font-bold text-center w-12">№</th>
              <th className="py-3 px-4 font-bold">Название</th>
              <th className="py-3 px-4 font-bold">Жанры</th>
              <th className="py-3 px-4 font-bold text-center">Сезон</th>
              <th className="py-3 px-4 font-bold text-center">Оценка</th>
            </tr>
          </thead>
          <tbody>
            {anime.map((a, idx) => (
              <tr
                key={a.id}
                className="border-b border-[#222226] hover:bg-[#1f1f23] transition-colors"
              >
                <td className="py-3 px-4 text-center font-bold text-gray-500">
                  {idx + 1}
                </td>
                <td className="py-3 px-4 font-bold text-gray-200">
                  <Link href={`/anime/${a.id}`} className="hover:text-sky-400 transition-colors">
                    {a.title}
                  </Link>
                </td>
                <td className="py-3 px-4 text-gray-400 text-[11px]">
                  {a.genres.join(", ")}
                </td>
                <td className="py-3 px-4 text-center text-gray-500">
                  {a.season_info}
                </td>
                <td className="py-3 px-4 text-center font-bold text-sky-400">
                  {typeof a.weighted_rating === "number"
                    ? a.weighted_rating.toFixed(2)
                    : a.weighted_rating}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
