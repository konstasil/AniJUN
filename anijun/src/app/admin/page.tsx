"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import ImageUpload from "@/components/ImageUpload";

const ADMIN_IDS = [
  "8fa96992-b063-4019-83a6-3acac8cc712f",
  "cc91e0bb-a24b-41ab-ba41-3bd352ed9add",
];

const ALL_GENRES = [
  "Боевик","Приключения","Комедия","Драма","Фантастика","Фэнтези","Хоррор",
  "Меха","Музыка","Мистика","Психология","Романтика","Спорт",
  "Повседневность","История","Военное","Детектив","Триллер","Сёнэн","Сёдзё",
];

const AGE_RATINGS = ["0+","6+","12+","16+","18+","21+"];

interface AnimeRow {
  id: number;
  title: string;
  image_url: string;
  genres: string[];
  season_info: string;
  age_rating: string;
  created_at: string;
}

interface ProfileRow {
  id: string;
  username: string;
  created_at: string;
}

interface RatingRow {
  id: number;
  user_id: string;
  anime_id: number;
  rating: number;
  profiles?: { username: string }[];
  anime?: { title: string }[];
}

type Tab = "add-anime" | "anime-list" | "users" | "ratings";

export default function AdminPage() {
  const router = useRouter();
  const supabase = createClient();

  const [isAdmin, setIsAdmin] = useState(false);
  const [tab, setTab] = useState<Tab>("add-anime");
  const [loading, setLoading] = useState(true);

  const [newTitle, setNewTitle] = useState("");
  const [newGenres, setNewGenres] = useState<string[]>([]);
  const [newSeason, setNewSeason] = useState("Зима 2025");
  const [newAgeRating, setNewAgeRating] = useState("16+");
  const [newPosterUrl, setNewPosterUrl] = useState("");
  const [seasons, setSeasons] = useState<{ number: number; episodes: number }[]>([{ number: 1, episodes: 12 }]);
  const [addingAnime, setAddingAnime] = useState(false);

  const [animeList, setAnimeList] = useState<AnimeRow[]>([]);
  const [animeSearch, setAnimeSearch] = useState("");
  const [editingAnime, setEditingAnime] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editPosterUrl, setEditPosterUrl] = useState("");
  const [editGenres, setEditGenres] = useState<string[]>([]);
  const [editSeason, setEditSeason] = useState("");
  const [editAgeRating, setEditAgeRating] = useState("16+");

  const [users, setUsers] = useState<ProfileRow[]>([]);

  const [ratings, setRatings] = useState<RatingRow[]>([]);
  const [ratingAnimeId, setRatingAnimeId] = useState("");
  const [ratingUserId, setRatingUserId] = useState("");
  const [ratingValue, setRatingValue] = useState("7");

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      if (ADMIN_IDS.includes(user.id)) {
        setIsAdmin(true);
        await loadAll();
      }
      setLoading(false);
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadAll() {
    const { data: anime } = await supabase.from("anime").select("*").order("id", { ascending: false });
    if (anime) setAnimeList(anime);

    const { data: profiles } = await supabase.from("profiles").select("id, username, created_at").order("created_at", { ascending: false });
    if (profiles) setUsers(profiles);

    const { data: r } = await supabase
      .from("ratings")
      .select("*, profiles:user_id(username), anime:anime_id(title)")
      .order("id", { ascending: false })
      .limit(200);
    if (r) setRatings(r as unknown as RatingRow[]);
  }

  function toggleGenre(genre: string, list: string[], setter: (v: string[]) => void) {
    setter(list.includes(genre) ? list.filter((g) => g !== genre) : [...list, genre]);
  }

  async function handleAddAnime() {
    if (!newTitle.trim()) return;
    setAddingAnime(true);
    const { data: anime } = await supabase.from("anime").insert({
      title: newTitle.trim(),
      image_url: newPosterUrl || "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400&q=80",
      genres: newGenres,
      season_info: newSeason,
      age_rating: newAgeRating,
    }).select().single();

    if (anime) {
      for (const s of seasons) {
        await supabase.from("anime_seasons").insert({
          anime_id: anime.id,
          season_number: s.number,
          episodes_count: s.episodes,
        });
      }
    }
    setNewTitle(""); setNewGenres([]); setNewPosterUrl(""); setSeasons([{ number: 1, episodes: 12 }]);
    setAddingAnime(false);
    await loadAll();
    setTab("anime-list");
  }

  async function handleDeleteAnime(id: number) {
    if (!confirm("Удалить это аниме со всеми данными?")) return;
    const { data: seas } = await supabase.from("anime_seasons").select("id").eq("anime_id", id);
    if (seas && seas.length > 0) {
      const ids = seas.map((s) => s.id);
      await supabase.from("episode_progress").delete().in("season_id", ids);
    }
    await supabase.from("anime_seasons").delete().eq("anime_id", id);
    await supabase.from("ratings").delete().eq("anime_id", id);
    await supabase.from("user_anime_list").delete().eq("anime_id", id);
    await supabase.from("anime").delete().eq("id", id);
    await loadAll();
  }

  function startEditAnime(a: AnimeRow) {
    setEditingAnime(a.id);
    setEditTitle(a.title);
    setEditPosterUrl(a.image_url);
    setEditGenres(a.genres || []);
    setEditSeason(a.season_info);
    setEditAgeRating(a.age_rating);
  }

  async function saveEditAnime() {
    if (editingAnime === null) return;
    await supabase.from("anime").update({
      title: editTitle,
      image_url: editPosterUrl,
      genres: editGenres,
      season_info: editSeason,
      age_rating: editAgeRating,
    }).eq("id", editingAnime);
    setEditingAnime(null);
    await loadAll();
  }

  async function handleAddRating() {
    if (!ratingAnimeId || !ratingUserId) return;
    await supabase.from("ratings").upsert(
      { user_id: ratingUserId, anime_id: Number(ratingAnimeId), rating: Number(ratingValue) },
      { onConflict: "user_id,anime_id" }
    );
    setRatingAnimeId(""); setRatingUserId(""); setRatingValue("7");
    await loadAll();
  }

  async function handleDeleteRating(id: number) {
    await supabase.from("ratings").delete().eq("id", id);
    await loadAll();
  }

  if (loading) return <div className="text-center py-20 text-gray-500 text-xs">Загрузка...</div>;

  if (!isAdmin) {
    return (
      <div className="text-center py-20">
        <i className="fa-solid fa-lock text-red-400 text-3xl mb-4 block"></i>
        <p className="text-gray-400 text-sm">Доступ запрещён. Только для администраторов.</p>
      </div>
    );
  }

  const filteredAnime = animeList.filter((a) => a.title.toLowerCase().includes(animeSearch.toLowerCase()));

  const tabs: [Tab, string, string][] = [
    ["add-anime", "Добавить аниме", "fa-plus"],
    ["anime-list", "Список аниме", "fa-film"],
    ["users", "Пользователи", "fa-users"],
    ["ratings", "Рейтинги", "fa-star"],
  ];

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <i className="fa-solid fa-shield text-sky-400 text-lg"></i>
        <h1 className="text-lg font-bold text-white">Панель администратора</h1>
      </div>

      <div className="flex gap-1 mb-6 bg-[#121214] p-1 rounded-lg border border-[#222226] overflow-x-auto">
        {tabs.map(([key, label, icon]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-bold transition-all whitespace-nowrap ${
              tab === key ? "bg-sky-500/20 text-sky-400 border border-sky-500/30" : "text-gray-500 hover:text-gray-300 border border-transparent"
            }`}>
            <i className={`fa-solid ${icon} text-[10px]`}></i> {label}
          </button>
        ))}
      </div>

      {/* ADD ANIME */}
      {tab === "add-anime" && (
        <div className="bg-[#1a1a1e] border border-[#222226] rounded-xl p-6 space-y-5">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Новое аниме</h3>
          <div className="flex flex-col md:flex-row gap-6">
            <ImageUpload bucket="Anime" currentUrl={newPosterUrl || undefined} onUploaded={setNewPosterUrl} size={160} label="Загрузить постер" />
            <div className="flex-1 space-y-4">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Название</label>
                <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Название аниме..."
                  className="w-full bg-[#121214] border border-[#222226] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-sky-500/50 transition-colors" />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Сезон</label>
                  <input value={newSeason} onChange={(e) => setNewSeason(e.target.value)}
                    className="w-full bg-[#121214] border border-[#222226] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-sky-500/50 transition-colors" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Возраст</label>
                  <select value={newAgeRating} onChange={(e) => setNewAgeRating(e.target.value)}
                    className="bg-[#121214] border border-[#222226] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-sky-500/50 transition-colors">
                    {AGE_RATINGS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">URL постера (или загрузите)</label>
                <input value={newPosterUrl} onChange={(e) => setNewPosterUrl(e.target.value)} placeholder="https://..."
                  className="w-full bg-[#121214] border border-[#222226] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-sky-500/50 transition-colors" />
              </div>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-2">Жанры</label>
            <div className="flex flex-wrap gap-1.5">
              {ALL_GENRES.map((g) => (
                <button key={g} onClick={() => toggleGenre(g, newGenres, setNewGenres)}
                  className={`text-[10px] font-bold px-2.5 py-1 rounded border transition-all ${
                    newGenres.includes(g) ? "bg-sky-500/20 text-sky-400 border-sky-500/30" : "bg-[#121214] text-gray-500 border-[#222226] hover:text-gray-300"
                  }`}>{g}</button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Сезоны</label>
              <button onClick={() => setSeasons([...seasons, { number: seasons.length + 1, episodes: 12 }])}
                className="text-[10px] font-bold text-sky-400 hover:text-sky-300 transition-colors">+ Добавить сезон</button>
            </div>
            <div className="space-y-2">
              {seasons.map((s, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 w-16">Сезон {s.number}:</span>
                  <input type="number" min={1} value={s.episodes}
                    onChange={(e) => { const c = [...seasons]; c[i] = { ...c[i], episodes: Number(e.target.value) }; setSeasons(c); }}
                    className="w-20 bg-[#121214] border border-[#222226] rounded px-2 py-1 text-xs text-white outline-none focus:border-sky-500/50" />
                  <span className="text-[10px] text-gray-500">серий</span>
                  {seasons.length > 1 && (
                    <button onClick={() => setSeasons(seasons.filter((_, j) => j !== i))} className="text-[10px] text-red-400 hover:text-red-300">
                      <i className="fa-solid fa-xmark"></i>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <button onClick={handleAddAnime} disabled={addingAnime || !newTitle.trim()}
            className="bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs px-5 py-2.5 rounded-lg transition-all disabled:opacity-50 shadow-lg shadow-sky-500/10">
            {addingAnime ? "Добавление..." : "Добавить аниме"}
          </button>
        </div>
      )}

      {/* ANIME LIST */}
      {tab === "anime-list" && (
        <div className="space-y-3">
          <input value={animeSearch} onChange={(e) => setAnimeSearch(e.target.value)} placeholder="Поиск аниме..."
            className="w-full bg-[#121214] border border-[#222226] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-sky-500/50 transition-colors" />
          {filteredAnime.length === 0 && <p className="text-gray-500 text-xs text-center py-8">Ничего не найдено</p>}
          {filteredAnime.map((a) => (
            <div key={a.id} className="bg-[#1a1a1e] border border-[#222226] rounded-lg p-3">
              {editingAnime === a.id ? (
                <div className="space-y-3">
                  <div className="flex gap-4">
                    <ImageUpload bucket="Anime" currentUrl={editPosterUrl} onUploaded={setEditPosterUrl} size={80} label="Постер" />
                    <div className="flex-1 space-y-2">
                      <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
                        className="w-full bg-[#121214] border border-[#222226] rounded px-2 py-1 text-xs text-white outline-none focus:border-sky-500/50" />
                      <input value={editSeason} onChange={(e) => setEditSeason(e.target.value)} placeholder="Сезон"
                        className="w-full bg-[#121214] border border-[#222226] rounded px-2 py-1 text-xs text-white outline-none focus:border-sky-500/50" />
                      <select value={editAgeRating} onChange={(e) => setEditAgeRating(e.target.value)}
                        className="bg-[#121214] border border-[#222226] rounded px-2 py-1 text-xs text-white outline-none">
                        {AGE_RATINGS.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {ALL_GENRES.map((g) => (
                      <button key={g} onClick={() => toggleGenre(g, editGenres, setEditGenres)}
                        className={`text-[9px] font-bold px-2 py-0.5 rounded border transition-all ${
                          editGenres.includes(g) ? "bg-sky-500/20 text-sky-400 border-sky-500/30" : "bg-[#121214] text-gray-500 border-[#222226]"
                        }`}>{g}</button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={saveEditAnime} className="bg-sky-500 hover:bg-sky-600 text-white text-[10px] font-bold px-3 py-1.5 rounded transition-all">Сохранить</button>
                    <button onClick={() => setEditingAnime(null)} className="bg-[#121214] text-gray-400 text-[10px] font-bold px-3 py-1.5 rounded border border-[#222226] hover:text-white transition-all">Отмена</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="w-12 h-16 rounded overflow-hidden bg-[#121214] flex-shrink-0 relative">
                    <Image src={a.image_url} alt={a.title} fill className="object-cover" sizes="48px" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-white truncate">{a.title}</p>
                    <p className="text-[10px] text-gray-500">{a.season_info} &middot; {a.age_rating} &middot; {(a.genres || []).slice(0, 3).join(", ")}</p>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button onClick={() => startEditAnime(a)} className="text-[10px] text-gray-400 hover:text-sky-400 px-2 py-1 rounded bg-[#121214] border border-[#222226] transition-all">
                      <i className="fa-solid fa-pen"></i>
                    </button>
                    <button onClick={() => router.push(`/anime/${a.id}`)} className="text-[10px] text-gray-400 hover:text-white px-2 py-1 rounded bg-[#121214] border border-[#222226] transition-all">
                      <i className="fa-solid fa-arrow-up-right-from-square"></i>
                    </button>
                    <button onClick={() => handleDeleteAnime(a.id)} className="text-[10px] text-gray-400 hover:text-red-400 px-2 py-1 rounded bg-[#121214] border border-[#222226] transition-all">
                      <i className="fa-solid fa-trash-can"></i>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* USERS */}
      {tab === "users" && (
        <div className="space-y-2">
          {users.length === 0 && <p className="text-gray-500 text-xs text-center py-8">Нет пользователей</p>}
          {users.map((u) => (
            <div key={u.id} className="bg-[#1a1a1e] border border-[#222226] rounded-lg p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-sky-400 to-blue-600 flex items-center justify-center text-white text-xs font-black flex-shrink-0">
                {u.username.substring(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white truncate">{u.username}</p>
                <p className="text-[10px] text-gray-500">{u.id}</p>
              </div>
              {ADMIN_IDS.includes(u.id) && (
                <span className="text-[9px] font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">Админ</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* RATINGS */}
      {tab === "ratings" && (
        <div className="space-y-4">
          <div className="bg-[#1a1a1e] border border-[#222226] rounded-xl p-4">
            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Добавить / изменить оценку</h4>
            <div className="flex flex-wrap gap-2 items-end">
              <div className="flex-1 min-w-[140px]">
                <label className="text-[10px] text-gray-500 block mb-1">Anime ID</label>
                <select value={ratingAnimeId} onChange={(e) => setRatingAnimeId(e.target.value)}
                  className="w-full bg-[#121214] border border-[#222226] rounded px-2 py-1.5 text-xs text-white outline-none focus:border-sky-500/50">
                  <option value="">Выберите</option>
                  {animeList.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
                </select>
              </div>
              <div className="flex-1 min-w-[140px]">
                <label className="text-[10px] text-gray-500 block mb-1">User ID</label>
                <select value={ratingUserId} onChange={(e) => setRatingUserId(e.target.value)}
                  className="w-full bg-[#121214] border border-[#222226] rounded px-2 py-1.5 text-xs text-white outline-none focus:border-sky-500/50">
                  <option value="">Выберите</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.username}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-gray-500 block mb-1">Оценка</label>
                <select value={ratingValue} onChange={(e) => setRatingValue(e.target.value)}
                  className="bg-[#121214] border border-[#222226] rounded px-2 py-1.5 text-xs text-white outline-none focus:border-sky-500/50">
                  {[1,2,3,4,5,6,7,8,9,10].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <button onClick={handleAddRating} disabled={!ratingAnimeId || !ratingUserId}
                className="bg-sky-500 hover:bg-sky-600 text-white font-bold text-[10px] px-4 py-1.5 rounded transition-all disabled:opacity-50">
                Сохранить
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            {ratings.map((r) => (
              <div key={r.id} className="bg-[#1a1a1e] border border-[#222226] rounded px-3 py-2 flex items-center gap-3 text-xs">
                <span className="font-bold text-sky-400 w-6 text-center">{r.rating}</span>
                <span className="text-gray-300 truncate flex-1">{r.anime?.[0]?.title || `Anime #${r.anime_id}`}</span>
                <span className="text-gray-500 truncate flex-1">{r.profiles?.[0]?.username || r.user_id.slice(0, 8)}</span>
                <button onClick={() => handleDeleteRating(r.id)} className="text-gray-500 hover:text-red-400 transition-colors flex-shrink-0">
                  <i className="fa-solid fa-trash-can text-[10px]"></i>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
