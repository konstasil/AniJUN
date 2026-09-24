"use client";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import VerifiedBadge from "@/components/VerifiedBadge";
import ImageUpload from "@/components/ImageUpload";

interface Post {
  id: number;
  user_id: string;
  text: string;
  image_url?: string | null;
  created_at: string;
  updated_at?: string | null;
  profiles?: { username: string; avatar_url: string; is_verified?: boolean }[];
}

interface AnimeRec { id: number; slug?: string; title: string; image_url: string; genres: string[] }

interface PostComment {
  id: number;
  post_id: number;
  user_id: string;
  text: string;
  created_at: string;
  parent_id?: number | null;
  profiles?: { username: string; avatar_url: string; is_verified?: boolean }[];
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function formatToHtml(text: string, usernameToId: Map<string, string>) {
  let h = escapeHtml(text);
  h = h.replace(/\|\|(.+?)\|\|/g, '<span class="spoiler" onclick="this.classList.toggle(\'revealed\')">$1</span>');
  h = h.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
  h = h.replace(/__(.+?)__/g, "<i>$1</i>");
  h = h.replace(/~~(.+?)~~/g, "<s>$1</s>");
  h = h.replace(/`(.+?)`/g, '<code class="bg-[#222226] px-1 py-0.5 rounded text-[11px]">$1</code>');
  h = h.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, p1, p2) => {
    let url = p2;
    if (!/^https?:\/\//i.test(url) && !/^mailto:/i.test(url) && !/^#/.test(url)) url = "https://" + url;
    const safeUrl = url.replace(/"/g, "&quot;");
    return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="text-sky-400 hover:underline">${p1}</a>`;
  });
  h = h.replace(/(?<!href="|">)(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-sky-400 hover:underline">$1</a>');
  h = h.replace(/@([a-zA-Z0-9_]+)/g, (m, uname) => {
    const id = usernameToId.get(uname.toLowerCase());
    if (id) return `<a href="/profile/${id}" class="text-sky-400 hover:underline">@${uname}</a>`;
    return m;
  });
  return h;
}

export default function FeedPage() {
  const supabase = useMemo(() => createClient(), []);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [text, setText] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [showComposer, setShowComposer] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [likes, setLikes] = useState<Map<number, number>>(new Map());
  const [myLikes, setMyLikes] = useState<Set<number>>(new Set());
  const [commentsCount, setCommentsCount] = useState<Map<number, number>>(new Map());
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [recs, setRecs] = useState<AnimeRec[]>([]);
  const [usernameToId, setUsernameToId] = useState<Map<string, string>>(new Map());
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [postComments, setPostComments] = useState<Map<number, PostComment[]>>(new Map());
  const [replyText, setReplyText] = useState<Map<number, string>>(new Map());
  const [replyTo, setReplyTo] = useState<Map<number, number | null>>(new Map());
  const [pcLikes, setPcLikes] = useState<Map<number, number>>(new Map());
  const [myPcLikes, setMyPcLikes] = useState<Set<number>>(new Set());
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [editingPost, setEditingPost] = useState<number | null>(null);
  const [editPostText, setEditPostText] = useState("");
  const [reportModal, setReportModal] = useState<{ type: "post" | "pc"; id: number } | null>(null);
  const [reportReason, setReportReason] = useState("");
  const mainRef = useRef<HTMLTextAreaElement>(null);
  const [toolbar, setToolbar] = useState<{ show: boolean }>({ show: false });
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerScale, setViewerScale] = useState(1);

  useEffect(() => { document.title = "Лента | AniJUN"; }, []);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { setIsAdmin(false); return; }
      setUserId(session.user.id);
      try {
        const { data } = await supabase.rpc("is_admin");
        const admin = !!data;
        setIsAdmin(admin);
        setIsAdminUser(admin);
      } catch { setIsAdmin(false); }
      const { data: profs } = await supabase.from("profiles").select("id, username");
      const u2i = new Map<string, string>();
      profs?.forEach((p) => { u2i.set(p.username.toLowerCase(), p.id); });
      setUsernameToId(u2i);
    })();
  }, [supabase]);

  const load = useCallback(async () => {
    const { data } = await supabase.from("posts").select("id, user_id, text, image_url, created_at, updated_at").order("created_at", { ascending: false }).limit(100);
    if (!data) { setPosts([]); return; }
    const ids = [...new Set(data.map((p) => p.user_id))];
    const { data: profs } = await supabase.from("profiles").select("id, username, avatar_url, is_verified").in("id", ids);
    const map = new Map<string, { username: string; avatar_url: string; is_verified?: boolean }>();
    profs?.forEach((p) => map.set(p.id, { username: p.username, avatar_url: p.avatar_url || "", is_verified: p.is_verified }));
    setPosts(data.map((p) => ({ ...p, profiles: map.has(p.user_id) ? [map.get(p.user_id)!] : [] })) as Post[]);

    const pids = data.map((p) => p.id);
    if (pids.length > 0) {
      const { data: likeRows } = await supabase.from("post_likes").select("post_id, user_id").in("post_id", pids);
      const lm = new Map<number, number>();
      const my = new Set<number>();
      const uid = (await supabase.auth.getSession()).data.session?.user.id;
      likeRows?.forEach((r) => {
        lm.set(r.post_id, (lm.get(r.post_id) || 0) + 1);
        if (r.user_id === uid) my.add(r.post_id);
      });
      setLikes(lm);
      setMyLikes(my);
      const { data: commentRows } = await supabase.from("post_comments").select("post_id").in("post_id", pids);
      const cm = new Map<number, number>();
      commentRows?.forEach((r) => cm.set(r.post_id, (cm.get(r.post_id) || 0) + 1));
      setCommentsCount(cm);
    }
    const { data: { session } } = await supabase.auth.getSession();
    const uid2 = session?.user.id;
    if (uid2) {
      const { data: follows } = await supabase.from("follows").select("following_id").eq("follower_id", uid2);
      setFollowing(new Set((follows || []).map((f) => f.following_id)));
    }
    const { data: animeList } = await supabase.from("anime").select("id, slug, title, image_url, genres").limit(50);
    if (animeList) {
      const shuffled = [...animeList].sort(() => Math.random() - 0.5).slice(0, 10);
      setRecs(shuffled);
    }
  }, [supabase]);

  useEffect(() => { if (isAdmin) load(); }, [isAdmin, load]);
  useEffect(() => { if (!isAdmin) return; const id = setInterval(() => load(), 30000); return () => clearInterval(id); }, [isAdmin, load]);

  function checkSelection() {
    const el = mainRef.current;
    if (!el) { setToolbar({ show: false }); return; }
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    setToolbar({ show: end > start });
  }
  function wrapSelection(before: string, after: string) {
    const el = mainRef.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const selected = text.substring(start, end);
    if (!selected) return;
    const next = text.substring(0, start) + before + selected + after + text.substring(end);
    setText(next);
    setTimeout(() => { el.focus(); el.setSelectionRange(start + before.length, end + before.length); checkSelection(); }, 0);
  }
  function handleSpoiler() { wrapSelection("||", "||"); }
  function handleBold() { wrapSelection("**", "**"); }
  function handleItalic() { wrapSelection("__", "__"); }
  function handleStrike() { wrapSelection("~~", "~~"); }
  function handleMono() { wrapSelection("`", "`"); }
  function handleLink() {
    const el = mainRef.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const selected = text.substring(start, end);
    if (!selected) return;
    const url = prompt("Введите ссылку:");
    if (!url) return;
    const next = text.substring(0, start) + `[${selected}](${url})` + text.substring(end);
    setText(next);
  }

  async function handlePost() {
    if (!userId || !text.trim()) return;
    setSending(true);
    const { data: inserted, error } = await supabase.from("posts").insert({ user_id: userId, text: text.trim(), image_url: imageUrl || null }).select("id").single();
    if (!error && inserted) {
      const mentions = [...text.matchAll(/@([a-zA-Z0-9_]+)/g)].map((m) => m[1].toLowerCase());
      for (const uname of [...new Set(mentions)]) {
        const targetId = usernameToId.get(uname);
        if (targetId && targetId !== userId) {
          await supabase.from("notifications").insert({ user_id: targetId, actor_id: userId, type: "mention", target_id: inserted.id });
        }
      }
    }
    setSending(false);
    if (error) return;
    setText("");
    setImageUrl("");
    setShowComposer(false);
    await load();
  }

  async function toggleLike(postId: number) {
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user.id;
    if (!uid) return;
    if (myLikes.has(postId)) await supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", uid);
    else await supabase.from("post_likes").insert({ post_id: postId, user_id: uid });
    await load();
  }
  async function copyLink(id: number) {
    const url = `${window.location.origin}/feed#post-${id}`;
    try { await navigator.clipboard.writeText(url); alert("Ссылка скопирована"); } catch {
      const ta = document.createElement("textarea"); ta.value = url; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta); alert("Ссылка скопирована");
    }
  }
  async function handleDelete(postId: number, ownerId: string) {
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user.id;
    if (!uid || (ownerId !== uid && !isAdminUser)) return;
    if (!confirm("Удалить пост?")) return;
    await supabase.from("posts").delete().eq("id", postId);
    await load();
  }
  async function handleEditPost(postId: number) {
    if (!editPostText.trim()) return;
    await supabase.from("posts").update({ text: editPostText.trim() }).eq("id", postId);
    setEditingPost(null);
    setEditPostText("");
    await load();
  }
  async function handleReport(postId: number) {
    setReportModal({ type: "post", id: postId });
  }
  async function submitReport() {
    if (!reportReason.trim() || !reportModal) return;
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user.id;
    if (!uid) return;
    let error = null;
    if (reportModal.type === "post") {
      const res = await supabase.from("post_reports").insert({ post_id: reportModal.id, reporter_id: uid, reason: reportReason.trim() });
      error = res.error;
    } else {
      const res = await supabase.from("post_comment_reports").insert({ comment_id: reportModal.id, reporter_id: uid, reason: reportReason.trim() });
      error = res.error;
    }
    if (error) alert(error.message); else { alert("Жалоба отправлена"); setReportModal(null); setReportReason(""); }
  }
  async function loadComments(postId: number) {
    const { data } = await supabase.from("post_comments").select("id, post_id, user_id, text, created_at, parent_id").eq("post_id", postId).order("created_at", { ascending: true });
    if (!data) return;
    const ids = [...new Set(data.map((c) => c.user_id))];
    const { data: profs } = await supabase.from("profiles").select("id, username, avatar_url, is_verified").in("id", ids);
    const map = new Map<string, { username: string; avatar_url: string; is_verified?: boolean }>();
    profs?.forEach((p) => map.set(p.id, { username: p.username, avatar_url: p.avatar_url || "", is_verified: p.is_verified }));
    const enriched = data.map((c) => {
      const pr = map.get(c.user_id);
      return { ...c, profiles: [{ username: pr?.username || "?", avatar_url: pr?.avatar_url || "", is_verified: pr?.is_verified }] };
    }) as (PostComment & { profiles: { username: string; avatar_url: string; is_verified?: boolean }[] })[];
    setPostComments((prev) => new Map(prev).set(postId, enriched));
    const cids = data.map((c) => c.id);
    if (cids.length > 0) {
      const { data: likeRows } = await supabase.from("post_comment_likes").select("comment_id, user_id").in("comment_id", cids);
      const lm = new Map<number, number>();
      const my = new Set<number>();
      const uid = (await supabase.auth.getSession()).data.session?.user.id;
      likeRows?.forEach((r) => { lm.set(r.comment_id, (lm.get(r.comment_id) || 0) + 1); if (r.user_id === uid) my.add(r.comment_id); });
      setPcLikes((prev) => { const m = new Map(prev); cids.forEach((id) => m.delete(id)); likeRows?.forEach((r) => m.set(r.comment_id, lm.get(r.comment_id) || 0)); return m; });
      setMyPcLikes((prev) => { const n = new Set(prev); cids.forEach((id) => n.delete(id)); my.forEach((id) => n.add(id)); return n; });
    }
  }
  async function handleReply(postId: number) {
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user.id;
    if (!uid) return;
    const body = (replyText.get(postId) || "").trim();
    if (!body) return;
    const parentId = replyTo.get(postId) || null;
    await supabase.from("post_comments").insert({ post_id: postId, user_id: uid, text: body, parent_id: parentId });
    const mentions = [...body.matchAll(/@([a-zA-Z0-9_]+)/g)].map((m) => m[1].toLowerCase());
    for (const uname of [...new Set(mentions)]) {
      const targetId = usernameToId.get(uname);
      if (targetId && targetId !== uid) await supabase.from("notifications").insert({ user_id: targetId, actor_id: uid, type: "mention", target_id: postId });
    }
    const { data: post } = await supabase.from("posts").select("user_id").eq("id", postId).single();
    if (post && post.user_id !== uid) await supabase.from("notifications").insert({ user_id: post.user_id, actor_id: uid, type: "reply", target_id: postId });
    if (parentId) {
      const { data: parent } = await supabase.from("post_comments").select("user_id").eq("id", parentId).single();
      if (parent && parent.user_id !== uid && parent.user_id !== post?.user_id) await supabase.from("notifications").insert({ user_id: parent.user_id, actor_id: uid, type: "reply", target_id: postId });
    }
    setReplyText((prev) => { const m = new Map(prev); m.set(postId, ""); return m; });
    setReplyTo((prev) => { const m = new Map(prev); m.set(postId, null); return m; });
    await loadComments(postId);
    await load();
  }
  async function togglePcLike(commentId: number, postId: number) {
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user.id;
    if (!uid) return;
    if (myPcLikes.has(commentId)) await supabase.from("post_comment_likes").delete().eq("comment_id", commentId).eq("user_id", uid);
    else await supabase.from("post_comment_likes").insert({ comment_id: commentId, user_id: uid });
    await loadComments(postId);
  }
  async function handlePcDelete(commentId: number, ownerId: string, postId: number) {
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user.id;
    if (!uid || (ownerId !== uid && !isAdminUser)) return;
    if (!confirm("Удалить?")) return;
    await supabase.from("post_comments").delete().eq("id", commentId);
    await loadComments(postId);
    await load();
  }
  async function handlePcReport(commentId: number) {
    setReportModal({ type: "pc", id: commentId });
  }
  function toggleExpand(postId: number) {
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(postId)) n.delete(postId);
      else { n.add(postId); loadComments(postId); }
      return n;
    });
  }
  function score(post: Post): number {
    const hours = (Date.now() - new Date(post.created_at).getTime()) / 3600000;
    const timeDecay = Math.exp(-hours / 36);
    const w = (likes.get(post.id) || 0) * 3 + (commentsCount.get(post.id) || 0) * 6 + 1;
    const affinity = following.has(post.user_id) ? 1.8 : 1.0;
    return affinity * w * timeDecay;
  }
  const sorted = useMemo(() => [...posts].sort((a, b) => score(b) - score(a)), [posts, likes, commentsCount, following]);
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
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <i className="fa-solid fa-rss text-sky-400"></i>
          <h1 className="text-sm font-bold text-white">Лента</h1>
        </div>
        <button onClick={() => setShowComposer(!showComposer)} className="w-9 h-9 rounded-full bg-sky-500 hover:bg-sky-600 text-white flex items-center justify-center shadow-lg shadow-sky-500/20 transition-all">
          <i className={`fa-solid ${showComposer ? "fa-xmark" : "fa-plus"} text-sm`}></i>
        </button>
      </div>
      {showComposer && (
        <div className="bg-[#1a1a1e] border border-[#222226] rounded-xl p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <label className="w-8 h-8 rounded-full bg-[#121214] border border-[#222226] flex items-center justify-center text-gray-400 hover:text-white cursor-pointer">
              <i className="fa-solid fa-paperclip text-xs"></i>
              <input type="file" accept="image/*,video/*,audio/*,.gif,.mp3,.mov,.mp4,.webm,.ogg,.wav,.flac,.mkv,.avi" className="hidden" onChange={async (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (!file) return;
                if (file.size > 1024*1024 && !file.type.startsWith("image/")) { alert("Максимум 1 МБ"); return; }
                const { createClient: cc } = await import("@/lib/supabase/client");
                const sb = cc();
                const ext = file.name.split(".").pop() || "jpg";
                const path = `${Date.now()}.${ext}`;
                const { error } = await sb.storage.from("Anime").upload(path, file, { contentType: file.type });
                if (!error) { const { data } = sb.storage.from("Anime").getPublicUrl(path); setImageUrl(data.publicUrl); }
              }} />
            </label>
            <button onClick={async () => {
              try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                const rec = new MediaRecorder(stream);
                const chunks: BlobPart[] = [];
                rec.ondataavailable = (e) => chunks.push(e.data);
                rec.onstop = async () => {
                  const blob = new Blob(chunks, { type: "audio/webm" });
                  if (blob.size > 1024*1024) { alert("Голосовое >1 МБ"); return; }
                  const { createClient: cc } = await import("@/lib/supabase/client");
                  const sb = cc();
                  const path = `${Date.now()}.webm`;
                  const { error } = await sb.storage.from("Anime").upload(path, blob, { contentType: "audio/webm" });
                  if (!error) { const { data } = sb.storage.from("Anime").getPublicUrl(path); setImageUrl(data.publicUrl); }
                  stream.getTracks().forEach((t) => t.stop());
                };
                rec.start();
                setTimeout(() => rec.stop(), 15000);
                alert("Запись 15с началась");
              } catch { alert("Нет доступа к микрофону"); }
            }} className="w-8 h-8 rounded-full bg-[#121214] border border-[#222226] flex items-center justify-center text-gray-400 hover:text-red-400" title="Голосовое"><i className="fa-solid fa-microphone text-xs"></i></button>
            {imageUrl && <span className="text-[11px] text-green-400">медиа прикреплено <button onClick={() => setImageUrl("")} className="text-red-400 ml-1">×</button></span>}
          </div>
          <div className="relative">
            {toolbar.show && (
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 p-1 bg-[#1a1a1e] border border-[#222226] rounded-lg shadow-xl">
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={handleBold} className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#222226] text-gray-300 hover:text-white text-xs font-black">B</button>
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={handleItalic} className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#222226] text-gray-300 hover:text-white text-xs italic">I</button>
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={handleStrike} className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#222226] text-gray-300 hover:text-white text-xs line-through">S</button>
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={handleMono} className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#222226] text-gray-300 hover:text-white text-[10px] font-mono">{"</>"}</button>
                <div className="w-px h-5 bg-[#222226]" />
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={handleSpoiler} className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#222226] text-gray-300 hover:text-white"><i className="fa-solid fa-eye-slash text-[10px]"></i></button>
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={handleLink} className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#222226] text-sky-400 hover:text-white"><i className="fa-solid fa-link text-[10px]"></i></button>
              </div>
            )}
            <textarea ref={mainRef} value={text} onChange={(e) => { setText(e.target.value); e.target.style.height="auto"; e.target.style.height = Math.min(e.target.scrollHeight, 200) + "px"; }} onSelect={checkSelection} onMouseUp={checkSelection} onKeyUp={checkSelection} onBlur={() => setTimeout(() => setToolbar({ show: false }), 150)} rows={3} placeholder="Что нового?" className="w-full bg-[#121214] border border-[#222226] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-sky-500/50 resize-none overflow-hidden" />
          </div>
          <button onClick={handlePost} disabled={sending || !text.trim()} className="self-end bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white text-xs font-bold px-5 py-2 rounded-lg transition-all">Опубликовать</button>
        </div>
      )}
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
          const isOwner = p.user_id === userId;
          const isExpanded = expanded.has(p.id);
          const comments = postComments.get(p.id) || [];
          return (
            <div key={p.id} id={`post-${p.id}`} className="bg-[#1a1a1e] border border-[#222226] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Link href={`/profile/${p.user_id}`} className="w-7 h-7 rounded-full bg-gradient-to-tr from-sky-400 to-blue-600 flex items-center justify-center text-white text-[10px] font-black overflow-hidden relative">
                  {p.profiles?.[0]?.avatar_url ? <Image src={p.profiles[0].avatar_url} alt="" fill unoptimized className="object-cover" /> : (p.profiles?.[0]?.username || "?").slice(0, 1).toUpperCase()}
                </Link>
                <Link href={`/profile/${p.user_id}`} className="text-xs font-bold text-white hover:text-sky-400 flex items-center gap-1">{p.profiles?.[0]?.username || "Пользователь"} {p.profiles?.[0]?.is_verified && <VerifiedBadge size={12} />}</Link>
                <span className="text-[10px] text-gray-600 ml-auto">{new Date(p.created_at).toLocaleString("ru-RU")}</span>
                {p.updated_at && p.updated_at !== p.created_at && <span className="text-[9px] text-gray-500">изменено</span>}
                {(isOwner || isAdminUser) && <button onClick={() => { if (editingPost === p.id) { setEditingPost(null); } else { setEditingPost(p.id); setEditPostText(p.text); } }} className="text-gray-500 hover:text-sky-400 text-xs" title="Редактировать"><i className="fa-solid fa-pen"></i></button>}
                {(isOwner || isAdminUser) && <button onClick={() => handleDelete(p.id, p.user_id)} className="text-gray-500 hover:text-red-400 text-xs"><i className="fa-solid fa-trash-can"></i></button>}
                <button onClick={() => handleReport(p.id)} className="text-gray-500 hover:text-amber-400 text-xs" title="Пожаловаться"><i className="fa-solid fa-flag"></i></button>
              </div>
              {editingPost === p.id ? (
                <div className="flex flex-col gap-2">
                  <textarea value={editPostText} onChange={(e) => setEditPostText(e.target.value)} rows={2} className="w-full bg-[#121214] border border-[#222226] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-sky-500/50 resize-none" />
                  <div className="flex gap-2">
                    <button onClick={() => handleEditPost(p.id)} className="bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold px-3 py-1.5 rounded">Сохранить</button>
                    <button onClick={() => setEditingPost(null)} className="bg-[#121214] text-gray-400 border border-[#222226] px-3 py-1.5 rounded text-xs">Отмена</button>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-200 whitespace-pre-wrap break-words" dangerouslySetInnerHTML={{ __html: formatToHtml(p.text, usernameToId) }} />
              )}
              {p.image_url && (
                /\.mp4|\.mov|\.webm|\.mkv|\.avi/i.test(p.image_url) ? (
                  <video src={p.image_url} controls className="mt-3 w-full rounded-lg bg-black max-h-80" />
                ) : /\.mp3|\.ogg|\.wav|\.flac/i.test(p.image_url) ? (
                  <audio src={p.image_url} controls className="mt-3 w-full" />
                ) : (
                  <div onClick={() => { setViewerUrl(p.image_url!); setViewerScale(1); }} className="mt-3 rounded-lg overflow-hidden bg-[#121214] relative aspect-[16/9] cursor-zoom-in"><Image src={p.image_url} alt="" fill unoptimized className="object-cover" sizes="600px" /></div>
                )
              )}
              <div className="flex gap-2 mt-3 flex-wrap">
                <button onClick={() => toggleLike(p.id)} className={`text-[11px] px-3 py-1 rounded-lg border ${myLikes.has(p.id) ? "bg-sky-500/20 text-sky-400 border-sky-500/30" : "text-gray-400 border-[#222226] hover:text-white"}`}>
                  <i className="fa-solid fa-heart mr-1"></i> {likes.get(p.id) || 0}
                </button>
                <button onClick={() => toggleExpand(p.id)} className="text-[11px] text-gray-400 hover:text-white border border-[#222226] px-3 py-1 rounded-lg"><i className="fa-solid fa-comment mr-1"></i> {commentsCount.get(p.id) || 0} {isExpanded ? "Скрыть" : "Ответить"}</button>
                <button onClick={() => copyLink(p.id)} className="text-[11px] text-gray-400 hover:text-white border border-[#222226] px-3 py-1 rounded-lg"><i className="fa-solid fa-share-nodes mr-1"></i> Поделиться</button>
              </div>
              {isExpanded && (
                <div className="mt-3 pt-3 border-t border-[#222226] space-y-3">
                  {(() => {
                    const renderTree = (parentId: number | null, depth: number): React.ReactNode => {
                      const nodes = comments.filter((c) => (c.parent_id || null) === parentId);
                      if (nodes.length === 0 && depth === 0) return <p className="text-xs text-gray-600">Пока нет комментариев</p>;
                      return nodes.map((c) => (
                        <div key={c.id} className={`${depth > 0 ? "ml-4 pl-3 border-l border-[#222226]" : ""} p-3 bg-[#121214] border border-[#222226] rounded-lg space-y-2`}>
                          <div className="flex items-center gap-2">
                            <Link href={`/profile/${c.user_id}`} className="w-6 h-6 rounded-full bg-gradient-to-tr from-sky-400 to-blue-600 flex items-center justify-center text-white text-[10px] font-black overflow-hidden relative shrink-0">
                              {c.profiles?.[0]?.avatar_url ? <Image src={c.profiles[0].avatar_url} alt="" fill unoptimized className="object-cover" sizes="24px" /> : (c.profiles?.[0]?.username || "?").slice(0, 1).toUpperCase()}
                            </Link>
                            <Link href={`/profile/${c.user_id}`} className="text-xs font-bold text-white hover:text-sky-400 flex items-center gap-1">{c.profiles?.[0]?.username || "?"} {c.profiles?.[0]?.is_verified && <VerifiedBadge size={10} />}</Link>
                            <span className="text-[10px] text-gray-600 ml-auto">{new Date(c.created_at).toLocaleString("ru-RU")}</span>
                            {(c.user_id === userId || isAdminUser) && <button onClick={() => handlePcDelete(c.id, c.user_id, p.id)} className="text-[10px] text-red-400 hover:text-red-300"><i className="fa-solid fa-trash-can"></i></button>}
                            <button onClick={() => handlePcReport(c.id)} className="text-[10px] text-gray-500 hover:text-amber-400" title="Пожаловаться"><i className="fa-solid fa-flag"></i></button>
                          </div>
                          <div className="text-xs text-gray-300 whitespace-pre-wrap break-words" dangerouslySetInnerHTML={{ __html: formatToHtml(c.text, usernameToId) }} />
                          <div className="flex gap-2">
                            <button onClick={() => togglePcLike(c.id, p.id)} className={`text-[11px] px-2 py-1 rounded border ${myPcLikes.has(c.id) ? "bg-sky-500/20 text-sky-400 border-sky-500/30" : "text-gray-500 border-[#222226] hover:text-sky-400"}`}><i className="fa-solid fa-heart text-[10px]"></i> {pcLikes.get(c.id) || ""}</button>
                            <button onClick={() => setReplyTo((prev) => { const m = new Map(prev); m.set(p.id, m.get(p.id) === c.id ? null : c.id); return m; })} className="text-[11px] text-sky-400 hover:text-sky-300"><i className="fa-solid fa-reply mr-1"></i>Ответить</button>
                          </div>
                          {replyTo.get(p.id) === c.id && (
                            <div className="flex gap-2">
                              <input value={replyText.get(p.id) || ""} onChange={(e) => setReplyText((prev) => new Map(prev).set(p.id, e.target.value))} placeholder={`Ответ ${c.profiles?.[0]?.username || ""}...`} className="flex-1 bg-[#1a1a1e] border border-[#222226] rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-sky-500/50" />
                              <button onClick={() => handleReply(p.id)} className="bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg">Отправить</button>
                            </div>
                          )}
                          <div className="space-y-2">{renderTree(c.id, depth + 1)}</div>
                        </div>
                      ));
                    };
                    return (
                      <>
                        <div className="space-y-2">{renderTree(null, 0)}</div>
                        {replyTo.get(p.id) == null && (
                          <div className="flex gap-2">
                            <input value={replyText.get(p.id) || ""} onChange={(e) => setReplyText((prev) => new Map(prev).set(p.id, e.target.value))} placeholder="Ответить..." className="flex-1 bg-[#121214] border border-[#222226] rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-sky-500/50" />
                            <button onClick={() => handleReply(p.id)} className="bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg">Отправить</button>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {reportModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setReportModal(null)}>
          <div className="bg-[#1a1a1e] border border-[#222226] rounded-xl p-4 w-full max-w-sm space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-white">Жалоба</h3>
            <textarea value={reportReason} onChange={(e) => setReportReason(e.target.value)} rows={3} placeholder="Причина..." className="w-full bg-[#121214] border border-[#222226] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-sky-500/50 resize-none" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setReportModal(null)} className="text-xs text-gray-400 border border-[#222226] px-3 py-1.5 rounded">Отмена</button>
              <button onClick={submitReport} className="bg-red-500 hover:bg-red-600 text-white text-xs font-bold px-4 py-1.5 rounded">Отправить</button>
            </div>
          </div>
        </div>
      )}
      {viewerUrl && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col" onClick={() => setViewerUrl(null)}>
          <div className="flex justify-between items-center p-4" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setViewerUrl(null)} className="text-white hover:text-gray-300"><i className="fa-solid fa-xmark text-xl"></i></button>
            <div className="flex gap-2">
              <button onClick={(e) => { e.stopPropagation(); setViewerScale((s) => Math.min(3, s + 0.25)); }} className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"><i className="fa-solid fa-magnifying-glass-plus"></i></button>
              <button onClick={(e) => { e.stopPropagation(); setViewerScale((s) => Math.max(0.5, s - 0.25)); }} className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"><i className="fa-solid fa-magnifying-glass-minus"></i></button>
              <button onClick={async (e) => { e.stopPropagation(); try { const res = await fetch(viewerUrl); const blob = await res.blob(); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = viewerUrl.split("/").pop()?.split("?")[0] || "image.jpg"; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); } catch { window.open(viewerUrl, "_blank"); } }} className="w-9 h-9 rounded-full bg-sky-500 hover:bg-sky-600 text-white flex items-center justify-center"><i className="fa-solid fa-download"></i></button>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center p-4 overflow-hidden" onClick={() => setViewerUrl(null)}>
            <img src={viewerUrl} alt="" className="max-w-full max-h-full object-contain transition-transform cursor-zoom-out" style={{ transform: `scale(${viewerScale})` }} onClick={() => setViewerUrl(null)} onWheel={(e) => setViewerScale((s) => Math.min(3, Math.max(0.5, s - e.deltaY * 0.001)))} />
          </div>
        </div>
      )}
    </div>
  );
}
