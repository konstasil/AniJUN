"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import AnimeCard from "@/components/AnimeCard";
import ImageUpload from "@/components/ImageUpload";
import UserSearch from "@/components/UserSearch";

interface RareAnime {
  id: number;
  title: string;
  image_url: string;
  votesCount: number;
  rarity: number;
}

interface ProfileCollection {
  id: number;
  name: string;
  description: string;
  is_public: boolean;
  count: number;
}

interface FavoriteAnime {
  id: number;
  title: string;
  image_url: string;
  rating: number;
}

interface ProfileData {
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
  favorites: FavoriteAnime[];
  rareAnime: RareAnime[];
  friends_count: number;
}

interface FriendRequest {
  request_id: number;
  user_id: string;
  username: string;
  avatar_url: string;
}

interface FriendRecommendation {
  id: string;
  username: string;
  avatar_url: string;
  shared_genres: number;
  shared_anime: number;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editBio, setEditBio] = useState("");
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editPrimaryColor, setEditPrimaryColor] = useState("#38bdf8");
  const [editSecondaryColor, setEditSecondaryColor] = useState("#0ea5e9");
  const [editBorderRadius, setEditBorderRadius] = useState("12px");
  const [displayBackground, setDisplayBackground] = useState(true);
  const [friends, setFriends] = useState<FriendRecommendation[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [recommendations, setRecommendations] = useState<FriendRecommendation[]>([]);
  const [collections, setCollections] = useState<ProfileCollection[]>([]);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        router.push("/login");
        return;
      }

      const user = session.user;
      if (cancelled) return;
      setUserId(user.id);

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (!profileData) {
        if (!cancelled) setLoading(false);
        return;
      }

      const { data: animeList } = await supabase
        .from("anime")
        .select("id, title, image_url, genres");

      const { data: userList } = await supabase
        .from("user_anime_list")
        .select("anime_id, status")
        .eq("user_id", user.id);

      const { data: userRatings } = await supabase
        .from("ratings")
        .select("anime_id, rating")
        .eq("user_id", user.id);

      const { data: allRatings } = await supabase
        .from("ratings")
        .select("anime_id, user_id");


      const { count: friendsCount } = await supabase
        .from("friends")
        .select("*", { count: "exact", head: true })
        .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
        .eq("status", "accepted");

      // Friends list
      const { data: friendsData } = await supabase
        .from("friends")
        .select("user_id, friend_id")
        .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
        .eq("status", "accepted");

      const friendIds = (friendsData || []).map(f => f.user_id === user.id ? f.friend_id : f.user_id);
      const { data: friendsProfiles } = friendIds.length > 0 ? await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .in("id", friendIds) : { data: [] };

      // Friend requests
      const { data: requestsData } = await supabase
        .from("friends")
        .select("id, user_id")
        .eq("friend_id", user.id)
        .eq("status", "pending");

      const requestUserIds = (requestsData || []).map(r => r.user_id);
      const { data: requestProfiles } = requestUserIds.length > 0 ? await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .in("id", requestUserIds) : { data: [] };

      const requestsMap = new Map((requestsData || []).map(r => [r.user_id, r.id]));
      const friendRequestsList: FriendRequest[] = (requestProfiles || []).map(p => ({
        request_id: requestsMap.get(p.id) || 0,
        user_id: p.id,
        username: p.username,
        avatar_url: p.avatar_url || ""
      }));

      // Recommendations: users with shared anime interests but not friends yet
      const currentUserGenres = new Set<string>();
      userList?.forEach(l => {
        const anime = animeList?.find(a => a.id === l.anime_id);
        if (anime?.genres) {
          (anime.genres as string[]).forEach(g => currentUserGenres.add(g));
        }
      });

      const { data: otherProfiles } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .neq("id", user.id)
        .limit(50);

      const recs: FriendRecommendation[] = [];
      if (otherProfiles && currentUserGenres.size > 0) {
        const candidateIds = otherProfiles
          .filter((other) => !friendIds.includes(other.id))
          .map((other) => other.id);

        if (candidateIds.length > 0) {
          const { data: candidatesList } = await supabase
            .from("user_anime_list")
            .select("user_id, anime_id")
            .in("user_id", candidateIds);

          const userAnimeIds = new Set((userList || []).map((l) => l.anime_id));
          const animeGenresMap = new Map<number, string[]>(
            (animeList || []).map((a) => [a.id, a.genres as string[]])
          );

          const listByUser = new Map<string, Set<number>>();
          (candidatesList || []).forEach((l) => {
            const set = listByUser.get(l.user_id) || new Set<number>();
            set.add(l.anime_id);
            listByUser.set(l.user_id, set);
          });

          for (const other of otherProfiles) {
            if (friendIds.includes(other.id)) continue;
            const otherAnimeIds = listByUser.get(other.id);
            if (!otherAnimeIds) continue;

            const sharedAnime = [...userAnimeIds].filter((id) => otherAnimeIds.has(id)).length;

            let sharedGenres = 0;
            if (sharedAnime > 0) {
              const otherGenres = new Set<string>();
              otherAnimeIds.forEach((id) => {
                (animeGenresMap.get(id) || []).forEach((g) => otherGenres.add(g));
              });
              otherGenres.forEach((g) => { if (currentUserGenres.has(g)) sharedGenres++; });
            }

            if (sharedAnime > 0 && sharedGenres > 0) {
              recs.push({
                id: other.id,
                username: other.username,
                avatar_url: other.avatar_url || "",
                shared_genres: sharedGenres,
                shared_anime: sharedAnime,
              });
            }
          }
        }
      }

      recs.sort((a, b) => (b.shared_genres + b.shared_anime) - (a.shared_genres + a.shared_anime));

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
        const anime = animeList?.find((a) => a.id === l.anime_id);
        if (anime?.genres) {
          (anime.genres as string[]).forEach((g: string) => {
            genreCounts[g] = (genreCounts[g] || 0) + 1;
          });
        }
      });

      const topGenres = Object.entries(genreCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([genre, count]) => ({ genre, count }));

      const favorites = (userRatings || [])
        .filter((r) => r.rating >= 9)
        .map((r) => {
          const anime = animeList?.find((a) => a.id === r.anime_id);
          return {
            id: r.anime_id,
            title: anime?.title || "Unknown",
            image_url: anime?.image_url || "",
            rating: r.rating,
          };
        });

      const ratingCounts = new Map<number, number>();
      allRatings?.forEach((r) => {
        ratingCounts.set(r.anime_id, (ratingCounts.get(r.anime_id) || 0) + 1);
      });

      // Редкие находки по формуле ТЗ: 1 − (оценившие / активные_пользователи) ≥ 95%
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
        const anime = animeList?.find((a) => a.id === aid);
        if (!anime) return;
        const rated = ratingCounts.get(aid) || 0;
        const rarity = 1 - rated / activeUsers;
        if (rarity >= 0.95) {
          rareAnime.push({
            id: anime.id,
            title: anime.title,
            image_url: anime.image_url,
            votesCount: rated,
            rarity,
          });
        }
      });
      rareAnime.sort((a, b) => b.rarity - a.rarity);

      // Мои коллекции
      const { data: myCollections } = await supabase
        .from("collections")
        .select("id, name, description, is_public")
        .eq("user_id", user.id);
      const collectionList: ProfileCollection[] = [];
      for (const c of myCollections || []) {
        const { count } = await supabase
          .from("collection_items")
          .select("id", { count: "exact", head: true })
          .eq("collection_id", c.id);
        collectionList.push({ id: c.id, name: c.name, description: c.description || "", is_public: c.is_public, count: count || 0 });
      }

      if (!cancelled) {
        setProfile({
          id: user.id,
          username: profileData.username,
          display_name: profileData.display_name || "",
          avatar_url: profileData.avatar_url || "",
          bio: profileData.bio || "",
          background_url: profileData.background_url || "",
          primary_color: profileData.primary_color || "#38bdf8",
          secondary_color: profileData.secondary_color || "#0ea5e9",
          border_radius: profileData.border_radius || "12px",
          display_background: profileData.display_background ?? true,
          total,
          completed,
          watching,
          planned,
          dropped,
          onHold,
          topGenres,
          favorites,
          rareAnime: rareAnime.slice(0, 6),
          friends_count: friendsCount || 0
        });
        setCollections(collectionList);
        setEditBio(profileData.bio || "");
        setEditDisplayName(profileData.display_name || "");
        setEditPrimaryColor(profileData.primary_color || "#38bdf8");
        setEditSecondaryColor(profileData.secondary_color || "#0ea5e9");
        setEditBorderRadius(profileData.border_radius || "12px");
        setDisplayBackground(profileData.display_background ?? true);
        setFriends((friendsProfiles || []).map(p => ({
          id: p.id,
          username: p.username,
          avatar_url: p.avatar_url,
          shared_genres: 0,
          shared_anime: 0
        })));
        setFriendRequests(friendRequestsList);
        setRecommendations(recs.slice(0, 10));
        setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [router, supabase]);

  async function handleAvatarUploaded(url: string) {
    if (!userId) return;
    await supabase.from("profiles").update({ avatar_url: url }).eq("id", userId);
    setProfile((p) => (p ? { ...p, avatar_url: url } : p));
  }

  async function handleBackgroundUploaded(url: string) {
    if (!userId) return;
    await supabase.from("profiles").update({ background_url: url }).eq("id", userId);
    setProfile((p) => (p ? { ...p, background_url: url } : p));
  }

  async function handleSave() {
    if (!userId) return;
    setSaving(true);
    const updates: {
      bio: string;
      display_name?: string;
      primary_color: string;
      secondary_color: string;
      border_radius: string;
      display_background: boolean;
    } = {
      bio: editBio,
      display_name: editDisplayName,
      primary_color: editPrimaryColor,
      secondary_color: editSecondaryColor,
      border_radius: editBorderRadius,
      display_background: displayBackground
    };
    const { error } = await supabase.from("profiles").update(updates).eq("id", userId);
    if (!error) {
      setProfile(p => p ? { ...p, ...updates } : p);
      setIsEditing(false);
    }
    setSaving(false);
  }

  async function handleAddFriend(targetId: string) {
    if (!userId) return;
    const { error } = await supabase.from("friends").insert({
      user_id: userId,
      friend_id: targetId,
      status: "pending"
    });
    if (!error) {
      setRecommendations(recs => recs.filter(r => r.id !== targetId));
    }
  }

  async function handleAcceptRequest(requestId: number, fromUserId: string) {
    if (!userId) return;
    const { error } = await supabase.from("friends").update({ status: "accepted" }).eq("id", requestId);
    if (!error) {
      setFriendRequests(reqs => reqs.filter(r => r.user_id !== fromUserId));
      setProfile(p => p ? { ...p, friends_count: p.friends_count + 1 } : p);
    }
  }

  async function handleRejectRequest(requestId: number) {
    if (!userId) return;
    await supabase.from("friends").delete().eq("id", requestId);
    setFriendRequests(reqs => reqs.filter(r => r.request_id !== requestId));
  }

  async function handleRemoveFriend(friendId: string) {
    if (!userId) return;
    await supabase.from("friends").delete().or(`user_id.eq.${userId},friend_id.eq.${userId}`)
      .eq("status", "accepted")
      .or(`and(user_id.eq.${userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${userId})`);
    setFriends(fs => fs.filter(f => f.id !== friendId));
    setProfile(p => p ? { ...p, friends_count: Math.max(0, p.friends_count - 1) } : p);
  }

  const colors = [
    "#38bdf8", "#0ea5e9", "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7",
    "#d946ef", "#ec4899", "#f43f5e", "#ef4444", "#f97316", "#f59e0b",
    "#84cc16", "#22c55e", "#14b8a6", "#06b6d4", "#64748b", "#94a3b8"
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-gray-500 text-xs">Загрузка профиля...</span>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-20 text-gray-500 text-xs">
        Не удалось загрузить профиль. Возможно, он ещё не создан.
      </div>
    );
  }

  const maxGenreCount = profile.topGenres[0]?.count || 1;
  const dropped = profile.dropped;
  const onHold = profile.onHold;

  return (
    <div className="flex flex-col gap-6">
      {/* Profile Card */}
      <div
        className="relative overflow-hidden border transition-all duration-300"
        style={{
          backgroundColor: profile.primary_color + '15',
          borderColor: profile.primary_color + '40',
          borderRadius: profile.border_radius
        }}
      >
        {/* Background */}
        {profile.display_background && profile.background_url && (
          <div className="absolute inset-0 z-0">
            <Image
              src={profile.background_url}
              alt="Background"
              fill
              unoptimized
              sizes="100vw"
              className="object-cover opacity-30"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          </div>
        )}

        <div className="relative z-10 p-6 flex flex-col sm:flex-row items-center gap-6">
          <div className="relative">
            <ImageUpload
              bucket="users"
              currentUrl={profile.avatar_url || undefined}
              onUploaded={handleAvatarUploaded}
              size={96}
              label="Аватар"
              userId={userId || undefined}
            />
          </div>

          <div className="text-center sm:text-left flex-1 min-w-0">
            <h2 className="text-2xl font-black text-white truncate">
              {profile.display_name || profile.username}
            </h2>
            {profile.display_name && (
              <p className="text-xs text-gray-400 mt-0.5">@{profile.username}</p>
            )}
            <p className="text-xs text-gray-400 mt-1.5 line-clamp-2">
              {profile.bio || "Пока нет описания. Добавь пару слов о себе!"}
            </p>

          </div>

          <button
            onClick={() => setIsEditing(!isEditing)}
            className="shrink-0 px-4 py-2 rounded-lg bg-[#1a1a1e] border border-[#222226] text-xs font-bold text-gray-300 hover:text-white hover:border-gray-500 transition-all flex items-center gap-2"
          >
            <i className="fa-solid fa-pen text-[10px]"></i>
            {isEditing ? "Отмена" : "Настроить"}
          </button>
        </div>
      </div>

      {/* Edit Panel */}
      {isEditing && (
        <div className="bg-[#1a1a1e] border border-[#222226] rounded-xl p-6">
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <i className="fa-solid fa-palette text-sky-400"></i>
            Настройка профиля
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Bio and Social */}
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block mb-1.5">
                  Отображаемое имя
                </label>
                <input
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  placeholder="Имя для отображения (может повторяться)"
                  className="w-full bg-[#121214] border border-[#222226] rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-sky-400/50"
                  maxLength={30}
                />
                <p className="text-[9px] text-gray-500 mt-1">Может совпадать с другими пользователями. Уникальный ник (@{profile.username})</p>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block mb-1.5">
                  О себе
                </label>
                <textarea
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  placeholder="Расскажи немного о себе..."
                  className="w-full bg-[#121214] border border-[#222226] rounded-lg px-3 py-2 text-xs text-gray-300 placeholder:text-gray-600 focus:outline-none focus:border-sky-400 transition-colors resize-none h-24"
                />
              </div>

            </div>

            {/* Colors and Style */}
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block mb-1.5">
                  Основной цвет
                </label>
                <div className="flex gap-2 flex-wrap">
                  {colors.map(color => (
                    <button
                      key={color}
                      onClick={() => setEditPrimaryColor(color)}
                      className={`w-8 h-8 rounded-lg border-2 transition-all hover:scale-110 ${
                        editPrimaryColor === color ? 'border-white scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block mb-1.5">
                  Вторичный цвет
                </label>
                <div className="flex gap-2 flex-wrap">
                  {colors.map(color => (
                    <button
                      key={color}
                      onClick={() => setEditSecondaryColor(color)}
                      className={`w-8 h-8 rounded-lg border-2 transition-all hover:scale-110 ${
                        editSecondaryColor === color ? 'border-white scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block mb-1.5">
                  Скругление: {editBorderRadius}
                </label>
                <input
                  type="range"
                  min="0"
                  max="24"
                  value={parseInt(editBorderRadius)}
                  onChange={(e) => setEditBorderRadius(e.target.value + 'px')}
                  className="w-full h-2 bg-[#121214] rounded-lg appearance-none cursor-pointer accent-sky-400"
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-[#121214] rounded-lg border border-[#222226]">
                <span className="text-xs text-gray-300">Показывать задний фон</span>
                <button
                  onClick={() => setDisplayBackground(!displayBackground)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    displayBackground ? 'bg-sky-500' : 'bg-[#222226]'
                  }`}
                >
                  <div
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                      displayBackground ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block mb-1.5">
                  Фоновое изображение
                </label>
                <ImageUpload
                  bucket="users"
                  currentUrl={profile.background_url || undefined}
                  onUploaded={handleBackgroundUploaded}
                  size={60}
                  label="Фон"
                  userId={userId || undefined}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-[#222226]">
            <button
              onClick={() => setIsEditing(false)}
              className="px-4 py-2 rounded-lg bg-[#121214] border border-[#222226] text-xs font-bold text-gray-400 hover:text-white hover:border-gray-500 transition-all"
            >
              Отмена
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-sky-500/20"
            >
              {saving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Сохранение...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-check text-[10px]"></i>
                  Сохранить
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Stats */}
        <div className="bg-[#1a1a1e] border border-[#222226] rounded-xl p-5 flex flex-col justify-between min-h-[160px]">
          <div>
            <span className="text-gray-500 text-[10px] font-bold uppercase tracking-wider block mb-2">
              Просмотры
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black text-white">
                {profile.completed}
              </span>
              <span className="text-gray-500 text-xs">
                / {profile.total} всего
              </span>
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
              <span className="font-bold text-amber-400">{onHold}</span>
            </div>
            <div className="flex justify-between text-[11px] text-gray-400">
              <span>Брошено:</span>
              <span className="font-bold text-red-400">{dropped}</span>
            </div>
          </div>
        </div>

        {/* Genres */}
        <div className="bg-[#1a1a1e] border border-[#222226] rounded-xl p-5 flex flex-col min-h-[160px]">
          <span className="text-gray-500 text-[10px] font-bold uppercase tracking-wider block mb-4">
            Любимые жанры
          </span>
          <div className="flex flex-col gap-3 flex-1 justify-center">
            {profile.topGenres.length === 0 ? (
              <div className="text-xs text-gray-500 text-center py-4">
                Оцени тайтлы на 8+ для расчёта жанров
              </div>
            ) : (
              profile.topGenres.map((g) => (
                <div key={g.genre} className="text-xs">
                  <div className="flex justify-between mb-1">
                    <span className="font-bold text-gray-300">{g.genre}</span>
                    <span className="text-gray-500 text-[10px]">
                      {g.count} тайтл.
                    </span>
                  </div>
                  <div className="w-full bg-[#121214] h-1.5 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded transition-all"
                      style={{
                        width: `${(g.count / maxGenreCount) * 100}%`,
                        backgroundColor: profile.primary_color
                      }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Friends */}
        <div className="bg-[#1a1a1e] border border-[#222226] rounded-xl p-5 flex flex-col min-h-[160px]">
          <span className="text-gray-500 text-[10px] font-bold uppercase tracking-wider block mb-3">
            Друзья ({profile.friends_count})
          </span>
          <div className="flex flex-col gap-2 flex-1 justify-center">
            {friends.length === 0 ? (
              <div className="text-xs text-gray-500 text-center py-4">
                Друзей пока нет
              </div>
            ) : (
              friends.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center justify-between p-2 bg-[#121214] rounded-lg border border-[#222226]"
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0 overflow-hidden">
                      {f.avatar_url ? (
                        <Image src={f.avatar_url} alt={f.username} fill unoptimized sizes="32px" className="object-cover" />
                      ) : (
                        f.username.charAt(0).toUpperCase()
                      )}
                    </div>
                    <span className="font-semibold text-gray-300 text-xs truncate">
                      {f.username}
                    </span>
                  </div>
                  <button
                    onClick={() => handleRemoveFriend(f.id)}
                    className="text-[10px] text-red-400 hover:text-red-300 transition-colors px-2 py-1"
                    title="Удалить из друзей"
                  >
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Rare Anime */}
      <div className="bg-[#1a1a1e] border border-[#222226] rounded-xl p-5">
        <span className="text-gray-500 text-[10px] font-bold uppercase tracking-wider block mb-1">
          Редкие находки <i className="fa-solid fa-gem text-amber-400 ml-1"></i>
        </span>
        <p className="text-[10px] text-gray-600 mb-3">
          Тайтлы, которые посмотрели меньше 5% активных пользователей
        </p>
        <div className="flex flex-col gap-2">
          {profile.rareAnime.length === 0 ? (
            <div className="text-xs text-gray-500 text-center py-4">
              Пока нет просмотренных аниме
            </div>
          ) : (
            profile.rareAnime.map((r) => (
              <div
                key={r.id}
                onClick={() => router.push(`/anime/${r.id}`)}
                className="flex items-center justify-between p-3 bg-[#121214] hover:bg-[#222226] rounded-lg border border-[#222226] cursor-pointer transition-all hover:scale-[1.01]"
              >
                <div className="flex items-center gap-3 overflow-hidden mr-2">
                  <div className="w-10 h-14 rounded overflow-hidden bg-[#121214] relative shrink-0">
                    <Image
                      src={r.image_url}
                      alt={r.title}
                      fill
                      unoptimized
                      sizes="40px"
                      className="object-cover rounded"
                    />
                  </div>
                  <span className="font-semibold text-gray-300 text-sm truncate">
                    {r.title}
                  </span>
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

      {/* My Collections */}
      <div className="bg-[#1a1a1e] border border-[#222226] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <span className="text-gray-500 text-[10px] font-bold uppercase tracking-wider">
            Мои коллекции <i className="fa-solid fa-folder text-amber-400 ml-1"></i>
          </span>
          <button onClick={() => router.push("/profile/collections")}
            className="text-[10px] font-bold text-sky-400 hover:text-sky-300 transition-colors flex items-center gap-1">
            Все коллекции <i className="fa-solid fa-arrow-right-long text-[9px]"></i>
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {collections.length === 0 ? (
            <div className="text-xs text-gray-500 text-center py-4">
              Пока нет коллекций — создайте первую на странице аниме
            </div>
          ) : (
            collections.map((c) => (
              <div key={c.id} className="flex items-center justify-between p-3 bg-[#121214] rounded-lg border border-[#222226]">
                <div className="flex items-center gap-3 overflow-hidden mr-2">
                  <i className={`fa-solid fa-folder-open ${c.is_public ? "text-amber-400/80" : "text-gray-600"}`}></i>
                  <div className="min-w-0">
                    <span className="font-semibold text-gray-300 text-xs block truncate">{c.name}</span>
                    {c.description && <span className="text-[10px] text-gray-600 truncate block">{c.description}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-gray-500">{c.count} тайтл.</span>
                  {!c.is_public && <i className="fa-solid fa-lock text-gray-600 text-[10px]"></i>}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Friend Requests */}
      {friendRequests.length > 0 && (
        <div className="bg-[#1a1a1e] border border-[#222226] rounded-xl p-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-2">
            <i className="fa-solid fa-user-plus text-sky-400"></i>
            Заявки в друзья ({friendRequests.length})
          </h3>
          <div className="flex flex-col gap-3">
            {friendRequests.map((req) => (
              <div key={req.request_id} className="flex items-center justify-between p-3 bg-[#121214] rounded-lg border border-[#222226]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center text-white text-sm font-bold overflow-hidden">
                    {req.avatar_url ? (
                      <Image src={req.avatar_url} alt={req.username} fill unoptimized sizes="40px" className="object-cover" />
                    ) : (
                      req.username.charAt(0).toUpperCase()
                    )}
                  </div>
                  <span className="font-bold text-white text-sm">{req.username}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAcceptRequest(req.request_id, req.user_id)}
                    className="px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 transition-all text-xs font-bold"
                  >
                    Принять
                  </button>
                  <button
                    onClick={() => handleRejectRequest(req.request_id)}
                    className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all text-xs font-bold"
                  >
                    Отклонить
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-2">
            <i className="fa-solid fa-users text-sky-400"></i>
            Возможные друзья
          </h3>
          <div className="flex flex-col gap-3">
            {recommendations.map((rec) => (
              <div key={rec.id} className="flex items-center justify-between p-4 bg-[#1a1a1e] border border-[#222226] rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center text-white text-lg font-bold shrink-0 overflow-hidden">
                    {rec.avatar_url ? (
                      <Image src={rec.avatar_url} alt={rec.username} fill unoptimized sizes="48px" className="object-cover" />
                    ) : (
                      rec.username.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div>
                    <span className="font-bold text-white text-sm block">{rec.username}</span>
                    <span className="text-[10px] text-gray-500">
                      {rec.shared_anime} общих аниме • {rec.shared_genres} общих жанров
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleAddFriend(rec.id)}
                  className="shrink-0 px-4 py-2 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20 hover:bg-sky-500/20 transition-all text-xs font-bold flex items-center gap-2"
                >
                  <i className="fa-solid fa-user-plus text-[10px]"></i>
                  Добавить
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search users */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-2">
          <i className="fa-solid fa-magnifying-glass text-sky-400"></i>
          Найти пользователя
        </h3>
        <UserSearch currentUserId={userId || ''} onAddFriend={handleAddFriend} />
      </div>

      {/* Favorites */}
      {profile.favorites.length > 0 && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-2">
            <i className="fa-solid fa-star text-amber-400"></i>
            Любимые тайтлы (оценки 9 и 10)
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
            {profile.favorites.map((f) => (
              <AnimeCard
                key={f.id}
                id={f.id}
                title={f.title}
                image_url={f.image_url}
                genres={[]}
                season_info=""
                age_rating=""
                weighted_rating={f.rating}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}