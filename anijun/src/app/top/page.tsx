"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { fetchViewersByAnime, enrichWithWeightedRating } from "@/lib/ratings";

const TOP_LIMIT = 100;

interface AnimeTop {
  id: number;
  slug?: string;
  title: string;
  image_url: string;
  genres: string[];
  season_info: string;
  age_rating: string;
  weighted_rating: number | string;
  viewers: number;
}

export default function TopPage() {
  const [anime, setAnime] = useState<AnimeTop[]>([]);
  const [loaded, setLoaded] = useState(false);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data: allAnime } = await supabase
        .from("anime")
        .select("id, slug, title, image_url, genres, season_info, age_rating")
        .order("id");

      if (!allAnime || cancelled) return;

      const { data: ratings } = await supabase.from("ratings").select("anime_id, rating");

      const viewersByAnime = await fetchViewersByAnime(supabase);
      const enriched = enrichWithWeightedRating(allAnime, ratings, viewersByAnime).map((a) => ({
        ...a,
        viewers: viewersByAnime.get(a.id)?.size || 0,
      }));

      // Сортировка: рейтинг по убыванию, при равенстве — больше зрителей выше
      enriched.sort((a, b) => {
        const valA = typeof a.weighted_rating === "number" ? a.weighted_rating : -1;
        const valB = typeof b.weighted_rating === "number" ? b.weighted_rating : -1;
        return valB - valA || (b.viewers ?? 0) - (a.viewers ?? 0);
      });

      if (!cancelled) {
        setAnime(enriched.slice(0, TOP_LIMIT));
        setLoaded(true);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [supabase]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400">
          Топ-{TOP_LIMIT} аниме по мнению пользователей AniJUN
        </h3>
        <span className="text-[10px] text-gray-600">Взвешенный рейтинг</span>
      </div>
      <div className="bg-[#1a1a1e] border border-[#222226] rounded-xl overflow-hidden">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-[#222226] bg-[#121214] text-gray-500">
              <th className="py-3 px-3 font-bold text-center w-10">№</th>
              <th className="py-3 px-3 font-bold w-16"></th>
              <th className="py-3 px-3 font-bold">Название</th>
              <th className="py-3 px-3 font-bold">Жанры</th>
              <th className="py-3 px-3 font-bold text-center">Сезон</th>
              <th className="py-3 px-3 font-bold text-right">Оценившие</th>
              <th className="py-3 px-3 font-bold text-center w-16">Оценка</th>
            </tr>
          </thead>
          <tbody>
            {anime.map((a, idx) => {
              const animeUrl = a.slug ? `/anime/${a.slug}` : `/anime/${a.id}`;
              const place = idx + 1;
              return (
                <tr
                  key={a.id}
                  className={`border-b border-[#222226] hover:bg-[#1f1f23] transition-colors ${
                    place % 2 === 0 ? "bg-[#17171a]" : ""
                  }`}
                >
                  <td className="py-2.5 px-3 text-center font-bold text-gray-500">
                    {place <= 3 ? (
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-white text-[10px] font-black ${
                        place === 1 ? "bg-gradient-to-br from-amber-400 to-yellow-600 shadow-lg shadow-amber-500/20" :
                        place === 2 ? "bg-gradient-to-br from-gray-300 to-gray-500" :
                        "bg-gradient-to-br from-amber-700 to-orange-900"
                      }`}>
                        {place}
                      </span>
                    ) : (
                      place
                    )}
                  </td>
                  <td className="py-2.5 px-3">
                    <Link href={animeUrl} className="block w-[50px] h-[70px] rounded overflow-hidden bg-[#121214] relative">
                      <Image src={a.image_url} alt={a.title} fill className="object-cover" sizes="50px" />
                    </Link>
                  </td>
                  <td className="py-2.5 px-3 font-bold text-gray-200 max-w-[220px]">
                    <Link href={animeUrl} className="hover:text-sky-400 transition-colors line-clamp-2">
                      {a.title}
                    </Link>
                    <span className="text-[10px] text-gray-600 font-normal"> {a.age_rating}</span>
                  </td>
                  <td className="py-2.5 px-3 text-gray-400 text-[11px] max-w-[180px] truncate">
                    {a.genres.join(", ")}
                  </td>
                  <td className="py-2.5 px-3 text-center text-gray-500 whitespace-nowrap">
                    {a.season_info}
                  </td>
                  <td className="py-2.5 px-3 text-right text-gray-400">
                    {a.viewers}
                  </td>
                  <td className="py-2.5 px-3 text-center font-bold text-sky-400 whitespace-nowrap">
                    {typeof a.weighted_rating === "number"
                      ? a.weighted_rating.toFixed(2)
                      : a.weighted_rating}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {loaded && anime.length === 0 && (
          <div className="text-center py-16 text-gray-500 text-xs">Пока нет данных для рейтинга</div>
        )}
      </div>
    </div>
  );
}
