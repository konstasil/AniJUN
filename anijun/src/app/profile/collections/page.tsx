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
  items: { id: number; anime_id: number; slug?: string; title: string; image_url: string }[];
}

interface AnimeOption {
  id: number;
  slug?: string;
  title: string;
}

export default function CollectionsPage() {
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

  const loadCollections = useCallback(async (uid: string) => {
    const { data: cols } = await supabase
      .from("collections")
      .select("id, name, description, is_public")
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
      const mapped = {
        id: i.id,
        anime_id: i.anime_id,
        slug: i.anime?.[0]?.slug,
        title: i.anime?.[0]?.title || "Unknown",
        image_url: i.anime?.[0]?.image_url || "",
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

  async function handleDeleteCollection(col: OwnCollection) {
    if (!confirm(`Удалить коллекцию «${col.name}»?`)) return;
    await supabase.from("collections").delete().eq("id", col.id);
    if (userId) await loadCollections(userId);
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
          <div className="flex items-center gap-3 mb-4">
            <i className="fa-solid fa-folder-open text-amber-400/80 text-sm"></i>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-white truncate">{col.name}</h3>
              {col.description && <p className="text-[11px] text-gray-500 truncate">{col.description}</p>}
            </div>
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

          {col.items.length === 0 ? (
            <p className="text-center text-gray-600 text-xs py-4">Коллекция пуста</p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {col.items.map((item) => (
                <div key={item.id} className="relative group">
                  <Link href={item.slug ? `/anime/${item.slug}` : `/anime/${item.anime_id}`}
                    className="block w-16 h-22 aspect-[3/4] rounded-lg overflow-hidden bg-[#121214] relative">
                    {item.image_url && <Image src={item.image_url} alt={item.title} fill className="object-cover" sizes="64px" />}
                  </Link>
                  <button onClick={() => handleRemoveItem(col, item.id)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 pt-3 border-t border-[#222226]/50">
            {addingTo === col.id ? (
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
