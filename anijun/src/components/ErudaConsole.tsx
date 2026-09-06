"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ADMIN_IDS } from "@/lib/admin";

export default function ErudaConsole() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [erudaLoaded, setErudaLoaded] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !ADMIN_IDS.includes(user.id)) return;
      setIsAdmin(true);
    }
    load();
  }, []);

  function openEruda() {
    if (erudaLoaded) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).eruda?.show();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/eruda";
    script.onload = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).eruda?.init();
      setErudaLoaded(true);
    };
    document.head.appendChild(script);
  }

  if (!isAdmin) return null;

  return (
    <button
      onClick={openEruda}
      title="Открыть Eruda консоль"
      className="fixed bottom-4 right-4 z-50 w-10 h-10 rounded-full bg-sky-500 hover:bg-sky-600 text-white font-bold text-sm shadow-lg shadow-sky-500/30 flex items-center justify-center transition-all hover:scale-110"
    >
      {">_"}
    </button>
  );
}
