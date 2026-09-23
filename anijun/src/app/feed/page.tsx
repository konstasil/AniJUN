"use client";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";

interface Post {
  id: number;
  user_id: string;
  text: string;
  created_at: string;
  profiles?: { username: string; avatar_url: string }[];
}

interface AnimeRec { id: number; slug?: string; title: string; image_url: string; genres: string[] }

export default function FeedPage() {
  const supabase = useMemo(() => createClient(), []);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [text, setText] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [likes, setLikes] = useState<Map<number, number>>(new Map());
  const [myLikes, setMyLikes] = useState<Set<number>>(new Set());
  const [commentsCount, setCommentsCount] = useState<Map<number, number>>(new Map());
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [recs, setRecs] = useState<AnimeRec[]>([]);

  useEffect(() => { document.title = "Лента | AniJUN"; }, []);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { setIsAdmin(false); return; }
      setUserId(session.user.id);
      try { const { data } = await supabase.rpc("is_admin"); setIsAdmin(!!data); } catch { setIsAdmin(false); }
    })();
  }, [supabase]);

  const load = useCallback(async () => {
    const { data } = await supabase.from("posts").select("id, user_id, text, created_at").order("created_at", { ascending: false }).limit(100);
    if (!data) { setPosts([]); return; }
    const ids = [...new Set(data.map((p) => p.user_id))];
    const { data: profs } = await supabase.from("profiles").select("id, username, avatar_url").in("id", ids);
    const map = new Map<string, { username: string; avatar_url: string }>();
    profs?.forEach((p) => map.set(p.id, { username: p.username, avatar_url: p.avatar_url }));
    setPosts(data.map((p) => ({ ...p, profiles: map.has(p.user_id) ? [map.get(p.user_id)!] : [] })) as Post[]);

    const pids = data.map((p) => p.id);
    if (pids.length > 0) {
      const { data: likeRows } = await supabase.from("post_likes").select("post_id, user_id").in("post_id", pids);
      const lm = new Map<number, number>();
      const my = new Set<number>();
      likeRows?.forEach((r) => {
        lm.set(r.post_id, (lm.get(r.post_id) || 0) + 1);
        if (r.user_id === userId) my.add(r.post_id);
      });
      setLikes(lm);
      setMyLikes(my);
      const { data: commentRows } = await supabase.from("post_comments").select("post_id").in("post_id", pids);
      const cm = new Map<number, number>();
      commentRows?.forEach((r) => cm.set(r.post_id, (cm.get(r.post_id) || 0) + 1));
      setCommentsCount(cm);
    }
    if (userId) {
      const { data: follows } = await supabase.from("follows").select("following_id").eq("follower_id", userId);
      setFollowing(new Set((follows || []).map((f) => f.following_id)));
    }
    const { data: animeList } = await supabase.from("anime").select("id, slug, title, image_url, genres").limit(50);
    if (animeList) {
      const shuffled = [...animeList].sort(() => Math.random() - 0.5).slice(0, 10);
      setRecs(shuffled);
    }
  }, [supabase, userId]);

  useEffect(() => { if (isAdmin) load(); }, [isAdmin, load]);

  async function handlePost() {
    if (!userId || !text.trim()) return;
    setSending(true);
    const { error } = await supabase.from("posts").insert({ user_id: userId, text: text.trim() });
    setSending(false);
    if (error) return;
    setText("");
    await load();
  }

  async function toggleLike(postId: number) {
    if (!userId) return;
    if (myLikes.has(postId)) {
      await supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", userId);
    } else {
      await supabase.from("post_likes").insert({ post_id: postId, user_id: userId });
    }
    await load();
  }

  async function copyLink(id: number) {
    const url = `${window.location.origin}/feed#post-${id}`;
    try { await navigator.clipboard.writeText(url); } catch {}
  }

  function score(post: Post): number {
    const hours = (Date.now() - new Date(post.created_at).getTime()) / 3600000;
    const timeDecay = Math.exp(-hours / 36);
    const w = (likes.get(post.id) || 0) * 3 + (commentsCount.get(post.id) || 0) * 6 + 1;
    const affinity = following.has(post.user_id) ? 1.8 : 1.0;
    return affinity * w * timeDecay;
  }

  const sorted = useMemo(() => {
    return [...posts].sort((a, b) => score(b) - score(a));
  }, [posts, likes, commentsCount, following]);

  if (isAdmin === null) return <div className="text-center py-20 text-gray-500 text-xs">Загрузка...</div>;
  if (!isAdmin) {
    return (
      <div className="text-center py-20">
        <i className="fa-solid fa-lock text-red-400 text-3xl mb-4 block"></i>
        <p className="text-gray-400 text-sm">Доступ только для админов.</p>
        <Link href="/" className="text-sky-400 text-xs hover:underline mt-3 inline-block">На главную</Link>
      </div>
    );
  }

  const feedItems: (Post | { rec: AnimeRec })[] = [];
  sorted.forEach((p, idx) => {
    feedItems.push(p);
    if ((idx + 1) % 6 === 0 && recs.length > 0) {
      const rec = recs[Math.floor(idx / 6) % recs.length];
      feedItems.push({ rec });
    }
  });

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <i className="fa-solid fa-rss text-sky-400"></i>
        <h1 className="text-sm font-bold text-white">Лента</h1>
      </div>
      <div className="bg-[#1a1a1e] border border-[#222226] rounded-xl p-4 flex flex-col gap-3">
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="Что нового?" className="w-full bg-[#121214] border border-[#222226] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-sky-500/50 resize-none" />
        <button onClick={handlePost} disabled={sending || !text.trim()} className="self-end bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white text-xs font-bold px-5 py-2 rounded-lg transition-all">Опубликовать</button>
      </div>
      <div className="space-y-3">
        {feedItems.length === 0 && <p className="text-center text-gray-600 text-xs py-10">Пока пусто</p>}
        {feedItems.map((item, i) => {
          if ("rec" in item) {
            const a = item.rec;
            const url = a.slug ? `/anime/${a.slug}` : `/anime/${a.id}`;
            return (
              <Link key={`rec-${i}`} href={url} className="block bg-gradient-to-br from-sky-500/10 to-blue-600/10 border border-sky-500/20 rounded-xl p-4 flex gap-3 hover:border-sky-500/40 transition-all">
                <div className="w-14 h-20 rounded overflow-hidden bg-[#121214] relative shrink-0">
                  <Image src={a.image_url} alt={a.title} fill unoptimized className="object-cover" sizes="56px" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-sky-400 uppercase">Возможно, вам понравится</p>
                  <p className="text-sm font-bold text-white truncate">{a.title}</p>
                  <p className="text-[11px] text-gray-500">{a.genres.slice(0, 3).join(", ")}</p>
                </div>
              </Link>
            );
          }
          const p = item as Post;
          return (
            <div key={p.id} id={`post-${p.id}`} className="bg-[#1a1a1e] border border-[#222226] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Link href={`/profile/${p.user_id}`} className="w-7 h-7 rounded-full bg-gradient-to-tr from-sky-400 to-blue-600 flex items-center justify-center text-white text-[10px] font-black overflow-hidden relative">
                  {p.profiles?.[0]?.avatar_url ? <Image src={p.profiles[0].avatar_url} alt="" fill unoptimized className="object-cover" /> : (p.profiles?.[0]?.username || "?").slice(0, 1).toUpperCase()}
                </Link>
                <Link href={`/profile/${p.user_id}`} className="text-xs font-bold text-white hover:text-sky-400">{p.profiles?.[0]?.username || "Пользователь"}</Link>
                <span className="text-[10px] text-gray-600 ml-auto">{new Date(p.created_at).toLocaleString("ru-RU")}</span>
              </div>
              <p className="text-sm text-gray-200 whitespace-pre-wrap break-words">{p.text}</p>
              <div className="flex gap-2 mt-3">
                <button onClick={() => toggleLike(p.id)} className={`text-[11px] px-3 py-1 rounded-lg border ${myLikes.has(p.id) ? "bg-sky-500/20 text-sky-400 border-sky-500/30" : "text-gray-400 border-[#222226] hover:text-white"}`}>
                  <i className="fa-solid fa-heart mr-1"></i> {likes.get(p.id) || 0}
                </button>
                <button onClick={() => copyLink(p.id)} className="text-[11px] text-gray-400 hover:text-white border border-[#222226] px-3 py-1 rounded-lg"><i className="fa-solid fa-share-nodes mr-1"></i> Поделиться</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
