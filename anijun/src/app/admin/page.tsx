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
import { generateSlug, sanitizeSlugInput } from "@/lib/slug";

interface AnimeRow {
  id: number;
  slug?: string;
  title: string;
  image_url: string;
  genres: string[];
  season_info: string;
  age_rating: string;
  status?: string;
  release_date?: string | null;
  created_at: string;
  anime_seasons?: { id: number; season_number: number; episodes_count: number; note?: string; age_rating?: string }[];
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

type Tab = "add-anime" | "anime-list" | "suggestions" | "users" | "ratings" | "bans" | "tools" | "genres" | "comments";

export default function AdminPage() {
  const router = useRouter();
  const supabase = createClient();

  const [isAdmin, setIsAdmin] = useState(false);
  const [tab, setTab] = useState<Tab>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("anijun_admin_tab") as Tab | null;
      if (saved) return saved;
    }
    return "add-anime";
  });
  const [loading, setLoading] = useState(true);
  useEffect(() => { document.title = "Админ-панель | AniJUN"; }, []);
  useEffect(() => { try { localStorage.setItem("anijun_admin_tab", tab); } catch {} }, [tab]);

  const [newTitle, setNewTitle] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newGenres, setNewGenres] = useState<string[]>([]);
  const [newSeason, setNewSeason] = useState("Зима 2025");
  const [newAgeRating, setNewAgeRating] = useState("16+");
  const [newStatus, setNewStatus] = useState("finished");
  const [newReleaseDate, setNewReleaseDate] = useState("");
  const [newPosterUrl, setNewPosterUrl] = useState("");
  const [seasons, setSeasons] = useState<SeasonDraft[]>([{ number: 1, episodes: 12, note: "" }]);
  const [addingAnime, setAddingAnime] = useState(false);
  const [allGenresAdmin, setAllGenresAdmin] = useState<string[]>(ALL_GENRES);
  const [newGenreAdmin, setNewGenreAdmin] = useState("");

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
  const [editReleaseDate, setEditReleaseDate] = useState("");
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

  const [users, setUsers] = useState<(ProfileRow & { is_verified?: boolean })[]>([]);
  const [admins, setAdmins] = useState<string[]>([]);
  const [newAdminId, setNewAdminId] = useState("");

  const [bans, setBans] = useState<{ id: number; username: string | null; email: string | null; ip: string | null; user_id: string | null; reason: string | null; expires_at: string | null }[]>([]);
  const [mutes, setMutes] = useState<{ id: number; username: string | null; email: string | null; ip: string | null; user_id: string | null; reason: string | null; expires_at: string | null }[]>([]);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [banType, setBanType] = useState<"username" | "email" | "ip" | "uid">("username");
  const [banValue, setBanValue] = useState("");
  const [banReason, setBanReason] = useState("");
  const [banDays, setBanDays] = useState("");
  const [muteType, setMuteType] = useState<"username" | "email" | "ip" | "uid">("username");
  const [muteValue, setMuteValue] = useState("");
  const [muteReason, setMuteReason] = useState("");
  const [muteDays, setMuteDays] = useState("");
  const [userIps, setUserIps] = useState<{ user_id: string; ip: string; user_agent: string | null; last_seen: string }[]>([]);
  const [pendingComments, setPendingComments] = useState<{ id: number; user_id: string; text: string; created_at: string; anime_id: number; ip?: string | null; user_verified?: boolean | null; profiles?: { username: string }[]; anime?: { title: string; slug: string | null } | null }[]>([]);
  const [filterWords, setFilterWords] = useState<{ id: number; word: string }[]>([]);
  const [newFilterWord, setNewFilterWord] = useState("");
  const [checkingLinks, setCheckingLinks] = useState(false);
  const [brokenLinks, setBrokenLinks] = useState<{ id: number; title: string; url: string; slug?: string }[]>([]);

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

    const { data: profiles } = await supabase.from("profiles").select("id, username, created_at, is_verified").order("created_at", { ascending: false });
    if (profiles) setUsers(profiles as (ProfileRow & { is_verified?: boolean })[]);

    const { data: genresData } = await supabase.from("genres").select("name").order("name");
    if (genresData && genresData.length > 0) {
      const dbNames = genresData.map((r) => r.name);
      setAllGenresAdmin([...new Set([...ALL_GENRES, ...dbNames])]);
    }

    const { data: adminsData } = await supabase.from("admins").select("user_id");
    if (adminsData) setAdmins(adminsData.map((a) => a.user_id));

    const { data: bansData } = await supabase.from("bans").select("id, username, email, ip, user_id, reason, expires_at").order("created_at", { ascending: false });
    if (bansData) setBans(bansData);
    const { data: mutesData } = await supabase.from("mutes").select("id, username, email, ip, user_id, reason, expires_at").order("created_at", { ascending: false });
    if (mutesData) setMutes(mutesData);
    const { data: ipsData } = await supabase.from("user_ips").select("user_id, ip, user_agent, last_seen").order("last_seen", { ascending: false }).limit(100);
    if (ipsData) setUserIps(ipsData);
    const { data: pendingData } = await supabase.from("comments").select("id, user_id, text, created_at, anime_id, ip, user_verified, profiles:user_id(username), anime:anime_id(title, slug)").eq("status", "pending").order("created_at", { ascending: false }).limit(50);
    if (pendingData) setPendingComments(pendingData as unknown as typeof pendingComments);
    try {
      const { data: filtersData } = await supabase.from("comment_filters").select("id, word").order("created_at", { ascending: false });
      if (filtersData) setFilterWords(filtersData);
    } catch {}

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
      release_date: newStatus === "announced" && newReleaseDate ? newReleaseDate : null,
    }).select().single();

    if (anime) {
      for (let i = 0; i < seasons.length; i++) {
        const s = seasons[i];
        await supabase.from("anime_seasons").insert({
          anime_id: anime.id,
          season_number: i + 1,
          episodes_count: s.episodes,
          note: s.note || "",
          age_rating: s.age_rating || "",
        });
      }
    }
    setNewTitle(""); setNewSlug(""); setNewGenres([]); setNewPosterUrl(""); setNewStatus("finished"); setSeasons([{ number: 1, episodes: 12, note: "" }]);
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
    setEditStatus(a.status || "finished");
    setEditReleaseDate(a.release_date || "");
    setEditSeasons((a.anime_seasons || []).map((s) => ({
      id: s.id,
      number: s.season_number,
      episodes: s.episodes_count,
      note: s.note || "",
      age_rating: s.age_rating || "",
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
      release_date: editStatus === "announced" && editReleaseDate ? editReleaseDate : null,
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
          age_rating: s.age_rating || "",
        }).eq("id", s.id);
      } else {
        await supabase.from("anime_seasons").insert({
          anime_id: editingAnime,
          season_number: i + 1,
          episodes_count: s.episodes,
          note: s.note || "",
          age_rating: s.age_rating || "",
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
    if (!banValue.trim()) { alert("Введите значение"); return; }
    const expires_at = banDays ? new Date(Date.now() + Number(banDays) * 86400000).toISOString() : null;
    const payload: Record<string, unknown> = { reason: banReason, expires_at };
    if (banType === "username") payload.username = banValue.trim();
    else if (banType === "email") payload.email = banValue.trim();
    else if (banType === "ip") payload.ip = banValue.trim();
    else if (banType === "uid") payload.user_id = banValue.trim();
    const { error } = await supabase.from("bans").insert(payload);
    if (error) { alert(error.message); return; }
    setBanValue(""); setBanReason(""); setBanDays("");
    await loadAll();
  }
  async function handleRemoveBan(id: number) {
    await supabase.from("bans").delete().eq("id", id);
    await loadAll();
  }
  async function handleAddMute() {
    if (!muteValue.trim()) { alert("Введите значение"); return; }
    const expires_at = muteDays ? new Date(Date.now() + Number(muteDays) * 86400000).toISOString() : null;
    const payload: Record<string, unknown> = { reason: muteReason, expires_at };
    if (muteType === "username") payload.username = muteValue.trim();
    else if (muteType === "email") payload.email = muteValue.trim();
    else if (muteType === "ip") payload.ip = muteValue.trim();
    else if (muteType === "uid") payload.user_id = muteValue.trim();
    const { error } = await supabase.from("mutes").insert(payload);
    if (error) { alert(error.message); return; }
    setMuteValue(""); setMuteReason(""); setMuteDays("");
    await loadAll();
  }
  async function handleRemoveMute(id: number) {
    await supabase.from("mutes").delete().eq("id", id);
    await loadAll();
  }

  async function handleApproveComment(id: number) {
    const { error } = await supabase.from("comments").update({ status: "approved" }).eq("id", id);
    if (error) { alert("Ошибка: " + error.message); return; }
    setPendingComments((prev) => prev.filter((c) => c.id !== id));
    await loadAll();
  }
  async function handleRejectComment(id: number) {
    const { error } = await supabase.from("comments").update({ status: "rejected" }).eq("id", id);
    if (error) { alert("Ошибка: " + error.message); return; }
    setPendingComments((prev) => prev.filter((c) => c.id !== id));
    await loadAll();
  }
  async function handleAddFilterWord() {
    const w = newFilterWord.trim();
    if (!w) return;
    const { error } = await supabase.from("comment_filters").insert({ word: w });
    if (error) { alert(error.message); return; }
    setNewFilterWord("");
    const { data } = await supabase.from("comment_filters").select("id, word").order("created_at", { ascending: false });
    if (data) setFilterWords(data);
  }
  async function handleRemoveFilterWord(id: number) {
    await supabase.from("comment_filters").delete().eq("id", id);
    setFilterWords((prev) => prev.filter((x) => x.id !== id));
  }

  async function handleAddGenreAdmin() {
    const name = newGenreAdmin.trim();
    if (!name || allGenresAdmin.includes(name)) return;
    const { error } = await supabase.from("genres").insert({ name });
    if (error) { alert(error.message); return; }
    setAllGenresAdmin((prev) => [...prev, name]);
    setNewGenres((prev) => [...prev, name]);
    setNewGenreAdmin("");
  }

  async function handleDeleteGenreAdmin(name: string) {
    if (!confirm(`Удалить жанр "${name}"?`)) return;
    const { error } = await supabase.from("genres").delete().eq("name", name);
    if (error) { alert(error.message); return; }
    setAllGenresAdmin((prev) => prev.filter((g) => g !== name));
    setNewGenres((prev) => prev.filter((g) => g !== name));
    setEditGenres((prev) => prev.filter((g) => g !== name));
    setEditSuggGenres((prev) => prev.filter((g) => g !== name));
  }

  async function handleCheckLinks() {
    setCheckingLinks(true);
    setBrokenLinks([]);
    const broken: { id: number; title: string; url: string; slug?: string }[] = [];
    for (const a of animeList) {
      const url = `${window.location.origin}/anime/${a.slug || a.id}`;
      try {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 7000);
        const res = await fetch(url, { method: "HEAD", signal: controller.signal });
        clearTimeout(t);
        if (!res.ok) broken.push({ id: a.id, title: a.title, url, slug: a.slug });
      } catch {
        broken.push({ id: a.id, title: a.title, url, slug: a.slug });
      }
    }
    setBrokenLinks(broken);
    setCheckingLinks(false);
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
    ["tools", "Инструменты", "fa-screwdriver-wrench"],
    ["genres", "Жанры", "fa-tags"],
    ["comments", "Комментарии", "fa-comments"],
  ];

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <i className="fa-solid fa-shield text-sky-400 text-lg"></i>
        <h1 className="text-base sm:text-lg font-bold text-white">Панель администратора</h1>
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
        <div className="bg-[#1a1a1e] border border-[#222226] rounded-xl p-4 sm:p-6 space-y-4 sm:space-y-5">
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
                <input value={newSlug} onChange={(e) => setNewSlug(sanitizeSlugInput(e.target.value))} placeholder="naprimer-takoy-slug"
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
                    <option value="">Без рейтинга</option>
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
              {newStatus === "announced" && (
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Дата выхода</label>
                  <input type="date" value={newReleaseDate} onChange={(e) => setNewReleaseDate(e.target.value)} className="w-full bg-[#121214] border border-[#222226] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-sky-500/50" />
                </div>
              )}

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
              {allGenresAdmin.map((g) => (
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
                      <input value={editSlug} onChange={(e) => setEditSlug(sanitizeSlugInput(e.target.value))} placeholder="slug (адресная строка)"
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
                      {editStatus === "announced" && (
                        <input type="date" value={editReleaseDate} onChange={(e) => setEditReleaseDate(e.target.value)} className="bg-[#121214] border border-[#222226] rounded px-2 py-1 text-xs text-white outline-none" />
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {allGenresAdmin.map((g) => (
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
                    <Image src={a.image_url} alt={a.title} fill unoptimized className="object-cover" sizes="48px" />
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
                    {allGenresAdmin.map((g) => (
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
                    {s.image_url ? <Image src={s.image_url} alt={s.title} fill unoptimized className="object-cover" sizes="48px" /> : (
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
              const expanded = expandedUserId === u.id;
              const ips = userIps.filter((x) => x.user_id === u.id);
              return (
                <div key={u.id} className="bg-[#1a1a1e] border border-[#222226] rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-sky-400 to-blue-600 flex items-center justify-center text-white text-xs font-black flex-shrink-0">
                      {u.username.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-white truncate flex items-center gap-1">{u.username} {u.is_verified && <span className="inline-flex"><span style={{ width: 14, height: 14, display: "inline-flex" }}><svg viewBox="0 0 512 512" width="14" height="14"><g transform="matrix(1.11,0,0,1.11,236,258)"><g><path fill="rgb(48,168,232)" d="M128.29,25.58 C128.29,25.58 106.81,47.06 106.81,47.06 C106.81,47.06 106.81,79.68 106.81,79.68 C106.81,95.62 93.89,108.54 77.95,108.54 C77.95,108.54 45.32,108.54 45.32,108.54 C45.32,108.54 25.57,128.29 25.57,128.29 C11.45,142.42 -11.45,142.42 -25.58,128.29 C-25.58,128.29 -45.33,108.54 -45.33,108.54 C-45.33,108.54 -79.87,108.54 -79.87,108.54 C-95.81,108.54 -108.73,95.62 -108.73,79.68 C-108.73,79.68 -108.73,45.54 -108.73,45.54 C-108.73,45.41 -108.73,45.28 -108.72,45.15 C-108.72,45.15 -128.29,25.58 -128.29,25.58 C-142.42,11.45 -142.42,-11.45 -128.29,-25.57 C-128.29,-25.57 -108.73,-45.13 -108.73,-45.13 C-108.73,-45.13 -108.73,-78.56 -108.73,-78.56 C-108.73,-94.5 -95.81,-107.42 -79.87,-107.42 C-79.87,-107.42 -46.45,-107.42 -46.45,-107.42 C-46.45,-107.42 -25.58,-128.29 -25.58,-128.29 C-11.45,-142.42 11.45,-142.42 25.57,-128.29 C25.57,-128.29 46.44,-107.42 46.44,-107.42 C46.44,-107.42 77.95,-107.42 77.95,-107.42 C93.89,-107.42 106.81,-94.5 106.81,-78.56 C106.81,-78.56 106.81,-47.05 106.81,-47.05 C106.81,-47.05 128.29,-25.57 128.29,-25.57 C142.42,-11.45 142.42,11.45 128.29,25.58 Z"/></g></g><g transform="matrix(1.09,0,0,1.09,236,258)"><g><path fill="rgb(255,255,255)" d="M63.61,-26.62 C63.61,-26.62 -8.29,45.27 -8.29,45.27 C-13.19,50.16 -21.15,50.16 -26.06,45.27 C-26.06,45.27 -26.93,44.4 -26.93,44.4 C-26.93,44.4 -63.6,7.72 -63.6,7.72 C-68.51,2.81 -68.51,-5.14 -63.6,-10.05 C-61.15,-12.51 -57.94,-13.73 -54.72,-13.73 C-51.5,-13.73 -48.28,-12.51 -45.83,-10.05 C-45.83,-10.05 -18.04,17.74 -18.04,17.74 C-18.04,17.74 44.97,-45.26 44.97,-45.26 C49.87,-50.17 57.83,-50.17 62.73,-45.26 C62.73,-45.26 63.61,-44.39 63.61,-44.39 C68.51,-39.49 68.51,-31.53 63.61,-26.62 Z"/></g></g></svg></span></span>}</p>
                      <p className="text-[10px] text-gray-500">{u.id}</p>
                    </div>
                    <button onClick={async () => { const { error } = await supabase.from("profiles").update({ is_verified: !u.is_verified }).eq("id", u.id); if (!error) await loadAll(); }} className={`text-[9px] font-bold px-2 py-0.5 rounded border ${u.is_verified ? "bg-sky-500/20 text-sky-400 border-sky-500/30" : "bg-[#121214] text-gray-500 border-[#222226]"}`} title="Верификация"><i className="fa-solid fa-circle-check mr-1"></i>{u.is_verified ? "Снять" : "Вериф"}</button>
                    <button onClick={() => setExpandedUserId(expanded ? null : u.id)}
                      className="text-[10px] text-gray-400 hover:text-white border border-[#222226] px-2 py-1 rounded">
                      <i className={`fa-solid ${expanded ? "fa-chevron-up" : "fa-chevron-down"} mr-1`}></i>{expanded ? "Скрыть" : "Подробнее"}
                    </button>
                    {isAdmin ? (
                      <span className="text-[9px] font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">Админ</span>
                    ) : (
                      <button onClick={() => { setNewAdminId(u.id); }} className="text-[10px] text-sky-400 hover:text-sky-300 border border-sky-500/20 px-2 py-0.5 rounded">Выдать</button>
                    )}
                  </div>
                  {expanded && (
                    <div className="mt-3 pt-3 border-t border-[#222226] space-y-2">
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider"><i className="fa-solid fa-network-wired mr-1"></i>IP пользователя</p>
                      {ips.length === 0 ? (
                        <p className="text-[11px] text-gray-600">IP пока нет — появится после захода</p>
                      ) : (
                        ips.map((ip) => (
                          <div key={`${ip.user_id}-${ip.ip}`} className="bg-[#121214] border border-[#222226] rounded px-3 py-2 flex items-center gap-3 text-xs">
                            <span className="text-sky-400 font-mono text-[11px]">{ip.ip}</span>
                            <span className="text-[10px] text-gray-600 hidden sm:inline truncate flex-1" title={ip.user_agent || ""}>{ip.user_agent?.slice(0, 40) || ""}</span>
                            <span className="text-[10px] text-gray-600">{new Date(ip.last_seen).toLocaleString("ru-RU")}</span>
                            <button onClick={() => { setTab("bans"); setBanType("ip"); setBanValue(ip.ip); }} className="text-[10px] text-red-400 hover:text-red-300 border border-red-500/20 px-1.5 py-0.5 rounded">Бан</button>
                            <button onClick={() => { setTab("bans"); setMuteType("ip"); setMuteValue(ip.ip); }} className="text-[10px] text-amber-400 hover:text-amber-300 border border-amber-500/20 px-1.5 py-0.5 rounded">Мут</button>
                          </div>
                        ))
                      )}
                    </div>
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
            <div className="flex flex-wrap gap-2 mb-3">
              <select value={banType} onChange={(e) => setBanType(e.target.value as typeof banType)}
                className="bg-[#121214] border border-[#222226] rounded px-2 py-1.5 text-xs text-white outline-none">
                <option value="username">По нику</option>
                <option value="email">По почте</option>
                <option value="ip">По IP</option>
                <option value="uid">По UID</option>
              </select>
              <input value={banValue} onChange={(e) => setBanValue(e.target.value)} placeholder={banType === "username" ? "Ник" : banType === "email" ? "Почта" : banType === "ip" ? "IP" : "UID"}
                className="flex-1 min-w-[160px] bg-[#121214] border border-[#222226] rounded px-2 py-1.5 text-xs text-white outline-none focus:border-red-500/50" />
              <input value={banDays} onChange={(e) => setBanDays(e.target.value)} placeholder="Дней (пусто=навсегда)" type="number" min={1}
                className="w-24 bg-[#121214] border border-[#222226] rounded px-2 py-1.5 text-xs text-white outline-none focus:border-red-500/50" />
            </div>
            <input value={banReason} onChange={(e) => setBanReason(e.target.value)} placeholder="Причина"
              className="w-full bg-[#121214] border border-[#222226] rounded px-2 py-1.5 text-xs text-white outline-none focus:border-red-500/50 mb-3" />
            <button onClick={handleAddBan} className="bg-red-500 hover:bg-red-600 text-white text-xs font-bold px-4 py-1.5 rounded transition-all">Забанить</button>
            <div className="space-y-1.5 mt-4">
              {bans.map((b) => (
                <div key={b.id} className="bg-[#121214] border border-[#222226] rounded px-3 py-2 flex items-center gap-3 text-xs">
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${b.user_id ? "bg-sky-500/20 text-sky-400" : b.ip ? "bg-amber-500/20 text-amber-400" : b.email ? "bg-emerald-500/20 text-emerald-400" : "bg-purple-500/20 text-purple-400"}`}>{b.user_id ? "UID" : b.ip ? "IP" : b.email ? "Почта" : "Ник"}</span>
                  <span className="text-white flex-1 truncate">{b.user_id || b.username || b.email || b.ip || "—"} </span>
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
            <div className="flex flex-wrap gap-2 mb-3">
              <select value={muteType} onChange={(e) => setMuteType(e.target.value as typeof muteType)}
                className="bg-[#121214] border border-[#222226] rounded px-2 py-1.5 text-xs text-white outline-none">
                <option value="username">По нику</option>
                <option value="email">По почте</option>
                <option value="ip">По IP</option>
                <option value="uid">По UID</option>
              </select>
              <input value={muteValue} onChange={(e) => setMuteValue(e.target.value)} placeholder={muteType === "username" ? "Ник" : muteType === "email" ? "Почта" : muteType === "ip" ? "IP" : "UID"}
                className="flex-1 min-w-[160px] bg-[#121214] border border-[#222226] rounded px-2 py-1.5 text-xs text-white outline-none focus:border-amber-500/50" />
              <input value={muteDays} onChange={(e) => setMuteDays(e.target.value)} placeholder="Дней (пусто=навсегда)" type="number" min={1}
                className="w-24 bg-[#121214] border border-[#222226] rounded px-2 py-1.5 text-xs text-white outline-none focus:border-amber-500/50" />
            </div>
            <input value={muteReason} onChange={(e) => setMuteReason(e.target.value)} placeholder="Причина"
              className="w-full bg-[#121214] border border-[#222226] rounded px-2 py-1.5 text-xs text-white outline-none focus:border-amber-500/50 mb-3" />
            <button onClick={handleAddMute} className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-4 py-1.5 rounded transition-all">Замутить</button>
            <div className="space-y-1.5 mt-4">
              {mutes.map((m) => (
                <div key={m.id} className="bg-[#121214] border border-[#222226] rounded px-3 py-2 flex items-center gap-3 text-xs">
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${m.user_id ? "bg-sky-500/20 text-sky-400" : m.ip ? "bg-amber-500/20 text-amber-400" : m.email ? "bg-emerald-500/20 text-emerald-400" : "bg-purple-500/20 text-purple-400"}`}>{m.user_id ? "UID" : m.ip ? "IP" : m.email ? "Почта" : "Ник"}</span>
                  <span className="text-white flex-1 truncate">{m.user_id || m.username || m.email || m.ip || "—"}</span>
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

      {tab === "comments" && (
        <div className="space-y-4">
          <div className="bg-[#1a1a1e] border border-[#222226] rounded-xl p-4">
            <h4 className="text-[10px] font-bold text-sky-400 uppercase tracking-wider mb-3"><i className="fa-solid fa-comments mr-1"></i> Комментарии на проверку</h4>
            <div className="space-y-2">
              {pendingComments.length === 0 && <p className="text-[11px] text-gray-600 text-center py-4">На проверке пусто</p>}
              {pendingComments.map((c) => (
                <div key={c.id} className="bg-[#121214] border border-[#222226] rounded-lg p-3 flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-xs flex-wrap">
                    <span className="font-bold text-white">{c.profiles?.[0]?.username || c.user_id.slice(0, 8)}</span>
                    <span className="text-[10px] text-gray-500 font-mono">{c.user_id}</span>
                    {c.user_verified ? <span className="text-[9px] bg-sky-500/20 text-sky-400 px-1.5 py-0.5 rounded">вериф</span> : <span className="text-[9px] bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded">не вериф</span>}
                    {c.ip && <span className="text-[10px] text-amber-400 font-mono">IP: {c.ip}</span>}
                    <span className="text-[10px] text-gray-600 ml-auto">{new Date(c.created_at).toLocaleString("ru-RU")}</span>
                    <a href={`/anime/${c.anime?.slug || c.anime_id}`} target="_blank" className="text-sky-400 hover:text-sky-300 text-[10px] truncate max-w-[160px]">{c.anime?.title || `Аниме #${c.anime_id}`}</a>
                  </div>
                  <p className="text-xs text-gray-300 bg-[#1a1a1e] rounded p-2 border border-[#222226]/50 whitespace-pre-wrap break-words">{c.text}</p>
                  <div className="flex gap-2">
                    <button onClick={() => handleApproveComment(c.id)} className="flex-1 bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/20 text-xs font-bold py-1.5 rounded">Одобрить</button>
                    <button onClick={() => handleRejectComment(c.id)} className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs font-bold py-1.5 rounded">Отклонить</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-[#1a1a1e] border border-[#222226] rounded-xl p-4">
            <h4 className="text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-3"><i className="fa-solid fa-filter mr-1"></i> Запрещённые слова</h4>
            <p className="text-[11px] text-gray-500 mb-3">Комментарии с этим словом попадут на проверку.</p>
            <div className="flex gap-2 mb-3">
              <input value={newFilterWord} onChange={(e) => setNewFilterWord(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAddFilterWord()} placeholder="Введите слово..."
                className="flex-1 bg-[#121214] border border-[#222226] rounded px-2 py-1.5 text-xs text-white outline-none focus:border-amber-500/50" />
              <button onClick={handleAddFilterWord} className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-4 py-1.5 rounded transition-all">Добавить</button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {filterWords.length === 0 && <span className="text-[11px] text-gray-600">Слов пока нет</span>}
              {filterWords.map((w) => (
                <span key={w.id} className="inline-flex items-center gap-1.5 bg-[#121214] border border-[#222226] rounded px-2 py-1 text-xs text-gray-300">
                  {w.word}
                  <button onClick={() => handleRemoveFilterWord(w.id)} className="text-gray-500 hover:text-red-400"><i className="fa-solid fa-xmark text-[9px]"></i></button>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "tools" && (
        <div className="space-y-4">
          <div className="bg-[#1a1a1e] border border-[#222226] rounded-xl p-4">
            <h4 className="text-[10px] font-bold text-sky-400 uppercase tracking-wider mb-3"><i className="fa-solid fa-link mr-1"></i> Проверка ссылок аниме</h4>
            <p className="text-[11px] text-gray-500 mb-3">Проверяет ссылку на страницу каждого аниме (/anime/slug). Битые покажет ниже.</p>
            <button onClick={handleCheckLinks} disabled={checkingLinks} className="bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white text-xs font-bold px-4 py-1.5 rounded transition-all">
              {checkingLinks ? "Проверка..." : "Проверить ссылки"}
            </button>
            {brokenLinks.length > 0 && (
              <div className="mt-4 space-y-1.5">
                <p className="text-[11px] text-red-400 font-bold">Найдено битых: {brokenLinks.length}</p>
                {brokenLinks.map((b) => (
                  <div key={b.id} className="bg-[#121214] border border-red-500/20 rounded px-3 py-2 flex items-center gap-3 text-xs">
                    <span className="text-white flex-1 truncate">{b.title}</span>
                    <span className="text-gray-500 truncate max-w-[220px]">{b.url}</span>
                    <a href={b.slug ? `/anime/${b.slug}` : `/anime/${b.id}`} target="_blank" className="text-sky-400 hover:text-sky-300 text-[10px] font-bold px-2 py-1 rounded border border-sky-500/20">Открыть</a>
                  </div>
                ))}
              </div>
            )}
            {!checkingLinks && brokenLinks.length === 0 && <p className="text-[11px] text-gray-600 mt-3">Нажми кнопку чтобы проверить. Если всё ок — список останется пустым.</p>}
          </div>
        </div>
      )}

      {tab === "genres" && (
        <div className="space-y-4">
          <div className="bg-[#1a1a1e] border border-[#222226] rounded-xl p-4">
            <h4 className="text-[10px] font-bold text-sky-400 uppercase tracking-wider mb-3"><i className="fa-solid fa-tags mr-1"></i> Жанры</h4>
            <p className="text-[11px] text-gray-500 mb-3">Добавляй и удаляй жанры. Добавление остаётся и в «Инструментах».</p>
            <div className="flex gap-2 mb-4">
              <input value={newGenreAdmin} onChange={(e) => setNewGenreAdmin(e.target.value)} placeholder="Новый жанр" className="flex-1 bg-[#121214] border border-[#222226] rounded px-2 py-1.5 text-xs text-white outline-none focus:border-sky-500/50" />
              <button onClick={handleAddGenreAdmin} className="bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold px-4 py-1.5 rounded">Добавить</button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {allGenresAdmin.map((g) => (
                <span key={g} className="inline-flex items-center gap-1.5 bg-[#121214] border border-[#222226] rounded px-2.5 py-1 text-[10px] font-bold text-gray-300">
                  {g}
                  <button onClick={() => handleDeleteGenreAdmin(g)} className="text-gray-500 hover:text-red-400"><i className="fa-solid fa-xmark text-[9px]"></i></button>
                </span>
              ))}
            </div>
            <p className="text-[10px] text-gray-600 mt-3">Всего: {allGenresAdmin.length}</p>
          </div>
        </div>
      )}
    </div>
  );
}