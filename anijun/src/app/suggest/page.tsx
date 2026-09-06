"use client";

import { createClient } from "@/lib/supabase/client";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ALL_GENRES, AGE_RATINGS } from "@/lib/genres";

export default function SuggestPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [title, setTitle] = useState("");
  const [genres, setGenres] = useState<string[]>([]);
  const [seasonInfo, setSeasonInfo] = useState("");
  const [ageRating, setAgeRating] = useState("16+");
  const [imageUrl, setImageUrl] = useState("");
  const [link, setLink] = useState("");
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  function toggleGenre(g: string) {
    setGenres((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]
    );
  }

  async function handleSubmit() {
    if (!title.trim()) return;
    setSending(true);
    setError("");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("Необходимо войти в систему");
      setSending(false);
      return;
    }

    const { error: err } = await supabase.from("anime_suggestions").insert({
      user_id: user.id,
      title: title.trim(),
      genres,
      season_info: seasonInfo || "Не указан",
      age_rating: ageRating,
      image_url: imageUrl,
      link: link.trim(),
      comment: comment.trim(),
      status: "new",
    });

    if (err) {
      setError("Ошибка отправки: " + err.message);
      setSending(false);
      return;
    }

    setSent(true);
    setSending(false);
  }

  if (sent) {
    return (
      <div className="max-w-lg mx-auto text-center py-20">
        <div className="text-4xl mb-4">🎉</div>
        <h2 className="text-lg font-bold text-white mb-3">Спасибо!</h2>
        <p className="text-sm text-gray-400 leading-relaxed">
          Ваше предложение отправлено на модерацию. После проверки аниме появится на сайте.
        </p>
        <button
          onClick={() => router.push("/")}
          className="mt-6 bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs px-5 py-2.5 rounded-lg transition-all"
        >
          На главную
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <i className="fa-solid fa-lightbulb text-amber-400 text-lg"></i>
        <h1 className="text-lg font-bold text-white">Предложить аниме</h1>
      </div>

      <div className="bg-[#1a1a1e] border border-[#222226] rounded-xl p-6 space-y-5">
        <p className="text-[10px] text-gray-500 leading-relaxed">
          Не нашли аниме в каталоге? Предложите его — мы рассмотрим и добавим!
        </p>

        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Название *</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Название аниме..."
            className="w-full bg-[#121214] border border-[#222226] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-sky-500/50 transition-colors" />
        </div>

        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Сезон</label>
          <input value={seasonInfo} onChange={(e) => setSeasonInfo(e.target.value)} placeholder="Например: Зима 2025"
            className="w-full bg-[#121214] border border-[#222226] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-sky-500/50 transition-colors" />
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Возрастной рейтинг</label>
            <select value={ageRating} onChange={(e) => setAgeRating(e.target.value)}
              className="w-full bg-[#121214] border border-[#222226] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-sky-500/50 transition-colors">
              {AGE_RATINGS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="flex-[2]">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Ссылка на постер</label>
            <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..."
              className="w-full bg-[#121214] border border-[#222226] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-sky-500/50 transition-colors" />
          </div>
        </div>

        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Ссылка на источник</label>
          <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="MAL / AniList / Kinopoisk / IMDB... https://"
            className="w-full bg-[#121214] border border-[#222226] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-sky-500/50 transition-colors" />
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
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Комментарий (почему стоит добавить)</label>
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Расскажите, почему это аниме заслуживает внимания..."
            rows={3}
            className="w-full bg-[#121214] border border-[#222226] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-sky-500/50 transition-colors resize-none" />
        </div>

        {error && (
          <div className="text-[10px] text-red-400 bg-red-950/20 border border-red-500/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <button onClick={handleSubmit} disabled={sending || !title.trim()}
          className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs px-5 py-2.5 rounded-lg transition-all disabled:opacity-50 shadow-lg shadow-amber-500/10">
          {sending ? "Отправка..." : "Отправить предложение"}
        </button>
      </div>
    </div>
  );
}