"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { useSimulatedUser } from "@/lib/simulation-context";
import { isAdminId } from "@/lib/admin";

export default function Header() {
  const [user, setUser] = useState<User | null>(null);
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [animeDropdown, setAnimeDropdown] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { simulatedProfile, isSimulating } = useSimulatedUser();

  async function checkAdmin(userId: string): Promise<boolean> {
    if (isAdminId(userId)) return true;
    try {
      const { data } = await supabase.rpc("is_admin");
      return !!data;
    } catch { return false; }
  }

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      const authUser = session?.user ?? null;
      setUser(authUser);
      if (authUser) {
        setIsAdmin(await checkAdmin(authUser.id));
        const { data } = await supabase
          .from("profiles")
          .select("username, avatar_url")
          .eq("id", authUser.id)
          .single();
        if (data) {
          setUsername(data.username);
          setAvatarUrl(data.avatar_url || "");
        }
      }
    }
    load();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const authUser = session?.user ?? null;
        setUser(authUser);
        setIsAdmin(authUser ? await checkAdmin(authUser.id) : false);
        if (session?.user) {
          const { data } = await supabase
            .from("profiles")
            .select("username, avatar_url")
            .eq("id", session.user.id)
            .single();
          if (data) {
            setUsername(data.username);
            setAvatarUrl(data.avatar_url || "");
          }
        } else {
          setUsername("");
          setAvatarUrl("");
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
      .select("id, slug")
      .order("id");
    if (!animeList || animeList.length === 0) return;
    const rnd = animeList[Math.floor(Math.random() * animeList.length)];
    const animeUrl = rnd.slug ? `/anime/${rnd.slug}` : `/anime/${rnd.id}`;
    router.push(animeUrl);
  }

  const isAnimeSection = pathname.startsWith("/catalog") || pathname.startsWith("/anime");

function NotifBadge() {
  const [count, setCount] = useState(0);
  const supabase = useMemo(() => createClient(), []);
  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const { count: c } = await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", session.user.id).eq("is_read", false);
      setCount(c || 0);
    }
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [supabase]);
  if (count === 0) return null;
  return <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">{count > 99 ? "99+" : count}</span>;
}

function NotifDropdown({ onClose }: { onClose: () => void }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [items, setItems] = useState<{ id: number; actor_id: string; type: string; target_id: number | null; is_read: boolean; created_at: string; actor?: { username: string } }[]>([]);
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const { data } = await supabase.from("notifications").select("id, actor_id, type, target_id, is_read, created_at").eq("user_id", session.user.id).order("created_at", { ascending: false }).limit(20);
      if (!data) return;
      const aids = [...new Set(data.map((d) => d.actor_id))];
      const { data: profs } = await supabase.from("profiles").select("id, username").in("id", aids);
      const map = new Map<string, string>();
      profs?.forEach((p) => map.set(p.id, p.username));
      setItems(data.map((d) => ({ ...d, actor: { username: map.get(d.actor_id) || "Кто-то" } })));
    })();
  }, [supabase]);
  async function openNotif(n: typeof items[0]) {
    if (!n.is_read) await supabase.from("notifications").update({ is_read: true }).eq("id", n.id);
    onClose();
    router.push(`/profile/${n.actor_id}`);
  }
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute right-0 top-full mt-2 bg-[#1a1a1e] border border-[#222226] rounded-xl shadow-2xl w-80 z-50 overflow-hidden">
        <div className="px-4 py-3 border-b border-[#222226] flex items-center justify-between">
          <span className="text-xs font-bold text-white">Уведомления</span>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><i className="fa-solid fa-xmark text-xs"></i></button>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-xs text-gray-600">Пока ничего нет</p>
          ) : (
            items.map((n) => (
              <button key={n.id} onClick={() => openNotif(n)} className={`w-full text-left px-4 py-3 hover:bg-[#222226] transition-colors border-b border-[#222226]/50 ${!n.is_read ? "bg-sky-500/5" : ""}`}>
                <p className="text-xs text-gray-200"><span className="font-bold text-white">{n.actor?.username}</span> {n.type === "mention" ? "упомянул Вас" : n.type === "reply" ? "ответил Вам" : "опубликовал пост"}</p>
                <p className="text-[11px] text-gray-500">{new Date(n.created_at).toLocaleString("ru-RU")}</p>
              </button>
            ))
          )}
        </div>
      </div>
    </>
  );
}


  return (
    <header className="border-b border-[#222226] bg-[#1a1a1e] px-4 md:px-8 py-3 md:py-4 sticky top-0 z-40">
      <div className="flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 cursor-pointer group shrink-0" title="AniJUN — на главную">
          <Image
            src="/favicon.ico"
            alt="AniJUN"
            width={36}
            height={36}
            className="w-9 h-9 rounded-lg group-hover:scale-110 transition-transform"
          />
        </Link>

        <nav className="hidden md:flex items-center gap-8 text-xs font-bold uppercase tracking-widest text-gray-400">
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

        <Link
          href="/suggest"
          className="nav-tab flex items-center gap-1.5 transition-colors hover:text-amber-400"
          style={{ textTransform: "none" }}
        >
          <i className="fa-solid fa-lightbulb"></i> Предложить
        </Link>
      </nav>

      <div className="flex items-center gap-2 md:gap-3">
        <button
          onClick={() => setMobileNavOpen(!mobileNavOpen)}
          className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg bg-[#121214] border border-[#222226] text-gray-400 hover:text-white hover:border-gray-600 transition-all shrink-0"
          aria-label="Меню"
        >
          <i className={`fa-solid ${mobileNavOpen ? "fa-xmark" : "fa-bars"} text-sm`}></i>
        </button>

        {isSimulating && (
          <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-2">
            <i className="fa-solid fa-user-secret"></i>
            <span className="hidden sm:inline">Симуляция: {simulatedProfile?.username || "..."}</span>
          </div>
        )}

        {user ? (
          <div className="flex items-center gap-2">
            <div className="relative">
              <button onClick={() => setNotifOpen(!notifOpen)} title="Уведомления" className="w-9 h-9 flex items-center justify-center rounded-lg bg-[#121214] border border-[#222226] text-gray-400 hover:text-white transition-all relative">
                <i className="fa-solid fa-bell text-sm"></i>
                <NotifBadge />
              </button>
              {notifOpen && <NotifDropdown onClose={() => setNotifOpen(false)} />}
            </div>
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-2 bg-[#121214] hover:bg-[#222226] px-3 py-2 rounded-lg border border-[#222226] transition-all group"
            >
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt={username || "Аватар"}
                  width={24}
                  height={24}
                  unoptimized
                  className="w-6 h-6 rounded-full object-cover shrink-0 group-hover:scale-110 transition-transform"
                />
              ) : (
                <i className="fa-solid fa-circle-user text-sky-400 text-sm group-hover:scale-110 transition-transform"></i>
              )}
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
                  {isAdmin && (
                    <Link
                      href="/admin"
                      onClick={() => setMenuOpen(false)}
                      className="w-full text-left px-4 py-2 hover:bg-[#222226] hover:text-amber-400 transition-colors text-xs text-gray-400 font-semibold flex items-center gap-2"
                    >
                      <i className="fa-solid fa-shield text-[10px]"></i> Админ
                    </Link>
                  )}
                  {isAdmin && (
                    <Link
                      href="/admin/add"
                      onClick={() => setMenuOpen(false)}
                      className="w-full text-left px-4 py-2 hover:bg-[#222226] hover:text-sky-400 transition-colors text-xs text-gray-400 font-semibold flex items-center gap-2"
                    >
                      <i className="fa-solid fa-plus text-[10px]"></i> Добавить аниме
                    </Link>
                  )}
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
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="text-xs font-bold text-gray-300 hover:text-white px-3 py-2 rounded-lg hover:bg-[#222226] transition-all min-h-[36px] flex items-center"
            >
              Войти
            </Link>
            <Link
              href="/signup"
              className="bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs px-4 py-2 rounded-lg transition-all flex items-center gap-1.5 shadow-lg shadow-sky-500/10 min-h-[36px]"
            >
              <i className="fa-solid fa-user-plus text-[10px]"></i>{" "}
              Регистрация
            </Link>
          </div>
        )}
      </div>
      </div>

      {mobileNavOpen && (
        <nav className="md:hidden mt-4 pt-4 border-t border-[#222226] flex flex-col gap-1">
          <Link href="/" onClick={() => setMobileNavOpen(false)} className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-bold transition-colors ${pathname === "/" ? "bg-sky-500/10 text-sky-400" : "text-gray-400 hover:bg-[#222226] hover:text-white"}`}>
            <i className="fa-solid fa-home w-5"></i> Главная
          </Link>
          <Link href="/catalog" onClick={() => setMobileNavOpen(false)} className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-bold transition-colors ${pathname === "/catalog" ? "bg-sky-500/10 text-sky-400" : "text-gray-400 hover:bg-[#222226] hover:text-white"}`}>
            <i className="fa-solid fa-folder-open w-5"></i> Каталог
          </Link>
          <Link href="/catalog?tab=ongoing" onClick={() => setMobileNavOpen(false)} className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-bold text-gray-400 hover:bg-[#222226] hover:text-white transition-colors">
            <i className="fa-solid fa-clock w-5"></i> Онгоинги
          </Link>
          <Link href="/catalog?tab=announcements" onClick={() => setMobileNavOpen(false)} className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-bold text-gray-400 hover:bg-[#222226] hover:text-white transition-colors">
            <i className="fa-solid fa-bullhorn w-5"></i> Анонсы
          </Link>
          <Link href="/top" onClick={() => setMobileNavOpen(false)} className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-bold transition-colors ${pathname === "/top" ? "bg-sky-500/10 text-sky-400" : "text-gray-400 hover:bg-[#222226] hover:text-white"}`}>
            <i className="fa-solid fa-chart-simple w-5"></i> Топ-100
          </Link>
          <button onClick={() => { setMobileNavOpen(false); handleRandomAnime(); }} className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-bold text-gray-400 hover:bg-[#222226] hover:text-white transition-colors text-left w-full">
            <i className="fa-solid fa-shuffle w-5"></i> Случайное
          </button>
          <Link href="/suggest" onClick={() => setMobileNavOpen(false)} className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-bold text-amber-400 hover:bg-amber-500/10 transition-colors">
            <i className="fa-solid fa-lightbulb w-5"></i> Предложить
          </Link>
        </nav>
      )}
    </header>
  );
}