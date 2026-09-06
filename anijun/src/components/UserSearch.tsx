"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState, useMemo } from "react";
import Image from "next/image";

interface UserResult {
  id: string;
  username: string;
  avatar_url: string;
}

interface UserSearchProps {
  currentUserId: string;
  onAddFriend: (userId: string) => void;
}

export default function UserSearch({ currentUserId, onAddFriend }: UserSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserResult[]>([]);
  const [loading, setLoading] = useState(false);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (!query.trim()) return;

    const timeout = setTimeout(async () => {
      setLoading(true);
      const { data } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .neq("id", currentUserId)
        .ilike("username", `%${query}%`)
        .limit(10);

      setResults(data || []);
      setLoading(false);
    }, 300);

    return () => clearTimeout(timeout);
  }, [query, currentUserId, supabase]);

  return (
    <div className="space-y-2">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Поиск по никнейму..."
        className="w-full bg-[#121214] border border-[#222226] rounded-lg px-4 py-2.5 text-xs text-gray-300 placeholder:text-gray-600 focus:outline-none focus:border-sky-400 transition-colors"
      />

      {loading && (
        <div className="text-xs text-gray-500 text-center py-2">
          Поиск...
        </div>
      )}

      {!loading && query.trim() && results.length > 0 && (
        <div className="flex flex-col gap-2">
          {results.map((user) => (
            <div
              key={user.id}
              className="flex items-center justify-between p-3 bg-[#121214] rounded-lg border border-[#222226]"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center text-white text-xs font-bold shrink-0 relative overflow-hidden">
                  {user.avatar_url ? (
                    <Image src={user.avatar_url} alt={user.username} fill unoptimized sizes="32px" className="object-cover rounded-full" />
                  ) : (
                    user.username.charAt(0).toUpperCase()
                  )}
                </div>
                <div>
                  <span className="font-bold text-white text-xs block">{user.username}</span>
                  <div className="flex gap-2 text-[10px] text-gray-500">
                  </div>
                </div>
              </div>
              <button
                onClick={() => onAddFriend(user.id)}
                className="px-3 py-1.5 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20 hover:bg-sky-500/20 transition-all text-[11px] font-bold"
              >
                Добавить
              </button>
            </div>
          ))}
        </div>
      )}

      {!loading && query && results.length === 0 && (
        <div className="text-xs text-gray-500 text-center py-2">
          Пользователи не найдены
        </div>
      )}
    </div>
  );
}