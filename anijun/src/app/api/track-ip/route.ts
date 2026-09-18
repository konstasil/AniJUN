import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "";
  if (!ip) return NextResponse.json({ ok: true });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: true });
  const ua = req.headers.get("user-agent") || "";
  await supabase.from("user_ips").upsert(
    { user_id: user.id, ip, user_agent: ua, last_seen: new Date().toISOString() },
    { onConflict: "user_id,ip" }
  );
  return NextResponse.json({ ok: true, ip });
}

export async function GET(req: NextRequest) {
  return POST(req);
}
