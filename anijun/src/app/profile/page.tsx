"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AnimeCard from "@/components/AnimeCard";
import Image from "next/image";

interface ProfileData {
  username: string;
  total: number;
  completed: number;
  watching: number;
  planned: number;
  topGenres: { genre: string; count: number }[];
  favorites: {
    id: number;
    title: string;
    image_url: string;
    rating: number;
  }[];
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .single();

      if (!profileData) return;

      const { data: animeList } = await supabase
        .from("anime")
        .select("id, title, image_url, genres");

      const { data: userList } = await supabase
        .from("user_anime_list")
        .select("anime_id, status")
        .eq("user_id", user.id);

      const { data: userRatings } = await supabase
        .from("ratings")
        .select("anime_id, rating")
        .eq("user_id", user.id);

      const statusMap = new Map<number, string>();
      userList?.forEach((l) => statusMap.set(l.anime_id, l.status));

      const ratingsMap = new Map<number, number>();
      userRatings?.forEach((r) => ratingsMap.set(r.anime_id, r.rating));

      const total = userList?.length || 0;
      const completed = userList?.filter((l) => l.status === "completed").length || 0;
      const watching = userList?.filter((l) => l.status === "watching").length || 0;
      const planned = userList?.filter((l) => l.status === "planned").length || 0;

      // Top genres
      const genreCounts: Record<string, number> = {};
      userList?.forEach((l) => {
        const anime = animeList?.find((a) => a.id === l.anime_id);
        if (anime?.genres) {
          (anime.genres as string[]).forEach((g: string) => {
            genreCounts[g] = (genreCounts[g] || 0) + 1;
          });
        }
      });

      const topGenres = Object.entries(genreCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([genre, count]) => ({ genre, count }));

      // Favorites (rating 9-10)
      const favorites = (userRatings || [])
        .filter((r) => r.rating >= 9)
        .map((r) => {
          const anime = animeList?.find((a) => a.id === r.anime_id);
          return {
            id: r.anime_id,
            title: anime?.title || "Unknown",
            image_url: anime?.image_url || "",
            rating: r.rating,
          };
        });

      setProfile({
        username: profileData.username,
        total,
        completed,
        watching,
        planned,
        topGenres,
        favorites,
      });
    }

    load();
  }, [supabase, router]);

  if (!profile) {
    return (
      <div className="text-center py-20 text-gray-500 text-xs">Загрузка...</div>
    );
  }

  const maxGenreCount = profile.topGenres[0]?.count || 1;

  return (
    <div className="flex flex-col gap-8">
      {/* User block */}
      <div className="bg-[#1a1a1e] border border-[#222226] rounded-xl p-6 flex flex-col sm:flex-row items-center gap-6">
        <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-sky-400 to-blue-600 flex items-center justify-center text-white text-2xl font-black shadow-lg shadow-sky-500/10">
          {profile.username.substring(0, 2).toUpperCase()}
        </div>
        <div className="text-center sm:text-left flex-1">
          <h2 className="text-xl font-bold text-white flex items-center justify-center sm:justify-start gap-2.5">
            {profile.username}
            <span className="bg-sky-500/10 text-sky-400 text-[10px] font-bold uppercase px-2.5 py-0.5 rounded tracking-wider border border-sky-500/20">
              Профиль
            </span>
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Твой личный уголок статистики в AniJUN
          </p>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#1a1a1e] border border-[#222226] rounded-xl p-5 flex flex-col justify-between min-h-[160px]">
          <div>
            <span className="text-gray-500 text-[10px] font-bold uppercase tracking-wider block mb-2">
              Просмотры
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black text-white">
                {profile.completed}
              </span>
              <span className="text-gray-500 text-xs">
                / {profile.total} всего
              </span>
            </div>
          </div>
          <div className="space-y-1.5 mt-4 pt-3 border-t border-[#222226]/50">
            <div className="flex justify-between text-[11px] text-gray-400">
              <span>Смотрю сейчас:</span>
              <span className="font-bold text-sky-400">{profile.watching}</span>
            </div>
            <div className="flex justify-between text-[11px] text-gray-400">
              <span>Запланировано:</span>
              <span className="font-bold text-gray-500">{profile.planned}</span>
            </div>
          </div>
        </div>

        <div className="bg-[#1a1a1e] border border-[#222226] rounded-xl p-5 flex flex-col min-h-[160px]">
          <span className="text-gray-500 text-[10px] font-bold uppercase tracking-wider block mb-4">
            Любимые жанры
          </span>
          <div className="flex flex-col gap-3 flex-1 justify-center">
            {profile.topGenres.length === 0 ? (
              <div className="text-xs text-gray-500 text-center py-4">
                Оцени аниме для расчёта жанров
              </div>
            ) : (
              profile.topGenres.map((g) => (
                <div key={g.genre} className="text-xs">
                  <div className="flex justify-between mb-1">
                    <span className="font-bold text-gray-300">{g.genre}</span>
                    <span className="text-gray-500 text-[10px]">
                      {g.count} тайтл.
                    </span>
                  </div>
                  <div className="w-full bg-[#121214] h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-sky-400 h-full rounded"
                      style={{ width: `${(g.count / maxGenreCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-[#1a1a1e] border border-[#222226] rounded-xl p-5 flex flex-col min-h-[160px]">
          <span className="text-gray-500 text-[10px] font-bold uppercase tracking-wider block mb-3">
            Избранное <i className="fa-solid fa-gem text-amber-400 ml-1"></i>
          </span>
          <div className="flex flex-col gap-2 flex-1 justify-center">
            {profile.favorites.length === 0 ? (
              <div className="text-xs text-gray-500 text-center py-4">
                Оцени аниме на 9 или 10
              </div>
            ) : (
              profile.favorites.slice(0, 3).map((f) => (
                <div
                  key={f.id}
                  onClick={() => router.push(`/anime/${f.id}`)}
                  className="flex items-center justify-between p-2 bg-[#121214] hover:bg-[#222226] rounded border border-[#222226] cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2 overflow-hidden mr-2">
                    <Image
                      src={f.image_url}
                      alt={f.title}
                      width={24}
                      height={32}
                      className="object-cover rounded"
                    />
                    <span className="font-semibold text-gray-300 text-xs truncate">
                      {f.title}
                    </span>
                  </div>
                  <span className="bg-sky-400/10 text-sky-400 text-[9px] font-bold px-2 py-0.5 rounded border border-sky-400/20 whitespace-nowrap">
                    ★ {f.rating}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Favorites grid */}
      {profile.favorites.length > 0 && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4">
            Любимые тайтлы (оценки 9 и 10)
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
            {profile.favorites.map((f) => (
              <AnimeCard
                key={f.id}
                id={f.id}
                title={f.title}
                image_url={f.image_url}
                genres={[]}
                season_info=""
                age_rating=""
                weighted_rating={f.rating}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
