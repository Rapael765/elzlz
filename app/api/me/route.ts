import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Ringkasan "Hari Ini" + data referral milik pengguna yang login.
export async function GET(request: NextRequest) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: "Silakan login ulang." }, { status: 401 });
  const db = createServerClient();
  const { data: prof } = await db.from("profiles").select("referral_code, referral_earned").eq("id", user.id).maybeSingle();
  const { data: invited } = await db.from("profiles").select("id, full_name, success_count").eq("referred_by", user.id).order("created_at", { ascending: false }).limit(50);
  const { data: st } = await db.from("app_settings").select("referral_rate").eq("id", 1).maybeSingle();
  // awal hari WIB (UTC+7)
  const wib = new Date(Date.now() + 7 * 3600 * 1000); wib.setUTCHours(0, 0, 0, 0);
  const start = new Date(wib.getTime() - 7 * 3600 * 1000).toISOString();
  const { data: logs } = await db.from("message_logs").select("reward").eq("sent_by", user.id).eq("status", "sent").gte("created_at", start).limit(20000);
  const todayEarned = (logs || []).reduce((a: number, l: any) => a + (l.reward || 0), 0);
  const mask = (n: string | null) => (n ? n.slice(0, 1) + "***" : "Pengguna");
  return NextResponse.json({
    today: { sent: (logs || []).length, earned: todayEarned },
    referral: { code: prof?.referral_code || "", earned: prof?.referral_earned || 0, rate: st?.referral_rate || 0, count: (invited || []).length, invited: (invited || []).map((u: any) => ({ name: mask(u.full_name), success_count: u.success_count })) },
  });
}
