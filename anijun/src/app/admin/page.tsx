"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import ImageUpload from "@/components/ImageUpload";
import { useSimulatedUser } from "@/lib/simulation-context";
import { ALL_GENRES, AGE_RATINGS, ANIME_STATUSES } from "@/lib/genres";
import { ADMIN_IDS } from "@/lib/admin";
import SeasonEditor, { SeasonDraft } from "@/components/SeasonEditor";

interface AnimeRow {
  id: number;
  slug?: string;
  title: string;
  image_url: string;
  genres: string[];
  season_info: string;
  age_rating: string;
  status?: string;
  created_at: string;
  anime_seasons?: { id: number; season_number: number; episodes_count: number; note?: string }[];
}

interface SuggestionRow {
  id: number;
  title: string;
  genres: string[];
  season_info: string;
  age_rating: string;
  image_url: string;
  link: string;
  comment: string;
  seasons?: SeasonDraft[];
  status: string;
  created_at: string;
  user_id: string;
  profiles?: { username: string }[];
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

type Tab = "add-anime" | "anime-list" | "suggestions" | "users" | "ratings" | "bans";

export default function AdminPage() {
  const router = useRouter();
  const supabase = createClient();

  const [isAdmin, setIsAdmin] = useState(false);
  const [tab, setTab] = useState<Tab>("add-anime");
  const [loading, setLoading] = useState(true);

  const [newTitle, setNewTitle] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newGenres, setNewGenres] = useState<string[]>([]);
  const [newSeason, setNewSeason] = useState("Зима 2025");
  const [newAgeRating, setNewAgeRating] = useState("16+");
  const [newStatus, setNewStatus] = useState("announced");
  const [newPosterUrl, setNewPosterUrl] = useState("");
  const [seasons, setSeasons] = useState<SeasonDraft[]>([{ number: 1, episodes: 12, note: "" }]);
  const [addingAnime, setAddingAnime] = useState(false);

  const [animeList, setAnimeList] = useState<AnimeRow[]>([]);
  const [animeSearch, setAnimeSearch] = useState("");
  const [editingAnime, setEditingAnime] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [editPosterUrl, setEditPosterUrl] = useState("");
  const [editGenres, setEditGenres] = useState<string[]>([]);
  const [editSeason, setEditSeason] = useState("");
  const [editAgeRating, setEditAgeRating] = useState("16+");
  const [editStatus, setEditStatus] = useState("announced");
  const [editSeasons, setEditSeasons] = useState<SeasonDraft[]>([]);

  const [suggestions, setSuggestions] = useState<SuggestionRow[]>([]);
  const [editingSuggestion, setEditingSuggestion] = useState<number | null>(null);
  const [editSuggTitle, setEditSuggTitle] = useState("");
  const [editSuggGenres, setEditSuggGenres] = useState<string[]>([]);
  const [editSuggSeason, setEditSuggSeason] = useState("");
  const [editSuggAgeRating, setEditSuggAgeRating] = useState("16+");
  const [editSuggImageUrl, setEditSuggImageUrl] = useState("");
  const [editSuggLink, setEditSuggLink] = useState("");
  const [editSuggComment, setEditSuggComment] = useState("");
  const [editSuggSeasons, setEditSuggSeasons] = useState<SeasonDraft[]>([]);

  const [users, setUsers] = useState<ProfileRow[]>([]);
  const [admins, setAdmins] = useState<string[]>([]);
  const [newAdminId, setNewAdminId] = useState("");

  const [bans, setBans] = useState<{ id: number; username: string | null; email: string | null; ip: string | null; reason: string | null; expires_at: string | null }[]>([]);
  const [mutes, setMutes] = useState<{ id: number; username: string | null; email: string | null; ip: string | null; reason: string | null; expires_at: string | null }[]>([]);
  const [banInput, setBanInput] = useState({ username: "", email: "", ip: "", reason: "", days: "" });
  const [muteInput, setMuteInput] = useState({ username: "", email: "", ip: "", reason: "", days: "" });

  const [ratings, setRatings] = useState<RatingRow[]>([]);
  const [ratingAnimeId, setRatingAnimeId] = useState("");
  const [ratingUserId, setRatingUserId] = useState("");
  const [ratingValue, setRatingValue] = useState("7");


  const { simulatedUserId, setSimulatedUserId: setGlobalSimulatedUserId } = useSimulatedUser();
  const [simulationLogs, setSimulationLogs] = useState<{ time: string; message: string }[]>([]);
  const [showSimulation, setShowSimulation] = useState(false);

  function addSimulationLog(message: string) {
    const time = new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setSimulationLogs((prev) => [...prev, { time, message }]);
  }

  async function simulateLogin(userId: string) {
    const user = users.find((u) => u.id === userId);
    if (!user) return;
    setGlobalSimulatedUserId(userId);
    addSimulationLog(`Вход как: ${user.username} (${user.id})`);
  }

  function simulateLogout() {
    const username = users.find((u) => u.id === simulatedUserId)?.username || "Unknown";
    addSimulationLog(`Выход из режима: ${username}`);
    setGlobalSimulatedUserId(null);
  }

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { router.push("/login"); return; }
      const hardcoded = ADMIN_IDS.includes(session.user.id);
      let dbAdmin = false;
      try {
        const { data } = await supabase.rpc("is_admin");
        dbAdmin = !!data;
      } catch {}
      if (hardcoded || dbAdmin) {
        setIsAdmin(true);
        await loadAll();
      }
      setLoading(false);
    }
    init();
  }, [supabase, router]);

  async function loadAll() {
    const { data: anime } = await supabase.from("anime").select("*, anime_seasons(*)").order("id", { ascending: false });
    if (anime) setAnimeList(anime);

    const { data: profiles } = await supabase.from("profiles").select("id, username, created_at").order("created_at", { ascending: false });
    if (profiles) setUsers(profiles);

    const { data: adminsData } = await supabase.from("admins").select("user_id");
    if (adminsData) setAdmins(adminsData.map((a) => a.user_id));

    const { data: bansData } = await supabase.from("bans").select("id, username, email, ip, reason, expires_at").order("created_at", { ascending: false });
    if (bansData) setBans(bansData);
    const { data: mutesData } = await supabase.from("mutes").select("id, username, email, ip, reason, expires_at").order("created_at", { ascending: false });
    if (mutesData) setMutes(mutesData);

    const { data: r } = await supabase
      .from("ratings")
      .select("*, profiles:user_id(username), anime:anime_id(title)")
      .order("id", { ascending: false })
      .limit(200);
    if (r) setRatings(r as unknown as RatingRow[]);

    const { data: sugg } = await supabase
      .from("anime_suggestions")
      .select("*, profiles:user_id(username)")
      .order("created_at", { ascending: false })
      .limit(100);
    if (sugg) setSuggestions(sugg as unknown as SuggestionRow[]);
  }

  // Функция для генерации slug из названия
  function generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9а-я\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  function toggleGenre(genre: string, list: string[], setter: (v: string[]) => void) {
    setter(list.includes(genre) ? list.filter((g) => g !== genre) : [...list, genre]);
  }

  async function handleAddAnime() {
    if (!newTitle.trim()) return;
    setAddingAnime(true);
    const slug = newSlug.trim() || generateSlug(newTitle.trim());
    const { data: anime } = await supabase.from("anime").insert({
      title: newTitle.trim(),
      slug: slug,
      image_url: newPosterUrl || "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400&q=80",
      genres: newGenres,
      season_info: newSeason,
      age_rating: newAgeRating,
      status: newStatus,
    }).select().single();

    if (anime) {
      for (let i = 0; i < seasons.length; i++) {
        const s = seasons[i];
        await supabase.from("anime_seasons").insert({
          anime_id: anime.id,
          season_number: i + 1,
          episodes_count: s.episodes,
          note: s.note || "",
        });
      }
    }
    setNewTitle(""); setNewSlug(""); setNewGenres([]); setNewPosterUrl(""); setNewStatus("announced"); setSeasons([{ number: 1, episodes: 12, note: "" }]);
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
    setEditSlug(a.slug || "");
    setEditPosterUrl(a.image_url);
    setEditGenres(a.genres || []);
    setEditSeason(a.season_info);
    setEditAgeRating(a.age_rating);
    setEditStatus(a.status || "announced");
    setEditSeasons((a.anime_seasons || []).map((s) => ({
      id: s.id,
      number: s.season_number,
      episodes: s.episodes_count,
      note: s.note || "",
    })));
  }

  async function saveEditAnime() {
    if (editingAnime === null) return;
    const slug = editSlug.trim() || generateSlug(editTitle.trim());
    await supabase.from("anime").update({
      title: editTitle,
      slug: slug,
      image_url: editPosterUrl,
      genres: editGenres,
      season_info: editSeason,
      age_rating: editAgeRating,
      status: editStatus,
    }).eq("id", editingAnime);

    const original = animeList.find((a) => a.id === editingAnime)?.anime_seasons || [];
    const keptIds = editSeasons.filter((s) => s.id).map((s) => s.id as number);
    const toDelete = original.filter((s) => !keptIds.includes(s.id)).map((s) => s.id);
    if (toDelete.length > 0) {
      await supabase.from("episode_progress").delete().in("season_id", toDelete);
      await supabase.from("anime_seasons").delete().in("id", toDelete);
    }
    for (let i = 0; i < editSeasons.length; i++) {
      const s = editSeasons[i];
      if (s.id) {
        await supabase.from("anime_seasons").update({
          season_number: i + 1,
          episodes_count: s.episodes,
          note: s.note || "",
        }).eq("id", s.id);
      } else {
        await supabase.from("anime_seasons").insert({
          anime_id: editingAnime,
          season_number: i + 1,
          episodes_count: s.episodes,
          note: s.note || "",
        });
      }
    }
    setEditingAnime(null);
    await loadAll();
  }

  function startEditSuggestion(s: SuggestionRow) {
    setEditingSuggestion(s.id);
    setEditSuggTitle(s.title);
    setEditSuggGenres(s.genres || []);
    setEditSuggSeason(s.season_info);
    setEditSuggAgeRating(s.age_rating);
    setEditSuggImageUrl(s.image_url);
    setEditSuggLink(s.link || "");
    setEditSuggComment(s.comment || "");
    setEditSuggSeasons(Array.isArray(s.seasons) ? s.seasons.map((x) => ({
      number: x.number,
      episodes: x.episodes,
      note: x.note || "",
    })) : []);
  }

  async function saveSuggestionEdits() {
    if (editingSuggestion === null) return;
    await supabase.from("anime_suggestions").update({
      title: editSuggTitle,
      genres: editSuggGenres,
      season_info: editSuggSeason,
      age_rating: editSuggAgeRating,
      image_url: editSuggImageUrl,
      link: editSuggLink,
      comment: editSuggComment,
      seasons: editSuggSeasons,
      status: "in_review",
    }).eq("id", editingSuggestion);
    setEditingSuggestion(null);
    await loadAll();
  }

  async function handleApproveSuggestion(id: number) {
    if (!confirm("Одобрить заявку? Будет создано аниме с указанными сезонами.")) return;
    const { data, error } = await supabase.rpc("approve_suggestion", { sugg_id: id });
    if (error) {
      alert("Ошибка: " + error.message);
    } else if (data) {
      await loadAll();
      setTab("anime-list");
    }
  }

  async function handleRejectSuggestion(id: number) {
    if (!confirm("Отклонить заявку?")) return;
    await supabase.rpc("reject_suggestion", { sugg_id: id });
    await loadAll();
  }

  async function handleDeleteSuggestion(id: number) {
    if (!confirm("Удалить заявку безвозвратно?")) return;
    const { error } = await supabase.from("anime_suggestions").delete().eq("id", id);
    if (error) { alert("Не удалось удалить: " + error.message); return; }
    await loadAll();
  }

  async function handleGrantAdmin() {
    const id = newAdminId.trim();
    if (!id) return;
    const { error } = await supabase.from("admins").insert({ user_id: id });
    if (error) { alert("Ошибка: " + error.message); return; }
    setNewAdminId("");
    await loadAll();
  }

  async function handleRevokeAdmin(adminId: string) {
    if (!confirm("Снять админку?")) return;
    await supabase.from("admins").delete().eq("user_id", adminId);
    await loadAll();
  }

  async function handleAddBan() {
    const expires_at = banInput.days ? new Date(Date.now() + Number(banInput.days) * 86400000).toISOString() : null;
    const { error } = await supabase.from("bans").insert({ username: banInput.username || null, email: banInput.email || null, ip: banInput.ip || null, reason: banInput.reason, expires_at });
    if (error) { alert(error.message); return; }
    setBanInput({ username: "", email: "", ip: "", reason: "", days: "" });
    await loadAll();
  }
  async function handleRemoveBan(id: number) {
    await supabase.from("bans").delete().eq("id", id);
    await loadAll();
  }
  async function handleAddMute() {
    const expires_at = muteInput.days ? new Date(Date.now() + Number(muteInput.days) * 86400000).toISOString() : null;
    const { error } = await supabase.from("mutes").insert({ username: muteInput.username || null, email: muteInput.email || null, ip: muteInput.ip || null, reason: muteInput.reason, expires_at });
    if (error) { alert(error.message); return; }
    setMuteInput({ username: "", email: "", ip: "", reason: "", days: "" });
    await loadAll();
  }
  async function handleRemoveMute(id: number) {
    await supabase.from("mutes").delete().eq("id", id);
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
    ["suggestions", "Предложения", "fa-lightbulb"],
    ["users", "Пользователи", "fa-users"],
    ["ratings", "Рейтинги", "fa-star"],
    ["bans", "Баны / Муты", "fa-ban"],
  ];

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <i className="fa-solid fa-shield text-sky-400 text-lg"></i>
        <h1 className="text-lg font-bold text-white">Панель администратора</h1>
        <div className="ml-auto">
          <button onClick={() => setShowSimulation(!showSimulation)}
            className="text-[10px] font-bold text-gray-400 hover:text-amber-400 px-3 py-1.5 rounded border border-[#222226] hover:border-amber-400/30 transition-all">
            <i className="fa-solid fa-user-secret mr-1"></i> {showSimulation ? "Скрыть симуляцию" : "Симуляция пользователя"}
          </button>
        </div>
      </div>

      {showSimulation && (
        <div className="bg-[#1a1a1e] border border-amber-500/20 rounded-xl p-4 mb-6 space-y-3">
          <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider">Симуляция входа</h3>
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="text-[10px] text-gray-500 block mb-1">Выберите пользователя</label>
              <select value={simulatedUserId || ""} onChange={(e) => e.target.value ? simulateLogin(e.target.value) : simulateLogout()}
                className="w-full bg-[#121214] border border-[#222226] rounded px-2 py-1.5 text-xs text-white outline-none focus:border-amber-500/50">
                <option value="">Не выбран (режим админа)</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.username} {ADMIN_IDS.includes(u.id) ? "(Админ)" : ""}</option>)}
              </select>
            </div>
            {simulatedUserId && (
              <button onClick={simulateLogout}
                className="bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[10px] font-bold px-3 py-1.5 rounded border border-red-500/20 transition-all">
                Выход
              </button>
            )}
          </div>

          {simulationLogs.length > 0 && (
            <div className="bg-[#121214] border border-[#222226] rounded-lg p-3">
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Логи</div>
              <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar">
                {simulationLogs.map((log, i) => (
                  <div key={i} className="flex gap-2 text-[10px]">
                    <span className="text-gray-500 font-mono">{log.time}</span>
                    <span className="text-gray-300">{log.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

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
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">
                  Slug (адресная строка) <span className="text-gray-600 font-normal">— если пусто, сгенерируется из названия</span>
                </label>
                <input value={newSlug} onChange={(e) => setNewSlug(e.target.value)} placeholder="naprimer-takoy-slug"
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
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Статус</label>
                  <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)}
                    className="bg-[#121214] border border-[#222226] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-sky-500/50 transition-colors">
                    {ANIME_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
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

          <SeasonEditor seasons={seasons} onChange={setSeasons} />

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
                      <input value={editSlug} onChange={(e) => setEditSlug(e.target.value)} placeholder="slug (адресная строка)"
                        className="w-full bg-[#121214] border border-[#222226] rounded px-2 py-1 text-xs text-white outline-none focus:border-sky-500/50" />
                      <input value={editSeason} onChange={(e) => setEditSeason(e.target.value)} placeholder="Сезон"
                        className="w-full bg-[#121214] border border-[#222226] rounded px-2 py-1 text-xs text-white outline-none focus:border-sky-500/50" />
                      <select value={editAgeRating} onChange={(e) => setEditAgeRating(e.target.value)}
                        className="bg-[#121214] border border-[#222226] rounded px-2 py-1 text-xs text-white outline-none">
                        {AGE_RATINGS.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                      <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)}
                        className="bg-[#121214] border border-[#222226] rounded px-2 py-1 text-xs text-white outline-none">
                        {ANIME_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
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
                  <SeasonEditor seasons={editSeasons} onChange={setEditSeasons} />
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
                    <p className="text-[10px] mt-0.5">
                      {a.status === "ongoing" && <span className="text-emerald-400 font-bold">● Онгоинг</span>}
                      {a.status === "announced" && <span className="text-amber-400 font-bold">● Анонс</span>}
                      {a.status === "finished" && <span className="text-gray-500 font-bold">● Завершено</span>}
                    </p>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button onClick={() => startEditAnime(a)} className="text-[10px] text-gray-400 hover:text-sky-400 px-2 py-1 rounded bg-[#121214] border border-[#222226] transition-all">
                      <i className="fa-solid fa-pen"></i>
                    </button>
                    {(() => {
                      const animeUrl = a.slug ? `/anime/${a.slug}` : `/anime/${a.id}`;
                      return (
                        <button onClick={() => router.push(animeUrl)} className="text-[10px] text-gray-400 hover:text-white px-2 py-1 rounded bg-[#121214] border border-[#222226] transition-all">
                          <i className="fa-solid fa-arrow-up-right-from-square"></i>
                        </button>
                      );
                    })()}
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

      {/* SUGGESTIONS */}
      {tab === "suggestions" && (
        <div className="space-y-3">
          {suggestions.length === 0 && <p className="text-gray-500 text-xs text-center py-8">Заявок нет</p>}
          {suggestions.map((s) => (
            <div key={s.id} className="bg-[#1a1a1e] border border-[#222226] rounded-lg p-3">
              {editingSuggestion === s.id ? (
                <div className="space-y-3">
                  <div className="flex gap-4">
                    <ImageUpload bucket="Anime" currentUrl={editSuggImageUrl} onUploaded={setEditSuggImageUrl} size={80} label="Постер" />
                    <div className="flex-1 space-y-2">
                      <input value={editSuggTitle} onChange={(e) => setEditSuggTitle(e.target.value)}
                        className="w-full bg-[#121214] border border-[#222226] rounded px-2 py-1 text-xs text-white outline-none focus:border-sky-500/50" />
                      <input value={editSuggSeason} onChange={(e) => setEditSuggSeason(e.target.value)} placeholder="Сезон"
                        className="w-full bg-[#121214] border border-[#222226] rounded px-2 py-1 text-xs text-white outline-none focus:border-sky-500/50" />
                      <div className="flex gap-2">
                        <select value={editSuggAgeRating} onChange={(e) => setEditSuggAgeRating(e.target.value)}
                          className="bg-[#121214] border border-[#222226] rounded px-2 py-1 text-xs text-white outline-none">
                          {AGE_RATINGS.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                        <input value={editSuggLink} onChange={(e) => setEditSuggLink(e.target.value)} placeholder="Ссылка на источник https://..."
                          className="flex-1 bg-[#121214] border border-[#222226] rounded px-2 py-1 text-xs text-white outline-none focus:border-sky-500/50" />
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {ALL_GENRES.map((g) => (
                      <button key={g} onClick={() => toggleGenre(g, editSuggGenres, setEditSuggGenres)}
                        className={`text-[9px] font-bold px-2 py-0.5 rounded border transition-all ${
                          editSuggGenres.includes(g) ? "bg-sky-500/20 text-sky-400 border-sky-500/30" : "bg-[#121214] text-gray-500 border-[#222226]"
                        }`}>{g}</button>
                    ))}
                  </div>
                  <textarea value={editSuggComment} onChange={(e) => setEditSuggComment(e.target.value)} rows={2}
                    className="w-full bg-[#121214] border border-[#222226] rounded px-2 py-1 text-xs text-white outline-none focus:border-sky-500/50 resize-none" />
                  <SeasonEditor seasons={editSuggSeasons} onChange={setEditSuggSeasons} />
                  <div className="flex gap-2">
                    <button onClick={saveSuggestionEdits} className="bg-sky-500 hover:bg-sky-600 text-white text-[10px] font-bold px-3 py-1.5 rounded transition-all">Сохранить правки</button>
                    <button onClick={() => setEditingSuggestion(null)} className="bg-[#121214] text-gray-400 text-[10px] font-bold px-3 py-1.5 rounded border border-[#222226] hover:text-white transition-all">Отмена</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="w-12 h-16 rounded overflow-hidden bg-[#121214] flex-shrink-0 relative">
                    {s.image_url ? <Image src={s.image_url} alt={s.title} fill className="object-cover" sizes="48px" /> : (
                      <div className="w-full h-full flex items-center justify-center text-gray-600"><i className="fa-solid fa-image text-sm"></i></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-white truncate">{s.title}</p>
                    <p className="text-[10px] text-gray-500">
                      {s.season_info} &middot; {s.age_rating} &middot; {(s.genres || []).slice(0, 3).join(", ")}
                    </p>
                    <p className="text-[10px] text-gray-600 truncate">
                      {s.profiles?.[0]?.username || "Неизвестный"} &middot; {new Date(s.created_at).toLocaleDateString("ru-RU")}
                      {s.link && <> &middot; <a href={s.link} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:text-sky-300" onClick={(e) => e.stopPropagation()}>источник</a></>}
                    </p>
                    <p className="text-[10px] mt-1">
                      {s.status === "new" && <span className="text-sky-400 font-bold">● Новая</span>}
                      {s.status === "pending" && <span className="text-gray-400 font-bold">● Ожидает</span>}
                      {s.status === "in_review" && <span className="text-amber-400 font-bold">● На проверке</span>}
                      {s.status === "accepted" && <span className="text-emerald-400 font-bold">● Одобрена</span>}
                      {s.status === "rejected" && <span className="text-red-400 font-bold">● Отклонена</span>}
                    </p>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    {s.status !== "accepted" && s.status !== "rejected" && (
                      <>
                        <button onClick={() => handleApproveSuggestion(s.id)} title="Одобрить (создать аниме)"
                          className="text-[10px] text-emerald-400 hover:text-emerald-300 px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 transition-all">
                          <i className="fa-solid fa-check"></i>
                        </button>
                        <button onClick={() => handleRejectSuggestion(s.id)} title="Отклонить"
                          className="text-[10px] text-red-400 hover:text-red-300 px-2 py-1 rounded bg-red-500/10 border border-red-500/20 transition-all">
                          <i className="fa-solid fa-xmark"></i>
                        </button>
                        <button onClick={() => startEditSuggestion(s)} title="Редактировать"
                          className="text-[10px] text-gray-400 hover:text-sky-400 px-2 py-1 rounded bg-[#121214] border border-[#222226] transition-all">
                          <i className="fa-solid fa-pen"></i>
                        </button>
                      </>
                    )}
                    <button onClick={() => handleDeleteSuggestion(s.id)} title="Удалить заявку"
                      className="text-[10px] text-gray-400 hover:text-red-400 px-2 py-1 rounded bg-[#121214] border border-[#222226] transition-all">
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
        <div className="space-y-4">
          <div className="bg-[#1a1a1e] border border-[#222226] rounded-xl p-4">
            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Выдать админку</h4>
            <div className="flex gap-2">
              <select value={newAdminId} onChange={(e) => setNewAdminId(e.target.value)}
                className="flex-1 bg-[#121214] border border-[#222226] rounded px-2 py-1.5 text-xs text-white outline-none focus:border-sky-500/50">
                <option value="">Выберите пользователя</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.username} {admins.includes(u.id) || ADMIN_IDS.includes(u.id) ? "(Админ)" : ""}</option>)}
              </select>
              <button onClick={handleGrantAdmin} disabled={!newAdminId}
                className="bg-amber-500 hover:bg-amber-600 disabled:opacity-30 text-white text-xs font-bold px-4 py-1.5 rounded transition-all">Выдать</button>
            </div>
            <div className="flex gap-2 mt-2">
              <input value={newAdminId} onChange={(e) => setNewAdminId(e.target.value)} placeholder="или вставьте UUID"
                className="flex-1 bg-[#121214] border border-[#222226] rounded px-2 py-1.5 text-xs text-white outline-none focus:border-sky-500/50" />
            </div>
            {admins.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {admins.map((aid) => {
                  const u = users.find((x) => x.id === aid);
                  return (
                    <span key={aid} className="inline-flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold px-2 py-1 rounded">
                      {u?.username || aid.slice(0, 8)}
                      <button onClick={() => handleRevokeAdmin(aid)} className="hover:text-red-400"><i className="fa-solid fa-xmark text-[9px]"></i></button>
                    </span>
                  );
                })}
              </div>
            )}
          </div>
          <div className="space-y-2">
            {users.length === 0 && <p className="text-gray-500 text-xs text-center py-8">Нет пользователей</p>}
            {users.map((u) => {
              const isAdmin = admins.includes(u.id) || ADMIN_IDS.includes(u.id);
              return (
                <div key={u.id} className="bg-[#1a1a1e] border border-[#222226] rounded-lg p-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-sky-400 to-blue-600 flex items-center justify-center text-white text-xs font-black flex-shrink-0">
                    {u.username.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-white truncate">{u.username}</p>
                    <p className="text-[10px] text-gray-500">{u.id}</p>
                  </div>
                  {isAdmin ? (
                    <span className="text-[9px] font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">Админ</span>
                  ) : (
                    <button onClick={() => { setNewAdminId(u.id); }} className="text-[10px] text-sky-400 hover:text-sky-300 border border-sky-500/20 px-2 py-0.5 rounded">Выдать</button>
                  )}
                </div>
              );
            })}
          </div>
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

      {tab === "bans" && (
        <div className="space-y-6">
          <div className="bg-[#1a1a1e] border border-[#222226] rounded-xl p-4">
            <h4 className="text-[10px] font-bold text-red-400 uppercase tracking-wider mb-3"><i className="fa-solid fa-ban mr-1"></i> Бан на сайте</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
              <input value={banInput.username} onChange={(e) => setBanInput({ ...banInput, username: e.target.value })} placeholder="Ник"
                className="bg-[#121214] border border-[#222226] rounded px-2 py-1.5 text-xs text-white outline-none focus:border-red-500/50" />
              <input value={banInput.email} onChange={(e) => setBanInput({ ...banInput, email: e.target.value })} placeholder="Почта"
                className="bg-[#121214] border border-[#222226] rounded px-2 py-1.5 text-xs text-white outline-none focus:border-red-500/50" />
              <input value={banInput.ip} onChange={(e) => setBanInput({ ...banInput, ip: e.target.value })} placeholder="IP"
                className="bg-[#121214] border border-[#222226] rounded px-2 py-1.5 text-xs text-white outline-none focus:border-red-500/50" />
              <input value={banInput.days} onChange={(e) => setBanInput({ ...banInput, days: e.target.value })} placeholder="Дней (пусто=навсегда)" type="number" min={1}
                className="bg-[#121214] border border-[#222226] rounded px-2 py-1.5 text-xs text-white outline-none focus:border-red-500/50" />
            </div>
            <input value={banInput.reason} onChange={(e) => setBanInput({ ...banInput, reason: e.target.value })} placeholder="Причина"
              className="w-full bg-[#121214] border border-[#222226] rounded px-2 py-1.5 text-xs text-white outline-none focus:border-red-500/50 mb-3" />
            <button onClick={handleAddBan} className="bg-red-500 hover:bg-red-600 text-white text-xs font-bold px-4 py-1.5 rounded transition-all">Забанить</button>
            <div className="space-y-1.5 mt-4">
              {bans.map((b) => (
                <div key={b.id} className="bg-[#121214] border border-[#222226] rounded px-3 py-2 flex items-center gap-3 text-xs">
                  <span className="text-white flex-1 truncate">{[b.username, b.email, b.ip].filter(Boolean).join(" / ") || "—"} </span>
                  <span className="text-gray-500 truncate">{b.reason || ""}</span>
                  <span className="text-[10px] text-gray-600">{b.expires_at ? new Date(b.expires_at).toLocaleDateString("ru-RU") : "навсегда"}</span>
                  <button onClick={() => handleRemoveBan(b.id)} className="text-gray-500 hover:text-green-400"><i className="fa-solid fa-xmark"></i></button>
                </div>
              ))}
              {bans.length === 0 && <p className="text-[11px] text-gray-600 text-center py-2">Бан-лист пуст</p>}
            </div>
          </div>

          <div className="bg-[#1a1a1e] border border-[#222226] rounded-xl p-4">
            <h4 className="text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-3"><i className="fa-solid fa-comment-slash mr-1"></i> Мут комментариев</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
              <input value={muteInput.username} onChange={(e) => setMuteInput({ ...muteInput, username: e.target.value })} placeholder="Ник"
                className="bg-[#121214] border border-[#222226] rounded px-2 py-1.5 text-xs text-white outline-none focus:border-amber-500/50" />
              <input value={muteInput.email} onChange={(e) => setMuteInput({ ...muteInput, email: e.target.value })} placeholder="Почта"
                className="bg-[#121214] border border-[#222226] rounded px-2 py-1.5 text-xs text-white outline-none focus:border-amber-500/50" />
              <input value={muteInput.ip} onChange={(e) => setMuteInput({ ...muteInput, ip: e.target.value })} placeholder="IP"
                className="bg-[#121214] border border-[#222226] rounded px-2 py-1.5 text-xs text-white outline-none focus:border-amber-500/50" />
              <input value={muteInput.days} onChange={(e) => setMuteInput({ ...muteInput, days: e.target.value })} placeholder="Дней (пусто=навсегда)" type="number" min={1}
                className="bg-[#121214] border border-[#222226] rounded px-2 py-1.5 text-xs text-white outline-none focus:border-amber-500/50" />
            </div>
            <input value={muteInput.reason} onChange={(e) => setMuteInput({ ...muteInput, reason: e.target.value })} placeholder="Причина"
              className="w-full bg-[#121214] border border-[#222226] rounded px-2 py-1.5 text-xs text-white outline-none focus:border-amber-500/50 mb-3" />
            <button onClick={handleAddMute} className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-4 py-1.5 rounded transition-all">Замутить</button>
            <div className="space-y-1.5 mt-4">
              {mutes.map((m) => (
                <div key={m.id} className="bg-[#121214] border border-[#222226] rounded px-3 py-2 flex items-center gap-3 text-xs">
                  <span className="text-white flex-1 truncate">{[m.username, m.email, m.ip].filter(Boolean).join(" / ") || "—"}</span>
                  <span className="text-gray-500 truncate">{m.reason || ""}</span>
                  <span className="text-[10px] text-gray-600">{m.expires_at ? new Date(m.expires_at).toLocaleDateString("ru-RU") : "навсегда"}</span>
                  <button onClick={() => handleRemoveMute(m.id)} className="text-gray-500 hover:text-green-400"><i className="fa-solid fa-xmark"></i></button>
                </div>
              ))}
              {mutes.length === 0 && <p className="text-[11px] text-gray-600 text-center py-2">Мут-лист пуст</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}