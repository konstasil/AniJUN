"use client";

export interface SeasonDraft {
  id?: number;
  number: number;
  episodes: number;
  note?: string;
  age_rating?: string;
  aired_episodes?: number | null;
}

interface SeasonEditorProps {
  seasons: SeasonDraft[];
  onChange: (seasons: SeasonDraft[]) => void;
  showAired?: boolean;
}

export default function SeasonEditor({ seasons, onChange, showAired = true }: SeasonEditorProps) {
  function update(i: number, patch: Partial<SeasonDraft>) {
    const copy = [...seasons];
    const nextEpisodes = patch.episodes !== undefined ? Math.max(1, Math.floor(patch.episodes)) : copy[i].episodes;
    const nextAired = patch.aired_episodes !== undefined ? patch.aired_episodes : copy[i].aired_episodes;
    const clampedAired = nextAired != null ? Math.max(0, Math.min(nextEpisodes, Math.floor(nextAired))) : nextAired;
    copy[i] = { ...copy[i], ...patch, episodes: nextEpisodes, aired_episodes: clampedAired };
    if (patch.episodes !== undefined && copy[i].aired_episodes != null && copy[i].aired_episodes! > nextEpisodes) {
      copy[i].aired_episodes = nextEpisodes;
    }
    onChange(copy);
  }

  function add() {
    onChange([...seasons, { number: seasons.length + 1, episodes: 12, note: "" }]);
  }

  function remove(i: number) {
    onChange(seasons.filter((_, j) => j !== i));
  }

  function move(i: number, dir: number) {
    const j = i + dir;
    if (j < 0 || j >= seasons.length) return;
    const copy = [...seasons];
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
    onChange(copy);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Сезоны</label>
        <button type="button" onClick={add}
          className="text-[10px] font-bold text-sky-400 hover:text-sky-300 transition-colors">
          + Добавить сезон
        </button>
      </div>
      {seasons.length === 0 ? (
        <p className="text-[10px] text-gray-500">Сезоны не указаны — при одобрении будет создан сезон 1 × 12 серий.</p>
      ) : (
        <div className="space-y-2">
          {seasons.map((s, i) => (
            <div key={s.id ?? i} className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <span className="text-xs text-gray-400 w-16 shrink-0">Сезон {i + 1}:</span>
              <input type="number" min={1} value={s.episodes}
                onChange={(e) => update(i, { episodes: Math.max(1, Number(e.target.value) || 1) })}
                className="w-16 shrink-0 bg-[#121214] border border-[#222226] rounded px-2 py-1 text-xs text-white outline-none focus:border-sky-500/50" />
              <span className="text-[10px] text-gray-500 shrink-0">всего</span>
              {showAired && (
                <>
                  <input type="number" min={0} max={s.episodes} value={s.aired_episodes ?? s.episodes}
                    onChange={(e) => update(i, { aired_episodes: Math.max(0, Math.min(s.episodes, Number(e.target.value) || 0)) })}
                    className="w-16 shrink-0 bg-[#121214] border border-[#222226] rounded px-2 py-1 text-xs text-white outline-none focus:border-sky-500/50" />
                  <span className="text-[10px] text-gray-500 shrink-0">вышло</span>
                </>
              )}
              <input value={s.note || ""} placeholder="Название (опционально)"
                onChange={(e) => update(i, { note: e.target.value })}
                className="basis-full sm:basis-auto sm:flex-1 min-w-0 bg-[#121214] border border-[#222226] rounded px-2 py-1 text-xs text-white outline-none focus:border-sky-500/50 order-5 sm:order-none" />
              <select value={s.age_rating || ""} onChange={(e) => update(i, { age_rating: e.target.value })}
                className="w-full sm:w-24 shrink-0 bg-[#121214] border border-[#222226] rounded px-2 py-1.5 sm:py-1 text-xs text-white outline-none focus:border-sky-500/50 order-6 sm:order-none">
                <option value="">Без рейтинга</option>
                <option value="0+">0+</option>
                <option value="6+">6+</option>
                <option value="12+">12+</option>
                <option value="16+">16+</option>
                <option value="18+">18+</option>
                <option value="21+">21+</option>
              </select>
              <div className="flex items-center gap-1 ml-auto sm:ml-0">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} title="Вверх"
                  className="text-[10px] text-gray-500 hover:text-white disabled:opacity-30 px-1">
                  <i className="fa-solid fa-chevron-up"></i>
                </button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === seasons.length - 1} title="Вниз"
                  className="text-[10px] text-gray-500 hover:text-white disabled:opacity-30 px-1">
                  <i className="fa-solid fa-chevron-down"></i>
                </button>
                <button type="button" onClick={() => remove(i)} title="Удалить сезон"
                  className="text-[10px] text-red-400 hover:text-red-300 transition-all px-1.5 py-1">
                  <i className="fa-solid fa-trash-can"></i>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
