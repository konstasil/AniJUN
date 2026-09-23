"use client";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

interface Post {
  id: number;
  user_id: string;
  text: string;
  created_at: string;
  profiles?: { username: string; avatar_url: string }[];
}

export default function FeedPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [text, setText] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => { document.title = "Лента | AniJUN"; }, []);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { setIsAdmin(false); return; }
      setUserId(session.user.id);
      try { const { data } = await supabase.rpc("is_admin"); setIsAdmin(!!data); } catch { setIsAdmin(false); }
    })();
  }, [supabase]);

  async function load() {
    const { data } = await supabase.from("posts").select("id, user_id, text, created_at").order("created_at", { ascending: false }).limit(50);
    if (!data || data.length === 0) { setPosts([]); return; }
    const ids = [...new Set(data.map((p) => p.user_id))];
    const { data: profs } = await supabase.from("profiles").select("id, username, avatar_url").in("id", ids);
    const map = new Map<string, { username: string; avatar_url: string }>();
    profs?.forEach((p) => map.set(p.id, { username: p.username, avatar_url: p.avatar_url }));
    setPosts(data.map((p) => ({ ...p, profiles: map.has(p.user_id) ? [map.get(p.user_id)!] : [] })) as Post[]);
  }

  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  async function handlePost() {
    if (!userId || !text.trim()) return;
    setSending(true);
    const { error } = await supabase.from("posts").insert({ user_id: userId, text: text.trim() });
    setSending(false);
    if (error) return;
    setText("");
    await load();
  }

  async function copyLink(id: number) {
    const url = `${window.location.origin}/feed#post-${id}`;
    try { await navigator.clipboard.writeText(url); } catch {}
  }

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
        {posts.length === 0 && <p className="text-center text-gray-600 text-xs py-10">Пока пусто</p>}
        {posts.map((p) => (
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
              <button onClick={() => copyLink(p.id)} className="text-[11px] text-gray-400 hover:text-white border border-[#222226] px-3 py-1 rounded-lg"><i className="fa-solid fa-share-nodes mr-1"></i> Поделиться</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
