"use client";
import { createClient } from "@/lib/supabase/client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";

interface Item {
  id: number;
  anime_id: number;
  title: string;
  image_url: string;
  slug?: string;
  age_rating?: string;
  genres?: string[];
  season_info?: string;
}

export default function CollectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const supabase = createClient();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [ownerName, setOwnerName] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "denied" | "missing">("loading");
  const [copied, setCopied] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [shown, setShown] = useState(24);

  useEffect(() => { document.title = "Коллекция | AniJUN"; }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user.id ?? null;

      const { data: bySlug } = await supabase.from("collections").select("id, name, description, user_id, is_public, slug").eq("slug", id).maybeSingle();
      let col = bySlug as { id: number; name: string; description: string; user_id: string; is_public: boolean; slug: string } | null;
      if (!col) {
        const num = parseInt(id);
        if (!isNaN(num)) {
          const { data } = await supabase.from("collections").select("id, name, description, user_id, is_public, slug").eq("id", num).maybeSingle();
          col = data as typeof col;
        }
      }
      if (cancelled) return;
      if (!col) { setStatus("missing"); return; }

      const allowed = col.is_public || (uid && uid === col.user_id);
      if (!allowed) { setStatus("denied"); return; }

      setName(col.name);
      setDescription(col.description || "");
      setOwnerId(col.user_id);
      setIsPublic(col.is_public);
      setIsOwner(uid === col.user_id);
      document.title = `${col.name} | AniJUN`;

      const { data: owner } = await supabase.from("profiles").select("username, avatar_url").eq("id", col.user_id).maybeSingle();
      if (!cancelled) setOwnerName(owner?.username || "Пользователь");

      const { data: rows } = await supabase
        .from("collection_items")
        .select("id, anime_id, anime:anime_id(title, image_url, slug, age_rating, genres, season_info)")
        .eq("collection_id", col.id)
        .order("id");

      const mapped: Item[] = (rows || []).map((r) => {
        const a = Array.isArray((r as unknown as { anime: unknown }).anime)
          ? (r as unknown as { anime: { title: string; image_url: string; slug?: string; age_rating?: string; genres?: string[]; season_info?: string }[] }).anime[0]
          : (r as unknown as { anime: { title: string; image_url: string; slug?: string; age_rating?: string; genres?: string[]; season_info?: string } }).anime;
        return {
          id: r.id,
          anime_id: r.anime_id,
          title: a?.title || "Unknown",
          image_url: a?.image_url || "",
          slug: a?.slug,
          age_rating: a?.age_rating || "",
          genres: a?.genres || [],
          season_info: a?.season_info || "",
        };
      });
      if (cancelled) return;
      setItems(mapped);
      setStatus("ready");
    })();
    return () => { cancelled = true; };
  }, [id, supabase]);

  async function handleShare() {
    const url = `${window.location.origin}/collection/${id}`;
    if (navigator.share) {
      try { await navigator.share({ title: name, url }); return; } catch {}
    }
    try { await navigator.clipboard.writeText(url); } catch {
      const ta = document.createElement("textarea");
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (status === "loading") return <div className="text-center py-20 text-gray-500 text-xs">Загрузка...</div>;

  if (status === "missing") {
    return (
      <div className="text-center py-20">
        <i className="fa-solid fa-folder-open text-gray-600 text-3xl mb-4 block"></i>
        <p className="text-gray-400 text-sm">Коллекция не найдена</p>
        <Link href="/" className="text-sky-400 text-xs hover:underline mt-3 inline-block">На главную</Link>
      </div>
    );
  }

  if (status === "denied") {
    return (
      <div className="text-center py-20">
        <i className="fa-solid fa-lock text-red-400 text-3xl mb-4 block"></i>
        <p className="text-gray-400 text-sm">Коллекция приватная</p>
        <button onClick={() => router.back()} className="text-gray-500 text-xs hover:text-white mt-3">Назад</button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6">
      <button onClick={() => router.back()} className="w-8 h-8 rounded bg-[#1a1a1e] hover:bg-[#222226] border border-[#222226] flex items-center justify-center text-xs text-gray-400 transition-all self-start">
        <i className="fa-solid fa-arrow-left"></i>
      </button>

      <div className="bg-[#1a1a1e] border border-[#222226] rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-xl bg-[#121214] border border-[#222226] flex items-center justify-center shrink-0">
            <i className="fa-solid fa-folder-open text-amber-400 text-lg"></i>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-white break-words">{name}</h1>
            {description && <p className="text-xs text-gray-400 mt-1 whitespace-pre-wrap break-words">{description}</p>}
            <div className="flex items-center gap-3 mt-2 text-[11px] text-gray-500 flex-wrap">
              {ownerId && <Link href={`/profile/${ownerId}`} className="text-sky-400 hover:underline">{ownerName}</Link>}
              <span>{items.length} тайтл.</span>
              {!isPublic && <span className="text-gray-600"><i className="fa-solid fa-lock mr-0.5"></i>приватная</span>}
              {isOwner && <span className="text-amber-400">это ваша коллекция</span>}
            </div>
          </div>
          <button onClick={handleShare} className="shrink-0 text-[10px] font-bold text-sky-400 hover:text-sky-300 border border-sky-400/30 hover:bg-sky-400/10 rounded px-2.5 py-1.5 transition-all">
            <i className={`fa-solid ${copied ? "fa-check" : "fa-share-nodes"} mr-1`}></i>
            {copied ? "Скопировано" : "Поделиться"}
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-16 text-gray-500 text-xs bg-[#1a1a1e] border border-[#222226] rounded-xl">
          Коллекция пуста
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {items.slice(0, shown).map((it) => (
              <Link key={it.id} href={it.slug ? `/anime/${it.slug}` : `/anime/${it.anime_id}`} className="group block">
                <div className="relative aspect-[3/4] rounded-lg overflow-hidden bg-[#121214] border border-[#222226] group-hover:border-sky-400/40 transition-colors">
                  <Image src={it.image_url || "/window.svg"} alt={it.title} fill unoptimized className="object-cover" sizes="150px" />
                </div>
                <p className="text-[11px] text-gray-300 group-hover:text-sky-400 mt-1 truncate transition-colors">{it.title}</p>
                {it.season_info && <p className="text-[9px] text-gray-600 truncate">{it.season_info}</p>}
              </Link>
            ))}
          </div>
          {items.length > shown && (
            <button onClick={() => setShown((s) => s + 24)}
              className="self-center text-xs font-bold text-sky-400 hover:text-sky-300 transition-colors">
              Показать ещё ({items.length - shown})
            </button>
          )}
        </>
      )}
    </div>
  );
}
