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
  display_name?: string;
  avatar_url: string;
  bio: string;
  background_url: string;
  primary_color: string;
  secondary_color: string;
  border_radius: string;
  display_background: boolean;
  total: number;
  completed: number;
  watching: number;
  planned: number;
  dropped: number;
  onHold: number;
  topGenres: { genre: string; count: number }[];
  favorites: Favorite[];
  rareAnime: RareAnime[];
  friends_count: number;
}

interface Favorite {
  id: number;
  title: string;
  image_url: string;
  rating: number;
}

interface RareAnime {
  id: number;
  title: string;
  image_url: string;
  rarity: number;
}

interface FriendItem {
  id: string;
  username: string;
  avatar_url: string;
}

interface UserReview {
  id: number;
  text: string;
  rating: number;
  created_at: string;
  anime_id: number;
}

interface PublicCollection {
  id: number;
  name: string;
  description: string;
  count: number;
}

type Relation = "self" | "friends" | "request_sent" | "request_received" | "none";

export default function PublicProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { getEffectiveUserId } = useSimulatedUser();

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [relation, setRelation] = useState<Relation>("none");
  const [incomingRequestId, setIncomingRequestId] = useState<number | null>(null);
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [viewerFriendIds, setViewerFriendIds] = useState<Set<string>>(new Set());
  const [viewerPendingIds, setViewerPendingIds] = useState<Set<string>>(new Set());
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [reviews, setReviews] = useState<UserReview[]>([]);
  const [collections, setCollections] = useState<PublicCollection[]>([]);
  const [animeTitles, setAnimeTitles] = useState<Map<number, { title: string; image_url: string }>>(new Map());
  const [favoritesLoaded, setFavoritesLoaded] = useState(false);
  const [reviewsLoaded, setReviewsLoaded] = useState(false);
  const [expandedCol, setExpandedCol] = useState<number | null>(null);
  const [colItems, setColItems] = useState<Map<number, { anime_id: number; title: string; image_url: string; slug?: string }[]>>(new Map());

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      const viewer = session?.user ? getEffectiveUserId(session.user.id) : null;
      if (cancelled) return;
      setViewerId(viewer);

      const { data: p } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, bio, background_url, primary_color, secondary_color, border_radius, display_background")
        .eq("id", id)
        .single();
      if (!p || cancelled) { setLoading(false); return; }

      const isSelf = viewer === id;
      if (isSelf) setRelation("self");

      const { data: animeList } = await supabase
        .from("anime")
        .select("id, title, image_url, genres");
      if (cancelled) return;

      const titleMap = new Map<number, { title: string; image_url: string }>();
      (animeList || []).forEach((a) => titleMap.set(a.id, { title: a.title, image_url: a.image_url }));
      setAnimeTitles(titleMap);

      const { data: userList } = await supabase
        .from("user_anime_list")
        .select("anime_id, status")
        .eq("user_id", id);

      const { data: userRatings } = await supabase
        .from("ratings")
        .select("anime_id, rating")
        .eq("user_id", id);

      const { data: allRatings } = await supabase
        .from("ratings")
        .select("anime_id, user_id");

      if (cancelled) return;

      const total = userList?.length || 0;
      const completed = userList?.filter((l) => l.status === "completed").length || 0;
      const watching = userList?.filter((l) => l.status === "watching").length || 0;
      const planned = userList?.filter((l) => l.status === "planned").length || 0;
      const dropped = userList?.filter((l) => l.status === "dropped").length || 0;
      const onHold = userList?.filter((l) => l.status === "on_hold").length || 0;

      const highRatedIds = new Set(
        (userRatings || []).filter((r) => r.rating >= 8).map((r) => r.anime_id)
      );
      const genreCounts: Record<string, number> = {};
      userList?.forEach((l) => {
        if (!highRatedIds.has(l.anime_id)) return;
        const anime = (animeList || []).find((a) => a.id === l.anime_id);
        if (anime?.genres) {
          (anime.genres as string[]).forEach((g) => {
            genreCounts[g] = (genreCounts[g] || 0) + 1;
          });
        }
      });
      const topGenres = Object.entries(genreCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([genre, count]) => ({ genre, count }));

      const favs: Favorite[] = (userRatings || [])
        .filter((r) => r.rating >= 9)
        .map((r) => {
          const meta = titleMap.get(r.anime_id);
          return {
            id: r.anime_id,
            title: meta?.title || "Без названия",
            image_url: meta?.image_url || "",
            rating: r.rating,
          };
        });

      const ratingCounts = new Map<number, number>();
      allRatings?.forEach((r) => {
        ratingCounts.set(r.anime_id, (ratingCounts.get(r.anime_id) || 0) + 1);
      });
      const activeUsersSet = new Set<string>();
      allRatings?.forEach((r) => activeUsersSet.add(r.user_id));
      const { data: allListUsers } = await supabase.from("user_anime_list").select("user_id");
      allListUsers?.forEach((l) => activeUsersSet.add(l.user_id));
      const activeUsers = activeUsersSet.size || 1;

      const watchedIds = new Set(
        (userList || [])
          .filter((l) => l.status === "completed" || l.status === "watching")
          .map((l) => l.anime_id)
      );
      const rareAnime: RareAnime[] = [];
      watchedIds.forEach((aid) => {
        const meta = titleMap.get(aid);
        if (!meta) return;
        const rated = ratingCounts.get(aid) || 0;
        const rarity = 1 - rated / activeUsers;
        if (rarity >= 0.95) {
          rareAnime.push({ id: aid, title: meta.title, image_url: meta.image_url, rarity });
        }
      });
      rareAnime.sort((a, b) => b.rarity - a.rarity);

      const { data: friendsData } = await supabase
        .from("friends")
        .select("user_id, friend_id")
        .eq("status", "accepted")
        .or(`user_id.eq.${id},friend_id.eq.${id}`);
      const friendIds = (friendsData || []).map((f) => (f.user_id === id ? f.friend_id : f.user_id));
      const { data: friendsProfiles } = friendIds.length > 0
        ? await supabase.from("profiles").select("id, username, avatar_url").in("id", friendIds)
        : { data: [] as { id: string; username: string; avatar_url: string }[] };
      if (cancelled) return;
      setFriends((friendsProfiles || []).map((f) => ({
        id: f.id,
        username: f.username,
        avatar_url: f.avatar_url || "",
      })));

      if (viewer && !isSelf) {
        const { data: vFriends } = await supabase
          .from("friends")
          .select("user_id, friend_id")
          .eq("status", "accepted")
          .or(`user_id.eq.${viewer},friend_id.eq.${viewer}`);
        const vFriendIds = new Set<string>(
          (vFriends || []).map((f) => (f.user_id === viewer ? f.friend_id : f.user_id))
        );
        setViewerFriendIds(vFriendIds);

        const { data: vPending } = await supabase
          .from("friends")
          .select("friend_id")
          .eq("status", "pending")
          .eq("user_id", viewer);
        const vPendingIds = new Set<string>((vPending || []).map((r) => r.friend_id));
        setViewerPendingIds(vPendingIds);

        const { data: incoming } = await supabase
          .from("friends")
          .select("id")
          .eq("status", "pending")
          .eq("user_id", id)
          .eq("friend_id", viewer)
          .maybeSingle();

        if (vFriendIds.has(id)) setRelation("friends");
        else if (vPendingIds.has(id)) setRelation("request_sent");
        else if (incoming) {
          setRelation("request_received");
          setIncomingRequestId(incoming.id);
        } else setRelation("none");
      }

      const { data: revs } = await supabase
        .from("reviews")
        .select("id, text, rating, created_at, anime_id")
        .eq("user_id", id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (!cancelled) { setReviews((revs || []) as UserReview[]); setReviewsLoaded(true); }

      const { data: cols } = await supabase
        .from("collections")
        .select("id, name, description")
        .eq("user_id", id)
        .eq("is_public", true);
      const { data: items } = cols?.length
        ? await supabase
            .from("collection_items")
            .select("collection_id, id, anime:anime_id(id, title, image_url, slug)")
            .in("collection_id", cols.map((c) => c.id))
        : { data: [] };
      const countByCollection = new Map<number, number>();
      const itemsByCol = new Map<number, { anime_id: number; title: string; image_url: string; slug?: string }[]>();
      for (const it of items || []) {
        countByCollection.set(it.collection_id, (countByCollection.get(it.collection_id) ?? 0) + 1);
        const a = Array.isArray((it as unknown as { anime: unknown }).anime) ? (it as unknown as { anime: { id: number; title: string; image_url: string; slug?: string }[] }).anime[0] : (it as unknown as { anime: { id: number; title: string; image_url: string; slug?: string } }).anime;
        if (a) {
          const list = itemsByCol.get(it.collection_id) || [];
          list.push({ anime_id: a.id, title: a.title, image_url: a.image_url, slug: a.slug });
          itemsByCol.set(it.collection_id, list);
        }
      }
      const colList: PublicCollection[] = (cols || []).map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description || "",
        count: countByCollection.get(c.id) ?? 0,
      }));
      if (cancelled) return;
      setCollections(colList);
      setColItems(itemsByCol);

      setProfile({
        id: p.id,
        username: p.username,
        display_name: p.display_name || "",
        avatar_url: p.avatar_url || "",
        bio: p.bio || "",
        background_url: p.background_url || "",
        primary_color: p.primary_color || "#38bdf8",
        secondary_color: p.secondary_color || "#0ea5e9",
        border_radius: p.border_radius || "12px",
        display_background: p.display_background ?? true,
        total,
        completed,
        watching,
        planned,
        dropped,
        onHold,
        topGenres,
        favorites: favs,
        rareAnime: rareAnime.slice(0, 6),
        friends_count: friendIds.length,
      });
      setFavorites(favs);
      setFavoritesLoaded(true);
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [id, getEffectiveUserId, supabase]);

  async function handleAddProfileFriend() {
    if (!viewerId) { router.push("/login"); return; }
    const { error: err } = await supabase
      .from("friends")
      .insert({ user_id: viewerId, friend_id: id, status: "pending" });
    if (!err) setRelation("request_sent");
  }

  async function handleAcceptProfileFriend() {
    if (!viewerId || !incomingRequestId) return;
    const { error: err } = await supabase
      .from("friends")
      .update({ status: "accepted" })
      .eq("id", incomingRequestId);
    if (!err) {
      setRelation("friends");
      setViewerFriendIds((prev) => new Set(prev).add(id));
      setProfile((prev) => prev ? { ...prev, friends_count: prev.friends_count + 1 } : prev);
    }
  }

  async function handleAddFriend(targetId: string) {
    if (!viewerId) { router.push("/login"); return; }
    const { error: err } = await supabase
      .from("friends")
      .insert({ user_id: viewerId, friend_id: targetId, status: "pending" });
    if (!err) setViewerPendingIds((prev) => new Set(prev).add(targetId));
  }

  if (loading) return <div className="text-center py-20 text-gray-500 text-xs">Загрузка...</div>;
  if (!profile) return <div className="text-center py-20 text-gray-500 text-xs">Пользователь не найден</div>;

  const maxGenreCount = profile.topGenres[0]?.count || 1;

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto">
      <div className="relative overflow-hidden border transition-all duration-300"
        style={{ backgroundColor: profile.primary_color + "15", borderColor: profile.primary_color + "40", borderRadius: profile.border_radius }}>
        {profile.display_background && profile.background_url && (
          <div className="absolute inset-0">
            <Image src={profile.background_url} alt="" fill unoptimized sizes="900px" className="object-cover opacity-25" />
          </div>
        )}
        <div className="relative p-6 flex flex-col sm:flex-row items-center gap-6">
          <div className="w-24 h-24 rounded-2xl overflow-hidden bg-[#121214] relative shrink-0">
            {profile.avatar_url ? (
              <Image src={profile.avatar_url} alt={profile.username} fill unoptimized sizes="96px" className="object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white text-2xl font-black">
                {profile.username.substring(0, 2).toUpperCase()}
              </div>
            )}
          </div>
          <div className="text-center sm:text-left flex-1 min-w-0">
            <h2 className="text-2xl font-black text-white truncate">
              {profile.display_name || profile.username}
            </h2>
            {profile.display_name && (
              <span className="text-[11px] text-gray-500">@{profile.username}</span>
            )}
            <p className="text-xs text-gray-400 mt-1.5 line-clamp-2">{profile.bio || "Пока без описания"}</p>
          </div>

          {relation === "self" ? (
            <Link href="/profile"
              className="shrink-0 px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 border bg-[#1a1a1e] border-[#222226] text-gray-300 hover:text-white">
              <i className="fa-solid fa-pen text-[10px]"></i>Редактировать
            </Link>
          ) : relation === "friends" ? (
            <span className="shrink-0 px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 border bg-green-500/10 border-green-500/20 text-green-400">
              <i className="fa-solid fa-user-check text-[10px]"></i>В друзьях
            </span>
          ) : relation === "request_sent" ? (
            <span className="shrink-0 px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 border bg-[#1a1a1e] border-[#222226] text-gray-400">
              <i className="fa-solid fa-clock text-[10px]"></i>Заявка отправлена
            </span>
          ) : relation === "request_received" ? (
            <button onClick={handleAcceptProfileFriend}
              className="shrink-0 px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 border bg-green-500/10 border-green-500/20 text-green-400 hover:bg-green-500/20">
              <i className="fa-solid fa-user-plus text-[10px]"></i>Принять заявку
            </button>
          ) : (
            <button onClick={handleAddProfileFriend}
              className="shrink-0 px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 border bg-sky-500 hover:bg-sky-600 border-sky-500 text-white shadow-lg shadow-sky-500/20">
              <i className="fa-solid fa-user-plus text-[10px]"></i>Добавить в друзья
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#1a1a1e] border border-[#222226] rounded-xl p-5 flex flex-col justify-between min-h-[160px]">
          <div>
            <span className="text-gray-500 text-[10px] font-bold uppercase tracking-wider block mb-2">Просмотры</span>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black text-white">{profile.completed}</span>
              <span className="text-gray-500 text-xs">/ {profile.total} всего</span>
            </div>
          </div>
          <div className="space-y-1.5 mt-4 pt-3 border-t border-[#222226]/50">
            <div className="flex justify-between text-[11px] text-gray-400">
              <span>Смотрю сейчас:</span>
              <span className="font-bold text-sky-400">{profile.watching}</span>
            </div>
            <div className="flex justify-between text-[11px] text-gray-400">
              <span>Запланировано:</span>
              <span className="font-bold text-gray-500">{profile.planned}</span>
            </div>
            <div className="flex justify-between text-[11px] text-gray-400">
              <span>Отложено:</span>
              <span className="font-bold text-amber-400">{profile.onHold}</span>
            </div>
            <div className="flex justify-between text-[11px] text-gray-400">
              <span>Брошено:</span>
              <span className="font-bold text-red-400">{profile.dropped}</span>
            </div>
          </div>
        </div>

        <div className="bg-[#1a1a1e] border border-[#222226] rounded-xl p-5 flex flex-col min-h-[160px]">
          <span className="text-gray-500 text-[10px] font-bold uppercase tracking-wider block mb-4">Любимые жанры</span>
          <div className="flex flex-col gap-3 flex-1 justify-center">
            {profile.topGenres.length === 0 ? (
              <div className="text-xs text-gray-500 text-center py-4">Нет оценок на 8+</div>
            ) : (
              profile.topGenres.map((g) => (
                <div key={g.genre} className="text-xs">
                  <div className="flex justify-between mb-1">
                    <span className="font-bold text-gray-300">{g.genre}</span>
                    <span className="text-gray-500 text-[10px]">{g.count} тайтл.</span>
                  </div>
                  <div className="w-full bg-[#121214] h-1.5 rounded-full overflow-hidden">
                    <div className="h-full rounded transition-all"
                      style={{ width: `${(g.count / maxGenreCount) * 100}%`, backgroundColor: profile.primary_color }} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-[#1a1a1e] border border-[#222226] rounded-xl p-5 flex flex-col min-h-[160px]">
          <span className="text-gray-500 text-[10px] font-bold uppercase tracking-wider block mb-3">
            Друзья ({profile.friends_count})
          </span>
          <div className="flex flex-col gap-2 flex-1 justify-center">
            {friends.length === 0 ? (
              <div className="text-xs text-gray-500 text-center py-4">Друзей пока нет</div>
            ) : (
              friends.map((f) => {
                const isViewer = f.id === viewerId;
                const alreadyFriend = viewerFriendIds.has(f.id);
                const pending = viewerPendingIds.has(f.id);
                return (
                  <div key={f.id} className="flex items-center justify-between p-2 bg-[#121214] rounded-lg border border-[#222226]">
                    <Link href={`/profile/${f.id}`} className="flex items-center gap-2 overflow-hidden flex-1 min-w-0 group">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0 overflow-hidden relative">
                        {f.avatar_url ? (
                          <Image src={f.avatar_url} alt={f.username} fill unoptimized sizes="32px" className="object-cover" />
                        ) : (
                          f.username.charAt(0).toUpperCase()
                        )}
                      </div>
                      <span className="font-semibold text-gray-300 text-xs truncate group-hover:text-sky-400 transition-colors">
                        {f.username}
                      </span>
                    </Link>
                    {!isViewer && (
                      alreadyFriend ? (
                        <span className="text-[9px] font-bold text-green-400 shrink-0" title="В друзьях">
                          <i className="fa-solid fa-user-check"></i>
                        </span>
                      ) : pending ? (
                        <span className="text-[9px] font-bold text-gray-500 shrink-0" title="Заявка отправлена">
                          <i className="fa-solid fa-clock"></i>
                        </span>
                      ) : (
                        <button onClick={() => handleAddFriend(f.id)} title="Добавить в друзья"
                          className="shrink-0 text-[10px] text-sky-400 hover:text-sky-300 transition-colors px-1.5 py-1">
                          <i className="fa-solid fa-user-plus"></i>
                        </button>
                      )
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="bg-[#1a1a1e] border border-[#222226] rounded-xl p-5">
        <span className="text-gray-500 text-[10px] font-bold uppercase tracking-wider block mb-1">
          Редкие находки <i className="fa-solid fa-gem text-amber-400 ml-1"></i>
        </span>
        <p className="text-[10px] text-gray-600 mb-3">
          Тайтлы, которые посмотрели меньше 5% активных пользователей
        </p>
        <div className="flex flex-col gap-2">
          {profile.rareAnime.length === 0 ? (
            <div className="text-xs text-gray-500 text-center py-4">Пока нет просмотренных аниме</div>
          ) : (
            profile.rareAnime.map((r) => (
              <div key={r.id} onClick={() => router.push(`/anime/${r.id}`)}
                className="flex items-center justify-between p-3 bg-[#121214] hover:bg-[#222226] rounded-lg border border-[#222226] cursor-pointer transition-all hover:scale-[1.01]">
                <div className="flex items-center gap-3 overflow-hidden mr-2">
                  <div className="w-10 h-14 rounded overflow-hidden bg-[#121214] relative shrink-0">
                    <Image src={r.image_url || "/window.svg"} alt={r.title} fill unoptimized sizes="40px" className="object-cover rounded" />
                  </div>
                  <span className="font-semibold text-gray-300 text-sm truncate">{r.title}</span>
                </div>
                <span className="bg-amber-400/10 text-amber-400 text-[10px] font-bold px-2.5 py-1 rounded-lg border border-amber-400/20 whitespace-nowrap">
                  <i className="fa-solid fa-gem mr-1"></i>
                  {Math.round(r.rarity * 100)}% не видели
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="bg-[#1a1a1e] border border-[#222226] rounded-xl p-5">
        <span className="text-gray-500 text-[10px] font-bold uppercase tracking-wider block mb-4">
          Публичные коллекции <i className="fa-solid fa-folder text-amber-400 ml-1"></i>
        </span>
        <div className="flex flex-col gap-2">
          {collections.length === 0 ? (
            <div className="text-xs text-gray-500 text-center py-4">Публичных коллекций нет</div>
          ) : (
            collections.map((c) => (
              <div key={c.id} className="bg-[#121214] rounded-lg border border-[#222226] overflow-hidden">
                <div onClick={() => setExpandedCol(expandedCol === c.id ? null : c.id)} className="flex items-center justify-between p-3 hover:bg-[#1a1a1e] cursor-pointer transition-colors">
                  <div className="flex items-center gap-3 overflow-hidden mr-2">
                    <i className={`fa-solid ${expandedCol === c.id ? "fa-folder-open" : "fa-folder"} text-amber-400/80`}></i>
                    <div className="min-w-0">
                      <span className="font-semibold text-gray-300 text-xs block truncate">{c.name}</span>
                      {c.description && <span className="text-[10px] text-gray-600 truncate block">{c.description}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-gray-500">{c.count} тайтл.</span>
                    <i className={`fa-solid ${expandedCol === c.id ? "fa-chevron-up" : "fa-chevron-down"} text-gray-600 text-[9px]`}></i>
                  </div>
                </div>
                {expandedCol === c.id && (
                  <div className="px-3 pb-3 pt-1 border-t border-[#222226]/50">
                    {(colItems.get(c.id) || []).length === 0 ? (
                      <p className="text-[11px] text-gray-600 py-2">Пусто</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {(colItems.get(c.id) || []).map((a) => (
                          <Link key={a.anime_id} href={a.slug ? `/anime/${a.slug}` : `/anime/${a.anime_id}`} className="block w-14 h-20 rounded overflow-hidden bg-[#121214] relative">
                            <Image src={a.image_url || "/window.svg"} alt={a.title} fill unoptimized className="object-cover" sizes="56px" />
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {favoritesLoaded && favorites.length > 0 && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-2">
            <i className="fa-solid fa-star text-amber-400"></i>
            Любимые тайтлы (оценки 9 и 10)
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
            {favorites.map((f) => (
              <AnimeCard key={f.id} id={f.id} title={f.title} image_url={f.image_url}
                genres={[]} season_info="" age_rating="" weighted_rating={f.rating} />
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
            {reviews.map((r) => {
              const meta = animeTitles.get(r.anime_id);
              return (
                <div key={r.id} className="p-3 bg-[#121214] border border-[#222226] rounded-lg">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Link href={`/anime/${r.anime_id}`}
                      className="text-xs font-bold text-white hover:text-sky-400 transition-colors truncate flex-1">
                      {meta?.title || "Аниме"}
                    </Link>
                    <span className="text-[10px] font-bold text-amber-400 border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 rounded">{r.rating}/10</span>
                  </div>
                  <p className="text-xs text-gray-300 whitespace-pre-wrap break-words">{r.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {favoritesLoaded && reviewsLoaded && reviews.length === 0 && favorites.length === 0 && collections.length === 0 && (
        <div className="text-center py-12 text-gray-500 text-xs">Пользователь пока ничего не добавил</div>
      )}
    </div>
  );
}
