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

interface Comment {
  id: number;
  user_id: string;
  text: string;
  created_at: string;
  parent_id: number | null;
  profiles?: { username: string; avatar_url: string }[];
}

interface ReviewsSectionProps {
  animeId: number;
  isAuthed: boolean;
  userId: string | null;
  defaultRating: number | "-";
}

export default function ReviewsSection({ animeId, isAuthed, userId, defaultRating }: ReviewsSectionProps) {
  const supabase = useMemo(() => createClient(), []);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentVotes, setCommentVotes] = useState<{ comment_id: number; user_id: string; vote: number }[]>([]);
  const [myText, setMyText] = useState("");
  const [myRating, setMyRating] = useState<number | "-">(defaultRating);
  const [editingOwn, setEditingOwn] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [commentText, setCommentText] = useState("");
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [replyText, setReplyText] = useState("");
  const [friendIds, setFriendIds] = useState<Set<string>>(new Set());
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [isReviewAdmin, setIsReviewAdmin] = useState(false);
  const [reviewVotes, setReviewVotes] = useState<{ review_id: number; user_id: string; vote: number }[]>([]);
  const [lastDefaultRating, setLastDefaultRating] = useState<number | "-">("-");

  if (defaultRating !== lastDefaultRating) {
    setLastDefaultRating(defaultRating);
    setMyRating(defaultRating);
  }

  const loadAll = useCallback(async () => {
    const { data } = await supabase
      .from("reviews")
      .select("id, user_id, text, rating, created_at")
      .eq("anime_id", animeId)
      .order("created_at", { ascending: false });
    if (!data || data.length === 0) { setReviews([]); setReviewVotes([]); } else {
      const ids = [...new Set(data.map((r) => r.user_id))];
      const { data: profs } = await supabase.from("profiles").select("id, username, avatar_url").in("id", ids);
      const map = new Map<string, { username: string; avatar_url: string }>();
      profs?.forEach((p) => map.set(p.id, { username: p.username, avatar_url: p.avatar_url || "" }));
      const enriched = data.map((r) => ({ ...r, profiles: map.has(r.user_id) ? [map.get(r.user_id)!] : [] }));
      setReviews(enriched as unknown as Review[]);
      const rids = data.map((r) => r.id);
      const { data: rv } = await supabase.from("review_votes").select("review_id, user_id, vote").in("review_id", rids);
      setReviewVotes((rv || []) as { review_id: number; user_id: string; vote: number }[]);
    }

    const { data: cdata } = await supabase.from("comments").select("id, user_id, text, created_at, parent_id").eq("anime_id", animeId).order("created_at", { ascending: true });
    if (!cdata || cdata.length === 0) { setComments([]); setCommentVotes([]); return; }
    const cids = [...new Set(cdata.map((c) => c.user_id))];
    const { data: cprofs } = await supabase.from("profiles").select("id, username, avatar_url").in("id", cids);
    const cmap = new Map<string, { username: string; avatar_url: string }>();
    cprofs?.forEach((p) => cmap.set(p.id, { username: p.username, avatar_url: p.avatar_url || "" }));
    const cenriched = cdata.map((c) => ({ ...c, profiles: cmap.has(c.user_id) ? [cmap.get(c.user_id)!] : [] }));
    setComments(cenriched as unknown as Comment[]);
    const ccids = cdata.map((c) => c.id);
    const { data: cv } = await supabase.from("comment_votes").select("comment_id, user_id, vote").in("comment_id", ccids);
    setCommentVotes((cv || []) as { comment_id: number; user_id: string; vote: number }[]);
  }, [animeId, supabase]);

  useEffect(() => {
    const t = setTimeout(() => { loadAll(); }, 0);
    return () => clearTimeout(t);
  }, [loadAll]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try { const { data } = await supabase.rpc("is_admin"); if (!cancelled) setIsReviewAdmin(!!data); } catch {}
      const { data: accepted } = await supabase.from("friends").select("user_id, friend_id").eq("status", "accepted").or(`user_id.eq.${userId},friend_id.eq.${userId}`);
      if (cancelled) return;
      const f = new Set<string>();
      accepted?.forEach((row) => f.add(row.user_id === userId ? row.friend_id : row.user_id));
      setFriendIds(f);
      const { data: pending } = await supabase.from("friends").select("friend_id").eq("status", "pending").eq("user_id", userId);
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
    if (!text) { setError("Напишите текст отзыва"); setSaving(false); return; }
    if (myRating === "-") { setError("Сначала поставьте оценку аниме"); setSaving(false); return; }
    try {
      const { data: muted } = await supabase.rpc("is_current_user_muted");
      if (muted) { setError("Вы замучены и не можете оставлять отзывы"); setSaving(false); return; }
      const { data: banned } = await supabase.rpc("is_current_user_banned");
      if (banned) { setError("Вы забанены"); setSaving(false); return; }
    } catch {}
    const { error: err } = await supabase.from("reviews").upsert({ user_id: userId, anime_id: animeId, text, rating: myRating as number }, { onConflict: "user_id,anime_id" });
    if (err) { setError("Ошибка: " + err.message); setSaving(false); return; }
    setMyText(""); setEditingOwn(false); setSaving(false); await loadAll();
  }

  async function handleDeleteOwn() {
    if (!userId) return;
    await supabase.from("reviews").delete().eq("user_id", userId).eq("anime_id", animeId);
    setEditingOwn(false); await loadAll();
  }

  async function handleDeleteReview(targetUserId: string) {
    const { data: { session } } = await supabase.auth.getSession();
    const isAdmin = session?.user ? (await supabase.rpc("is_admin")).data : false;
    if (targetUserId !== userId && !isAdmin) return;
    if (!confirm("Удалить отзыв?")) return;
    await supabase.from("reviews").delete().eq("user_id", targetUserId).eq("anime_id", animeId);
    await loadAll();
    if (targetUserId === userId) setEditingOwn(false);
  }

  async function handleAddFriend(authorId: string) {
    if (!userId || authorId === userId) return;
    const { error: err } = await supabase.from("friends").insert({ user_id: userId, friend_id: authorId, status: "pending" });
    if (!err) setPendingIds(new Set(pendingIds).add(authorId));
  }

  async function handleReviewVote(reviewId: number, v: number) {
    if (!userId) return;
    const existing = reviewVotes.find((x) => x.review_id === reviewId && x.user_id === userId);
    if (existing?.vote === v) await supabase.from("review_votes").delete().eq("user_id", userId).eq("review_id", reviewId);
    else if (existing) await supabase.from("review_votes").update({ vote: v }).eq("user_id", userId).eq("review_id", reviewId);
    else await supabase.from("review_votes").insert({ user_id: userId, review_id: reviewId, vote: v });
    const { data: rv } = await supabase.from("review_votes").select("review_id, user_id, vote").in("review_id", reviews.map((r) => r.id));
    setReviewVotes((rv || []) as { review_id: number; user_id: string; vote: number }[]);
  }

  async function handleCommentPost(parentId: number | null) {
    if (!userId) return;
    const body = parentId ? replyText.trim() : commentText.trim();
    if (!body) return;
    try {
      const { data: muted } = await supabase.rpc("is_current_user_muted");
      if (muted) { setError("Вы замучены"); return; }
      const { data: banned } = await supabase.rpc("is_current_user_banned");
      if (banned) { setError("Вы забанены"); return; }
    } catch {}
    const { error } = await supabase.from("comments").insert({ user_id: userId, anime_id: animeId, text: body, parent_id: parentId });
    if (error) { setError(error.message); return; }
    setCommentText(""); setReplyText(""); setReplyTo(null); setError(""); await loadAll();
  }

  async function handleCommentVote(commentId: number, v: number) {
    if (!userId) return;
    const existing = commentVotes.find((x) => x.comment_id === commentId && x.user_id === userId);
    if (existing?.vote === v) await supabase.from("comment_votes").delete().eq("user_id", userId).eq("comment_id", commentId);
    else if (existing) await supabase.from("comment_votes").update({ vote: v }).eq("user_id", userId).eq("comment_id", commentId);
    else await supabase.from("comment_votes").insert({ user_id: userId, comment_id: commentId, vote: v });
    const cids = comments.map((c) => c.id);
    if (cids.length === 0) return;
    const { data: cv } = await supabase.from("comment_votes").select("comment_id, user_id, vote").in("comment_id", cids);
    setCommentVotes((cv || []) as { comment_id: number; user_id: string; vote: number }[]);
  }

  async function handleCommentDelete(commentId: number, ownerId: string) {
    const isAdmin = isReviewAdmin;
    if (ownerId !== userId && !isAdmin) return;
    if (!confirm("Удалить комментарий?")) return;
    await supabase.from("comments").delete().eq("id", commentId);
    await loadAll();
  }

  function startEditOwn() {
    if (!myReview) return;
    setMyText(myReview.text); setMyRating(myReview.rating); setEditingOwn(true);
  }

  const roots = comments.filter((c) => !c.parent_id);
  const children = (pid: number) => comments.filter((c) => c.parent_id === pid);

  return (
    <div className="bg-[#1a1a1e] border border-[#222226] rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <i className="fa-solid fa-comments text-sky-400 text-xs"></i>
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Отзывы и комментарии</h3>
        <span className="text-[10px] text-gray-600 ml-auto">{reviews.length + comments.length}</span>
      </div>

      {isAuthed && userId ? (
        <>
          {myReview && !editingOwn && (
            <div className="mb-4 flex items-center gap-2 text-xs">
              <span className="text-gray-500">Ваш отзыв:</span>
              <span className="text-amber-400 font-bold">{myReview.rating}/10</span>
              <button onClick={startEditOwn} className="text-[10px] text-sky-400 hover:text-sky-300 ml-auto transition-colors"><i className="fa-solid fa-pen mr-1"></i>Редактировать</button>
              <button onClick={handleDeleteOwn} className="text-[10px] text-red-400 hover:text-red-300 transition-colors"><i className="fa-solid fa-trash-can"></i></button>
            </div>
          )}
          {(!myReview || editingOwn) && (
            <div className="mb-5 p-3 bg-[#121214] border border-[#222226] rounded-lg flex flex-col gap-2">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-gray-500 text-[10px] uppercase tracking-wider">Оценка:</span>
                <span className="text-amber-400 font-bold">{myRating === "-" ? "—" : `${myRating}/10`}</span>
              </div>
              <textarea value={myText} onChange={(e) => setMyText(e.target.value)} rows={3} placeholder="Поделитесь впечатлениями..."
                className="w-full bg-[#121214] border border-[#222226] rounded px-3 py-2 text-xs text-white outline-none focus:border-sky-500/50 resize-none" />
              {error && <p className="text-[10px] text-red-400">{error}</p>}
              <div className="flex gap-2">
                <button onClick={handleSubmit} disabled={saving} className="bg-sky-500 hover:bg-sky-600 text-white text-[10px] font-bold px-3 py-1.5 rounded transition-all disabled:opacity-50">{saving ? "Сохранение..." : "Опубликовать отзыв"}</button>
                {editingOwn && <button onClick={() => setEditingOwn(false)} className="text-gray-400 text-[10px] font-bold px-3 py-1.5 rounded border border-[#222226] hover:text-white transition-all">Отмена</button>}
              </div>
            </div>
          )}
          <div className="mb-5 p-3 bg-[#121214] border border-[#222226] rounded-lg flex flex-col gap-2">
            <textarea value={commentText} onChange={(e) => setCommentText(e.target.value)} rows={2} placeholder="Написать комментарий..."
              className="w-full bg-[#1a1a1e] border border-[#222226] rounded px-3 py-2 text-xs text-white outline-none focus:border-sky-500/50 resize-none" />
            <button onClick={() => handleCommentPost(null)} className="self-start bg-sky-500 hover:bg-sky-600 text-white text-[10px] font-bold px-3 py-1.5 rounded transition-all">Отправить комментарий</button>
          </div>
        </>
      ) : (
        <p className="mb-5 text-[11px] text-gray-500"><Link href="/login" className="text-sky-400 hover:underline">Войдите</Link>, чтобы оставить отзыв или комментарий</p>
      )}

      <div className="flex flex-col gap-3">
        {reviews.length === 0 && comments.length === 0 && <p className="text-center text-gray-600 text-[11px] py-4">Пока пусто — будьте первым!</p>}
        {[...reviews.map((r) => ({ ...r, kind: "review" as const })), ...comments.filter((c) => !c.parent_id).map((c) => ({ ...c, kind: "comment" as const, rating: undefined }))].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map((item) => {
          if (item.kind === "review") {
            const r = item as Review & { kind: string };
            const likes = reviewVotes.filter((x) => x.review_id === r.id && x.vote === 1).length;
            const dislikes = reviewVotes.filter((x) => x.review_id === r.id && x.vote === -1).length;
            const myV = reviewVotes.find((x) => x.review_id === r.id && x.user_id === userId)?.vote || 0;
            return (
              <div key={`r-${r.id}`} className="p-3 bg-[#121214] border border-[#222226] rounded-lg">
                <div className="flex items-center gap-2 mb-1.5">
                  <Link href={`/profile/${r.user_id}`} className="w-7 h-7 rounded-full bg-gradient-to-tr from-sky-400 to-blue-600 flex items-center justify-center text-white text-[10px] font-black overflow-hidden shrink-0 relative">
                    {r.profiles?.[0]?.avatar_url ? <Image src={r.profiles[0].avatar_url} alt={r.profiles[0].username} fill unoptimized sizes="28px" className="object-cover" /> : (r.profiles?.[0]?.username || "А").substring(0, 2).toUpperCase()}
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link href={`/profile/${r.user_id}`} className="text-xs font-bold text-white hover:text-sky-400 truncate block">{r.profiles?.[0]?.username || "Пользователь"}</Link>
                    <span className="text-[10px] text-gray-600">{new Date(r.created_at).toLocaleDateString("ru-RU")} · отзыв</span>
                  </div>
                  <span className="text-[10px] font-bold text-amber-400 border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 rounded">{r.rating}/10</span>
                  {(r.user_id === userId || isReviewAdmin) && <button onClick={() => handleDeleteReview(r.user_id)} className="text-[9px] text-red-400 hover:text-red-300 ml-1"><i className="fa-solid fa-trash-can"></i></button>}
                  {isAuthed && userId && r.user_id !== userId && (
                    friendIds.has(r.user_id) ? <span className="text-[9px] font-bold px-2 py-1 rounded border text-green-400 border-green-500/20 bg-green-500/10"><i className="fa-solid fa-user-check mr-0.5"></i>В друзьях</span> : pendingIds.has(r.user_id) ? <span className="text-[9px] font-bold px-2 py-1 rounded border text-gray-400 border-[#222226] bg-[#1a1a1e]"><i className="fa-solid fa-clock mr-0.5"></i>Заявка</span> : <button onClick={() => handleAddFriend(r.user_id)} className="text-[9px] font-bold px-2 py-1 rounded border text-sky-400 border-sky-400/30 hover:bg-sky-400/10"><i className="fa-solid fa-user-plus mr-0.5"></i>В друзья</button>
                  )}
                </div>
                <p className="text-xs text-gray-300 whitespace-pre-wrap break-words">{r.text}</p>
                <div className="flex items-center gap-2 mt-2">
                  <button onClick={() => handleReviewVote(r.id, 1)} className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded border ${myV === 1 ? "bg-green-500/20 text-green-400 border-green-500/30" : "text-gray-500 border-[#222226] hover:text-green-400"}`}><i className="fa-solid fa-thumbs-up text-[10px]"></i> {likes || ""}</button>
                  <button onClick={() => handleReviewVote(r.id, -1)} className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded border ${myV === -1 ? "bg-red-500/20 text-red-400 border-red-500/30" : "text-gray-500 border-[#222226] hover:text-red-400"}`}><i className="fa-solid fa-thumbs-down text-[10px]"></i> {dislikes || ""}</button>
                </div>
              </div>
            );
          } else {
            const c = item as Comment & { kind: string };
            const likes = commentVotes.filter((x) => x.comment_id === c.id && x.vote === 1).length;
            const dislikes = commentVotes.filter((x) => x.comment_id === c.id && x.vote === -1).length;
            const myV = commentVotes.find((x) => x.comment_id === c.id && x.user_id === userId)?.vote || 0;
            return (
              <div key={`c-${c.id}`} className="p-3 bg-[#121214] border border-[#222226] rounded-lg">
                <div className="flex items-center gap-2 mb-1.5">
                  <Link href={`/profile/${c.user_id}`} className="w-7 h-7 rounded-full bg-gradient-to-tr from-emerald-400 to-teal-600 flex items-center justify-center text-white text-[10px] font-black overflow-hidden shrink-0 relative">
                    {c.profiles?.[0]?.avatar_url ? <Image src={c.profiles[0].avatar_url} alt={c.profiles[0].username} fill unoptimized sizes="28px" className="object-cover" /> : (c.profiles?.[0]?.username || "?").substring(0, 1).toUpperCase()}
                  </Link>
                  <Link href={`/profile/${c.user_id}`} className="text-xs font-bold text-white hover:text-sky-400 truncate flex-1">{c.profiles?.[0]?.username || "Пользователь"}</Link>
                  <span className="text-[10px] text-gray-600">{new Date(c.created_at).toLocaleDateString("ru-RU")} · комментарий</span>
                  {(c.user_id === userId || isReviewAdmin) && <button onClick={() => handleCommentDelete(c.id, c.user_id)} className="text-[10px] text-red-400 hover:text-red-300"><i className="fa-solid fa-trash-can"></i></button>}
                </div>
                <p className="text-xs text-gray-300 whitespace-pre-wrap break-words">{c.text}</p>
                <div className="flex items-center gap-2 mt-2">
                  <button onClick={() => handleCommentVote(c.id, 1)} className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded border ${myV === 1 ? "bg-green-500/20 text-green-400 border-green-500/30" : "text-gray-500 border-[#222226] hover:text-green-400"}`}><i className="fa-solid fa-thumbs-up text-[10px]"></i> {likes || ""}</button>
                  <button onClick={() => handleCommentVote(c.id, -1)} className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded border ${myV === -1 ? "bg-red-500/20 text-red-400 border-red-500/30" : "text-gray-500 border-[#222226] hover:text-red-400"}`}><i className="fa-solid fa-thumbs-down text-[10px]"></i> {dislikes || ""}</button>
                  {isAuthed && <button onClick={() => setReplyTo(replyTo === c.id ? null : c.id)} className="text-[11px] text-sky-400 hover:text-sky-300 ml-2"><i className="fa-solid fa-reply mr-1"></i>Ответить</button>}
                </div>
                {replyTo === c.id && (
                  <div className="mt-3 flex gap-2">
                    <input value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Ответ..." className="flex-1 bg-[#1a1a1e] border border-[#222226] rounded px-2 py-1.5 text-xs text-white outline-none" />
                    <button onClick={() => handleCommentPost(c.id)} className="bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold px-3 rounded">Отправить</button>
                  </div>
                )}
                <div className="mt-3 flex flex-col gap-2">
                  {children(c.id).map((ch) => {
                    const clikes = commentVotes.filter((x) => x.comment_id === ch.id && x.vote === 1).length;
                    const cdis = commentVotes.filter((x) => x.comment_id === ch.id && x.vote === -1).length;
                    const cmy = commentVotes.find((x) => x.comment_id === ch.id && x.user_id === userId)?.vote || 0;
                    return (
                      <div key={ch.id} className="ml-4 pl-3 border-l border-[#222226] p-2 bg-[#1a1a1e] rounded">
                        <div className="flex items-center gap-2 mb-1">
                          <Link href={`/profile/${ch.user_id}`} className="text-xs font-bold text-white hover:text-sky-400 truncate flex-1">{ch.profiles?.[0]?.username || "Пользователь"}</Link>
                          <span className="text-[10px] text-gray-600">{new Date(ch.created_at).toLocaleDateString("ru-RU")}</span>
                          {(ch.user_id === userId || isReviewAdmin) && <button onClick={() => handleCommentDelete(ch.id, ch.user_id)} className="text-[10px] text-red-400"><i className="fa-solid fa-trash-can"></i></button>}
                        </div>
                        <p className="text-xs text-gray-300 whitespace-pre-wrap break-words">{ch.text}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <button onClick={() => handleCommentVote(ch.id, 1)} className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded border ${cmy === 1 ? "bg-green-500/20 text-green-400 border-green-500/30" : "text-gray-500 border-[#222226]"}`}><i className="fa-solid fa-thumbs-up text-[10px]"></i> {clikes || ""}</button>
                          <button onClick={() => handleCommentVote(ch.id, -1)} className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded border ${cmy === -1 ? "bg-red-500/20 text-red-400 border-red-500/30" : "text-gray-500 border-[#222226]"}`}><i className="fa-solid fa-thumbs-down text-[10px]"></i> {cdis || ""}</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          }
        })}
      </div>
    </div>
  );
}
