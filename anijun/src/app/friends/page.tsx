"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

interface Friend {
  id: string;
  username: string;
  avatar_url: string;
}

interface Request {
  request_id: number;
  user_id: string;
  username: string;
  avatar_url: string;
}

export default function FriendsPage() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        router.push("/login");
        return;
      }

      const userId = session.user.id;

      const { data: friendsData } = await supabase
        .from("friends")
        .select("user_id, friend_id")
        .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
        .eq("status", "accepted");

      const ids = (friendsData || []).map(f => f.user_id === userId ? f.friend_id : f.user_id);
      const { data: profiles } = ids.length > 0 ? await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .in("id", ids) : { data: [] };

      setFriends((profiles || []).map(p => ({ id: p.id, username: p.username, avatar_url: p.avatar_url })));

      const { data: reqs } = await supabase
        .from("friends")
        .select("id, user_id")
        .eq("friend_id", userId)
        .eq("status", "pending");

      const uids = (reqs || []).map(r => r.user_id);
      const { data: reqProfiles } = uids.length > 0 ? await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .in("id", uids) : { data: [] };

      const map = new Map((reqs || []).map(r => [r.user_id, r.id]));
      setRequests((reqProfiles || []).map(p => ({ request_id: map.get(p.id) || 0, user_id: p.id, username: p.username, avatar_url: p.avatar_url || "" })));

      setLoading(false);
    }

    load();
  }, [supabase, router]);

  async function handleAccept(id: number, from: string) {
    await supabase.from("friends").update({ status: "accepted" }).eq("id", id);
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, username, avatar_url")
      .eq("id", from)
      .maybeSingle();
    setRequests(r => r.filter(x => x.user_id !== from));
    if (profile) {
      setFriends(f => [...f, {
        id: profile.id,
        username: profile.username || "?",
        avatar_url: profile.avatar_url || "",
      }]);
    }
  }

  async function handleReject(id: number) {
    await supabase.from("friends").delete().eq("id", id);
    setRequests(r => r.filter(x => x.request_id !== id));
  }


  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-[#1a1a1e] border border-[#222226] rounded-xl p-6">
        <h1 className="text-xl font-black text-white mb-1">Друзья</h1>
        <p className="text-xs text-gray-500 mb-6">Управляй заявками и найди новых друзей через поиск по нику</p>


        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Друзья ({friends.length})</h3>
            <div className="flex flex-col gap-2">
              {friends.length === 0 ? (
                <div className="text-xs text-gray-500 text-center py-4">Друзей пока нет</div>
              ) : (
                friends.map(f => (
                  <div key={f.id} className="flex items-center gap-3 p-3 bg-[#121214] rounded-lg border border-[#222226]">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0 overflow-hidden">
                      {f.avatar_url ? <Image src={f.avatar_url} alt={f.username} fill unoptimized sizes="32px" className="object-cover" /> : (f.username || "?").charAt(0).toUpperCase()}
                    </div>
                    <span className="text-xs font-bold text-gray-200 truncate">{f.username}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Заявки ({requests.length})</h3>
            <div className="flex flex-col gap-2">
              {requests.length === 0 ? (
                <div className="text-xs text-gray-500 text-center py-4">Нет входящих заявок</div>
              ) : (
                requests.map(r => (
                  <div key={r.request_id} className="flex items-center justify-between p-3 bg-[#121214] rounded-lg border border-[#222226]">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center text-white text-[10px] font-bold overflow-hidden">
                        {r.avatar_url ? <Image src={r.avatar_url} alt={r.username} fill unoptimized sizes="32px" className="object-cover" /> : (r.username || "?").charAt(0).toUpperCase()}
                      </div>
                      <span className="text-xs font-bold text-white">{r.username}</span>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleAccept(r.request_id, r.user_id)} className="px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400 border border-green-500/20 text-[11px] font-bold">Принять</button>
                      <button onClick={() => handleReject(r.request_id)} className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 text-[11px] font-bold">Отклонить</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}