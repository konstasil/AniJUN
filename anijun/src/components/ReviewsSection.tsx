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
  defaultRating: number | "-";
  onRatingChange?: (rating: number | "-") => void;
}

export default function ReviewsSection({ animeId, isAuthed, userId, defaultRating, onRatingChange }: ReviewsSectionProps) {
  const supabase = useMemo(() => createClient(), []);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [myText, setMyText] = useState("");
  const [myRating, setMyRating] = useState<number>(7);
  const [editingOwn, setEditingOwn] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [friendIds, setFriendIds] = useState<Set<string>>(new Set());
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [isReviewAdmin, setIsReviewAdmin] = useState(false);
  const [lastDefaultRating, setLastDefaultRating] = useState<number | "-">("-");

  if (defaultRating !== lastDefaultRating) {
    setLastDefaultRating(defaultRating);
    if (typeof defaultRating === "number") setMyRating(defaultRating);
  }

  const loadReviews = useCallback(async () => {
    const { data } = await supabase
      .from("reviews")
      .select("id, user_id, text, rating, created_at")
      .eq("anime_id", animeId)
      .order("created_at", { ascending: false });
    if (!data || data.length === 0) { setReviews([]); return; }
    const ids = [...new Set(data.map((r) => r.user_id))];
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, username, avatar_url")
      .in("id", ids);
    const map = new Map<string, { username: string; avatar_url: string }>();
    profs?.forEach((p) => map.set(p.id, { username: p.username, avatar_url: p.avatar_url || "" }));
    const enriched = data.map((r) => ({
      ...r,
      profiles: map.has(r.user_id) ? [map.get(r.user_id)!] : [],
    }));
    setReviews(enriched as unknown as Review[]);
  }, [animeId, supabase]);

  useEffect(() => {
    const t = setTimeout(() => { loadReviews(); }, 0);
    return () => clearTimeout(t);
  }, [loadReviews]);









  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try { const { data } = await supabase.rpc("is_admin"); if (!cancelled) setIsReviewAdmin(!!data); } catch {}
      const { data: accepted } = await supabase
        .from("friends")
        .select("user_id, friend_id")
        .eq("status", "accepted")
        .or(`user_id.eq.${userId},friend_id.eq.${userId}`);
      if (cancelled) return;
      const f = new Set<string>();
      accepted?.forEach((row) => f.add(row.user_id === userId ? row.friend_id : row.user_id));
      setFriendIds(f);

      const { data: pending } = await supabase
        .from("friends")
        .select("friend_id")
        .eq("status", "pending")
        .eq("user_id", userId);
      if (cancelled) return;
      const p = new Set<string>();
      pending?.forEach((row) => p.add(row.friend_id));
      setPendingIds(p);
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
    try {
      const { data: muted } = await supabase.rpc("is_current_user_muted");
      if (muted) { setError("Вы замучены и не можете оставлять отзывы"); setSaving(false); return; }
      const { data: banned } = await supabase.rpc("is_current_user_banned");
      if (banned) { setError("Вы забанены"); setSaving(false); return; }
    } catch {}
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

  async function handleDeleteReview(targetUserId: string) {
    const { data: { session } } = await supabase.auth.getSession();
    const isAdmin = session?.user ? (await supabase.rpc("is_admin")).data : false;
    if (targetUserId !== userId && !isAdmin) return;
    if (!confirm("Удалить отзыв?")) return;
    await supabase.from("reviews").delete().eq("user_id", targetUserId).eq("anime_id", animeId);
    await loadReviews();
    if (targetUserId === userId) setEditingOwn(false);
  }

  async function handleAddFriend(authorId: string) {
    if (!userId || authorId === userId) return;
    const { error: err } = await supabase.from("friends").insert({
      user_id: userId,
      friend_id: authorId,
      status: "pending",
    });
    if (!err) setPendingIds(new Set(pendingIds).add(authorId));
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
                <select value={myRating} onChange={(e) => { const v = Number(e.target.value); setMyRating(v); onRatingChange?.(v); }}
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
              <Link href={`/profile/${r.user_id}`} className="w-7 h-7 rounded-full bg-gradient-to-tr from-sky-400 to-blue-600 flex items-center justify-center text-white text-[10px] font-black overflow-hidden shrink-0 relative hover:ring-2 hover:ring-sky-400/40 transition-all">
                {r.profiles?.[0]?.avatar_url ? (
                  <Image src={r.profiles[0].avatar_url} alt={r.profiles[0].username} fill unoptimized sizes="28px" className="object-cover" />
                ) : (
                  (r.profiles?.[0]?.username || "А").substring(0, 2).toUpperCase()
                )}
              </Link>
              <div className="flex-1 min-w-0">
                <Link href={`/profile/${r.user_id}`} className="text-xs font-bold text-white hover:text-sky-400 transition-colors truncate block">
                  {r.profiles?.[0]?.username || "Пользователь"}
                </Link>
                <span className="text-[10px] text-gray-600">{new Date(r.created_at).toLocaleDateString("ru-RU")}</span>
              </div>
              <span className="text-[10px] font-bold text-amber-400 border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 rounded">{r.rating}/10</span>
              {(r.user_id === userId || isReviewAdmin) && (
                <button onClick={() => handleDeleteReview(r.user_id)} className="text-[9px] text-red-400 hover:text-red-300 ml-1"><i className="fa-solid fa-trash-can"></i></button>
              )}
              {isAuthed && userId && r.user_id !== userId && (
                friendIds.has(r.user_id) ? (
                  <span className="text-[9px] font-bold px-2 py-1 rounded border text-green-400 border-green-500/20 bg-green-500/10">
                    <i className="fa-solid fa-user-check mr-0.5"></i>В друзьях
                  </span>
                ) : pendingIds.has(r.user_id) ? (
                  <span className="text-[9px] font-bold px-2 py-1 rounded border text-gray-400 border-[#222226] bg-[#1a1a1e]">
                    <i className="fa-solid fa-clock mr-0.5"></i>Заявка
                  </span>
                ) : (
                  <button onClick={() => handleAddFriend(r.user_id)}
                    className="text-[9px] font-bold px-2 py-1 rounded border text-sky-400 border-sky-400/30 hover:bg-sky-400/10 transition-all">
                    <i className="fa-solid fa-user-plus mr-0.5"></i>В друзья
                  </button>
                )
              )}
            </div>
            <p className="text-xs text-gray-300 whitespace-pre-wrap break-words">{r.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
