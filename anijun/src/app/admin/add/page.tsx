"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ImageUpload from "@/components/ImageUpload";
import { ALL_GENRES, AGE_RATINGS, ANIME_STATUSES } from "@/lib/genres";
import { ADMIN_IDS } from "@/lib/admin";
import SeasonEditor, { SeasonDraft } from "@/components/SeasonEditor";
import { generateSlug, sanitizeSlugInput } from "@/lib/slug";

export default function AdminAddAnimePage() {
  useEffect(() => { document.title = "Добавить аниме | AniJUN"; }, []);

  const router = useRouter();
  const supabase = createClient();

  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [genres, setGenres] = useState<string[]>([]);
  const [season, setSeason] = useState("Зима 2025");
  const [ageRating, setAgeRating] = useState("16+");
  const [status, setStatus] = useState("finished");
  const [releaseDate, setReleaseDate] = useState("");
  const [posterUrl, setPosterUrl] = useState("");
  const [seasons, setSeasons] = useState<SeasonDraft[]>([{ number: 1, episodes: 12, note: "" }]);
  const [allGenres, setAllGenres] = useState<string[]>(ALL_GENRES);



  useEffect(() => {
    async function check() {
      const { data: { session } } = await supabase.auth.getSession();
      const authUser = session?.user;
      if (!authUser || !ADMIN_IDS.includes(authUser.id)) {
        router.push("/");
        return;
      }
      setIsAdmin(true);
      setLoading(false);
    }
    check();
  }, [router, supabase]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("genres").select("name").order("name");
      if (data && data.length > 0) {
        const dbNames = data.map((r) => r.name);
        setAllGenres([...new Set([...ALL_GENRES, ...dbNames])]);
      }
    })();
  }, [supabase]);

  function toggleGenre(g: string) {
    setGenres((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]
    );
  }

  async function handleSubmit() {
    if (!title.trim()) return;
    setSaving(true);
    setError("");

    const finalSlug = slug.trim() || generateSlug(title.trim());
    const { data: anime, error: err } = await supabase
      .from("anime")
      .insert({
        title: title.trim(),
        slug: finalSlug,
        image_url: posterUrl || "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400&q=80",
        genres,
        season_info: season,
        age_rating: ageRating,
        status,
        release_date: status === "announced" && releaseDate ? releaseDate : null,
      })
      .select()
      .single();

    if (err || !anime) {
      setError(err?.message || "Ошибка добавления");
      setSaving(false);
      return;
    }

    for (let i = 0; i < seasons.length; i++) {
      const s = seasons[i];
      await supabase.from("anime_seasons").insert({
        anime_id: anime.id,
        season_number: i + 1,
        episodes_count: s.episodes,
        aired_episodes: s.aired_episodes ?? s.episodes,
        note: s.note || "",
        age_rating: s.age_rating || "",
      });
    }

    setSaving(false);
    router.push(`/anime/${finalSlug}`);
  }

  if (loading) {
    return <div className="text-center py-20 text-gray-500 text-xs">Загрузка...</div>;
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <i className="fa-solid fa-plus text-sky-400 text-lg"></i>
        <h1 className="text-base sm:text-lg font-bold text-white">Добавить аниме</h1>
      </div>

      <div className="bg-[#1a1a1e] border border-[#222226] rounded-xl p-4 sm:p-6 space-y-4 sm:space-y-5">
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Название *</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Название аниме..."
            className="w-full bg-[#121214] border border-[#222226] rounded-lg px-3 py-2 text-xs sm:text-sm text-white outline-none focus:border-sky-500/50 transition-colors" />
        </div>

        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">
            Slug (адресная строка) <span className="text-gray-600 font-normal">— если пусто, сгенерируется из названия</span>
          </label>
          <input value={slug} onChange={(e) => setSlug(sanitizeSlugInput(e.target.value))} placeholder="naprimer-takoy-slug"
            className="w-full bg-[#121214] border border-[#222226] rounded-lg px-3 py-2 text-xs sm:text-sm text-white outline-none focus:border-sky-500/50 transition-colors" />
        </div>

        <div className="flex flex-wrap gap-2 sm:gap-3">
          <div className="flex-1 min-w-[110px]">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Сезон</label>
            <input value={season} onChange={(e) => setSeason(e.target.value)}
              className="w-full bg-[#121214] border border-[#222226] rounded-lg px-3 py-2 text-xs sm:text-sm text-white outline-none focus:border-sky-500/50 transition-colors" />
          </div>
          <div className="min-w-[90px] flex-1 sm:flex-none">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Возраст</label>
            <select value={ageRating} onChange={(e) => setAgeRating(e.target.value)}
              className="w-full bg-[#121214] border border-[#222226] rounded-lg px-3 py-2 text-xs sm:text-sm text-white outline-none focus:border-sky-500/50 transition-colors">
              <option value="">Без рейтинга</option>
              {AGE_RATINGS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="min-w-[120px] flex-1 sm:flex-none">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Статус</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}
              className="w-full bg-[#121214] border border-[#222226] rounded-lg px-3 py-2 text-xs sm:text-sm text-white outline-none focus:border-sky-500/50 transition-colors">
              {ANIME_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>
        {status === "announced" && (
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Дата выхода</label>
            <input type="date" value={releaseDate} onChange={(e) => setReleaseDate(e.target.value)} className="w-full bg-[#121214] border border-[#222226] rounded-lg px-3 py-2 text-xs sm:text-sm text-white outline-none focus:border-sky-500/50" />
          </div>
        )}

        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">URL постера</label>
          <input value={posterUrl} onChange={(e) => setPosterUrl(e.target.value)} placeholder="https://..."
            className="w-full bg-[#121214] border border-[#222226] rounded-lg px-3 py-2 text-xs sm:text-sm text-white outline-none focus:border-sky-500/50 transition-colors" />
          <div className="mt-2">
            <ImageUpload bucket="Anime" currentUrl={posterUrl || undefined} onUploaded={setPosterUrl} size={160} label="Загрузить постер" />
          </div>
        </div>

        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-2">Жанры</label>
          <div className="flex flex-wrap gap-2 sm:gap-1.5">
            {allGenres.map((g) => (
              <button key={g} onClick={() => toggleGenre(g)}
                className={`text-[11px] sm:text-[10px] font-bold px-3 sm:px-2.5 py-1.5 sm:py-1 rounded border transition-all ${
                  genres.includes(g) ? "bg-sky-500/20 text-sky-400 border-sky-500/30" : "bg-[#121214] text-gray-500 border-[#222226] hover:text-gray-300"
                }`}>{g}</button>
            ))}
          </div>
        </div>

        <SeasonEditor seasons={seasons} onChange={setSeasons} />

        {error && (
          <div className="text-[10px] text-red-400 bg-red-950/20 border border-red-500/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <button onClick={handleSubmit} disabled={saving || !title.trim()}
          className="w-full bg-sky-500 hover:bg-sky-600 text-white font-bold text-[11px] sm:text-xs px-4 sm:px-5 py-2 sm:py-2.5 rounded-lg transition-all disabled:opacity-50 shadow-lg shadow-sky-500/10">
          {saving ? "Добавление..." : "Добавить аниме"}
        </button>
      </div>
    </div>
  );
}