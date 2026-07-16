"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState, useRef } from "react";
import AnimeCard from "@/components/AnimeCard";
import Link from "next/link";

interface Anime {
  id: number;
  title: string;
  image_url: string;
  genres: string[];
  season_info: string;
  age_rating: string;
  weighted_rating: number | string;
}

interface UserListEntry {
  anime_id: number;
  status: string;
  anime: Anime;
  watched: number;
  total: number;
}

export default function HomePage() {
  const [recommendations, setRecommendations] = useState<Anime[]>([]);
  const [continueWatching, setContinueWatching] = useState<UserListEntry[]>([]);
  const [unrated, setUnrated] = useState<Anime[]>([]);
  const [news, setNews] = useState<Anime[]>([]);
  const [user, setUser] = useState<string | null>(null);
  const supabase = useRef(createClient()).current;

  useEffect(() => {
    async function load() {
      const { data: { user: authUser } } = await supabase.auth.getUser();

      const { data: allAnime } = await supabase
        .from("anime")
        .select("*, anime_seasons(*)")
        .order("id");

      if (!allAnime) return;

      const { data: ratings } = await supabase
        .from("ratings")
        .select("anime_id, rating");

      const { count: totalUsers } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });

      const ratedAnime = allAnime.map((a) => {
        const animeRatings = ratings?.filter((r) => r.anime_id === a.id) || [];
        const count = animeRatings.length;
        let weightedRating: number | string = "-";
        if (count > 0) {
          const avg =
            animeRatings.reduce((s, r) => s + r.rating, 0) / count;
          weightedRating = parseFloat(
            (avg * Math.pow(count / Math.max(totalUsers || 1, 1), 0.5)).toFixed(2)
          );
        }
        return { ...a, weighted_rating: weightedRating };
      });

      // News: anime with no user list entry (planned/new arrivals)
      setNews(ratedAnime.slice(0, 5));

      if (!authUser) return;
      setUser(authUser.id);

      const { data: userRatings } = await supabase
        .from("ratings")
        .select("anime_id, rating")
        .eq("user_id", authUser.id);

      const { data: userList } = await supabase
        .from("user_anime_list")
        .select("anime_id, status");

      const { data: userProgress } = await supabase
        .from("episode_progress")
        .select("season_id, episode_number, watched, anime_seasons!inner(anime_id)")
        .eq("user_id", authUser.id);

      const ratingsMap = new Map<number, number>();
      userRatings?.forEach((r) => ratingsMap.set(r.anime_id, r.rating));

      const listMap = new Map<number, string>();
      userList?.forEach((l) => listMap.set(l.anime_id, l.status));

      const progressByAnime = new Map<number, { watched: number; total: number }>();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      userProgress?.forEach((p: any) => {
        const aid = p.anime_seasons?.anime_id as number;
        if (!aid) return;
        const existing = progressByAnime.get(aid) || { watched: 0, total: 0 };
        if (p.watched) existing.watched++;
        existing.total++;
        progressByAnime.set(aid, existing);
      });

      // Recommendations
      const completedGenres = new Set<string>();
      allAnime.forEach((a) => {
        const status = listMap.get(a.id);
        const rating = ratingsMap.get(a.id);
        if (status === "completed" || (rating && rating >= 7)) {
          (a.genres as string[])?.forEach((g: string) => completedGenres.add(g));
        }
      });

      const recs =
        completedGenres.size > 0
          ? ratedAnime
              .filter((a) => (a.genres as string[])?.some((g: string) => completedGenres.has(g)))
              .slice(0, 5)
          : ratedAnime.slice(0, 5);

      // Continue watching
      const watchingList = allAnime
        .filter((a) => listMap.get(a.id) === "watching")
        .map((a) => {
          const prog = progressByAnime.get(a.id) || { watched: 0, total: 0 };
          const totalEps =
            a.anime_seasons?.reduce(
              (s: number, sn: { episodes_count: number }) =>
                s + sn.episodes_count,
              0
            ) || 0;
          return {
            ...a,
            watched: prog.watched || 0,
            total: totalEps,
          };
        })
        .filter((a) => a.watched < a.total && a.watched > 0)
        .slice(0, 5);

      // Unrated
      const unratedList = ratedAnime
        .filter((a) => !ratingsMap.has(a.id))
        .slice(0, 5);

      setRecommendations(recs);
      setContinueWatching(watchingList as unknown as UserListEntry[]);
      setUnrated(unratedList);
    }

    load();
  }, []);

  return (
    <div className="flex flex-col gap-10">
      <Section
        title="Рекомендации для тебя"
        items={recommendations.map((a) => ({
          ...a,
          weighted_rating: a.weighted_rating,
          watched_episodes: 0,
          total_episodes: 0,
        }))}
      />

      <Section
        title="Продолжить просмотр"
        items={continueWatching.map((e) => ({
          id: e.anime.id,
          title: e.anime.title,
          image_url: e.anime.image_url,
          genres: e.anime.genres,
          season_info: e.anime.season_info,
          age_rating: e.anime.age_rating,
          weighted_rating: e.anime.weighted_rating ?? "-",
          watched_episodes: e.watched,
          total_episodes: e.total,
        }))}
      />

      <Section
        title="Ждут оценки"
        items={unrated.map((a) => ({
          ...a,
          weighted_rating: a.weighted_rating,
          watched_episodes: 0,
          total_episodes: 0,
        }))}
      />

      {news.length > 0 && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400">
              Новости и анонсы
            </h3>
            <Link
              href="/catalog?tab=announcements"
              className="text-xs text-sky-400 hover:underline flex items-center gap-1"
            >
              Все анонсы <i className="fa-solid fa-arrow-right-long text-[10px]"></i>
            </Link>
          </div>
          <div className="flex flex-col gap-3">
            {news.map((a) => (
              <Link
                key={a.id}
                href={`/anime/${a.id}`}
                className="p-4 bg-[#1a1a1e] border border-[#222226] rounded-xl hover:border-sky-400/30 transition-colors flex items-center gap-4"
              >
                <div className="w-12 h-12 bg-[#121214] rounded flex items-center justify-center shrink-0">
                  <i className="fa-solid fa-bullhorn text-sky-400 text-xs"></i>
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[9px] text-sky-400 font-bold uppercase">
                    {a.season_info}
                  </span>
                  <h4 className="font-bold text-white text-xs mt-0.5 truncate">{a.title}</h4>
                  <p className="text-gray-500 text-[11px] mt-0.5">
                    {a.age_rating} · {a.genres.join(", ")}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {!user && (
        <div className="text-center py-16">
          <p className="text-gray-500 text-xs mb-4">
            Войди, чтобы видеть рекомендации и отслеживать просмотр
          </p>
          <Link
            href="/signup"
            className="bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs px-6 py-2.5 rounded-lg transition-all inline-block"
          >
            Начать
          </Link>
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  items,
}: {
  title: string;
  items: {
    id: number;
    title: string;
    image_url: string;
    genres: string[];
    season_info: string;
    age_rating: string;
    weighted_rating: number | string;
    watched_episodes: number;
    total_episodes: number;
  }[];
}) {
  if (items.length === 0) return null;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400">
          {title}
        </h3>
        <Link
          href="/catalog"
          className="text-xs text-sky-400 hover:underline flex items-center gap-1"
        >
          Смотреть все <i className="fa-solid fa-arrow-right-long text-[10px]"></i>
        </Link>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-5">
        {items.map((item) => (
          <AnimeCard key={item.id} {...item} />
        ))}
      </div>
    </div>
  );
}
