"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

interface Season {
  id: number;
  season_number: number;
  episodes_count: number;
}

interface AnimeDetail {
  id: number;
  title: string;
  image_url: string;
  genres: string[];
  season_info: string;
  age_rating: string;
  anime_seasons: Season[];
}

export default function AnimeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const supabase = createClient();

  const [anime, setAnime] = useState<AnimeDetail | null>(null);
  const [userRating, setUserRating] = useState<number | "-">("-");
  const [weightedRating, setWeightedRating] = useState<number | string>("-");
  const [votesCount, setVotesCount] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);
  const [userStatus, setUserStatus] = useState<string>("planned");
  const [episodeProgress, setEpisodeProgress] = useState<
    Map<number, Set<number>>
  >(new Map());
  const [userId, setUserId] = useState<string | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [allRatings, setAllRatings] = useState<number[]>([]);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data: animeData } = await supabase
        .from("anime")
        .select("*, anime_seasons(*)")
        .eq("id", id)
        .single();

      if (!animeData) return;
      setAnime(animeData);

      // All ratings for this anime
      const { data: ratings } = await supabase
        .from("ratings")
        .select("rating")
        .eq("anime_id", id);

      if (ratings) {
        setAllRatings(ratings.map((r) => r.rating));
        setVotesCount(ratings.length);
      }

      // Total users
      const { count } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });
      setTotalUsers(count || 0);

      // Calculate weighted rating
      if (ratings && ratings.length > 0) {
        const avg =
          ratings.reduce((s, r) => s + r.rating, 0) / ratings.length;
        const wR = parseFloat(
          (avg * Math.pow(ratings.length / Math.max(count || 1, 1), 0.5)).toFixed(2)
        );
        setWeightedRating(wR);
      }

      // User rating
      const { data: userRatingData } = await supabase
        .from("ratings")
        .select("rating")
        .eq("user_id", user.id)
        .eq("anime_id", id)
        .single();

      if (userRatingData) setUserRating(userRatingData.rating);

      // User list status
      const { data: listEntry } = await supabase
        .from("user_anime_list")
        .select("status")
        .eq("user_id", user.id)
        .eq("anime_id", id)
        .single();

      if (listEntry) setUserStatus(listEntry.status);
      else {
        await supabase.from("user_anime_list").insert({
          user_id: user.id,
          anime_id: Number(id),
          status: "planned",
        });
      }

      // Episode progress
      const { data: seasons } = await supabase
        .from("anime_seasons")
        .select("id")
        .eq("anime_id", id);

      if (seasons && seasons.length > 0) {
        const seasonIds = seasons.map((s) => s.id);
        const { data: progress } = await supabase
          .from("episode_progress")
          .select("season_id, episode_number")
          .eq("user_id", user.id)
          .in("season_id", seasonIds)
          .eq("watched", true);

        const progressMap = new Map<number, Set<number>>();
        progress?.forEach((p) => {
          const set = progressMap.get(p.season_id) || new Set<number>();
          set.add(p.episode_number);
          progressMap.set(p.season_id, set);
        });
        setEpisodeProgress(progressMap);
      }
    }

    load();
  }, [id, supabase]);

  async function handleRate(rating: number | "-") {
    if (!userId) return;
    setUserRating(rating);

    if (rating === "-") {
      await supabase
        .from("ratings")
        .delete()
        .eq("user_id", userId)
        .eq("anime_id", id);
    } else {
      await supabase.from("ratings").upsert(
        {
          user_id: userId,
          anime_id: Number(id),
          rating,
        },
        { onConflict: "user_id,anime_id" }
      );
    }

    // Refresh weighted rating
    const { data: ratings } = await supabase
      .from("ratings")
      .select("rating")
      .eq("anime_id", id);

    if (ratings) {
      setAllRatings(ratings.map((r) => r.rating));
      setVotesCount(ratings.length);
      if (ratings.length > 0) {
        const avg =
          ratings.reduce((s, r) => s + r.rating, 0) / ratings.length;
        const wR = parseFloat(
          (avg * Math.pow(ratings.length / Math.max(totalUsers, 1), 0.5)).toFixed(2)
        );
        setWeightedRating(wR);
      } else {
        setWeightedRating("-");
      }
    }
  }

  async function handleStatus(status: string) {
    if (!userId) return;
    setUserStatus(status);
    await supabase
      .from("user_anime_list")
      .update({ status })
      .eq("user_id", userId)
      .eq("anime_id", id);
  }

  async function toggleEpisode(seasonId: number, epNumber: number) {
    if (!userId) return;

    const current = episodeProgress.get(seasonId) || new Set<number>();
    const isWatched = current.has(epNumber);

    if (isWatched) {
      await supabase
        .from("episode_progress")
        .delete()
        .eq("user_id", userId)
        .eq("season_id", seasonId)
        .eq("episode_number", epNumber);
      current.delete(epNumber);
    } else {
      await supabase.from("episode_progress").upsert(
        {
          user_id: userId,
          season_id: seasonId,
          episode_number: epNumber,
          watched: true,
        },
        { onConflict: "user_id,season_id,episode_number" }
      );
      current.add(epNumber);
    }

    const newMap = new Map(episodeProgress);
    newMap.set(seasonId, current);
    setEpisodeProgress(newMap);

    // Auto-update status based on progress
    if (anime?.anime_seasons) {
      let totalEps = 0;
      let watchedEps = 0;
      for (const s of anime.anime_seasons) {
        totalEps += s.episodes_count;
        const prog = s.id === seasonId ? current : episodeProgress.get(s.id);
        watchedEps += prog?.size || 0;
      }
      if (watchedEps === 0) handleStatus("planned");
      else if (watchedEps >= totalEps) handleStatus("completed");
      else handleStatus("watching");
    }
  }

  async function toggleWholeSeason(seasonId: number, episodesCount: number) {
    if (!userId) return;
    const current = episodeProgress.get(seasonId) || new Set<number>();
    const allWatched = current.size >= episodesCount;

    if (allWatched) {
      await supabase
        .from("episode_progress")
        .delete()
        .eq("user_id", userId)
        .eq("season_id", seasonId);
      current.clear();
    } else {
      const eps = Array.from({ length: episodesCount }, (_, i) => i + 1);
      await supabase.from("episode_progress").upsert(
        eps.map((ep) => ({
          user_id: userId,
          season_id: seasonId,
          episode_number: ep,
          watched: true,
        })),
        { onConflict: "user_id,season_id,episode_number" }
      );
      eps.forEach((ep) => current.add(ep));
    }

    const newMap = new Map(episodeProgress);
    newMap.set(seasonId, current);
    setEpisodeProgress(newMap);
  }

  async function handleDelete() {
    if (!userId) return;
    if (!confirm(`Удалить "${anime?.title}"?`)) return;

    const { data: seasons } = await supabase
      .from("anime_seasons")
      .select("id")
      .eq("anime_id", id);

    if (seasons && seasons.length > 0) {
      const seasonIds = seasons.map((s) => s.id);
      await supabase
        .from("episode_progress")
        .delete()
        .eq("user_id", userId)
        .in("season_id", seasonIds);
    }

    await supabase
      .from("ratings")
      .delete()
      .eq("user_id", userId)
      .eq("anime_id", id);

    await supabase
      .from("user_anime_list")
      .delete()
      .eq("user_id", userId)
      .eq("anime_id", id);

    router.push("/");
  }

  if (!anime) {
    return (
      <div className="text-center py-20 text-gray-500 text-xs">Загрузка...</div>
    );
  }

  const votedPercent =
    totalUsers > 0 ? Math.round((votesCount / totalUsers) * 100) : 0;

  // Rating distribution for stats
  const ratingDist = Array.from({ length: 10 }, (_, i) => {
    const score = i + 1;
    const count = allRatings.filter((r) => r === score).length;
    return { score, count, pct: votesCount > 0 ? (count / votesCount) * 100 : 0 };
  }).reverse();

  return (
    <div className="max-w-4xl mx-auto">
      <button
        onClick={() => router.back()}
        className="mb-6 w-8 h-8 rounded bg-[#1a1a1e] hover:bg-[#222226] border border-[#222226] flex items-center justify-center text-xs text-gray-400 transition-all"
      >
        <i className="fa-solid fa-arrow-left"></i>
      </button>

      <div className="bg-[#1a1a1e] border border-[#222226] rounded-xl overflow-hidden flex flex-col md:flex-row">
        <div className="w-full md:w-72 bg-[#121214] flex-shrink-0 relative">
          <Image
            src={anime.image_url}
            alt={anime.title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 288px"
          />
          <div className="absolute top-3 left-3 bg-black/80 border border-[#222226] text-xs font-bold text-sky-400 px-2 py-1 rounded">
            ★ {typeof weightedRating === "number" ? weightedRating.toFixed(2) : weightedRating}
          </div>
        </div>

        <div className="p-6 md:p-8 flex-1 flex flex-col">
          <h2 className="text-xl font-bold text-white mb-4 pr-8">
            {anime.title}
          </h2>

          <div className="flex flex-wrap gap-y-1.5 gap-x-4 text-xs text-gray-400 mb-5 pb-3 border-b border-[#222226]">
            <div>
              Сезон:{" "}
              <span className="text-sky-400 font-semibold ml-1">
                {anime.season_info}
              </span>
            </div>
            <div>
              Рейтинг:{" "}
              <span className="border border-[#3a3a42] px-1.5 py-0.5 rounded text-[10px] text-gray-300 font-bold ml-1">
                {anime.age_rating}
              </span>
            </div>
            <div className="w-full flex flex-wrap gap-1 items-center mt-1">
              <span>Жанры:</span>
              {anime.genres?.map((g) => (
                <span
                  key={g}
                  className="bg-[#222226] hover:bg-[#32323a] border border-[#2d2d35] px-1.5 py-0.5 rounded text-[10px] text-gray-300 cursor-pointer transition-all"
                >
                  {g}
                </span>
              ))}
            </div>
          </div>

          {/* Ratings block */}
          <div className="bg-[#121214] p-4 rounded-lg border border-[#222226] mb-6">
            <div className="flex flex-wrap items-center justify-between gap-4 text-xs mb-4 border-b border-[#222226] pb-3">
              <div>
                <span className="text-gray-500 block text-[10px] uppercase">
                  Взвешенный рейтинг
                </span>
                <div className="flex items-center gap-2 mt-0.5">
                  <strong className="text-sky-400 text-base">
                    {typeof weightedRating === "number"
                      ? weightedRating.toFixed(2)
                      : weightedRating}
                  </strong>
                  <button
                    onClick={() => setShowStats(!showStats)}
                    className="bg-[#1a1a1e] hover:bg-[#222226] text-gray-300 px-2.5 py-1 rounded border border-[#222226] text-[10px] font-bold flex items-center gap-1.5 transition-all"
                  >
                    <i className="fa-solid fa-chart-bar"></i>
                    {votesCount} голосов
                  </button>
                </div>
              </div>
              <div className="text-right">
                <span className="text-gray-500 block text-[10px] uppercase">
                  Активность
                </span>
                <span className="text-gray-400 text-[11px] block mt-0.5">
                  Оценили:{" "}
                  <strong className="text-sky-400">{votedPercent}%</strong> (
                  {votesCount}/{totalUsers} чел.)
                </span>
              </div>
            </div>

            {showStats && (
              <div className="mb-4 p-3 bg-[#1a1a1e] border border-[#222226] rounded flex flex-col gap-1.5">
                {ratingDist.map((r) => (
                  <div key={r.score} className="flex items-center gap-2 text-[11px]">
                    <div className="w-5 text-right font-bold text-gray-500">
                      {r.score}★
                    </div>
                    <div className="flex-1 bg-[#121214] h-2.5 rounded overflow-hidden">
                      <div
                        className="bg-sky-400 h-full"
                        style={{ width: `${r.pct}%` }}
                      />
                    </div>
                    <div className="w-4 text-right text-[10px] text-gray-400">
                      {r.count}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <span className="font-bold text-gray-400">Твоя оценка:</span>
              <div className="flex flex-wrap gap-1">
                {["-", 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((opt) => {
                  const isSelected = String(userRating) === String(opt);
                  return (
                    <button
                      key={opt}
                      onClick={() =>
                        handleRate(opt === "-" ? "-" : Number(opt))
                      }
                      className={`w-6 h-6 text-[10px] font-bold rounded transition-all ${
                        isSelected
                          ? "bg-sky-500 text-white"
                          : "bg-zinc-900 border border-zinc-800 text-gray-500 hover:text-gray-300"
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Status */}
          <div className="flex items-center gap-2 mb-6">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              Статус:
            </span>
            {["planned", "watching", "completed"].map((s) => {
              const labels: Record<string, string> = {
                planned: "Запланировано",
                watching: "Смотрю",
                completed: "Просмотрено",
              };
              return (
                <button
                  key={s}
                  onClick={() => handleStatus(s)}
                  className={`text-[10px] font-bold px-3 py-1 rounded transition-all ${
                    userStatus === s
                      ? "bg-sky-500/20 text-sky-400 border border-sky-500/30"
                      : "bg-[#121214] text-gray-500 border border-[#222226] hover:text-gray-300"
                  }`}
                >
                  {labels[s]}
                </button>
              );
            })}
          </div>

          {/* Seasons */}
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
            Сезоны и серии
          </h4>
          <div className="flex flex-col gap-3 flex-1">
            {anime.anime_seasons
              ?.sort((a, b) => a.season_number - b.season_number)
              .map((season) => {
                const watched = episodeProgress.get(season.id) || new Set<number>();
                const allEpsWatched = watched.size >= season.episodes_count;

                return (
                  <div
                    key={season.id}
                    className="p-3 bg-[#121214] rounded-lg border border-[#222226] flex flex-col gap-2"
                  >
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-gray-300">
                        {season.season_number} Сезон ({season.episodes_count} сер.)
                      </span>
                      <button
                        onClick={() =>
                          toggleWholeSeason(season.id, season.episodes_count)
                        }
                        className="text-[10px] text-sky-400 hover:underline"
                      >
                        {allEpsWatched
                          ? "Сбросить сезон"
                          : "Посмотрел весь"}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {Array.from(
                        { length: season.episodes_count },
                        (_, i) => i + 1
                      ).map((ep) => (
                        <button
                          key={ep}
                          onClick={() => toggleEpisode(season.id, ep)}
                          className={`w-6 h-6 text-[9px] font-bold rounded transition-all ${
                            watched.has(ep)
                              ? "bg-sky-500/20 text-sky-400 border border-sky-400/30"
                              : "bg-[#1a1a1e] text-gray-500 border border-[#222226] hover:text-gray-300"
                          }`}
                        >
                          {ep}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
          </div>

          {/* Delete */}
          {userId && (
            <div className="border-t border-[#222226] pt-4 mt-6 flex justify-end">
              <button
                onClick={handleDelete}
                className="px-3 py-1.5 rounded bg-red-950/20 hover:bg-red-950/60 text-red-400 font-semibold border border-red-500/10 text-xs transition-all"
              >
                <i className="fa-solid fa-trash-can mr-1"></i> Удалить
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
