"use client";
import { useEffect, useRef, useState } from "react";
import VoiceMessage from "@/components/VoiceMessage";
import { uploadMedia } from "@/lib/storage";

const MAX_SEC = 60;
const MAX_BYTES = 1024 * 1024;

interface Props {
  onChange: (v: { url: string; duration: number; peaks: number[] } | null) => void;
}

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function VoiceRecorder({ onChange }: Props) {
  const [recording, setRecording] = useState(false);
  const [time, setTime] = useState(0);
  const [live, setLive] = useState<number[]>([]);
  const [result, setResult] = useState<{ url: string; duration: number; peaks: number[] } | null>(null);
  const [error, setError] = useState("");

  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef(0);
  const lastPushRef = useRef(0);
  const peaksRef = useRef<number[]>([]);
  const doneRef = useRef(false);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (ctxRef.current) ctxRef.current.close().catch(() => {});
    };
  }, []);

  function start() {
    setError("");
    setResult(null);
    onChange(null);
    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "";
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      const chunks: BlobPart[] = [];
      peaksRef.current = [];
      lastPushRef.current = 0;
      doneRef.current = false;

      rec.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      rec.onstop = () => { void upload(chunks); };

      const ctx = new AudioContext();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      src.connect(analyser);
      const buf = new Uint8Array(analyser.fftSize);

      recRef.current = rec;
      streamRef.current = stream;
      ctxRef.current = ctx;
      startRef.current = Date.now();
      setRecording(true);
      setTime(0);
      setLive([]);
      rec.start(200);

      const tick = () => {
        const elapsed = (Date.now() - startRef.current) / 1000;
        setTime(elapsed);
        if (elapsed >= MAX_SEC) { stop(); return; }
        if (Date.now() - lastPushRef.current > 90) {
          lastPushRef.current = Date.now();
          analyser.getByteTimeDomainData(buf);
          let peak = 0;
          for (let i = 0; i < buf.length; i++) peak = Math.max(peak, Math.abs(buf[i] - 128) / 128);
          const v = Math.max(0.08, Math.min(1, peak * 1.6));
          peaksRef.current.push(v);
          if (peaksRef.current.length > 60) peaksRef.current.shift();
          setLive([...peaksRef.current]);
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    }).catch(() => setError("Нет доступа к микрофону"));
  }

  function stop() {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    setRecording(false);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    const dur = (Date.now() - startRef.current) / 1000;
    if (recRef.current && recRef.current.state !== "inactive") recRef.current.stop();
    setTime(dur);
  }

  async function upload(chunks: BlobPart[]) {
    const mime = recRef.current?.mimeType || "audio/webm";
    const ext = mime.includes("ogg") ? "ogg" : mime.includes("mp4") ? "m4a" : "webm";
    const blob = new Blob(chunks, { type: mime });
    const named = new File([blob], `voice.${ext}`, { type: mime });
    let url: string;
    try {
      const res = await uploadMedia(named, "voice");
      url = res.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
      return;
    }
    const dur = (Date.now() - startRef.current) / 1000;
    const peaks = downsample(peaksRef.current, 42);
    const v = { url, duration: dur, peaks };
    setResult(v);
    onChange(v);
  }

  function reset() {
    setResult(null);
    setTime(0);
    setLive([]);
    setError("");
    onChange(null);
  }

  if (result) {
    return (
      <div className="flex-1 min-w-0">
        <VoiceMessage src={result.url} duration={result.duration} peaks={result.peaks} compact />
        <div className="flex items-center gap-2 mt-1.5">
          <button onClick={reset} className="text-[10px] text-gray-500 hover:text-red-400 flex items-center gap-1">
            <i className="fa-solid fa-trash-can text-[9px]"></i> удалить
          </button>
          <span className="text-[10px] text-gray-600">голосовое</span>
        </div>
      </div>
    );
  }

  if (recording) {
    return (
      <div className="flex-1 min-w-0 flex items-center gap-2 px-3 py-2 bg-[#121214] border border-red-500/30 rounded-full">
        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
        <span className="text-[11px] text-gray-300 font-mono tabular-nums shrink-0">{fmt(time)}</span>
        <div className="flex-1 h-6 flex items-center gap-[2px] overflow-hidden">
          {live.slice(-42).map((p, i) => (
            <span key={i} className="w-[3px] rounded-full bg-red-500/70 shrink-0" style={{ height: `${Math.round(p * 100)}%`, minHeight: 3 }} />
          ))}
          {!live.length && <span className="text-[10px] text-gray-600">говорите…</span>}
        </div>
        <button onClick={stop} className="text-[10px] font-bold text-red-400 border border-red-500/30 rounded-full px-2.5 py-1 shrink-0">
          стоп
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 min-w-0 flex items-center gap-2">
      <button onClick={start} title="Голосовое сообщение" className="w-8 h-8 shrink-0 rounded-full bg-[#121214] border border-[#222226] flex items-center justify-center text-gray-400 hover:text-sky-400 transition-colors">
        <i className="fa-solid fa-microphone text-xs"></i>
      </button>
      {error ? <span className="text-[10px] text-red-400">{error}</span> : <span className="text-[10px] text-gray-600">до {MAX_SEC} сек</span>}
    </div>
  );
}

function downsample(arr: number[], count: number) {
  if (arr.length === 0) return [];
  if (arr.length <= count) return arr;
  const out: number[] = [];
  const step = arr.length / count;
  for (let i = 0; i < count; i++) {
    const start = Math.floor(i * step);
    const end = Math.max(start + 1, Math.floor((i + 1) * step));
    let peak = 0;
    for (let j = start; j < end && j < arr.length; j++) peak = Math.max(peak, arr[j]);
    out.push(peak);
  }
  const max = Math.max(...out, 0.01);
  return out.map((v) => Math.min(1, v / max));
}
