"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ImageUpload from "@/components/ImageUpload";
import { ALL_GENRES, AGE_RATINGS, ANIME_STATUSES } from "@/lib/genres";
import { ADMIN_IDS } from "@/lib/admin";

export default function AdminAddAnimePage() {
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
  const [status, setStatus] = useState("announced");
  const [posterUrl, setPosterUrl] = useState("");
  const [seasons, setSeasons] = useState<{ number: number; episodes: number }[]>([{ number: 1, episodes: 12 }]);

  function generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9а-я\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

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
      })
      .select()
      .single();

    if (err || !anime) {
      setError(err?.message || "Ошибка добавления");
      setSaving(false);
      return;
    }

    for (const s of seasons) {
      await supabase.from("anime_seasons").insert({
        anime_id: anime.id,
        season_number: s.number,
        episodes_count: s.episodes,
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
        <h1 className="text-lg font-bold text-white">Добавить аниме</h1>
      </div>

      <div className="bg-[#1a1a1e] border border-[#222226] rounded-xl p-6 space-y-5">
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Название *</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Название аниме..."
            className="w-full bg-[#121214] border border-[#222226] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-sky-500/50 transition-colors" />
        </div>

        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">
            Slug (адресная строка) <span className="text-gray-600 font-normal">— если пусто, сгенерируется из названия</span>
          </label>
          <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="naprimer-takoy-slug"
            className="w-full bg-[#121214] border border-[#222226] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-sky-500/50 transition-colors" />
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Сезон</label>
            <input value={season} onChange={(e) => setSeason(e.target.value)}
              className="w-full bg-[#121214] border border-[#222226] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-sky-500/50 transition-colors" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Возраст</label>
            <select value={ageRating} onChange={(e) => setAgeRating(e.target.value)}
              className="bg-[#121214] border border-[#222226] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-sky-500/50 transition-colors">
              {AGE_RATINGS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Статус</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}
              className="bg-[#121214] border border-[#222226] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-sky-500/50 transition-colors">
              {ANIME_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">URL постера</label>
          <input value={posterUrl} onChange={(e) => setPosterUrl(e.target.value)} placeholder="https://..."
            className="w-full bg-[#121214] border border-[#222226] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-sky-500/50 transition-colors" />
          <div className="mt-2">
            <ImageUpload bucket="Anime" currentUrl={posterUrl || undefined} onUploaded={setPosterUrl} size={160} label="Загрузить постер" />
          </div>
        </div>

        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-2">Жанры</label>
          <div className="flex flex-wrap gap-1.5">
            {ALL_GENRES.map((g) => (
              <button key={g} onClick={() => toggleGenre(g)}
                className={`text-[10px] font-bold px-2.5 py-1 rounded border transition-all ${
                  genres.includes(g) ? "bg-sky-500/20 text-sky-400 border-sky-500/30" : "bg-[#121214] text-gray-500 border-[#222226] hover:text-gray-300"
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

        {error && (
          <div className="text-[10px] text-red-400 bg-red-950/20 border border-red-500/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <button onClick={handleSubmit} disabled={saving || !title.trim()}
          className="w-full bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs px-5 py-2.5 rounded-lg transition-all disabled:opacity-50 shadow-lg shadow-sky-500/10">
          {saving ? "Добавление..." : "Добавить аниме"}
        </button>
      </div>
    </div>
  );
}