import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const cfIp = req.headers.get("cf-connecting-ip")?.trim();
  const xff = req.headers.get("x-forwarded-for");
  const forwarded = xff ? xff.split(",").map((s) => s.trim()).find((s) => s && !s.startsWith("172.69.") && !s.startsWith("172.64.") && !s.startsWith("108.162.") && !s.startsWith("162.158.") && !s.startsWith("104.16.") && !s.startsWith("131.0.")) || xff.split(",")[0].trim() : "";
  const ip = cfIp || forwarded || req.headers.get("x-real-ip")?.trim() || req.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() || "";
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
