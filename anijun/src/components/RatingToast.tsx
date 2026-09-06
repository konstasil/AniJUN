"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";

export interface ToastData {
  animeTitle: string;
  animeImage: string;
  message: string;
  type: "rating_shift" | "top100";
  shiftAmount?: number;
}

export default function RatingToast({ toast, onDone }: { toast: ToastData | null; onDone: () => void }) {
  const [visible, setVisible] = useState(false);
  const [show, setShow] = useState(false);

  // onDone пересоздаётся родителем каждый рендер — держим актуальную версию в ref,
  // чтобы не перезапускать таймеры тоста из-за зависимости.
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  });

  useEffect(() => {
    if (!toast) {
      const t = setTimeout(() => {
        setVisible(false);
        setShow(false);
      }, 0);
      return () => clearTimeout(t);
    }

    requestAnimationFrame(() => {
      setVisible(true);
      setShow(true);
    });

    const hideTimer = setTimeout(() => {
      setShow(false);
      setTimeout(() => {
        setVisible(false);
        onDoneRef.current();
      }, 300);
    }, 3500);

    return () => clearTimeout(hideTimer);
  }, [toast]);

  if (!visible) return null;

  const shiftText = toast?.type === "rating_shift" && toast.shiftAmount !== undefined
    ? `Ваша оценка сдвинула рейтинг этого аниме на ${Math.abs(toast.shiftAmount).toFixed(2)} пункта.`
    : null;

  return (
    <div
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ease-out ${
        show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      }`}
    >
      <div className="bg-[#1a1a1e] border border-[#222226] rounded-xl p-3 pr-5 shadow-2xl shadow-black/50 flex items-center gap-3 min-w-[320px] max-w-[420px]">
        {/* Картинка тайтла */}
        {toast?.animeImage && (
          <div className="w-12 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-[#121214]">
            <Image
              src={toast.animeImage}
              alt={toast.animeTitle || ""}
              width={48}
              height={64}
              className="object-cover w-full h-full"
            />
          </div>
        )}

        {/* Текст */}
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] font-bold text-white leading-tight">
            {toast?.animeTitle}
          </span>
          <span className="text-[10px] text-gray-400 leading-tight">
            {shiftText || toast?.message}
          </span>
          {toast?.type === "top100" && (
            <span className="text-[10px] text-amber-400 font-semibold leading-tight flex items-center gap-1">
              <i className="fa-solid fa-trophy text-[9px]"></i>
              {toast?.message}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}