"use client";

export interface SeasonDraft {
  id?: number;
  number: number;
  episodes: number;
  note?: string;
}

interface SeasonEditorProps {
  seasons: SeasonDraft[];
  onChange: (seasons: SeasonDraft[]) => void;
}

export default function SeasonEditor({ seasons, onChange }: SeasonEditorProps) {
  function update(i: number, patch: Partial<SeasonDraft>) {
    const copy = [...seasons];
    copy[i] = { ...copy[i], ...patch };
    onChange(copy);
  }

  function add() {
    onChange([...seasons, { number: seasons.length + 1, episodes: 12, note: "" }]);
  }

  function remove(i: number) {
    onChange(seasons.filter((_, j) => j !== i));
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
            <div key={s.id ?? i} className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-400 w-16 shrink-0">Сезон {i + 1}:</span>
              <input type="number" min={1} value={s.episodes}
                onChange={(e) => update(i, { episodes: Number(e.target.value) })}
                className="w-20 bg-[#121214] border border-[#222226] rounded px-2 py-1 text-xs text-white outline-none focus:border-sky-500/50" />
              <span className="text-[10px] text-gray-500">серий</span>
              <input value={s.note || ""} placeholder="Название (опционально)"
                onChange={(e) => update(i, { note: e.target.value })}
                className="flex-1 min-w-[120px] bg-[#121214] border border-[#222226] rounded px-2 py-1 text-xs text-white outline-none focus:border-sky-500/50" />
              <button type="button" onClick={() => remove(i)} title="Удалить сезон"
                className="text-[10px] text-red-400 hover:text-red-300 transition-all px-1.5 py-1">
                <i className="fa-solid fa-trash-can"></i>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
