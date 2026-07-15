"use client";

import { createClient } from "@/lib/supabase/client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SignupPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (username.trim().length < 2) {
      setError("Имя должно быть не менее 2 символов");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username: username.trim() },
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <div className="bg-[#1a1a1e] border border-[#222226] rounded-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-xl font-bold text-white mb-2">
            Регистрация в AniJUN
          </h1>
          <p className="text-xs text-gray-500">
            Создай свой аниме-дневник
          </p>
        </div>

        <form onSubmit={handleSignup} className="flex flex-col gap-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-4 py-2 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">
              Имя пользователя
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Кира"
              required
              className="w-full bg-[#121214] border border-[#222226] rounded-lg px-4 py-2.5 text-xs text-white focus:outline-none focus:border-sky-400 transition-colors"
            />
          </div>

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
              placeholder="Минимум 6 символов"
              required
              minLength={6}
              className="w-full bg-[#121214] border border-[#222226] rounded-lg px-4 py-2.5 text-xs text-white focus:outline-none focus:border-sky-400 transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-sky-500 hover:bg-sky-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs px-4 py-3 rounded-lg transition-all mt-2"
          >
            {loading ? "Создание аккаунта..." : "Зарегистрироваться"}
          </button>
        </form>

        <p className="text-center text-xs text-gray-500 mt-6">
          Уже есть аккаунт?{" "}
          <Link href="/login" className="text-sky-400 hover:underline font-semibold">
            Войти
          </Link>
        </p>
      </div>
    </div>
  );
}
