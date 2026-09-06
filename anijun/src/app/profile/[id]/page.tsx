"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState, use, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import AnimeCard from "@/components/AnimeCard";
import { useSimulatedUser } from "@/lib/simulation-context";

interface PublicProfile {
  id: string;
  username: string;
  avatar_url: string;
  bio: string;
  primary_color: string;
  border_radius: string;
  total: number;
  completed: number;
  watching: number;
  planned: number;
}

interface Favorite {
  id: number;
  slug?: string;
  title: string;
  image_url: string;
  rating: number;
}

interface UserReview {
  id: number;
  text: string;
  rating: number;
  created_at: string;
  anime?: { id: number; slug?: string; title: string; image_url: string }[];
}

interface PublicCollection {
  id: number;
  name: string;
  description: string;
  count: number;
}

export default function PublicProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { getEffectiveUserId } = useSimulatedUser();

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSelf, setIsSelf] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [reviews, setReviews] = useState<UserReview[]>([]);
  const [collections, setCollections] = useState<PublicCollection[]>([]);
  const [favoritesLoaded, setFavoritesLoaded] = useState(false);
  const [reviewsLoaded, setReviewsLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      const viewerId = session?.user ? getEffectiveUserId(session.user.id) : null;
      if (cancelled) return;

      const { data: p } = await supabase
        .from("profiles")
        .select("id, username, avatar_url, bio, primary_color, border_radius")
        .eq("id", id)
        .single();
      if (!p || cancelled) { setLoading(false); return; }

      setIsSelf(viewerId === id);

      if (viewerId && viewerId !== id) {
        const { data: followRow } = await supabase
          .from("user_follows")
          .select("follower_id")
          .eq("follower_id", viewerId)
          .eq("following_id", id)
          .maybeSingle();
        if (!cancelled) setIsFollowing(!!followRow);
      }

      const { data: userList } = await supabase
        .from("user_anime_list")
        .select("status")
        .eq("user_id", id);

      if (cancelled) return;

      setProfile({
        id: p.id,
        username: p.username,
        avatar_url: p.avatar_url || "",
        bio: p.bio || "",
        primary_color: p.primary_color || "#38bdf8",
        border_radius: p.border_radius || "12px",
        total: userList?.length || 0,
        completed: userList?.filter((l) => l.status === "completed").length || 0,
        watching: userList?.filter((l) => l.status === "watching").length || 0,
        planned: userList?.filter((l) => l.status === "planned").length || 0,
      });


      const { data: ratings } = await supabase
        .from("ratings")
        .select("anime_id, rating, anime:anime_id(id, slug, title, image_url)")
        .eq("user_id", id)
        .gte("rating", 9);
      const favs: Favorite[] = (ratings || []).map((r) => ({
        id: r.anime_id,
        slug: r.anime?.[0]?.slug,
        title: r.anime?.[0]?.title || "Unknown",
        image_url: r.anime?.[0]?.image_url || "",
        rating: r.rating,
      }));
      if (!cancelled) { setFavorites(favs); setFavoritesLoaded(true); }


      const { data: revs } = await supabase
        .from("reviews")
        .select("*, anime:anime_id(id, slug, title, image_url)")
        .eq("user_id", id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (!cancelled) { setReviews(revs as unknown as UserReview[]); setReviewsLoaded(true); }


      const { data: cols } = await supabase
        .from("collections")
        .select("id, name, description")
        .eq("user_id", id)
        .eq("is_public", true);

      const { data: items } = cols?.length
        ? await supabase
            .from("collection_items")
            .select("collection_id, id")
            .in("collection_id", cols.map((c) => c.id))
        : { data: [] };

      const countByCollection = new Map<number, number>();
      for (const it of items || []) {
        countByCollection.set(it.collection_id, (countByCollection.get(it.collection_id) ?? 0) + 1);
      }
      const colList: PublicCollection[] = (cols || []).map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description || "",
        count: countByCollection.get(c.id) ?? 0,
      }));
      if (!cancelled) setCollections(colList);
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [id, getEffectiveUserId, supabase]);

  async function toggleFollow() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { router.push("/login"); return; }
    const viewerId = getEffectiveUserId(session.user.id);
    if (isFollowing) {
      await supabase.from("user_follows").delete().eq("follower_id", viewerId).eq("following_id", id);
      setIsFollowing(false);
    } else {
      await supabase.from("user_follows").insert({ follower_id: viewerId, following_id: id });
      setIsFollowing(true);
    }
  }

  if (loading) return <div className="text-center py-20 text-gray-500 text-xs">Загрузка...</div>;
  if (!profile) return <div className="text-center py-20 text-gray-500 text-xs">Пользователь не найден</div>;

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto">
      <div className="relative overflow-hidden border transition-all duration-300"
        style={{ backgroundColor: profile.primary_color + '15', borderColor: profile.primary_color + '40', borderRadius: profile.border_radius }}>
        <div className="relative p-6 flex flex-col sm:flex-row items-center gap-6">
          <div className="w-24 h-24 rounded-2xl overflow-hidden bg-[#121214] relative shrink-0">
            {profile.avatar_url ? (
              <Image src={profile.avatar_url} alt={profile.username} fill className="object-cover" sizes="96px" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white text-2xl font-black">
                {profile.username.substring(0, 2).toUpperCase()}
              </div>
            )}
          </div>
          <div className="text-center sm:text-left flex-1 min-w-0">
            <h2 className="text-2xl font-black text-white truncate">{profile.username}</h2>
            <p className="text-xs text-gray-400 mt-1.5 line-clamp-2">{profile.bio || "Пока без описания"}</p>
          </div>
          {!isSelf && (
            <button onClick={toggleFollow}
              className={`shrink-0 px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 border ${
                isFollowing ? "bg-[#1a1a1e] border-[#222226] text-gray-400 hover:text-red-400" : "bg-sky-500 hover:bg-sky-600 border-sky-500 text-white shadow-lg shadow-sky-500/20"
              }`}>
              <i className={`fa-solid ${isFollowing ? "fa-bell-slash" : "fa-bell"} text-[10px]`}></i>
              {isFollowing ? "Отписаться" : "Подписаться"}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Stat label="Всего" value={profile.total} />
        <Stat label="Просмотрено" value={profile.completed} />
        <Stat label="Смотрит" value={profile.watching} />
        <Stat label="Запланировано" value={profile.planned} />
      </div>

      {favoritesLoaded && favorites.length > 0 && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-2">
            <i className="fa-solid fa-star text-amber-400"></i> Любимые тайтлы
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
            {favorites.map((f) => (
              <Link key={f.id} href={f.slug ? `/anime/${f.slug}` : `/anime/${f.id}`}>
                <AnimeCard id={f.id} title={f.title} image_url={f.image_url} genres={[]} season_info="" age_rating="" weighted_rating={f.rating} />
              </Link>
            ))}
          </div>
        </div>
      )}

      {reviewsLoaded && reviews.length > 0 && (
        <div className="bg-[#1a1a1e] border border-[#222226] rounded-xl p-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-2">
            <i className="fa-solid fa-comment text-sky-400"></i> Отзывы ({reviews.length})
          </h3>
          <div className="flex flex-col gap-3">
            {reviews.map((r) => (
              <div key={r.id} className="p-3 bg-[#121214] border border-[#222226] rounded-lg">
                <div className="flex items-center gap-2 mb-1.5">
                  <Link href={r.anime?.[0]?.slug ? `/anime/${r.anime[0].slug}` : `/anime/${r.anime?.[0]?.id || ""}`}
                    className="text-xs font-bold text-white hover:text-sky-400 transition-colors truncate flex-1">
                    {r.anime?.[0]?.title || "Аниме"}
                  </Link>
                  <span className="text-[10px] font-bold text-amber-400 border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 rounded">{r.rating}/10</span>
                </div>
                <p className="text-xs text-gray-300 whitespace-pre-wrap break-words">{r.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {collections.length > 0 && (
        <div className="bg-[#1a1a1e] border border-[#222226] rounded-xl p-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-2">
            <i className="fa-solid fa-folder text-amber-400"></i> Публичные коллекции
          </h3>
          <div className="flex flex-col gap-2">
            {collections.map((c) => (
              <div key={c.id} className="flex items-center gap-3 p-3 bg-[#121214] border border-[#222226] rounded-lg">
                <i className="fa-solid fa-folder-open text-amber-400/80 text-sm"></i>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-300 truncate">{c.name}</p>
                  {c.description && <p className="text-[10px] text-gray-600 truncate">{c.description}</p>}
                </div>
                <span className="text-[10px] text-gray-500 shrink-0">{c.count} тайтл.</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {reviewsLoaded && favoritesLoaded && reviews.length === 0 && favorites.length === 0 && collections.length === 0 && (
        <div className="text-center py-12 text-gray-500 text-xs">Пользователь пока ничего не добавил</div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-[#1a1a1e] border border-[#222226] rounded-xl p-4 text-center">
      <span className="text-2xl font-black text-white block">{value}</span>
      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{label}</span>
    </div>
  );
}
