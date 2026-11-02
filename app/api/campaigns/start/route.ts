import { NextRequest, NextResponse } from "next/server";
import { getUser, isAdminUser } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: "Silakan login ulang." }, { status: 401 });
  const { campaignId, speed } = await request.json();
  const mode = ["slow", "medium", "fast"].includes(speed) ? speed : "slow";
  const base = process.env.BAILEYS_API_URL?.replace(/\/$/, "");
  const key = process.env.BAILEYS_API_KEY;
  if (!base || !key) return NextResponse.json({ error: "Backend Baileys belum dikonfigurasi." }, { status: 503 });
  let online = 0;
  try {
    const r = await fetch(`${base}/devices`, { headers: { Authorization: `Bearer ${key}`, "x-user-id": user.id }, cache: "no-store", signal: AbortSignal.timeout(15000) });
    online = ((await r.json()).devices || []).filter((d: any) => d.connected).length;
  } catch { return NextResponse.json({ error: "Backend Baileys tidak dapat dijangkau." }, { status: 502 }); }
  if (!online) return NextResponse.json({ error: "Hubungkan minimal 1 perangkat WhatsApp dulu." }, { status: 409 });
  const db = createServerClient();
  let campaign: any = null;
  if (campaignId && (await isAdminUser(user.id))) campaign = (await db.from("campaigns").select("id").eq("id", campaignId).maybeSingle()).data;
  else campaign = (await db.from("campaigns").select("id").order("created_at", { ascending: false }).limit(1).maybeSingle()).data;
  if (!campaign) return NextResponse.json({ error: "Belum ada campaign dari admin." }, { status: 404 });
  const { count: remaining } = await db.from("contacts").select("id", { count: "exact", head: true }).eq("opted_in", true).is("unsubscribed_at", null).is("used_at", null);
  if (!remaining) return NextResponse.json({ error: "Belum ada target baru untuk dikirim. Tunggu admin menambah campaign atau database." }, { status: 409 });
  const now = new Date().toISOString();
  const { error } = await db.from("user_runs").upsert({ user_id: user.id, campaign_id: campaign.id, status: "running", speed_mode: mode, started_at: now, updated_at: now }, { onConflict: "user_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ message: `Pengiriman dimulai (${mode}). Perangkat online: ${online}.` });
}
