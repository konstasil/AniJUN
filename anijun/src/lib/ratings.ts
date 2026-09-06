import type { SupabaseClient } from "@supabase/supabase-js";

// ==========================================
// AniJUN — Единый расчёт взвешенного рейтинга
// Формула: Рейтинг = Средняя × (Оценившие / Зрители)^0.5 × e^(−0.000005 × Молчащие)
// Зрители = уникальные пользователи из user_anime_list (completed/watching) + ratings
// ==========================================

export const K = 0.5;
export const LAMBDA = 0.000005;

export type WeightedRating = number | "-";

export interface AnimeRatingRow {
  anime_id: number;
  rating: number;
}

export function calcWeightedRating(ratings: number[], viewersCount: number): WeightedRating {
  if (ratings.length === 0 || viewersCount === 0) return "-";
  const avg = ratings.reduce((s, r) => s + r, 0) / ratings.length;
  const fillRatio = ratings.length / viewersCount;
  const silentUsers = viewersCount - ratings.length;
  const finalRating = avg * Math.pow(fillRatio, K) * Math.exp(-LAMBDA * silentUsers);
  return parseFloat(finalRating.toFixed(2));
}

function addViewer(viewersByAnime: Map<number, Set<string>>, animeId: number, userId: string) {
  const set = viewersByAnime.get(animeId) || new Set<string>();
  set.add(userId);
  viewersByAnime.set(animeId, set);
}

export async function fetchViewersByAnime(
  supabase: SupabaseClient
): Promise<Map<number, Set<string>>> {
  const [listRes, ratingRes] = await Promise.all([
    supabase
      .from("user_anime_list")
      .select("anime_id, user_id")
      .in("status", ["completed", "watching"]),
    supabase.from("ratings").select("anime_id, user_id"),
  ]);

  const viewersByAnime = new Map<number, Set<string>>();
  (listRes.data || []).forEach((v: { anime_id: number; user_id: string }) => {
    addViewer(viewersByAnime, v.anime_id, v.user_id);
  });
  (ratingRes.data || []).forEach((v: { anime_id: number; user_id: string }) => {
    addViewer(viewersByAnime, v.anime_id, v.user_id);
  });
  return viewersByAnime;
}

export async function fetchViewersCount(supabase: SupabaseClient, animeId: number): Promise<number> {
  const [listRes, ratingRes] = await Promise.all([
    supabase
      .from("user_anime_list")
      .select("user_id")
      .eq("anime_id", animeId)
      .in("status", ["completed", "watching"]),
    supabase.from("ratings").select("user_id").eq("anime_id", animeId),
  ]);

  const viewerSet = new Set<string>();
  (listRes.data || []).forEach((v: { user_id: string }) => viewerSet.add(v.user_id));
  (ratingRes.data || []).forEach((v: { user_id: string }) => viewerSet.add(v.user_id));
  return viewerSet.size;
}

export function enrichWithWeightedRating<T extends { id: number }>(
  animeList: T[],
  ratings: AnimeRatingRow[] | null | undefined,
  viewersByAnime: Map<number, Set<string>>
): (T & { weighted_rating: WeightedRating })[] {
  return animeList.map((a) => {
    const animeRatings = (ratings || []).filter((r) => r.anime_id === a.id);
    const viewersCount = viewersByAnime.get(a.id)?.size || 0;
    return {
      ...a,
      weighted_rating: calcWeightedRating(animeRatings.map((r) => r.rating), viewersCount),
    };
  });
}