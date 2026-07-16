"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";

export default function Header() {
  const [user, setUser] = useState<User | null>(null);
  const [username, setUsername] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [animeDropdown, setAnimeDropdown] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", user.id)
          .single();
        if (data) setUsername(data.username);
      }
    }
    load();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          const { data } = await supabase
            .from("profiles")
            .select("username")
            .eq("id", session.user.id)
            .single();
          if (data) setUsername(data.username);
        } else {
          setUsername("");
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [supabase]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    setMenuOpen(false);
    router.push("/login");
  }

  async function handleRandomAnime() {
    const { data: animeList } = await supabase
      .from("anime")
      .select("id")
      .order("id");
    if (!animeList || animeList.length === 0) return;
    const rnd = animeList[Math.floor(Math.random() * animeList.length)];
    router.push(`/anime/${rnd.id}`);
  }

  async function handleAddAnime() {
    const title = prompt("Название аниме:");
    if (!title) return;
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return;

    const { data: anime } = await supabase
      .from("anime")
      .insert({
        title,
        image_url:
          "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400&q=80",
        genres: ["Аниме"],
        season_info: "Зима 2025",
        age_rating: "16+",
      })
      .select()
      .single();

    if (anime) {
      await supabase.from("anime_seasons").insert({
        anime_id: anime.id,
        season_number: 1,
        episodes_count: 12,
      });
      await supabase.from("user_anime_list").insert({
        user_id: authUser.id,
        anime_id: anime.id,
        status: "planned",
      });
      router.push(`/anime/${anime.id}`);
    }
  }

  const isAnimeSection = pathname.startsWith("/catalog") || pathname.startsWith("/anime");

  return (
    <header className="border-b border-[#222226] bg-[#1a1a1e] px-8 py-4 flex flex-col md:flex-row gap-6 justify-between items-center sticky top-0 z-40">
      <Link href="/" className="flex items-center gap-2 cursor-pointer group">
        <i className="fa-solid fa-play text-sky-400 text-lg group-hover:scale-110 transition-transform"></i>
        <span className="text-lg font-bold tracking-wider text-white">
          AniJUN
        </span>
      </Link>

      <nav className="flex items-center gap-8 text-xs font-bold uppercase tracking-widest text-gray-400">
        <Link
          href="/"
          className={`nav-tab flex items-center gap-1.5 py-1 transition-colors hover:text-white ${
            pathname === "/" ? "active" : ""
          }`}
        >
          <i className="fa-solid fa-home"></i> Главная
        </Link>

        <div
          className="relative"
          onMouseEnter={() => setAnimeDropdown(true)}
          onMouseLeave={() => setAnimeDropdown(false)}
        >
          <Link
            href="/catalog"
            className={`nav-tab flex items-center gap-1.5 py-1 transition-colors hover:text-white ${
              isAnimeSection ? "active" : ""
            }`}
          >
            <i className="fa-solid fa-list"></i> Аниме
            <i className="fa-solid fa-chevron-down text-[9px] transition-transform group-hover:rotate-180"></i>
          </Link>
          {animeDropdown && (
            <div className="absolute top-[100%] left-1/2 -translate-x-1/2 pt-2 z-50">
              <div className="bg-[#1a1a1e] border border-[#222226] rounded-lg shadow-2xl py-1.5 w-36 overflow-hidden">
                <Link href="/catalog" className="w-full text-left px-4 py-2 hover:bg-[#222226] hover:text-white transition-colors text-xs text-gray-400 font-semibold flex items-center gap-2">
                  <i className="fa-solid fa-folder-open text-[10px]"></i> Каталог
                </Link>
                <Link href="/catalog?tab=ongoing" className="w-full text-left px-4 py-2 hover:bg-[#222226] hover:text-white transition-colors text-xs text-gray-400 font-semibold flex items-center gap-2">
                  <i className="fa-solid fa-clock text-[10px]"></i> Онгоинги
                </Link>
                <Link href="/catalog?tab=announcements" className="w-full text-left px-4 py-2 hover:bg-[#222226] hover:text-white transition-colors text-xs text-gray-400 font-semibold flex items-center gap-2">
                  <i className="fa-solid fa-bullhorn text-[10px]"></i> Анонсы
                </Link>
              </div>
            </div>
          )}
        </div>

        <Link
          href="/top"
          className={`nav-tab flex items-center gap-1.5 py-1 transition-colors hover:text-white ${
            pathname === "/top" ? "active" : ""
          }`}
        >
          <i className="fa-solid fa-chart-simple"></i> Топ-100
        </Link>

        <button
          onClick={handleRandomAnime}
          className="nav-tab flex items-center gap-1.5 transition-colors hover:text-white"
        >
          <i className="fa-solid fa-shuffle"></i> Случайное
        </button>
      </nav>

      <div className="flex items-center gap-3">
        {user && (
          <button
            onClick={handleAddAnime}
            className="bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 text-xs font-bold px-3 py-2 rounded-lg border border-sky-500/20 transition-all flex items-center gap-1.5"
          >
            <i className="fa-solid fa-plus text-[10px]"></i> Добавить
          </button>
        )}

        {user ? (
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-2 bg-[#121214] hover:bg-[#222226] px-3 py-2 rounded-lg border border-[#222226] transition-all group"
            >
              <i className="fa-solid fa-circle-user text-sky-400 text-sm group-hover:scale-110 transition-transform"></i>
              <span className="text-xs font-bold text-gray-200">
                {username || "Профиль"}
              </span>
            </button>
            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setMenuOpen(false)}
                />
                <div className="absolute right-0 top-full mt-2 bg-[#1a1a1e] border border-[#222226] rounded-lg shadow-2xl py-1.5 w-44 z-50">
                  <Link
                    href="/profile"
                    onClick={() => setMenuOpen(false)}
                    className="w-full text-left px-4 py-2 hover:bg-[#222226] hover:text-white transition-colors text-xs text-gray-400 font-semibold flex items-center gap-2"
                  >
                    <i className="fa-solid fa-user text-[10px]"></i> Профиль
                  </Link>
                  <button
                    onClick={handleSignOut}
                    className="w-full text-left px-4 py-2 hover:bg-[#222226] hover:text-red-400 transition-colors text-xs text-gray-400 font-semibold flex items-center gap-2"
                  >
                    <i className="fa-solid fa-right-from-bracket text-[10px]"></i>{" "}
                    Выйти
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="text-xs font-bold text-gray-300 hover:text-white px-3 py-2 rounded-lg hover:bg-[#222226] transition-all"
            >
              Войти
            </Link>
            <Link
              href="/signup"
              className="bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs px-4 py-2 rounded-lg transition-all flex items-center gap-1.5 shadow-lg shadow-sky-500/10"
            >
              <i className="fa-solid fa-user-plus text-[10px]"></i>{" "}
              Регистрация
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
