// ==========================================
// AniJUN — Рекомендательный движок
// Версия 1: жанровый профиль + взвешенный рейтинг
// Версия 2: коллаборативная фильтрация (при >200 пользователей)
// ==========================================

export interface AnimeItem {
  id: number;
  title: string;
  genres: string[];
  weighted_rating: number; // взвешенный рейтинг AniJUN
  popularity: number; // количество зрителей
}

export interface UserWatched {
  [animeId: number]: number; // anime_id -> оценка пользователя (1-10)
}

export interface UserRating {
  user_id: string;
  anime_id: number;
  rating: number;
}

export interface RecommendationResult {
  anime: AnimeItem;
  score: number;
  reasons: string[];
}

// ==========================================
// ВЕРСИЯ 1: Жанровый профиль пользователя
// ==========================================

/**
 * Создаёт профиль вкуса пользователя на основе его оценок.
 * Чем выше оценка — тем сильнее влияние жанра.
 * Оценки ниже 5 уменьшают вес жанра (нелюбимые жанры).
 */
export function createUserProfile(
  watched: UserWatched,
  animeList: AnimeItem[]
): Record<string, number> {
  const genres: Record<string, number> = {};

  for (const animeIdStr in watched) {
    const animeId = Number(animeIdStr);
    const score = watched[animeId];
    const anime = animeList.find((a) => a.id === animeId);
    if (!anime) continue;

    // Сила оценки: 5 — нейтрально, выше 5 — плюс, ниже 5 — минус
    let weight = score - 5;
    if (weight < 0) weight *= 0.5; // нелюбимые жанры штрафуем слабее

    anime.genres.forEach((genre) => {
      if (!genres[genre]) genres[genre] = 0;
      genres[genre] += weight;
    });
  }

  return genres;
}

/**
 * Считает насколько аниме соответствует профилю пользователя.
 */
export function calculateMatch(
  anime: AnimeItem,
  profile: Record<string, number>
): number {
  let score = 0;

  anime.genres.forEach((genre) => {
    if (profile[genre]) {
      score += profile[genre];
    }
  });

  return score;
}

/**
 * Проверяет, просмотрел ли пользователь аниме.
 */
export function isWatched(
  anime: AnimeItem,
  watched: UserWatched
): boolean {
  return watched[anime.id] !== undefined;
}

/**
 * Генерирует рекомендации на основе жанрового профиля (Версия 1).
 */
export function getRecommendationsV1(
  watched: UserWatched,
  animeList: AnimeItem[],
  topN: number = 20
): RecommendationResult[] {
  const profile = createUserProfile(watched, animeList);
  const recommendations: RecommendationResult[] = [];

  for (const anime of animeList) {
    if (isWatched(anime, watched)) continue;

    let score = calculateMatch(anime, profile);

    // Добавляем взвешенный рейтинг AniJUN
    score += anime.weighted_rating * 2;

    // Добавляем популярность
    score += anime.popularity * 0.05;

    const reasons: string[] = [];
    if (calculateMatch(anime, profile) > 0) {
      const matchedGenres = anime.genres.filter((g) => profile[g] && profile[g] > 0);
      if (matchedGenres.length > 0) {
        reasons.push(`Совпадают жанры: ${matchedGenres.join(", ")}`);
      }
    }
    if (anime.weighted_rating > 7) {
      reasons.push(`Высокий рейтинг: ${anime.weighted_rating.toFixed(2)}`);
    }

    recommendations.push({ anime, score, reasons });
  }

  return recommendations
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
}

// ==========================================
// ВЕРСИЯ 2: Коллаборативная фильтрация
// ==========================================

/**
 * Считает косинусное сходство между двумя пользователями
 * на основе их оценок аниме.
 */
function cosineSimilarity(
  userARatings: Map<number, number>,
  userBRatings: Map<number, number>
): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (const [animeId, ratingA] of userARatings) {
    const ratingB = userBRatings.get(animeId);
    if (ratingB !== undefined) {
      dotProduct += ratingA * ratingB;
    }
    normA += ratingA * ratingA;
  }

  for (const [, ratingB] of userBRatings) {
    normB += ratingB * ratingB;
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Находит пользователей, похожих на целевого пользователя.
 */
function findSimilarUsers(
  targetUserId: string,
  allRatings: UserRating[],
  threshold: number = 0.3
): { userId: string; similarity: number; ratings: Map<number, number> }[] {
  // Группируем оценки по пользователям
  const userRatingsMap = new Map<string, Map<number, number>>();
  for (const r of allRatings) {
    if (!userRatingsMap.has(r.user_id)) {
      userRatingsMap.set(r.user_id, new Map());
    }
    userRatingsMap.get(r.user_id)!.set(r.anime_id, r.rating);
  }

  const targetRatings = userRatingsMap.get(targetUserId);
  if (!targetRatings || targetRatings.size === 0) return [];

  const similar: { userId: string; similarity: number; ratings: Map<number, number> }[] = [];

  for (const [userId, ratings] of userRatingsMap) {
    if (userId === targetUserId) continue;
    const sim = cosineSimilarity(targetRatings, ratings);
    if (sim >= threshold) {
      similar.push({ userId, similarity: sim, ratings });
    }
  }

  return similar.sort((a, b) => b.similarity - a.similarity);
}

/**
 * Генерирует рекомендации на основе коллаборативной фильтрации (Версия 2).
 * Работает только если в системе > 200 пользователей с оценками.
 */
export function getRecommendationsV2(
  userId: string,
  watched: UserWatched,
  allRatings: UserRating[],
  animeList: AnimeItem[],
  topN: number = 20
): RecommendationResult[] {
  const uniqueUsers = new Set(allRatings.map((r) => r.user_id));
  if (uniqueUsers.size <= 200) {
    return []; // Недостаточно пользователей, возвращаем пустой массив
  }

  const similarUsers = findSimilarUsers(userId, allRatings);

  if (similarUsers.length === 0) return [];

  // Собираем рекомендации от похожих пользователей
  const scoreMap = new Map<number, { totalScore: number; totalSim: number; reasons: Set<string> }>();

  for (const similar of similarUsers) {
    for (const [animeId, rating] of similar.ratings) {
      // Пропускаем уже просмотренное
      if (watched[animeId] !== undefined) continue;

      if (!scoreMap.has(animeId)) {
        scoreMap.set(animeId, { totalScore: 0, totalSim: 0, reasons: new Set() });
      }
      const entry = scoreMap.get(animeId)!;
      entry.totalScore += rating * similar.similarity;
      entry.totalSim += similar.similarity;
      entry.reasons.add(`Похожий пользователь оценил в ${rating}`);
    }
  }

  const recommendations: RecommendationResult[] = [];

  for (const [animeId, { totalScore, totalSim, reasons }] of scoreMap) {
    const anime = animeList.find((a) => a.id === animeId);
    if (!anime) continue;

    const avgScore = totalSim > 0 ? totalScore / totalSim : 0;
    // Финальный счёт: коллаборативный + рейтинг + популярность
    let finalScore = avgScore * 3;
    finalScore += anime.weighted_rating * 2;
    finalScore += anime.popularity * 0.05;

    recommendations.push({
      anime,
      score: finalScore,
      reasons: Array.from(reasons).slice(0, 2),
    });
  }

  return recommendations
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
}

// ==========================================
// ОБЩАЯ ФУНКЦИЯ: выбирает версию автоматически
// ==========================================

/**
 * Главная функция рекомендаций.
 * Объединяет Версию 1 (жанровый профиль) и Версию 2 (коллаборативную фильтрацию).
 * Если пользователей > 200 — добавляет V2 поверх V1, без дубликатов.
 * Если пользователей <= 200 — работает только V1.
 * Если пользователь не авторизован — по рейтингу.
 */
export function getRecommendations(
  userId: string | null,
  watched: UserWatched,
  allRatings: UserRating[],
  animeList: AnimeItem[],
  topN: number = 20
): RecommendationResult[] {
  // Если пользователь не авторизован или нет оценок — возвращаем по рейтингу
  if (!userId || Object.keys(watched).length === 0) {
    return animeList
      .filter((a) => a.weighted_rating > 0)
      .sort((a, b) => b.weighted_rating - a.weighted_rating)
      .slice(0, topN)
      .map((anime) => ({
        anime,
        score: anime.weighted_rating * 2 + anime.popularity * 0.05,
        reasons: [`Рейтинг: ${anime.weighted_rating.toFixed(2)}`],
      }));
  }

  // Всегда получаем V1 (жанровый профиль) — база
  const v1Recs = getRecommendationsV1(watched, animeList, topN * 2);
  const seenIds = new Set<number>();
  const merged: RecommendationResult[] = [];

  // Пробуем V2 (коллаборативная) — только если >200 пользователей
  const v2Recs = getRecommendationsV2(userId, watched, allRatings, animeList, topN * 2);

  // Сначала добавляем V2 (они приоритетнее)
  for (const rec of v2Recs) {
    if (!seenIds.has(rec.anime.id)) {
      seenIds.add(rec.anime.id);
      // Добавляем жанровые причины поверх коллаборативных
      const v1Match = v1Recs.find((v) => v.anime.id === rec.anime.id);
      if (v1Match) {
        rec.reasons = [...new Set([...rec.reasons, ...v1Match.reasons])];
        // Берём максимум из скора V1 и V2
        rec.score = Math.max(rec.score, v1Match.score);
      }
      merged.push(rec);
    }
  }

  // Потом добавляем V1 (для тех, кого нет в V2)
  for (const rec of v1Recs) {
    if (!seenIds.has(rec.anime.id)) {
      seenIds.add(rec.anime.id);
      merged.push(rec);
    }
  }

  // Сортируем по score и берём topN
  return merged.sort((a, b) => b.score - a.score).slice(0, topN);
}
