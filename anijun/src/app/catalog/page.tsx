"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import AnimeCard from "@/components/AnimeCard";

interface Anime {
  id: number;
  title: string;
  image_url: string;
  genres: string[];
  season_info: string;
  age_rating: string;
  weighted_rating: number | string;
}

const CARDS_PER_PAGE = 8;

export default function CatalogPage() {
  const [allAnime, setAllAnime] = useState<Anime[]>([]);
  const [filtered, setFiltered] = useState<Anime[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data: animeList } = await supabase
        .from("anime")
        .select("*, anime_seasons(*)")
        .order("id");

      if (!animeList) return;

      const { data: ratings } = await supabase.from("ratings").select("anime_id, rating");
      const { data: userList } = await supabase.from("user_anime_list").select("anime_id, status");

      const totalUsers = 1;
      const enriched = animeList.map((a) => {
        const animeRatings = ratings?.filter((r) => r.anime_id === a.id) || [];
        const count = animeRatings.length;
        let weightedRating: number | string = "-";
        if (count > 0) {
          const avg = animeRatings.reduce((s, r) => s + r.rating, 0) / count;
          weightedRating = parseFloat(
            (avg * Math.pow(count / Math.max(totalUsers, 1), 0.5)).toFixed(2)
          );
        }
        return { ...a, weighted_rating: weightedRating };
      });

      setAllAnime(enriched);
      setFiltered(enriched);
    }
    load();
  }, [supabase]);

  useEffect(() => {
    let result = allAnime;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.genres.some((g) => g.toLowerCase().includes(q)) ||
          a.season_info.toLowerCase().includes(q)
      );
    }

    setFiltered(result);
    setPage(1);
  }, [search, allAnime]);

  const totalPages = Math.ceil(filtered.length / CARDS_PER_PAGE);
  const paginated = filtered.slice(
    (page - 1) * CARDS_PER_PAGE,
    page * CARDS_PER_PAGE
  );

  return (
    <div>
      <div className="relative mb-6">
        <i className="fa-solid fa-magnifying-glass absolute left-4 top-3 text-gray-500 text-xs"></i>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по названию, жанру, сезону..."
          className="w-full bg-[#1a1a1e] border border-[#222226] rounded-lg pl-10 pr-4 py-2.5 text-xs focus:outline-none focus:border-sky-400 transition-colors text-white"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-500 text-xs">
          Ничего не найдено
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-5">
            {paginated.map((anime) => (
              <AnimeCard key={anime.id} {...anime} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-8">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="w-8 h-8 rounded border border-[#222226] bg-[#1a1a1e] hover:bg-[#222226] disabled:opacity-30 disabled:cursor-not-allowed text-gray-400 flex items-center justify-center text-xs transition-all"
              >
                <i className="fa-solid fa-chevron-left"></i>
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-8 h-8 rounded text-xs font-bold transition-all ${
                    p === page
                      ? "bg-sky-500 text-white"
                      : "border border-[#222226] text-gray-400 hover:bg-[#222226]"
                  }`}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="w-8 h-8 rounded border border-[#222226] bg-[#1a1a1e] hover:bg-[#222226] disabled:opacity-30 disabled:cursor-not-allowed text-gray-400 flex items-center justify-center text-xs transition-all"
              >
                <i className="fa-solid fa-chevron-right"></i>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
