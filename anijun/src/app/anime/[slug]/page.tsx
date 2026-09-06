"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState, use, useRef, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import SafeImage from "@/components/SafeImage";
import Link from "next/link";
import ImageUpload from "@/components/ImageUpload";
import RatingToast, { ToastData } from "@/components/RatingToast";
import ReviewsSection from "@/components/ReviewsSection";
import CollectionsSection from "@/components/CollectionsSection";
import { useSimulatedUser } from "@/lib/simulation-context";
import { ALL_GENRES, AGE_RATINGS, ANIME_STATUSES } from "@/lib/genres";
import { calcWeightedRating, fetchViewersCount, fetchViewersByAnime, enrichWithWeightedRating } from "@/lib/ratings";
import { isAdminId } from "@/lib/admin";

interface Season {
  id: number;
  season_number: number;
  episodes_count: number;
  note?: string;
}

interface AnimeDetail {
  id: number;
  slug?: string;
  title: string;
  image_url: string;
  genres: string[];
  season_info: string;
  age_rating: string;
  status?: string;
  anime_seasons: Season[];
}

export default function AnimeDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { getEffectiveUserId } = useSimulatedUser();


  const [anime, setAnime] = useState<AnimeDetail | null>(null);
  const [animeId, setAnimeId] = useState<number | null>(null);
  const [animeLoaded, setAnimeLoaded] = useState(false);
  const [ratingsLoaded, setRatingsLoaded] = useState(false);
  const [userDataLoaded, setUserDataLoaded] = useState(false);

  const [userRating, setUserRating] = useState<number | "-">("-");
  const [weightedRating, setWeightedRating] = useState<number | string>("-");
  const [votesCount, setVotesCount] = useState(0);
  const [viewersCount, setViewersCount] = useState(0);
  const [topPosition, setTopPosition] = useState<number | null>(null);
  const [userStatus, setUserStatus] = useState<string>("planned");
  const [episodeProgress, setEpisodeProgress] = useState<Map<number, Set<number>>>(new Map());
  const [userId, setUserId] = useState<string | null>(null);
  const [isAuthed, setIsAuthed] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [allRatings, setAllRatings] = useState<number[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editingPoster, setEditingPoster] = useState(false);
  const [editingAnime, setEditingAnime] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [editGenres, setEditGenres] = useState<string[]>([]);
  const [editSeason, setEditSeason] = useState("");
  const [editAgeRating, setEditAgeRating] = useState("16+");
  const [editStatus, setEditStatus] = useState("announced");
  const [toast, setToast] = useState<ToastData | null>(null);
  const [prevWeighted, setPrevWeighted] = useState<number | null>(null);
  const [animeTitle, setAnimeTitle] = useState("");
  const [animeImage, setAnimeImage] = useState("");
  const [editingSeasonId, setEditingSeasonId] = useState<number | null>(null);
  const [editSeasonNote, setEditSeasonNote] = useState("");
  const [editSeasonEps, setEditSeasonEps] = useState("");
  const [addingSeason, setAddingSeason] = useState(false);
  const [newSeasonNumber, setNewSeasonNumber] = useState(0);
  const [newSeasonEps, setNewSeasonEps] = useState(12);
  const [newSeasonNote, setNewSeasonNote] = useState("");

  const animeIdRef = useRef<number | null>(null);

  function generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9а-я\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  const loadTopPosition = useCallback(async (animeId: number): Promise<number | null> => {
    const { data: allAnime } = await supabase.from("anime").select("id").order("id");
    if (!allAnime) return null;
    const { data: ratings } = await supabase.from("ratings").select("anime_id, rating");

    const viewersByAnime = await fetchViewersByAnime(supabase);
    const enriched = enrichWithWeightedRating(allAnime, ratings, viewersByAnime);
    enriched.sort((a, b) => {
      const valA = typeof a.weighted_rating === "number" ? a.weighted_rating : -1;
      const valB = typeof b.weighted_rating === "number" ? b.weighted_rating : -1;
      return valB - valA;
    });
    const idx = enriched.findIndex((e) => e.id === animeId);
    return (idx >= 0 && idx < 100) ? idx + 1 : null;
  }, [supabase]);


  useEffect(() => {
    let cancelled = false;
    async function loadAnime() {
      let query = supabase.from("anime").select("*, anime_seasons(*)");
      const { data: bySlug } = await supabase.from("anime").select("id").eq("slug", slug).maybeSingle();
      if (bySlug) {
        query = query.eq("id", bySlug.id);
      } else {
        const numId = parseInt(slug);
        if (!isNaN(numId)) { query = query.eq("id", numId); }
        else {
          if (!cancelled) {
            setAnime(null);
            setAnimeLoaded(true);
          }
          return;
        }
      }
      const { data: animeData } = await query.single();
      if (cancelled) return;
      if (!animeData) {
        setAnime(null);
        setAnimeLoaded(true);
        return;
      }
      const fetchedId = animeData.id;
      animeIdRef.current = fetchedId;
      setAnimeId(fetchedId);
      setAnime(animeData);
      setAnimeTitle(animeData.title);
      setAnimeImage(animeData.image_url);
      setAnimeLoaded(true);
    }
    loadAnime();
    return () => { cancelled = true; };
  }, [slug, supabase]);


  useEffect(() => {
    const id = animeId;
    if (id === null) return;
    let cancelled = false;
    async function loadRatings() {
      const { data: ratings } = await supabase.from("ratings").select("rating").eq("anime_id", id);
      if (ratings && !cancelled) {
        setAllRatings(ratings.map((r) => r.rating));
        setVotesCount(ratings.length);
      }
      const viewers = await fetchViewersCount(supabase, id!);
      if (!cancelled) setViewersCount(viewers);
      if (ratings && ratings.length > 0) {
        const wR = calcWeightedRating(ratings.map((r) => r.rating), viewers);
        if (!cancelled) { setWeightedRating(wR); if (typeof wR === "number") setPrevWeighted(wR); }
      }
      loadTopPosition(id!).then((pos: number | null) => { if (!cancelled) setTopPosition(pos); });
      if (!cancelled) setRatingsLoaded(true);
    }
    loadRatings();
    return () => { cancelled = true; };
  }, [animeId, loadTopPosition, supabase]);


  useEffect(() => {
    if (!animeId) return;
    let cancelled = false;
    async function loadUserData() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user || cancelled) return;
      const user = session.user;
      setIsAuthed(true);
      const effectiveId = getEffectiveUserId(user.id);
      setUserId(effectiveId);
      setIsAdmin(isAdminId(user.id));

      const { data: userRatingData } = await supabase
        .from("ratings").select("rating").eq("user_id", effectiveId).eq("anime_id", animeId).single();
      if (userRatingData && !cancelled) setUserRating(userRatingData.rating);

      const { data: listEntry } = await supabase
        .from("user_anime_list").select("status").eq("user_id", effectiveId).eq("anime_id", animeId).single();
      if (listEntry && !cancelled) setUserStatus(listEntry.status);
      else if (!cancelled) {
        await supabase.from("user_anime_list").insert({ user_id: effectiveId, anime_id: animeId, status: "planned" });
      }

      const { data: seasons } = await supabase.from("anime_seasons").select("id").eq("anime_id", animeId);
      if (seasons && seasons.length > 0 && !cancelled) {
        const seasonIds = seasons.map((s) => s.id);
        const { data: progress } = await supabase
          .from("episode_progress").select("season_id, episode_number").eq("user_id", effectiveId)
          .in("season_id", seasonIds).eq("watched", true);
        const progressMap = new Map<number, Set<number>>();
        progress?.forEach((p) => {
          const set = progressMap.get(p.season_id) || new Set<number>();
          set.add(p.episode_number); progressMap.set(p.season_id, set);
        });
        setEpisodeProgress(progressMap);
      }
      if (!cancelled) setUserDataLoaded(true);
    }
    loadUserData();
    return () => { cancelled = true; };
  }, [animeId, getEffectiveUserId, supabase]);

  async function handleRate(rating: number | "-") {
    if (!userId || animeId === null) return;
    setUserRating(rating);
    if (rating === "-") {
      await supabase.from("ratings").delete().eq("user_id", userId).eq("anime_id", animeId);
    } else {
      await supabase.from("ratings").upsert({ user_id: userId, anime_id: animeId, rating }, { onConflict: "user_id,anime_id" });
    }
    const { data: ratings } = await supabase.from("ratings").select("rating").eq("anime_id", animeId);
    if (ratings) {
      setAllRatings(ratings.map((r) => r.rating));
      setVotesCount(ratings.length);
      const viewers = await fetchViewersCount(supabase, animeId);
      setViewersCount(viewers);
      if (ratings.length > 0) {
        const newWR = calcWeightedRating(ratings.map((r) => r.rating), viewers);
        if (typeof newWR === "number" && typeof prevWeighted === "number") {
          const shift = newWR - prevWeighted;
          setWeightedRating(newWR); setPrevWeighted(newWR);
          if (rating !== "-") {
            setToast({ animeTitle, animeImage, message: `Ваша оценка сдвинула рейтинг на ${Math.abs(shift).toFixed(2)} пункта.`, type: "rating_shift", shiftAmount: shift });
          }
        } else setWeightedRating(newWR);
      } else setWeightedRating("-");

      loadTopPosition(animeId).then((pos) => setTopPosition(pos));
    }
  }

  async function handleStatus(status: string) {
    if (!userId || animeId === null) return;
    setUserStatus(status);
    await supabase.from("user_anime_list").update({ status }).eq("user_id", userId).eq("anime_id", animeId);
  }

  async function toggleEpisode(seasonId: number, epNumber: number) {
    if (!userId) return;
    const current = episodeProgress.get(seasonId) || new Set<number>();
    const isWatched = current.has(epNumber);
    if (isWatched) {
      await supabase.from("episode_progress").delete().eq("user_id", userId).eq("season_id", seasonId).eq("episode_number", epNumber);
      current.delete(epNumber);
    } else {
      await supabase.from("episode_progress").upsert({ user_id: userId, season_id: seasonId, episode_number: epNumber, watched: true }, { onConflict: "user_id,season_id,episode_number" });
      current.add(epNumber);
    }
    const newMap = new Map(episodeProgress);
    newMap.set(seasonId, current);
    setEpisodeProgress(newMap);
    if (anime?.anime_seasons) {
      let totalEps = 0, watchedEps = 0;
      for (const s of anime.anime_seasons) {
        totalEps += s.episodes_count;
        const prog = s.id === seasonId ? current : episodeProgress.get(s.id);
        watchedEps += prog?.size || 0;
      }
      if (userStatus === "dropped" || userStatus === "on_hold") return;
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
      await supabase.from("episode_progress").delete().eq("user_id", userId).eq("season_id", seasonId);
      current.clear();
    } else {
      const eps = Array.from({ length: episodesCount }, (_, i) => i + 1);
      await supabase.from("episode_progress").upsert(
        eps.map((ep) => ({ user_id: userId, season_id: seasonId, episode_number: ep, watched: true })),
        { onConflict: "user_id,season_id,episode_number" }
      );
      eps.forEach((ep) => current.add(ep));
    }
    const newMap = new Map(episodeProgress);
    newMap.set(seasonId, current);
    setEpisodeProgress(newMap);
  }

  async function handleDelete() {
    if (!userId || animeId === null) return;
    if (!confirm(`Удалить "${anime?.title}"?`)) return;
    const { data: seasons } = await supabase.from("anime_seasons").select("id").eq("anime_id", animeId);
    if (seasons && seasons.length > 0) {
      await supabase.from("episode_progress").delete().eq("user_id", userId).in("season_id", seasons.map((s) => s.id));
    }
    await supabase.from("ratings").delete().eq("user_id", userId).eq("anime_id", animeId);
    await supabase.from("user_anime_list").delete().eq("user_id", userId).eq("anime_id", animeId);
    router.push("/");
  }

  async function handlePosterUploaded(url: string) {
    if (animeId === null) return;
    await supabase.from("anime").update({ image_url: url }).eq("id", animeId);
    setAnime((a) => (a ? { ...a, image_url: url } : a));
    setAnimeImage(url);
    setEditingPoster(false);
  }

  async function handleDeleteSeason(seasonId: number) {
    if (!confirm("Удалить этот сезон?")) return;
    await supabase.from("episode_progress").delete().eq("season_id", seasonId);
    await supabase.from("anime_seasons").delete().eq("id", seasonId);
    setAnime((a) => a ? { ...a, anime_seasons: a.anime_seasons.filter((s) => s.id !== seasonId) } : a);
  }

  async function handleSaveSeason(seasonId: number) {
    await supabase.from("anime_seasons").update({
      episodes_count: parseInt(editSeasonEps) || 12, note: editSeasonNote,
    }).eq("id", seasonId);
    setAnime((a) => a ? { ...a, anime_seasons: a.anime_seasons.map((s) => s.id === seasonId ? { ...s, episodes_count: parseInt(editSeasonEps) || 12, note: editSeasonNote } : s) } : a);
    setEditingSeasonId(null);
  }

  async function handleAddSeason() {
    if (animeId === null) return;
    const { data } = await supabase.from("anime_seasons").insert({
      anime_id: animeId, season_number: newSeasonNumber, episodes_count: newSeasonEps, note: newSeasonNote,
    }).select().single();
    if (data) setAnime((a) => a ? { ...a, anime_seasons: [...a.anime_seasons, data] } : a);
    setAddingSeason(false);
    setNewSeasonNumber(0); setNewSeasonEps(12); setNewSeasonNote("");
  }

  // === СКЕЛЕТ (пока аниме не загружено) ===
  if (!animeLoaded) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-6 w-8 h-8 rounded bg-[#1a1a1e] border border-[#222226] animate-pulse" />
        <div className="bg-[#1a1a1e] border border-[#222226] rounded-xl overflow-hidden flex flex-col md:flex-row">
          <div className="w-full md:w-72 aspect-[3/4] bg-[#121214] animate-pulse" />
          <div className="p-6 md:p-8 flex-1 space-y-4">
            <div className="h-6 w-3/4 bg-[#222226] rounded animate-pulse" />
            <div className="h-4 w-1/2 bg-[#222226] rounded animate-pulse" />
            <div className="h-4 w-1/3 bg-[#222226] rounded animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (!anime) {
    return <div className="text-center py-20 text-gray-500 text-xs">Аниме не найдено</div>;
  }

  const votedPercent = viewersCount > 0 ? Math.round((votesCount / viewersCount) * 100) : 0;
  const ratingDist = Array.from({ length: 10 }, (_, i) => {
    const score = i + 1;
    const count = allRatings.filter((r) => r === score).length;
    return { score, count, pct: votesCount > 0 ? (count / votesCount) * 100 : 0 };
  }).reverse();

  function getRatingBtnHoverClass(opt: number | "-" | string): string {
    if (opt === "-") return "hover:border-gray-500 hover:text-gray-300";
    const num = Number(opt);
    if (num >= 1 && num <= 4) return "hover:border-red-500 hover:text-red-400 hover:bg-red-950/20";
    if (num >= 5 && num <= 6) return "hover:border-yellow-500 hover:text-yellow-400 hover:bg-yellow-950/20";
    if (num >= 7 && num <= 10) return "hover:border-green-500 hover:text-green-400 hover:bg-green-950/20";
    return "";
  }

  return (
    <div className="max-w-4xl mx-auto">
      <button onClick={() => router.back()} className="mb-6 w-8 h-8 rounded bg-[#1a1a1e] hover:bg-[#222226] border border-[#222226] flex items-center justify-center text-xs text-gray-400 transition-all">
        <i className="fa-solid fa-arrow-left"></i>
      </button>

      <div className="bg-[#1a1a1e] border border-[#222226] rounded-xl overflow-hidden flex flex-col md:flex-row">
        <div className="w-full md:w-72 bg-[#121214] flex-shrink-0 relative aspect-[3/4]">
          {editingPoster ? (
            <div className="absolute inset-0 flex items-center justify-center bg-[#121214] p-4 z-10">
              <ImageUpload bucket="Anime" currentUrl={anime.image_url} onUploaded={handlePosterUploaded} size={200} label="Загрузить постер" />
              <button onClick={() => setEditingPoster(false)} className="absolute top-2 right-2 text-gray-500 hover:text-white text-xs"><i className="fa-solid fa-xmark"></i></button>
            </div>
          ) : (
            <>
              <SafeImage src={anime.image_url} alt={anime.title} fill className="object-cover" sizes="(max-width: 768px) 100vw, 288px" />
              {isAdmin && (
                <button onClick={() => setEditingPoster(true)} className="absolute bottom-3 right-3 bg-black/80 hover:bg-black text-white text-[10px] font-bold px-2 py-1 rounded border border-[#222226] transition-all z-10">
                  <i className="fa-solid fa-pen mr-1"></i> Постер
                </button>
              )}
            </>
          )}
          <div className="absolute top-3 left-3 bg-black/80 border border-[#222226] text-xs font-bold text-sky-400 px-2 py-1 rounded">
            ★ {typeof weightedRating === "number" ? weightedRating.toFixed(2) : ratingsLoaded ? weightedRating : "..."}
          </div>
          {topPosition && (
            <div className="absolute top-3 right-3 bg-gradient-to-br from-amber-500 to-orange-600 text-[10px] font-bold text-white px-2 py-1 rounded shadow-lg shadow-amber-500/20 border border-amber-400/30">
              <i className="fa-solid fa-crown mr-1"></i> Топ #{topPosition}
            </div>
          )}
        </div>

        <div className="p-6 md:p-8 flex-1 flex flex-col">
          <div className="flex items-center gap-3 mb-4 pr-8">
            <h2 className="text-xl font-bold text-white flex-1">{anime.title}</h2>
            {isAdmin && !editingAnime && (
              <button onClick={() => { setEditTitle(anime.title); setEditSlug(anime.slug || ""); setEditGenres(anime.genres || []); setEditSeason(anime.season_info); setEditAgeRating(anime.age_rating); setEditStatus(anime.status || "announced"); setEditingAnime(true); }}
                className="text-[10px] font-bold text-gray-400 hover:text-sky-400 px-2.5 py-1 rounded bg-[#121214] border border-[#222226] transition-all flex items-center gap-1.5 shrink-0">
                <i className="fa-solid fa-pen"></i> Редактировать
              </button>
            )}
          </div>

          {editingAnime ? (
            <div className="mb-5 pb-3 border-b border-[#222226] space-y-3">
              <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="w-full bg-[#121214] border border-[#222226] rounded px-3 py-2 text-sm text-white outline-none focus:border-sky-500/50" placeholder="Название" />
              <input value={editSlug} onChange={(e) => setEditSlug(e.target.value)} className="w-full bg-[#121214] border border-[#222226] rounded px-3 py-2 text-sm text-white outline-none focus:border-sky-500/50" placeholder="slug (адресная строка)" />
              <div className="flex gap-2">
                <input value={editSeason} onChange={(e) => setEditSeason(e.target.value)} className="flex-1 bg-[#121214] border border-[#222226] rounded px-2 py-1 text-xs text-white outline-none focus:border-sky-500/50" placeholder="Сезон" />
                <select value={editAgeRating} onChange={(e) => setEditAgeRating(e.target.value)} className="bg-[#121214] border border-[#222226] rounded px-2 py-1 text-xs text-white outline-none">
                  {AGE_RATINGS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
                <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)} className="bg-[#121214] border border-[#222226] rounded px-2 py-1 text-xs text-white outline-none">
                  {ANIME_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div className="flex flex-wrap gap-1">
                {ALL_GENRES.map((g) => (
                  <button key={g} onClick={() => setEditGenres((prev) => prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g])}
                    className={`text-[9px] font-bold px-2 py-0.5 rounded border transition-all ${editGenres.includes(g) ? "bg-sky-500/20 text-sky-400 border-sky-500/30" : "bg-[#121214] text-gray-500 border-[#222226]"}`}>{g}</button>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={async () => {
                  if (animeId !== null) {
                    const newSlug = editSlug.trim() || generateSlug(editTitle.trim());
                    await supabase.from("anime").update({ title: editTitle, slug: newSlug, genres: editGenres, season_info: editSeason, age_rating: editAgeRating, status: editStatus }).eq("id", animeId);
                    setAnime((a) => a ? { ...a, title: editTitle, slug: newSlug, genres: editGenres, season_info: editSeason, age_rating: editAgeRating, status: editStatus } : a);
                    setAnimeTitle(editTitle); setEditingAnime(false);
                    router.replace(`/anime/${newSlug}`);
                  }
                }} className="bg-sky-500 hover:bg-sky-600 text-white text-[10px] font-bold px-3 py-1.5 rounded transition-all">Сохранить</button>
                <button onClick={() => setEditingAnime(false)} className="bg-[#121214] text-gray-400 text-[10px] font-bold px-3 py-1.5 rounded border border-[#222226] hover:text-white transition-all">Отмена</button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-y-1.5 gap-x-4 text-xs text-gray-400 mb-5 pb-3 border-b border-[#222226]">
              <div className="flex items-center gap-1.5">
                {anime.status === "ongoing" && <span className="text-emerald-400 font-bold">● Онгоинг</span>}
                {anime.status === "announced" && <span className="text-amber-400 font-bold">● Анонс</span>}
                {anime.status === "finished" && <span className="text-gray-500 font-bold">● Завершено</span>}
              </div>
              <div>Сезон: <span className="text-sky-400 font-semibold ml-1">{anime.season_info}</span></div>
              <div>Рейтинг: <span className="border border-[#3a3a42] px-1.5 py-0.5 rounded text-[10px] text-gray-300 font-bold ml-1">{anime.age_rating}</span></div>
              <div className="w-full flex flex-wrap gap-1 items-center mt-1">
                <span>Жанры:</span>
                {anime.genres?.map((g) => (
                  <Link key={g} href={`/catalog?genre=${encodeURIComponent(g)}`}
                    className="bg-[#222226] hover:bg-[#32323a] border border-[#2d2d35] px-1.5 py-0.5 rounded text-[10px] text-gray-300 cursor-pointer transition-all">{g}</Link>
                ))}
              </div>
            </div>
          )}

          {/* Рейтинг — показываем сразу как загрузится */}
          {ratingsLoaded && (
            <div className="bg-[#121214] p-4 rounded-lg border border-[#222226] mb-6">
              <div className="flex flex-wrap items-center justify-between gap-4 text-xs mb-4 border-b border-[#222226] pb-3">
                <div>
                  <span className="text-gray-500 block text-[10px] uppercase">Рейтинг</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <strong className="text-sky-400 text-base">{typeof weightedRating === "number" ? weightedRating.toFixed(2) : weightedRating}</strong>
                    <button onClick={() => setShowStats(!showStats)}
                      className="bg-[#1a1a1e] hover:bg-[#222226] text-gray-300 px-2.5 py-1 rounded border border-[#222226] text-[10px] font-bold flex items-center gap-1.5 transition-all">
                      <i className="fa-solid fa-chart-bar"></i> {votesCount} голосов
                    </button>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-gray-500 block text-[10px] uppercase">Активность</span>
                  <span className="text-gray-400 text-[11px] block mt-0.5">Оценили: <strong className="text-sky-400">{votedPercent}%</strong> ({votesCount}/{viewersCount} зрит.)</span>
                </div>
              </div>
              {showStats && (
                <div className="mb-4 p-3 bg-[#1a1a1e] border border-[#222226] rounded flex flex-col gap-1.5">
                  {ratingDist.map((r) => (
                    <div key={r.score} className="flex items-center gap-2 text-[11px]">
                      <div className="w-5 text-right font-bold text-gray-500">{r.score}★</div>
                      <div className="flex-1 bg-[#121214] h-2.5 rounded overflow-hidden"><div className="bg-sky-400 h-full" style={{ width: `${r.pct}%` }} /></div>
                      <div className="w-4 text-right text-[10px] text-gray-400">{r.count}</div>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <span className="font-bold text-gray-400">Твоя оценка:</span>
                {!isAuthed ? (
                  <div className="relative">
                    <div className="flex flex-wrap gap-1 opacity-40 pointer-events-none select-none">
                      {(["-", 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const).map((opt) => (
                        <span key={String(opt)} className="w-6 h-6 text-[10px] font-bold rounded bg-zinc-900 border border-zinc-800 text-gray-500 flex items-center justify-center">{opt}</span>
                      ))}
                    </div>
                    <div className="absolute inset-0 bg-[#121214]/80 backdrop-blur-[1px] rounded-lg flex items-center justify-center">
                      <button onClick={() => router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`)}
                        className="bg-sky-500 hover:bg-sky-600 text-white text-[10px] font-bold px-4 py-2 rounded-lg transition-all flex items-center gap-2 shadow-lg shadow-sky-500/20">
                        <i className="fa-solid fa-right-to-bracket"></i> Войти, чтобы оценить
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {(["-", 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const).map((opt) => {
                      const isSelected = String(userRating) === String(opt);
                      const optNum = opt === "-" ? 0 : opt;
                      return (
                        <button key={String(opt)} onClick={() => handleRate(opt === "-" ? "-" : Number(opt))}
                          className={`w-6 h-6 text-[10px] font-bold rounded transition-all ${isSelected ? opt === "-" ? "bg-zinc-700 text-white border border-zinc-600" : optNum >= 1 && optNum <= 4 ? "bg-red-600 text-white border border-red-500" : optNum >= 5 && optNum <= 6 ? "bg-yellow-600 text-white border border-yellow-500" : "bg-green-600 text-white border border-green-500" : `bg-zinc-900 border border-zinc-800 text-gray-500 ${getRatingBtnHoverClass(opt)}`}`}>
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {userDataLoaded && (
            <>
              <div className="flex items-center gap-2 mb-6">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Статус:</span>
                {["planned", "watching", "completed", "on_hold", "dropped"].map((s) => {
                  const labels: Record<string, string> = { planned: "Запланировано", watching: "Смотрю", completed: "Просмотрено", on_hold: "Отложено", dropped: "Брошено" };
                  return (
                    <button key={s} onClick={() => handleStatus(s)}
                      className={`text-[10px] font-bold px-3 py-1 rounded transition-all ${userStatus === s ? "bg-sky-500/20 text-sky-400 border border-sky-500/30" : "bg-[#121214] text-gray-500 border border-[#222226] hover:text-gray-300"}`}>
                      {labels[s]}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Сезоны и серии</h4>
                {isAdmin && (
                  <button onClick={() => setAddingSeason(true)}
                    className="text-[10px] font-bold text-sky-400 hover:text-sky-300 px-2 py-1 rounded border border-sky-400/30 hover:bg-sky-400/10 transition-all">
                    <i className="fa-solid fa-plus mr-1"></i> Добавить сезон
                  </button>
                )}
              </div>

              {addingSeason && (
                <div className="mb-3 p-3 bg-[#1a1a1e] border border-[#222226] rounded-lg flex flex-col gap-2">
                  <div className="flex gap-2 text-xs">
                    <input type="number" value={newSeasonNumber} onChange={(e) => setNewSeasonNumber(Number(e.target.value))} placeholder="№ сезона"
                      className="w-20 bg-[#121214] border border-[#222226] rounded px-2 py-1.5 text-white outline-none focus:border-sky-500/50" />
                    <input type="number" value={newSeasonEps} onChange={(e) => setNewSeasonEps(Number(e.target.value))} placeholder="Серий"
                      className="w-20 bg-[#121214] border border-[#222226] rounded px-2 py-1.5 text-white outline-none focus:border-sky-500/50" />
                    <input value={newSeasonNote} onChange={(e) => setNewSeasonNote(e.target.value)} placeholder="Название (опционально)"
                      className="flex-1 bg-[#121214] border border-[#222226] rounded px-2 py-1.5 text-white outline-none focus:border-sky-500/50" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleAddSeason} className="bg-sky-500 hover:bg-sky-600 text-white text-[10px] font-bold px-3 py-1 rounded transition-all">Добавить</button>
                    <button onClick={() => setAddingSeason(false)} className="text-gray-400 text-[10px] font-bold px-3 py-1 rounded border border-[#222226] hover:text-white transition-all">Отмена</button>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-3 flex-1">
                {anime.anime_seasons?.sort((a, b) => a.season_number - b.season_number).map((season) => {
                  const watched = episodeProgress.get(season.id) || new Set<number>();
                  const allEpsWatched = watched.size >= season.episodes_count;
                  return (
                    <div key={season.id} className="p-3 bg-[#121214] rounded-lg border border-[#222226] flex flex-col gap-2">
                      {editingSeasonId === season.id ? (
                        <div className="flex flex-col gap-2">
                          <div className="flex gap-2 text-xs">
                            <input type="number" value={editSeasonEps} onChange={(e) => setEditSeasonEps(e.target.value)} placeholder="Серий"
                              className="w-20 bg-[#1a1a1e] border border-[#222226] rounded px-2 py-1 text-white outline-none focus:border-sky-500/50" />
                            <input value={editSeasonNote} onChange={(e) => setEditSeasonNote(e.target.value)} placeholder="Название"
                              className="flex-1 bg-[#1a1a1e] border border-[#222226] rounded px-2 py-1 text-white outline-none focus:border-sky-500/50" />
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => handleSaveSeason(season.id)} className="bg-sky-500 hover:bg-sky-600 text-white text-[10px] font-bold px-2 py-1 rounded transition-all">Сохранить</button>
                            <button onClick={() => setEditingSeasonId(null)} className="text-gray-400 text-[10px] font-bold px-2 py-1 rounded border border-[#222226] hover:text-white transition-all">Отмена</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-bold text-gray-300">
                              {season.season_number} Сезон ({season.episodes_count} сер.)
                              {season.note ? <span className="text-gray-500 font-normal ml-1">— {season.note}</span> : null}
                            </span>
                            <div className="flex items-center gap-2">
                              {isAdmin && (
                                <>
                                  <button onClick={() => { setEditingSeasonId(season.id); setEditSeasonEps(String(season.episodes_count)); setEditSeasonNote(season.note || ""); }}
                                    className="text-[10px] text-gray-500 hover:text-sky-400 transition-colors"><i className="fa-solid fa-pen"></i></button>
                                  <button onClick={() => handleDeleteSeason(season.id)} className="text-[10px] text-gray-500 hover:text-red-400 transition-colors"><i className="fa-solid fa-trash-can"></i></button>
                                </>
                              )}
                              <button onClick={() => toggleWholeSeason(season.id, season.episodes_count)}
                                className="text-[10px] text-sky-400 hover:underline">{allEpsWatched ? "Сбросить сезон" : "Посмотрел весь"}</button>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {Array.from({ length: season.episodes_count }, (_, i) => i + 1).map((ep) => (
                              <button key={ep} onClick={() => toggleEpisode(season.id, ep)}
                                className={`w-6 h-6 text-[9px] font-bold rounded transition-all ${watched.has(ep) ? "bg-sky-500/20 text-sky-400 border border-sky-400/30" : "bg-[#1a1a1e] text-gray-500 border border-[#222226] hover:text-gray-300"}`}>
                                {ep}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
                {(!anime.anime_seasons || anime.anime_seasons.length === 0) && (
                  <div className="text-center py-6 text-gray-500 text-xs">Нет сезонов</div>
                )}
              </div>
            </>
          )}

          {userId && (
            <div className="border-t border-[#222226] pt-4 mt-6 flex justify-end">
              <button onClick={handleDelete} className="px-3 py-1.5 rounded bg-red-950/20 hover:bg-red-950/60 text-red-400 font-semibold border border-red-500/10 text-xs transition-all">
                <i className="fa-solid fa-trash-can mr-1"></i> Удалить
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-8 mt-8">
        <ReviewsSection animeId={anime.id} isAuthed={isAuthed} userId={userId} />
        <CollectionsSection animeId={anime.id} animeTitle={anime.title} userId={userId} />
      </div>

      <RatingToast toast={toast} onDone={() => setToast(null)} />
    </div>
  );
}