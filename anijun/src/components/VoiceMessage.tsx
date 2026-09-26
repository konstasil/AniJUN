"use client";
import { useEffect, useMemo, useRef, useState } from "react";

function fmt(sec: number) {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function fallbackPeaks(seed: string, count = 42) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 100000;
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    h = (h * 1103515245 + 12345) % 2147483648;
    out.push(0.25 + (h % 1000) / 1000 * 0.7);
  }
  return out;
}

interface Props {
  src: string;
  duration?: number | null;
  peaks?: number[] | null;
  accent?: string;
  compact?: boolean;
}

export default function VoiceMessage({ src, duration, peaks, accent = "bg-sky-500", compact = false }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [total, setTotal] = useState<number>(duration && duration > 0 ? duration : 0);
  const [rate, setRate] = useState(1);
  const [ready, setReady] = useState(false);

  const bars = useMemo(() => {
    const src_peaks = peaks && Array.isArray(peaks) && peaks.length > 0 ? peaks : fallbackPeaks(src);
    return src_peaks.map((p) => Math.max(0.12, Math.min(1, p)));
  }, [peaks, src]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onMeta = () => {
      if (isFinite(el.duration) && el.duration > 0) setTotal(el.duration);
      setReady(true);
    };
    const onTime = () => setCurrent(el.currentTime);
    const onEnd = () => { setPlaying(false); setCurrent(0); el.currentTime = 0; };
    el.addEventListener("loadedmetadata", onMeta);
    el.addEventListener("durationchange", onMeta);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("ended", onEnd);
    return () => {
      el.removeEventListener("loadedmetadata", onMeta);
      el.removeEventListener("durationchange", onMeta);
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("ended", onEnd);
    };
  }, [src]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = rate;
  }, [rate]);

  function toggle() {
    const el = audioRef.current;
    if (!el) return;
    if (playing) { el.pause(); setPlaying(false); }
    else { el.play().then(() => setPlaying(true)).catch(() => setPlaying(false)); }
  }

  function seek(e: React.MouseEvent<HTMLDivElement>) {
    const el = audioRef.current;
    if (!el) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const dur = total || (isFinite(el.duration) ? el.duration : 0);
    if (dur > 0) {
      el.currentTime = ratio * dur;
      setCurrent(el.currentTime);
    }
  }

  const progress = total > 0 ? Math.max(0, Math.min(1, current / total)) : 0;

  return (
    <div className={`flex items-center gap-3 bg-[#121214] border border-[#222226] rounded-full ${compact ? "px-2.5 py-2" : "px-3 py-2.5"}`}>
      <audio ref={audioRef} src={src} preload="metadata" />
      <button
        onClick={toggle}
        className={`${compact ? "w-8 h-8" : "w-10 h-10"} shrink-0 rounded-full ${accent} text-white flex items-center justify-center hover:opacity-90 transition-opacity`}
        aria-label={playing ? "Пауза" : "Слушать"}
      >
        <i className={`fa-solid ${playing ? "fa-pause" : "fa-play"} text-[10px] ${playing ? "" : "ml-0.5"}`}></i>
      </button>

      <div className="flex-1 min-w-0 flex items-center gap-2">
        <div
          onClick={seek}
          className="flex-1 h-8 flex items-center gap-[2px] cursor-pointer select-none"
          role="slider"
          aria-label="Перемотка"
        >
          {bars.map((p, i) => {
            const played = i / bars.length <= progress;
            return (
              <span
                key={i}
                className={`flex-1 rounded-full transition-colors ${played ? accent : "bg-[#3a3a42]"}`}
                style={{ height: `${Math.round(p * 100)}%`, minWidth: 2 }}
              />
            );
          })}
        </div>

        <span className="text-[10px] text-gray-400 font-mono tabular-nums shrink-0">
          {fmt(current)} / {fmt(total)}
        </span>

        <button
          onClick={() => setRate((r) => (r === 1 ? 1.5 : r === 1.5 ? 2 : 1))}
          className="text-[10px] font-bold text-gray-400 hover:text-white border border-[#222226] rounded-full px-2 py-0.5 shrink-0 tabular-nums"
          title="Скорость"
        >
          {rate}×
        </button>
      </div>
    </div>
  );
}
