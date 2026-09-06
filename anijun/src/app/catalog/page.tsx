"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState, useMemo, useRef, Suspense, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import AnimeCard from "@/components/AnimeCard";
import { ALL_GENRES } from "@/lib/genres";
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
  anime_status?: string;
  status?: string;
  watched_episodes?: number;
  total_episodes?: number;
}

const CARDS_PER_PAGE = 24;

type SubTab = "catalog" | "ongoing" | "announcements";

const STORAGE_KEY = "anijun_catalog_state";

interface SavedState {
  page: number;
  scrollY: number;
  search: string;
  statusFilter: string;
  selectedGenres: string[];
  ageFilter: string;
  episodeFilter: string;
  subTab: SubTab;
}

export default function CatalogPage() {
  return (
    <Suspense fallback={<div className="text-center py-20 text-gray-500 text-xs">Загрузка...</div>}>
      <CatalogContent />
    </Suspense>
  );
}

function CatalogContent() {
  const searchParams = useSearchParams();
  const { getEffectiveUserId } = useSimulatedUser();

  const [allAnime, setAllAnime] = useState<Anime[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [subTab, setSubTab] = useState<SubTab>(() => {
    const tab = searchParams.get("tab");
    if (tab === "ongoing" || tab === "announcements") return tab;
    return "catalog";
  });

  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedGenres, setSelectedGenres] = useState<string[]>(() => {
    const genreParam = searchParams.get("genre");
    if (genreParam && ALL_GENRES.includes(genreParam)) return [genreParam];
    return [];
  });
  const [ageFilter, setAgeFilter] = useState("");
  const [episodeFilter, setEpisodeFilter] = useState("");

  const supabase = useMemo(() => createClient(), []);
  const loadedRef = useRef(false);

  useEffect(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) {
      const state: SavedState = JSON.parse(saved);

      setTimeout(() => {
        setPage(state.page);
        setSearch(state.search);
        setStatusFilter(state.statusFilter);
        setSelectedGenres(state.selectedGenres);
        setAgeFilter(state.ageFilter);
        setEpisodeFilter(state.episodeFilter);
        setSubTab(state.subTab);
      }, 0);

      if (state.scrollY > 0) {
        setTimeout(() => {
          window.scrollTo(0, state.scrollY);
        }, 50);
      }
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const saveState = useCallback(() => {
    const state: SavedState = {
      page,
      scrollY: window.scrollY,
      search,
      statusFilter,
      selectedGenres,
      ageFilter,
      episodeFilter,
      subTab,
    };
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {  }
  }, [page, search, statusFilter, selectedGenres, ageFilter, episodeFilter, subTab]);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();

      const { data: animeList } = await supabase
        .from("anime")
        .select("*, anime_seasons(*)")
        .order("id");

      if (!animeList) return;

      const { data: ratings } = await supabase
        .from("ratings")
        .select("anime_id, rating");

      const effectiveId = user ? getEffectiveUserId(user.id) : null;

      const { data: userList } = effectiveId
        ? await supabase
            .from("user_anime_list")
            .select("anime_id, status")
            .eq("user_id", effectiveId)
        : { data: null };

      const { data: userProgress } = effectiveId
        ? await supabase
            .from("episode_progress")
            .select("season_id, episode_number, watched, anime_seasons!inner(anime_id)")
            .eq("user_id", effectiveId)
        : { data: null };

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

      const viewersByAnime = await fetchViewersByAnime(supabase);
      const enriched = enrichWithWeightedRating(animeList, ratings, viewersByAnime).map((a) => {
        const totalEps =
          a.anime_seasons?.reduce(
            (s: number, sn: { episodes_count: number }) => s + sn.episodes_count,
            0
          ) || 0;
        const prog = progressByAnime.get(a.id);

        return {
          ...a,
          anime_status: a.status,
          status: listMap.get(a.id) || "planned",
          watched_episodes: prog?.watched || 0,
          total_episodes: totalEps,
        };
      });

      setAllAnime(enriched);
      loadedRef.current = true;
    }
    load();
  }, [getEffectiveUserId, supabase]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return allAnime.filter((a) => {
      if (q && !a.title.toLowerCase().includes(q) && !a.genres.some((g: string) => g.toLowerCase().includes(q))) return false;
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (selectedGenres.length > 0 && !selectedGenres.every((g) => a.genres.includes(g))) return false;
      if (ageFilter && a.age_rating !== ageFilter) return false;
      if (episodeFilter) {
        const total = a.total_episodes || 0;
        if (episodeFilter === "short" && total > 12) return false;
        if (episodeFilter === "medium" && (total <= 12 || total > 24)) return false;
        if (episodeFilter === "long" && total <= 24) return false;
      }
      return true;
    });
  }, [allAnime, search, statusFilter, selectedGenres, ageFilter, episodeFilter]);

  const totalPages = Math.ceil(filtered.length / CARDS_PER_PAGE);
  const safePage = Math.min(page, totalPages || 1);
  const paginated = filtered.slice(
    (safePage - 1) * CARDS_PER_PAGE,
    safePage * CARDS_PER_PAGE
  );

  const ongoingAnime = allAnime.filter((a) => a.anime_status === "ongoing");
  const announcementsAnime = allAnime.filter((a) => a.anime_status === "announced");

  function toggleGenre(g: string) {
    setSelectedGenres((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]
    );
    setPage(1);
  }

  function resetFilters() {
    setSearch("");
    setStatusFilter("all");
    setSelectedGenres([]);
    setAgeFilter("");
    setEpisodeFilter("");
    setPage(1);
  }

  function handleSearch(e: React.ChangeEvent<HTMLInputElement>) {
    setSearch(e.target.value);
    setPage(1);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      <aside className="lg:col-span-3">
        <div className="bg-[#1a1a1e] p-5 rounded-xl border border-[#222226] flex flex-col gap-4 sticky top-24">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-[#222226] pb-2">
            Разделы
          </h3>
          <div className="flex flex-col gap-1">
            {([
              ["catalog", "Каталог аниме"],
              ["ongoing", "Онгоинги"],
              ["announcements", "Анонсы"],
            ] as [SubTab, string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setSubTab(key)}
                className={`text-left px-3 py-2 rounded text-xs font-semibold transition-colors ${
                  subTab === key
                    ? "bg-[#222226] text-white"
                    : "text-gray-400 hover:bg-[#222226]/50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {subTab === "catalog" && (
            <>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-[#222226] pb-2 mt-2">
                Статус
              </h3>
              <div className="flex flex-col gap-1">
                {[
                  ["all", "Все тайтлы"],
                  ["watching", "Смотрю"],
                  ["planned", "Запланировано"],
                  ["completed", "Просмотрено"],
                  ["on_hold", "Отложено"],
                  ["dropped", "Брошено"],
                ].map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => { setStatusFilter(val); setPage(1); }}
                    className={`w-full text-left px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                      statusFilter === val
                        ? "bg-sky-400/10 text-sky-400 font-semibold"
                        : "hover:bg-[#222226] text-gray-400"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-[#222226] pb-1">
                Жанры
              </h3>
              <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto pr-1 custom-scrollbar">
                {ALL_GENRES.map((g) => (
                  <button
                    key={g}
                    onClick={() => toggleGenre(g)}
                    className={`px-2 py-1 rounded text-[10px] font-semibold transition-all border ${
                      selectedGenres.includes(g)
                        ? "bg-sky-400/10 text-sky-400 border-sky-400/30"
                        : "bg-[#121214] text-gray-400 border-zinc-800 hover:border-zinc-700"
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>

              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-[#222226] pb-1">
                Возраст
              </h3>
              <select
                value={ageFilter}
                onChange={(e) => { setAgeFilter(e.target.value); setPage(1); }}
                className="w-full bg-[#121214] border border-[#222226] rounded px-2.5 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-sky-400"
              >
                <option value="">Любой возраст</option>
                <option value="0+">0+</option>
                <option value="6+">6+</option>
                <option value="12+">12+</option>
                <option value="16+">16+</option>
                <option value="18+">18+</option>
                <option value="21+">21+</option>
              </select>

              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-[#222226] pb-1">
                Серии
              </h3>
              <select
                value={episodeFilter}
                onChange={(e) => { setEpisodeFilter(e.target.value); setPage(1); }}
                className="w-full bg-[#121214] border border-[#222226] rounded px-2.5 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-sky-400"
              >
                <option value="">Любое количество</option>
                <option value="short">Короткие (до 12 сер.)</option>
                <option value="medium">Средние (13-24 сер.)</option>
                <option value="long">Длинные (25+ сер.)</option>
              </select>

              <button
                onClick={resetFilters}
                className="w-full bg-zinc-800 hover:bg-zinc-700 text-gray-300 py-1.5 rounded text-xs font-bold transition-all"
              >
                Сбросить фильтры
              </button>
            </>
          )}
        </div>
      </aside>

      <section className="lg:col-span-9 flex flex-col justify-between min-h-[60vh]">
        {subTab === "catalog" && (
          <>
            <div className="relative mb-6">
              <i className="fa-solid fa-magnifying-glass absolute left-4 top-3 text-gray-500 text-xs"></i>
              <input
                type="text"
                value={search}
                onChange={handleSearch}
                placeholder="Поиск в коллекции..."
                className="w-full bg-[#1a1a1e] border border-[#222226] rounded-lg pl-10 pr-4 py-2.5 text-xs focus:outline-none focus:border-sky-400 transition-colors text-white"
              />
            </div>

            {paginated.length === 0 ? (
              <div className="text-center py-20 text-gray-500 text-xs">
                Ничего не найдено с такими фильтрами.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                  {paginated.map((anime) => (
                    <AnimeCard key={anime.id} {...anime} onCardClick={() => saveState()} />
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="flex justify-center items-center gap-2 mt-8">
                    <button
                      onClick={() => setPage(Math.max(1, safePage - 1))}
                      disabled={safePage === 1}
                      className="w-8 h-8 rounded border border-[#222226] bg-[#1a1a1e] hover:bg-[#222226] disabled:opacity-30 disabled:cursor-not-allowed text-gray-400 flex items-center justify-center text-xs transition-all"
                    >
                      <i className="fa-solid fa-chevron-left"></i>
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`w-8 h-8 rounded text-xs font-bold transition-all ${
                          p === safePage
                            ? "bg-sky-500 text-white"
                            : "border border-[#222226] text-gray-400 hover:bg-[#222226]"
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                    <button
                      onClick={() => setPage(Math.min(totalPages, safePage + 1))}
                      disabled={safePage === totalPages}
                      className="w-8 h-8 rounded border border-[#222226] bg-[#1a1a1e] hover:bg-[#222226] disabled:opacity-30 disabled:cursor-not-allowed text-gray-400 flex items-center justify-center text-xs transition-all"
                    >
                      <i className="fa-solid fa-chevron-right"></i>
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {subTab === "ongoing" && (
          <div className="flex flex-col gap-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400">
              Онгоинги — выходят сейчас
            </h3>
            {ongoingAnime.length === 0 ? (
              <div className="p-4 bg-[#1a1a1e] border border-[#222226] rounded-xl text-center text-gray-500 text-xs py-10">
                Пока нет аниме в статусе «Онгоинг».
              </div>
            ) : (
              ongoingAnime.map((a) => {
                const animeUrl = a.slug ? `/anime/${a.slug}` : `/anime/${a.id}`;
                return (
                  <a
                    key={a.id}
                    href={animeUrl}
                    className="p-3 bg-[#1a1a1e] border border-[#222226] rounded-xl flex items-center gap-4 hover:border-emerald-400/30 transition-colors"
                  >
                    <div className="w-16 h-20 rounded overflow-hidden bg-[#121214] relative shrink-0">
                      <Image src={a.image_url} alt={a.title} fill className="object-cover" sizes="64px" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[9px] text-emerald-400 font-bold uppercase">● Онгоинг</span>
                      <h4 className="font-bold text-white text-xs mt-0.5 truncate">{a.title}</h4>
                      <p className="text-gray-500 text-[11px] mt-1">
                        {a.season_info} · {a.age_rating} · {a.genres.slice(0, 3).join(", ")}
                      </p>
                    </div>
                  </a>
                );
              })
            )}
          </div>
        )}

        {subTab === "announcements" && (
          <div className="flex flex-col gap-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400">
              Анонсы — запланировано к выходу
            </h3>
            {announcementsAnime.length === 0 ? (
              <div className="p-4 bg-[#1a1a1e] border border-[#222226] rounded-xl text-center text-gray-500 text-xs py-10">
                Пока нет анонсированных тайтлов.
              </div>
            ) : (
              announcementsAnime.map((a) => {
                const animeUrl = a.slug ? `/anime/${a.slug}` : `/anime/${a.id}`;
                return (
                  <a
                    key={a.id}
                    href={animeUrl}
                    className="p-3 bg-[#1a1a1e] border border-[#222226] rounded-xl flex items-center gap-4 hover:border-amber-400/30 transition-colors"
                  >
                    <div className="w-16 h-20 rounded overflow-hidden bg-[#121214] relative shrink-0">
                      <Image src={a.image_url} alt={a.title} fill className="object-cover" sizes="64px" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[9px] text-amber-400 font-bold uppercase">● Анонс</span>
                      <h4 className="font-bold text-white text-xs mt-0.5 truncate">{a.title}</h4>
                      <p className="text-gray-500 text-[11px] mt-1">
                        {a.season_info} · {a.age_rating} · {a.genres.slice(0, 3).join(", ")}
                      </p>
                    </div>
                  </a>
                );
              })
            )}
          </div>
        )}
      </section>
    </div>
  );
}