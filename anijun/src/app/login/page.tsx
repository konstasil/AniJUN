"use client";

import { createClient } from "@/lib/supabase/client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push(getNextPath());
    router.refresh();
  }

  function getNextPath() {
    const next = new URLSearchParams(window.location.search).get("next");
    return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  }

  function buildCallbackUrl() {
    const next = new URLSearchParams(window.location.search).get("next");
    const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
    return `${window.location.origin}/auth/callback${
      safeNext ? `?next=${encodeURIComponent(safeNext)}` : ""
    }`;
  }

  async function handleGoogleLogin() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: buildCallbackUrl(),
      },
    });
    if (error) {
      setError(error.message);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <div className="bg-[#1a1a1e] border border-[#222226] rounded-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-xl font-bold text-white mb-2">Вход в AniJUN</h1>
          <p className="text-xs text-gray-500">
            Добро пожаловать обратно
          </p>
        </div>

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-4 py-2 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              className="w-full bg-[#121214] border border-[#222226] rounded-lg px-4 py-2.5 text-xs text-white focus:outline-none focus:border-sky-400 transition-colors"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">
              Пароль
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full bg-[#121214] border border-[#222226] rounded-lg px-4 py-2.5 text-xs text-white focus:outline-none focus:border-sky-400 transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-sky-500 hover:bg-sky-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs px-4 py-3 rounded-lg transition-all mt-2"
          >
            {loading ? "Вход..." : "Войти"}
          </button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[#222226]"></div>
          </div>
          <div className="relative flex justify-center text-[10px]">
            <span className="bg-[#1a1a1e] px-3 text-gray-500">или</span>
          </div>
        </div>

        <button
          onClick={handleGoogleLogin}
          className="w-full bg-[#121214] hover:bg-[#222226] border border-[#222226] text-gray-300 font-bold text-xs px-4 py-3 rounded-lg transition-all flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Войти через Google
        </button>

        <p className="text-center text-xs text-gray-500 mt-6">
          Нет аккаунта?{" "}
          <Link href="/signup" className="text-sky-400 hover:underline font-semibold">
            Зарегистрироваться
          </Link>
        </p>
      </div>
    </div>
  );
}