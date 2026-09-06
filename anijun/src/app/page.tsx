"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState, useMemo } from "react";
import Image from "next/image";
import AnimeCard from "@/components/AnimeCard";
import Link from "next/link";
import { getRecommendations, type AnimeItem, type RecommendationResult } from "@/lib/recommendations";
import { fetchViewersByAnime, enrichWithWeightedRating } from "@/lib/ratings";
import { useSimulatedUser } from "@/lib/simulation-context";

interface Anime {
  id: number;
  slug?: string;
  title: string;
  image_url: string;
  genres: string[];
  season_info: string;
  age_rating: string;
  weighted_rating: number | string;
  status?: string;
}

interface UserListEntry {
  id: number;
  slug?: string;
  title: string;
  image_url: string;
  genres: string[];
  season_info: string;
  age_rating: string;
  weighted_rating: number | string;
  watched: number;
  total: number;
}

export default function HomePage() {
  const [recommendations, setRecommendations] = useState<Anime[]>([]);  const [continueWatching, setContinueWatching] = useState<UserListEntry[]>([]);
  const [unrated, setUnrated] = useState<Anime[]>([]);
  const [news, setNews] = useState<Anime[]>([]);
  const [user, setUser] = useState<string | null>(null);
  const [newsLoaded, setNewsLoaded] = useState(false);
  const [userDataLoaded, setUserDataLoaded] = useState(false);
  const supabase = useMemo(() => createClient(), []);
  const { getEffectiveUserId } = useSimulatedUser();


  useEffect(() => {
    let cancelled = false;

    async function loadNews() {
      const { data: allAnime } = await supabase
        .from("anime")
        .select("*, anime_seasons(*)")
        .order("id");

      if (!allAnime || cancelled) return;

      const { data: ratings } = await supabase
        .from("ratings")
        .select("anime_id, rating");

      if (cancelled) return;

      const viewersByAnime = await fetchViewersByAnime(supabase);
      const ratedAnime = enrichWithWeightedRating(allAnime, ratings, viewersByAnime);

      const statusOrder: Record<string, number> = { ongoing: 0, announced: 1, finished: 2 };
      const newsList = [...ratedAnime]
        .sort((a, b) => (statusOrder[a.status] ?? 2) - (statusOrder[b.status] ?? 2))
        .slice(0, 5);

      setNews(newsList);
      setNewsLoaded(true);
    }

    loadNews();
    return () => { cancelled = true; };
  }, [supabase]);

  useEffect(() => {
    if (!newsLoaded) return;
    let cancelled = false;

    async function loadUserData() {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser || cancelled) {
        if (!cancelled) setUserDataLoaded(true);
        return;
      }
      setUser(authUser.id);

      const { data: allAnime } = await supabase
        .from("anime")
        .select("*, anime_seasons(*)")
        .order("id");

      if (!allAnime || cancelled) return;

      const { data: ratings } = await supabase
        .from("ratings")
        .select("anime_id, rating");

      if (cancelled) return;

      const viewersByAnime = await fetchViewersByAnime(supabase);
      const ratedAnime = enrichWithWeightedRating(allAnime, ratings, viewersByAnime);

      if (cancelled) return;

      const effectiveId = getEffectiveUserId(authUser.id);
      const { data: userRatings } = await supabase
        .from("ratings")
        .select("anime_id, rating")
        .eq("user_id", effectiveId);

      const { data: userList } = await supabase
        .from("user_anime_list")
        .select("anime_id, status")
        .eq("user_id", effectiveId);

      const { data: userProgress } = await supabase
        .from("episode_progress")
        .select("season_id, episode_number, watched, anime_seasons!inner(anime_id)")
        .eq("user_id", effectiveId);

      if (cancelled) return;

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


      const animeItems: AnimeItem[] = ratedAnime.map((a) => ({
        id: a.id,
        title: a.title,
        genres: a.genres || [],
        weighted_rating: typeof a.weighted_rating === "number" ? a.weighted_rating : 0,
        popularity: viewersByAnime.get(a.id)?.size || 0,
      }));

      const watched: Record<number, number> = {};
      userRatings?.forEach((r) => { watched[r.anime_id] = r.rating; });

      const { data: allRatingsWithUsers } = await supabase
        .from("ratings")
        .select("user_id, anime_id, rating");

      const allUserRatings = (allRatingsWithUsers || []).map((r) => ({
        user_id: r.user_id || "",
        anime_id: r.anime_id,
        rating: r.rating,
      }));

      const recResults: RecommendationResult[] = getRecommendations(
        effectiveId, watched, allUserRatings, animeItems, 10
      );

      const recAnime: Anime[] = recResults.map((r) => {
        const original = ratedAnime.find((a) => a.id === r.anime.id);
        return original || r.anime;
      });

      const watchingList = allAnime
        .filter((a) => listMap.get(a.id) === "watching")
        .map((a) => {
          const prog = progressByAnime.get(a.id) || { watched: 0, total: 0 };
          const totalEps = a.anime_seasons?.reduce(
            (s: number, sn: { episodes_count: number }) => s + sn.episodes_count, 0
          ) || 0;
          const weightedRating = ratedAnime.find((r) => r.id === a.id)?.weighted_rating ?? "-";
          return { ...a, watched: prog.watched || 0, total: totalEps, weighted_rating: weightedRating };
        })
        .filter((a) => a && a.watched < a.total && a.watched > 0)
        .slice(0, 5);

      const unratedList = ratedAnime
        .filter((a) => !ratingsMap.has(a.id))
        .slice(0, 5);

      if (!cancelled) {
        setRecommendations(recAnime);
        setContinueWatching(watchingList as unknown as UserListEntry[]);
        setUnrated(unratedList);
        setUserDataLoaded(true);
      }
    }

    loadUserData();
    return () => { cancelled = true; };
  }, [newsLoaded, getEffectiveUserId, supabase]);

  return (
    <div className="flex flex-col gap-10">
      {userDataLoaded && recommendations.length > 0 && (
        <Section
          title="Рекомендации для тебя"
          items={recommendations.map((a) => ({
            ...a,
            weighted_rating: a.weighted_rating,
            watched_episodes: 0,
            total_episodes: 0,
          }))}
        />
      )}

      {userDataLoaded && continueWatching.length > 0 && (
        <Section
          title="Продолжить просмотр"
          items={continueWatching.map((e) => ({
            id: e.id,
            slug: e.slug,
            title: e.title,
            image_url: e.image_url,
            genres: e.genres,
            season_info: e.season_info,
            age_rating: e.age_rating,
            weighted_rating: e.weighted_rating ?? "-",
            watched_episodes: e.watched,
            total_episodes: e.total,
          }))}
        />
      )}

      {userDataLoaded && unrated.length > 0 && (
        <Section
          title="Ждут оценки"
          items={unrated.map((a) => ({
            ...a,
            weighted_rating: a.weighted_rating,
            watched_episodes: 0,
            total_episodes: 0,
          }))}
        />
      )}

      {!userDataLoaded && user && (
        <div className="flex flex-col gap-10">
          <div>
            <div className="h-4 w-48 bg-[#222226] rounded animate-pulse mb-4" />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-5">
              {[1,2,3,4,5].map((i) => (
                <div key={i} className="aspect-[3/4] bg-[#1a1a1e] border border-[#222226] rounded-lg animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      )}

      {newsLoaded && news.length > 0 && (
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
            {news.map((a) => {
              const animeUrl = a.slug ? `/anime/${a.slug}` : `/anime/${a.id}`;
              const isOngoing = a.status === "ongoing";
              const isAnnounced = a.status === "announced";
              return (
                <Link
                  key={a.id}
                  href={animeUrl}
                  className="p-3 bg-[#1a1a1e] border border-[#222226] rounded-xl hover:border-sky-400/30 transition-colors flex items-center gap-4"
                >
                  <div className="w-12 h-16 rounded overflow-hidden bg-[#121214] relative shrink-0">
                    <Image src={a.image_url} alt={a.title} fill className="object-cover" sizes="48px" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] font-bold uppercase ${isOngoing ? "text-emerald-400" : "text-amber-400"}`}>
                        {isOngoing ? "● Онгоинг" : isAnnounced ? "● Анонс" : ""}
                      </span>
                      <span className="text-[9px] text-sky-400 font-bold uppercase">{a.season_info}</span>
                    </div>
                    <h4 className="font-bold text-white text-xs mt-0.5 truncate">{a.title}</h4>
                    <p className="text-gray-500 text-[11px] mt-0.5">
                      {a.age_rating} · {a.genres.join(", ")}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {!newsLoaded && (
        <div className="flex flex-col gap-3">
          {[1,2,3].map((i) => (
            <div key={i} className="p-4 bg-[#1a1a1e] border border-[#222226] rounded-xl animate-pulse h-16" />
          ))}
        </div>
      )}

      {!user && newsLoaded && (
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
    slug?: string;
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