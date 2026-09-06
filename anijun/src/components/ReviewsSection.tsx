"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";

interface Review {
  id: number;
  user_id: string;
  text: string;
  rating: number;
  created_at: string;
  profiles?: { username: string; avatar_url: string }[];
}

interface ReviewsSectionProps {
  animeId: number;
  isAuthed: boolean;
  userId: string | null;
}

export default function ReviewsSection({ animeId, isAuthed, userId }: ReviewsSectionProps) {
  const supabase = useMemo(() => createClient(), []);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [myText, setMyText] = useState("");
  const [myRating, setMyRating] = useState<number>(7);
  const [editingOwn, setEditingOwn] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [following, setFollowing] = useState<Set<string>>(new Set());

  const loadReviews = useCallback(async () => {
    const { data } = await supabase
      .from("reviews")
      .select("*, profiles:user_id(username, avatar_url)")
      .eq("anime_id", animeId)
      .order("created_at", { ascending: false });
    if (data) setReviews(data as unknown as Review[]);
  }, [animeId, supabase]);

  useEffect(() => {
    const t = setTimeout(() => { loadReviews(); }, 0);
    return () => clearTimeout(t);
  }, [loadReviews]);


  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("user_follows")
        .select("following_id")
        .eq("follower_id", userId);
      if (cancelled) return;
      const s = new Set<string>();
      data?.forEach((f) => s.add(f.following_id));
      setFollowing(s);
    })();
    return () => { cancelled = true; };
  }, [userId, supabase]);

  const myReview = userId ? reviews.find((r) => r.user_id === userId) : undefined;

  async function handleSubmit() {
    if (!userId) return;
    setSaving(true);
    setError("");
    const text = myText.trim();
    if (!text) {
      setError("Напишите текст отзыва");
      setSaving(false);
      return;
    }
    const { error: err } = await supabase.from("reviews").upsert(
      { user_id: userId, anime_id: animeId, text, rating: myRating },
      { onConflict: "user_id,anime_id" }
    );
    if (err) {
      setError("Ошибка: " + err.message);
      setSaving(false);
      return;
    }
    setMyText("");
    setEditingOwn(false);
    setSaving(false);
    await loadReviews();
  }

  async function handleDeleteOwn() {
    if (!userId) return;
    await supabase.from("reviews").delete().eq("user_id", userId).eq("anime_id", animeId);
    setEditingOwn(false);
    await loadReviews();
  }

  async function toggleFollow(authorId: string) {
    if (!userId) return;
    const isFollowing = following.has(authorId);
    if (isFollowing) {
      await supabase.from("user_follows").delete().eq("follower_id", userId).eq("following_id", authorId);
      const next = new Set(following);
      next.delete(authorId);
      setFollowing(next);
    } else {
      await supabase.from("user_follows").insert({ follower_id: userId, following_id: authorId });
      setFollowing(new Set(following).add(authorId));
    }
  }

  function startEditOwn() {
    if (!myReview) return;
    setMyText(myReview.text);
    setMyRating(myReview.rating);
    setEditingOwn(true);
  }

  return (
    <div className="bg-[#1a1a1e] border border-[#222226] rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <i className="fa-solid fa-comment text-sky-400 text-xs"></i>
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Отзывы</h3>
        <span className="text-[10px] text-gray-600 ml-auto">{reviews.length}</span>
      </div>

      {}
      {isAuthed && userId ? (
        <>
          {myReview && !editingOwn && (
            <div className="mb-4 flex items-center gap-2 text-xs">
              <span className="text-gray-500">Ваш отзыв:</span>
              <span className="text-amber-400 font-bold">{myReview.rating}/10</span>
              <button onClick={startEditOwn} className="text-[10px] text-sky-400 hover:text-sky-300 ml-auto transition-colors">
                <i className="fa-solid fa-pen mr-1"></i>Редактировать
              </button>
              <button onClick={handleDeleteOwn} className="text-[10px] text-red-400 hover:text-red-300 transition-colors">
                <i className="fa-solid fa-trash-can"></i>
              </button>
            </div>
          )}
          {(!myReview || editingOwn) && (
            <div className="mb-5 p-3 bg-[#121214] border border-[#222226] rounded-lg flex flex-col gap-2">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-gray-500 text-[10px] uppercase tracking-wider">Оценка автора:</span>
                <select value={myRating} onChange={(e) => setMyRating(Number(e.target.value))}
                  className="bg-[#1a1a1e] border border-[#222226] rounded px-2 py-1 text-xs text-white outline-none focus:border-sky-500/50">
                  {[1,2,3,4,5,6,7,8,9,10].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <textarea value={myText} onChange={(e) => setMyText(e.target.value)} rows={3}
                placeholder="Поделитесь впечатлениями..."
                className="w-full bg-[#121214] border border-[#222226] rounded px-3 py-2 text-xs text-white outline-none focus:border-sky-500/50 resize-none" />
              {error && <p className="text-[10px] text-red-400">{error}</p>}
              <div className="flex gap-2">
                <button onClick={handleSubmit} disabled={saving}
                  className="bg-sky-500 hover:bg-sky-600 text-white text-[10px] font-bold px-3 py-1.5 rounded transition-all disabled:opacity-50">
                  {saving ? "Сохранение..." : "Опубликовать отзыв"}
                </button>
                {editingOwn && (
                  <button onClick={() => setEditingOwn(false)} className="text-gray-400 text-[10px] font-bold px-3 py-1.5 rounded border border-[#222226] hover:text-white transition-all">Отмена</button>
                )}
              </div>
            </div>
          )}
        </>
      ) : (
        <p className="mb-5 text-[11px] text-gray-500">
          <Link href={`/login?next=${encodeURIComponent(window.location.pathname)}`} className="text-sky-400 hover:underline">Войдите</Link>, чтобы оставить отзыв
        </p>
      )}

      {/* Список отзывов */}
      <div className="flex flex-col gap-3">
        {reviews.length === 0 && (
          <p className="text-center text-gray-600 text-[11px] py-4">Отзывов пока нет — будьте первым!</p>
        )}
        {reviews.map((r) => (
          <div key={r.id} className="p-3 bg-[#121214] border border-[#222226] rounded-lg">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-sky-400 to-blue-600 flex items-center justify-center text-white text-[10px] font-black overflow-hidden shrink-0 relative">
                {r.profiles?.[0]?.avatar_url ? (
                  <Image src={r.profiles[0].avatar_url} alt={r.profiles[0].username} fill unoptimized sizes="28px" className="object-cover" />
                ) : (
                  (r.profiles?.[0]?.username || "А").substring(0, 2).toUpperCase()
                )}
              </div>
              <div className="flex-1 min-w-0">
                <Link href={`/profile/${r.user_id}`} className="text-xs font-bold text-white hover:text-sky-400 transition-colors truncate block">
                  {r.profiles?.[0]?.username || "Пользователь"}
                </Link>
                <span className="text-[10px] text-gray-600">{new Date(r.created_at).toLocaleDateString("ru-RU")}</span>
              </div>
              <span className="text-[10px] font-bold text-amber-400 border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 rounded">{r.rating}/10</span>
              {isAuthed && userId && r.user_id !== userId && (
                <button onClick={() => toggleFollow(r.user_id)}
                  className={`text-[9px] font-bold px-2 py-1 rounded border transition-all ${
                    following.has(r.user_id)
                      ? "text-gray-400 border-[#222226] bg-[#1a1a1e] hover:text-red-400"
                      : "text-sky-400 border-sky-400/30 hover:bg-sky-400/10"
                  }`}>
                  {following.has(r.user_id) ? <><i className="fa-solid fa-bell-slash mr-0.5"></i>Отписаться</> : <><i className="fa-solid fa-bell mr-0.5"></i>Подписаться</>}
                </button>
              )}
            </div>
            <p className="text-xs text-gray-300 whitespace-pre-wrap break-words">{r.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
