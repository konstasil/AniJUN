"use client";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import VerifiedBadge from "@/components/VerifiedBadge";

interface Comment {
  id: number;
  user_id: string;
  text: string;
  created_at: string;
  parent_id: number | null;
  profiles?: { username: string; avatar_url: string; is_verified?: boolean }[];
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function formatToHtml(text: string) {
  let h = escapeHtml(text);
  h = h.replace(/\|\|(.+?)\|\|/g, '<span class="spoiler" onclick="this.classList.toggle(\'revealed\')">$1</span>');
  h = h.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
  h = h.replace(/__(.+?)__/g, "<i>$1</i>");
  h = h.replace(/~~(.+?)~~/g, "<s>$1</s>");
  h = h.replace(/`(.+?)`/g, '<code class="bg-[#222226] px-1 py-0.5 rounded text-[11px]">$1</code>');
  h = h.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-sky-400 hover:underline">$1</a>');
  return h;
}

export default function ReviewsSection({ animeId, isAuthed, userId }: { animeId: number; isAuthed: boolean; userId: string | null; defaultRating?: number | "-" }) {
  const supabase = useMemo(() => createClient(), []);
  const [comments, setComments] = useState<Comment[]>([]);
  const [votes, setVotes] = useState<{ comment_id: number; user_id: string; vote: number }[]>([]);
  const [ratingsMap, setRatingsMap] = useState<Map<string, number>>(new Map());
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [replyText, setReplyText] = useState("");
  const [error, setError] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const mainRef = useRef<HTMLTextAreaElement>(null);
  const replyRef = useRef<HTMLInputElement>(null);
  const [toolbar, setToolbar] = useState<{ show: boolean; for: "main" | "reply" | null }>({ show: false, for: null });

  const load = useCallback(async () => {
    const { data } = await supabase.from("comments").select("id, user_id, text, created_at, parent_id").eq("anime_id", animeId).order("created_at", { ascending: true });
    if (!data || data.length === 0) { setComments([]); setVotes([]); setRatingsMap(new Map()); return; }
    const ids = [...new Set(data.map((c) => c.user_id))];
    const { data: profs } = await supabase.from("profiles").select("id, username, avatar_url, is_verified").in("id", ids);
    const map = new Map<string, { username: string; avatar_url: string; is_verified?: boolean }>();
    profs?.forEach((p) => map.set(p.id, { username: p.username, avatar_url: p.avatar_url || "", is_verified: p.is_verified }));
    const enriched = data.map((c) => ({ ...c, profiles: map.has(c.user_id) ? [map.get(c.user_id)!] : [] }));
    setComments(enriched as unknown as Comment[]);
    const cids = data.map((c) => c.id);
    const { data: v } = await supabase.from("comment_votes").select("comment_id, user_id, vote").in("comment_id", cids);
    setVotes((v || []) as { comment_id: number; user_id: string; vote: number }[]);
    const { data: ratings } = await supabase.from("ratings").select("user_id, rating").eq("anime_id", animeId).in("user_id", ids);
    const rmap = new Map<string, number>();
    ratings?.forEach((r) => rmap.set(r.user_id, r.rating));
    setRatingsMap(rmap);
  }, [animeId, supabase]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!userId) { setIsAdmin(false); return; }
    supabase.rpc("is_admin").then(({ data }) => setIsAdmin(!!data));
  }, [userId, supabase]);

  function checkSelection(forType: "main" | "reply") {
    const el = forType === "main" ? mainRef.current : replyRef.current;
    if (!el) { setToolbar({ show: false, for: null }); return; }
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    if (end > start) setToolbar({ show: true, for: forType });
    else setToolbar({ show: false, for: null });
  }

  function wrapSelection(forType: "main" | "reply", before: string, after: string) {
    const el = forType === "main" ? mainRef.current : replyRef.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const val = forType === "main" ? text : replyText;
    const selected = val.substring(start, end);
    if (!selected) return;
    const next = val.substring(0, start) + before + selected + after + val.substring(end);
    if (forType === "main") setText(next);
    else setReplyText(next);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + before.length, end + before.length);
      checkSelection(forType);
    }, 0);
  }

  function handleSpoiler(forType: "main" | "reply") { wrapSelection(forType, "||", "||"); }
  function handleBold(forType: "main" | "reply") { wrapSelection(forType, "**", "**"); }
  function handleItalic(forType: "main" | "reply") { wrapSelection(forType, "__", "__"); }
  function handleStrike(forType: "main" | "reply") { wrapSelection(forType, "~~", "~~"); }
  function handleMono(forType: "main" | "reply") { wrapSelection(forType, "`", "`"); }
  function handleLink(forType: "main" | "reply") {
    const el = forType === "main" ? mainRef.current : replyRef.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const val = forType === "main" ? text : replyText;
    const selected = val.substring(start, end);
    if (!selected) return;
    const url = prompt("Введите ссылку:");
    if (!url) return;
    const next = val.substring(0, start) + `[${selected}](${url})` + val.substring(end);
    if (forType === "main") setText(next);
    else setReplyText(next);
  }

  async function handlePost(parentId: number | null) {
    if (!userId) return;
    const body = parentId ? replyText.trim() : text.trim();
    if (!body) return;
    try {
      const { data: muted } = await supabase.rpc("is_current_user_muted");
      if (muted) { setError("Вы замучены"); return; }
      const { data: banned } = await supabase.rpc("is_current_user_banned");
      if (banned) { setError("Вы забанены"); return; }
    } catch {}
    const { error } = await supabase.from("comments").insert({ user_id: userId, anime_id: animeId, text: body, parent_id: parentId });
    if (error) { setError(error.message); return; }
    setText(""); setReplyText(""); setReplyTo(null); setError(""); setToolbar({ show: false, for: null }); await load();
  }

  async function handleVote(commentId: number, v: number) {
    if (!userId) return;
    const existing = votes.find((x) => x.comment_id === commentId && x.user_id === userId);
    if (existing?.vote === v) await supabase.from("comment_votes").delete().eq("user_id", userId).eq("comment_id", commentId);
    else if (existing) await supabase.from("comment_votes").update({ vote: v }).eq("user_id", userId).eq("comment_id", commentId);
    else await supabase.from("comment_votes").insert({ user_id: userId, comment_id: commentId, vote: v });
    await load();
  }

  async function handleDelete(commentId: number, ownerId: string) {
    if (ownerId !== userId && !isAdmin) return;
    if (!confirm("Удалить комментарий?")) return;
    await supabase.from("comments").delete().eq("id", commentId);
    await load();
  }

  function voteCount(id: number, dir: number) { return votes.filter((x) => x.comment_id === id && x.vote === dir).length; }
  function myVote(id: number) { return votes.find((x) => x.comment_id === id && x.user_id === userId)?.vote || 0; }
  const roots = comments.filter((c) => !c.parent_id);
  const children = (pid: number) => comments.filter((c) => c.parent_id === pid);

  const Toolbar = ({ forType }: { forType: "main" | "reply" }) => (
    <div className="flex items-center gap-1 p-1 bg-[#1a1a1e] border border-[#222226] rounded-lg shadow-xl">
      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => handleBold(forType)} className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#222226] text-gray-300 hover:text-white text-xs font-black">B</button>
      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => handleItalic(forType)} className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#222226] text-gray-300 hover:text-white text-xs italic">I</button>
      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => handleStrike(forType)} className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#222226] text-gray-300 hover:text-white text-xs line-through">S</button>
      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => handleMono(forType)} className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#222226] text-gray-300 hover:text-white text-[10px] font-mono">{"</>"}</button>
      <div className="w-px h-5 bg-[#222226]" />
      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => handleSpoiler(forType)} className="px-2 h-7 flex items-center justify-center rounded hover:bg-[#222226] text-gray-300 hover:text-white text-[10px] font-bold gap-1"><i className="fa-solid fa-eye-slash text-[10px]"></i> Скрытый</button>
      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => handleLink(forType)} className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#222226] text-sky-400 hover:text-white"><i className="fa-solid fa-link text-[10px]"></i></button>
    </div>
  );

  return (
    <div className="bg-[#1a1a1e] border border-[#222226] rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <i className="fa-solid fa-comments text-sky-400 text-xs"></i>
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Комментарии</h3>
        <span className="text-[10px] text-gray-600 ml-auto">{comments.length}</span>
      </div>

      {isAuthed && userId ? (
        <div className="mb-5 p-3 bg-[#121214] border border-[#222226] rounded-lg flex flex-col gap-2">
          <div className="relative">
            {toolbar.show && toolbar.for === "main" && (
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 z-10">
                <Toolbar forType="main" />
              </div>
            )}
            <textarea ref={mainRef} value={text} onChange={(e) => setText(e.target.value)} onSelect={() => checkSelection("main")} onMouseUp={() => checkSelection("main")} onKeyUp={() => checkSelection("main")} onBlur={() => setTimeout(() => setToolbar({ show: false, for: null }), 150)} rows={2} placeholder="Написать комментарий..." className="w-full bg-[#1a1a1e] border border-[#222226] rounded px-3 py-2 text-xs text-white outline-none focus:border-sky-500/50 resize-none" />
          </div>
          {error && <p className="text-[10px] text-red-400">{error}</p>}
          <button onClick={() => handlePost(null)} className="self-start bg-sky-500 hover:bg-sky-600 text-white text-[10px] font-bold px-3 py-1.5 rounded transition-all">Отправить</button>
        </div>
      ) : (
        <p className="mb-5 text-[11px] text-gray-500"><Link href="/login" className="text-sky-400 hover:underline">Войдите</Link>, чтобы комментировать</p>
      )}

      <div className="flex flex-col gap-3">
        {roots.length === 0 && <p className="text-center text-gray-600 text-[11px] py-4">Комментариев пока нет</p>}
        {roots.map((c) => (
          <div key={c.id} className="p-3 bg-[#121214] border border-[#222226] rounded-lg">
            <div className="flex items-center gap-2 mb-1.5">
              <Link href={`/profile/${c.user_id}`} className="w-7 h-7 rounded-full bg-gradient-to-tr from-emerald-400 to-teal-600 flex items-center justify-center text-white text-[10px] font-black overflow-hidden shrink-0 relative">
                {c.profiles?.[0]?.avatar_url ? <Image src={c.profiles[0].avatar_url} alt={c.profiles[0].username} fill unoptimized sizes="28px" className="object-cover" /> : (c.profiles?.[0]?.username || "?").substring(0, 1).toUpperCase()}
              </Link>
              <Link href={`/profile/${c.user_id}`} className="text-xs font-bold text-white hover:text-sky-400 truncate flex-1 flex items-center gap-1">{c.profiles?.[0]?.username || "Пользователь"} {c.profiles?.[0]?.is_verified && <VerifiedBadge size={14} />}</Link>
              {ratingsMap.get(c.user_id) && <span className="text-[10px] font-bold text-amber-400 border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 rounded">{ratingsMap.get(c.user_id)}/10</span>}
              <span className="text-[10px] text-gray-600">{new Date(c.created_at).toLocaleDateString("ru-RU")}</span>
              {(c.user_id === userId || isAdmin) && <button onClick={() => handleDelete(c.id, c.user_id)} className="text-[10px] text-red-400 hover:text-red-300"><i className="fa-solid fa-trash-can"></i></button>}
            </div>
            <div className="text-xs text-gray-300 whitespace-pre-wrap break-words" dangerouslySetInnerHTML={{ __html: formatToHtml(c.text) }} />
            <div className="flex items-center gap-2 mt-2">
              <button onClick={() => handleVote(c.id, 1)} className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded border ${myVote(c.id) === 1 ? "bg-green-500/20 text-green-400 border-green-500/30" : "text-gray-500 border-[#222226] hover:text-green-400"}`}><i className="fa-solid fa-thumbs-up text-[10px]"></i> {voteCount(c.id, 1) || ""}</button>
              <button onClick={() => handleVote(c.id, -1)} className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded border ${myVote(c.id) === -1 ? "bg-red-500/20 text-red-400 border-red-500/30" : "text-gray-500 border-[#222226] hover:text-red-400"}`}><i className="fa-solid fa-thumbs-down text-[10px]"></i> {voteCount(c.id, -1) || ""}</button>
              {isAuthed && <button onClick={() => setReplyTo(replyTo === c.id ? null : c.id)} className="text-[11px] text-sky-400 hover:text-sky-300 ml-2"><i className="fa-solid fa-reply mr-1"></i>Ответить</button>}
            </div>
            {replyTo === c.id && (
              <div className="mt-3 flex flex-col gap-2">
                <div className="relative">
                  {toolbar.show && toolbar.for === "reply" && (
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 z-10">
                      <Toolbar forType="reply" />
                    </div>
                  )}
                  <input ref={replyRef} value={replyText} onChange={(e) => setReplyText(e.target.value)} onSelect={() => checkSelection("reply")} onMouseUp={() => checkSelection("reply")} onKeyUp={() => checkSelection("reply")} onBlur={() => setTimeout(() => setToolbar({ show: false, for: null }), 150)} placeholder="Ответ..." className="w-full bg-[#1a1a1e] border border-[#222226] rounded px-2 py-1.5 text-xs text-white outline-none" />
                </div>
                <button onClick={() => handlePost(c.id)} className="self-start bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold px-3 py-1 rounded">Отправить</button>
              </div>
            )}
            <div className="mt-3 flex flex-col gap-2">
              {children(c.id).map((ch) => (
                <div key={ch.id} className="ml-4 pl-3 border-l border-[#222226] p-2 bg-[#1a1a1e] rounded">
                  <div className="flex items-center gap-2 mb-1">
                    <Link href={`/profile/${ch.user_id}`} className="w-6 h-6 rounded-full bg-gradient-to-tr from-emerald-400 to-teal-600 flex items-center justify-center text-white text-[9px] font-black overflow-hidden shrink-0 relative">
                      {ch.profiles?.[0]?.avatar_url ? <Image src={ch.profiles[0].avatar_url} alt={ch.profiles[0].username} fill unoptimized sizes="24px" className="object-cover" /> : (ch.profiles?.[0]?.username || "?").substring(0, 1).toUpperCase()}
                    </Link>
                    <Link href={`/profile/${ch.user_id}`} className="text-xs font-bold text-white hover:text-sky-400 truncate flex-1 flex items-center gap-1">{ch.profiles?.[0]?.username || "Пользователь"} {ch.profiles?.[0]?.is_verified && <VerifiedBadge size={12} />}</Link>
                    {ratingsMap.get(ch.user_id) && <span className="text-[9px] font-bold text-amber-400 border border-amber-400/30 bg-amber-400/10 px-1 py-0.5 rounded">{ratingsMap.get(ch.user_id)}/10</span>}
                    <span className="text-[10px] text-gray-600">{new Date(ch.created_at).toLocaleDateString("ru-RU")}</span>
                    {(ch.user_id === userId || isAdmin) && <button onClick={() => handleDelete(ch.id, ch.user_id)} className="text-[10px] text-red-400"><i className="fa-solid fa-trash-can"></i></button>}
                  </div>
                  <div className="text-xs text-gray-300 whitespace-pre-wrap break-words" dangerouslySetInnerHTML={{ __html: formatToHtml(ch.text) }} />
                  <div className="flex items-center gap-2 mt-1.5">
                    <button onClick={() => handleVote(ch.id, 1)} className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded border ${myVote(ch.id) === 1 ? "bg-green-500/20 text-green-400 border-green-500/30" : "text-gray-500 border-[#222226]"}`}><i className="fa-solid fa-thumbs-up text-[10px]"></i> {voteCount(ch.id, 1) || ""}</button>
                    <button onClick={() => handleVote(ch.id, -1)} className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded border ${myVote(ch.id) === -1 ? "bg-red-500/20 text-red-400 border-red-500/30" : "text-gray-500 border-[#222226]"}`}><i className="fa-solid fa-thumbs-down text-[10px]"></i> {voteCount(ch.id, -1) || ""}</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
