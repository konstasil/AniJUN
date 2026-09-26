"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

interface OwnCollection {
  id: number;
  name: string;
  description: string;
  is_public: boolean;
  slug?: string;
  items: { id: number; anime_id: number; slug?: string; title: string; image_url: string }[];
}

interface AnimeOption {
  id: number;
  slug?: string;
  title: string;
}

const ALPHABET = "АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".split("");
const PAGE_STEP = 12;

export default function CollectionsPage() {
  useEffect(() => { document.title = "Коллекции | AniJUN"; }, []);

  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [collections, setCollections] = useState<OwnCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPublic, setNewPublic] = useState(true);
  const [saving, setSaving] = useState(false);
  const [animeOptions, setAnimeOptions] = useState<AnimeOption[]>([]);
  const [addingTo, setAddingTo] = useState<number | null>(null);
  const [selectedAnime, setSelectedAnime] = useState("");
  const [shown, setShown] = useState<Record<number, number>>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editPublic, setEditPublic] = useState(true);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const firstByLetter = useMemo(() => {
    const map = new Map<string, AnimeOption>();
    for (const a of animeOptions) {
      const ch = (a.title || "").trim().charAt(0).toUpperCase();
      if (ch && !map.has(ch)) map.set(ch, a);
    }
    return map;
  }, [animeOptions]);

  const loadCollections = useCallback(async (uid: string) => {
    const { data: cols } = await supabase
      .from("collections")
      .select("id, name, description, is_public, slug")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });
    if (!cols) return;

    const colIds = cols.map((c) => c.id);
    const { data: items } = colIds.length > 0
      ? await supabase
          .from("collection_items")
          .select("id, anime_id, collection_id, anime:anime_id(id, slug, title, image_url)")
          .in("collection_id", colIds)
      : { data: [] };

    const itemsByCollection = new Map<number, OwnCollection["items"]>();
    (items || []).forEach((i) => {
      const a = Array.isArray((i as unknown as { anime: unknown }).anime) ? (i as unknown as { anime: { slug?: string; title: string; image_url: string }[] }).anime[0] : (i as unknown as { anime: { slug?: string; title: string; image_url: string } }).anime;
      const mapped = {
        id: i.id,
        anime_id: i.anime_id,
        slug: a?.slug,
        title: a?.title || "Unknown",
        image_url: a?.image_url || "",
      };
      const list = itemsByCollection.get(i.collection_id) || [];
      list.push(mapped);
      itemsByCollection.set(i.collection_id, list);
    });

    const result: OwnCollection[] = cols.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description || "",
      is_public: c.is_public,
      slug: (c as unknown as { slug?: string }).slug,
      items: itemsByCollection.get(c.id) || [],
    }));
    setCollections(result);
  }, [supabase]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { router.push("/login"); return; }
      if (cancelled) return;
      setUserId(session.user.id);
      await loadCollections(session.user.id);
      const { data: anime } = await supabase.from("anime").select("id, slug, title").order("title");
      if (anime) setAnimeOptions(anime as AnimeOption[]);
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [loadCollections, router, supabase]);

  async function handleCreate() {
    if (!userId || !newName.trim()) return;
    setSaving(true);
    const { data: col } = await supabase
      .from("collections")
      .insert({ user_id: userId, name: newName.trim(), description: newDescription.trim(), is_public: newPublic })
      .select()
      .single();
    setNewName(""); setNewDescription(""); setNewPublic(true); setCreating(false); setSaving(false);
    if (col) await loadCollections(userId);
  }

  async function togglePublic(col: OwnCollection) {
    if (!userId) return;
    await supabase.from("collections").update({ is_public: !col.is_public }).eq("id", col.id);
    await loadCollections(userId);
  }

  function startEdit(col: OwnCollection) {
    setEditingId(col.id);
    setEditName(col.name);
    setEditDesc(col.description || "");
    setEditPublic(col.is_public);
    setEditError("");
  }

  async function handleSaveEdit(id: number) {
    if (!editName.trim() || !userId) return;
    setEditSaving(true);
    setEditError("");
    const col = collections.find((c) => c.id === id);
    const nameChanged = col ? col.name !== editName.trim() : false;
    const patch: Record<string, unknown> = {
      name: editName.trim(),
      description: editDesc.trim(),
      is_public: editPublic,
    };
    if (nameChanged) patch.slug = makeSlug(editName.trim(), id);
    const { error } = await supabase.from("collections").update(patch).eq("id", id);
    setEditSaving(false);
    if (error) { setEditError(error.message); return; }
    setEditingId(null);
    await loadCollections(userId);
  }

  function makeSlug(name: string, id: number) {
    const base = name
      .toLowerCase()
      .replace(/[^a-zа-я0-9\s-]/gi, "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    return base || `collection-${id}`;
  }

  async function handleShare(col: OwnCollection) {
    if (!userId) return;
    if (!col.is_public) {
      const makePublic = confirm("Коллекция приватная — её не увидят другие. Сделать публичной и поделиться?");
      if (!makePublic) return;
      const { error } = await supabase.from("collections").update({ is_public: true }).eq("id", col.id);
      if (error) { alert(error.message); return; }
      await loadCollections(userId);
    }
    const url = `${window.location.origin}/collection/${encodeURIComponent(col.slug || col.id)}`;
    const title = `Коллекция «${col.name}»`;
    if (navigator.share) {
      try { await navigator.share({ title, url }); return; } catch {}
    }
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopiedId(col.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  async function handleDeleteCollection(col: OwnCollection) {
    if (!confirm(`Удалить коллекцию «${col.name}»?`)) return;
    await supabase.from("collections").delete().eq("id", col.id);
    if (userId) await loadCollections(userId);
  }

  function handleLetter(ch: string) {
    const target = firstByLetter.get(ch);
    if (!target) return;
    setSelectedAnime(String(target.id));
    router.push(target.slug ? `/anime/${target.slug}` : `/anime/${target.id}`);
  }

  async function handleAddToCollection() {
    if (addingTo === null || !selectedAnime) return;
    const animeId = Number(selectedAnime);
    await supabase.from("collection_items").upsert(
      { collection_id: addingTo, anime_id: animeId },
      { onConflict: "collection_id,anime_id" }
    );
    setSelectedAnime("");
    setAddingTo(null);
    if (userId) await loadCollections(userId);
  }

  async function handleRemoveItem(col: OwnCollection, itemId: number) {
    await supabase.from("collection_items").delete().eq("id", itemId);
    if (userId) await loadCollections(userId);
  }

  if (loading) return <div className="text-center py-20 text-gray-500 text-xs">Загрузка...</div>;

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <i className="fa-solid fa-folder text-amber-400 text-lg"></i>
          <h1 className="text-lg font-bold text-white">Мои коллекции</h1>
        </div>
        <button onClick={() => setCreating(true)}
          className="text-[10px] font-bold text-sky-400 hover:text-sky-300 px-3 py-1.5 rounded border border-sky-400/30 hover:bg-sky-400/10 transition-all">
          <i className="fa-solid fa-plus mr-1"></i> Новая коллекция
        </button>
      </div>

      {creating && (
        <div className="bg-[#1a1a1e] border border-[#222226] rounded-xl p-4 flex flex-col gap-3">
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Название коллекции"
            className="w-full bg-[#121214] border border-[#222226] rounded px-3 py-2 text-sm text-white outline-none focus:border-sky-500/50" />
          <input value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="Описание (опционально)"
            className="w-full bg-[#121214] border border-[#222226] rounded px-3 py-2 text-sm text-white outline-none focus:border-sky-500/50" />
          <label className="flex items-center gap-2 text-xs text-gray-400">
            <input type="checkbox" checked={newPublic} onChange={(e) => setNewPublic(e.target.checked)} className="accent-sky-500" />
            Публичная
          </label>
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={saving || !newName.trim()}
              className="bg-sky-500 hover:bg-sky-600 text-white text-[10px] font-bold px-4 py-2 rounded transition-all disabled:opacity-50">
              {saving ? "Создание..." : "Создать"}
            </button>
            <button onClick={() => setCreating(false)} className="text-gray-400 text-[10px] font-bold px-4 py-2 rounded border border-[#222226] hover:text-white transition-all">Отмена</button>
          </div>
        </div>
      )}

      {collections.length === 0 && (
        <div className="text-center py-16 text-gray-500 text-xs bg-[#1a1a1e] border border-[#222226] rounded-xl">
          Пока нет коллекций — создайте первую!
        </div>
      )}

      {collections.map((col) => (
        <div key={col.id} className="bg-[#1a1a1e] border border-[#222226] rounded-xl p-5">
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <i className="fa-solid fa-folder-open text-amber-400/80 text-sm"></i>
            {editingId === col.id ? (
              <div className="flex-1 min-w-[200px]">
                <input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Название"
                  className="w-full bg-[#121214] border border-[#222226] rounded px-2.5 py-1.5 text-xs text-white outline-none focus:border-sky-500/50" />
              </div>
            ) : (
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-white truncate">{col.name}</h3>
                {col.description && <p className="text-[11px] text-gray-500 truncate">{col.description}</p>}
              </div>
            )}
            {editingId === col.id ? (
              <>
                <button onClick={() => handleSaveEdit(col.id)} disabled={editSaving || !editName.trim()}
                  className="bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white text-[10px] font-bold px-3 py-1.5 rounded">
                  {editSaving ? "..." : "Сохранить"}
                </button>
                <button onClick={() => { setEditingId(null); setEditError(""); }}
                  className="text-gray-400 text-[10px] font-bold px-2.5 py-1 rounded border border-[#222226] hover:text-white">Отмена</button>
              </>
            ) : (
              <>
                <button onClick={() => startEdit(col)} title="Изменить"
                  className="text-[10px] text-gray-500 hover:text-sky-400 transition-colors px-2 py-1">
                  <i className="fa-solid fa-pen"></i>
                </button>
                <button onClick={() => handleShare(col)} title="Поделиться"
                  className="text-[10px] text-gray-500 hover:text-sky-400 transition-colors px-2 py-1">
                  <i className={`fa-solid ${copiedId === col.id ? "fa-check" : "fa-share-nodes"}`}></i>
                </button>
                {copiedId === col.id && <span className="text-[10px] text-green-400">ссылка скопирована</span>}
              </>
            )}
            <span className="text-[10px] text-gray-500">{col.items.length} тайтл.</span>
            <button onClick={() => togglePublic(col)}
              className={`text-[10px] font-bold px-2.5 py-1 rounded border transition-all ${
                col.is_public ? "text-emerald-400 border-emerald-400/30 hover:bg-emerald-400/10" : "text-gray-500 border-[#222226] hover:text-gray-300"
              }`}>
              <i className={`fa-solid ${col.is_public ? "fa-eye" : "fa-lock"} mr-1`}></i>
              {col.is_public ? "Публичная" : "Приватная"}
            </button>
            <button onClick={() => handleDeleteCollection(col)}
              className="text-[10px] text-gray-500 hover:text-red-400 transition-colors px-2 py-1">
              <i className="fa-solid fa-trash-can"></i>
            </button>
          </div>

          {editingId === col.id && (
            <div className="mb-4 flex flex-col gap-2">
              <textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={2} placeholder="Описание (опционально)"
                className="w-full bg-[#121214] border border-[#222226] rounded px-2.5 py-1.5 text-xs text-white outline-none focus:border-sky-500/50 resize-none" />
              <label className="flex items-center gap-2 text-[11px] text-gray-400 cursor-pointer">
                <input type="checkbox" checked={editPublic} onChange={(e) => setEditPublic(e.target.checked)} className="accent-sky-500" />
                Публичная коллекция
              </label>
              {editError && <p className="text-[10px] text-red-400">{editError}</p>}
            </div>
          )}

          {col.items.length === 0 ? (
            <p className="text-center text-gray-600 text-xs py-4">Коллекция пуста</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-3">
                {col.items.slice(0, shown[col.id] ?? PAGE_STEP).map((item) => (
                  <div key={item.id} className="relative group">
                    <Link href={item.slug ? `/anime/${item.slug}` : `/anime/${item.anime_id}`}
                      className="block w-16 h-22 aspect-[3/4] rounded-lg overflow-hidden bg-[#121214] relative">
                      <Image src={item.image_url || "/window.svg"} alt={item.title} fill unoptimized className="object-cover" sizes="64px" />
                    </Link>
                    <button onClick={() => handleRemoveItem(col, item.id)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                      <i className="fa-solid fa-xmark"></i>
                    </button>
                  </div>
                ))}
              </div>
              {col.items.length > (shown[col.id] ?? PAGE_STEP) && (
                <button onClick={() => setShown((prev) => ({ ...prev, [col.id]: (prev[col.id] ?? PAGE_STEP) + PAGE_STEP }))}
                  className="mt-3 text-[10px] font-bold text-sky-400 hover:text-sky-300 transition-colors">
                  Показать ещё ({col.items.length - (shown[col.id] ?? PAGE_STEP)})
                </button>
              )}
            </>
          )}

          <div className="mt-4 pt-3 border-t border-[#222226]/50">
            {addingTo === col.id ? (
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap gap-0.5">
                  {ALPHABET.map((ch) => {
                    const target = firstByLetter.get(ch);
                    return (
                      <button key={ch} onClick={() => handleLetter(ch)} disabled={!target}
                        className={`w-6 h-6 rounded text-[10px] font-bold transition-colors ${
                          target
                            ? "bg-[#1a1a1e] text-gray-300 hover:bg-sky-500/20 hover:text-sky-400 border border-[#222226]"
                            : "text-gray-700 cursor-not-allowed"
                        }`}>
                        {ch}
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <label className="text-[10px] text-gray-500 block mb-1">Добавить аниме</label>
                    <select value={selectedAnime} onChange={(e) => setSelectedAnime(e.target.value)}
                      className="w-full bg-[#121214] border border-[#222226] rounded px-2 py-1.5 text-xs text-white outline-none focus:border-sky-500/50">
                      <option value="">Выберите аниме...</option>
                      {animeOptions.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
                    </select>
                  </div>
                  <button onClick={handleAddToCollection} disabled={!selectedAnime}
                    className="bg-sky-500 hover:bg-sky-600 text-white text-[10px] font-bold px-3 py-1.5 rounded transition-all disabled:opacity-50">Добавить</button>
                  <button onClick={() => { setAddingTo(null); setSelectedAnime(""); }}
                    className="text-gray-400 text-[10px] font-bold px-3 py-1.5 rounded border border-[#222226] hover:text-white transition-all">Отмена</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setAddingTo(col.id)}
                className="text-[10px] font-bold text-sky-400 hover:text-sky-300 transition-colors">
                <i className="fa-solid fa-plus mr-1"></i> Добавить аниме
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
