"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

const ADMIN_IDS = [
  "8fa96992-b063-4019-83a6-3acac8cc712f",
  "cc91e0bb-a24b-41ab-ba41-3bd352ed9add",
];

export default function ErudaConsole() {
  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !ADMIN_IDS.includes(user.id)) return;

      // Загружаем eruda только если пользователь админ
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/eruda";
      script.onload = () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).eruda?.init();
      };
      document.head.appendChild(script);
    }
    load();
  }, []);

  return null;
}