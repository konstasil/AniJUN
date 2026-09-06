"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";

interface Collection {
  id: number;
  user_id: string;
  name: string;
  description: string;
  is_public: boolean;
  contains: boolean;
  owned: boolean;
}

interface CollectionsSectionProps {
  animeId: number;
  animeTitle: string;
  userId: string | null;
}

export default function CollectionsSection({ animeId, animeTitle, userId }: CollectionsSectionProps) {
  const supabase = useMemo(() => createClient(), []);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPublic, setNewPublic] = useState(true);
  const [saving, setSaving] = useState(false);
  const [myCollections, setMyCollections] = useState<Collection[]>([]);

  const loadCollections = useCallback(async () => {

    const { data: items } = await supabase
      .from("collection_items")
      .select("collection_id, collections!inner(id, name, description, is_public, user_id)")
      .eq("anime_id", animeId);
    const cols: Collection[] = (items || []).map((i) => {
      const col = Array.isArray(i.collections) ? i.collections[0] : i.collections;
      return {
        id: col.id,
        user_id: col.user_id,
        name: col.name,
        description: col.description,
        is_public: col.is_public,
        contains: true,
        owned: col.user_id === userId,
      };
    });
    setCollections(cols);
  }, [animeId, userId, supabase]);

  const loadMyCollections = useCallback(async () => {
    if (!userId) return;
    const { data: mine } = await supabase
      .from("collections")
      .select("id, name, description, is_public, user_id")
      .eq("user_id", userId);
    if (!mine) return;
    const { data: contained } = await supabase
      .from("collection_items")
      .select("collection_id")
      .eq("anime_id", animeId);
    const containedIds = new Set((contained || []).map((c) => c.collection_id));
    const mapped: Collection[] = mine.map((c) => ({
      id: c.id,
      user_id: c.user_id,
      name: c.name,
      description: c.description,
      is_public: c.is_public,
      contains: containedIds.has(c.id),
      owned: true,
    }));
    setMyCollections(mapped);
  }, [animeId, userId, supabase]);

  useEffect(() => {
    const t = setTimeout(() => { loadCollections(); }, 0);
    return () => clearTimeout(t);
  }, [loadCollections]);

  useEffect(() => {
    const t = setTimeout(() => { loadMyCollections(); }, 0);
    return () => clearTimeout(t);
  }, [loadMyCollections]);

  async function handleCreateAndAdd() {
    if (!userId || !newName.trim()) return;
    setSaving(true);
    const { data: col } = await supabase
      .from("collections")
      .insert({ user_id: userId, name: newName.trim(), is_public: newPublic })
      .select()
      .single();
    if (col) {
      await supabase.from("collection_items").insert({ collection_id: col.id, anime_id: animeId });
    }
    setNewName("");
    setCreating(false);
    setSaving(false);
    await Promise.all([loadCollections(), loadMyCollections()]);
  }

  async function toggleInCollection(col: Collection) {
    if (!userId) return;
    if (col.contains) {
      await supabase.from("collection_items").delete().eq("collection_id", col.id).eq("anime_id", animeId);
    } else {
      await supabase.from("collection_items").insert({ collection_id: col.id, anime_id: animeId });
    }
    await Promise.all([loadCollections(), loadMyCollections()]);
  }

  return (
    <div className="bg-[#1a1a1e] border border-[#222226] rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <i className="fa-solid fa-folder text-amber-400 text-xs"></i>
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Коллекции</h3>
        {userId && (
          <button onClick={() => setCreating(true)}
            className="ml-auto text-[10px] font-bold text-sky-400 hover:text-sky-300 px-2 py-1 rounded border border-sky-400/30 hover:bg-sky-400/10 transition-all">
            <i className="fa-solid fa-plus mr-1"></i> Создать и добавить
          </button>
        )}
      </div>

      {creating && userId && (
        <div className="mb-4 p-3 bg-[#121214] border border-[#222226] rounded-lg flex flex-col gap-2">
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Название коллекции"
            className="w-full bg-[#1a1a1e] border border-[#222226] rounded px-3 py-1.5 text-xs text-white outline-none focus:border-sky-500/50" />
          <label className="flex items-center gap-2 text-[11px] text-gray-400">
            <input type="checkbox" checked={newPublic} onChange={(e) => setNewPublic(e.target.checked)} className="accent-sky-500" />
            Публичная коллекция (увидят другие)
          </label>
          <div className="flex gap-2">
            <button onClick={handleCreateAndAdd} disabled={saving || !newName.trim()}
              className="bg-sky-500 hover:bg-sky-600 text-white text-[10px] font-bold px-3 py-1.5 rounded transition-all disabled:opacity-50">
              {saving ? "Создание..." : `Создать и добавить «${animeTitle}»`}
            </button>
            <button onClick={() => setCreating(false)} className="text-gray-400 text-[10px] font-bold px-3 py-1.5 rounded border border-[#222226] hover:text-white transition-all">Отмена</button>
          </div>
        </div>
      )}

      {/* Мои коллекции с переключателями */}
      {myCollections.length > 0 && (
        <div className="mb-4">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Мои коллекции</p>
          <div className="flex flex-col gap-1.5">
            {myCollections.map((c) => (
              <label key={c.id} className="flex items-center gap-2.5 p-2 bg-[#121214] border border-[#222226] rounded-lg cursor-pointer hover:border-sky-500/30 transition-all">
                <input type="checkbox" checked={c.contains} onChange={() => toggleInCollection(c)} className="accent-sky-500" />
                <span className="text-xs text-gray-300 font-semibold flex-1 truncate">{c.name}</span>
                {!c.is_public && <span className="text-[9px] text-gray-600"><i className="fa-solid fa-lock mr-0.5"></i>приватная</span>}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Коллекции других, где есть это аниме */}
      <div className="flex flex-col gap-2">
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">В коллекциях пользователей</p>
        {collections.filter((c) => !c.owned).length === 0 && (
          <p className="text-[11px] text-gray-600">Пока нигде нет — добавьте в свою коллекцию!</p>
        )}
        {collections.filter((c) => !c.owned).map((c) => (
          <Link key={c.id} href={`/profile/${c.user_id}`}
            className="flex items-center gap-3 p-2.5 bg-[#121214] border border-[#222226] rounded-lg hover:border-sky-500/30 transition-all">
            <i className="fa-solid fa-folder-open text-amber-400/70 text-sm"></i>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-300 truncate">{c.name}</p>
              {c.description && <p className="text-[10px] text-gray-600 truncate">{c.description}</p>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
