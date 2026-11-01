import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: "Silakan login ulang." }, { status: 401 });
  const { campaignId, speed } = await request.json();
  const mode = ["slow", "medium", "fast"].includes(speed) ? speed : "slow";
  const base = process.env.BAILEYS_API_URL?.replace(/\/$/, "");
  const key = process.env.BAILEYS_API_KEY;
  if (!base || !key) return NextResponse.json({ error: "Backend Baileys belum dikonfigurasi." }, { status: 503 });
  let connected = false;
  try {
    const r = await fetch(`${base}/status`, { headers: { Authorization: `Bearer ${key}`, "x-user-id": user.id }, cache: "no-store", signal: AbortSignal.timeout(15000) });
    connected = Boolean((await r.json()).connected);
  } catch { return NextResponse.json({ error: "Backend Baileys tidak dapat dijangkau." }, { status: 502 }); }
  if (!connected) return NextResponse.json({ error: "Hubungkan WhatsApp perangkatmu dulu." }, { status: 409 });
  const db = createServerClient();
  const { data: campaign } = await db.from("campaigns").select("id").eq("id", campaignId).maybeSingle();
  if (!campaign) return NextResponse.json({ error: "Campaign tidak ditemukan." }, { status: 404 });
  const { data: contacts } = await db.from("contacts").select("id").eq("opted_in", true).is("unsubscribed_at", null).limit(5000);
  const { data: logs } = await db.from("message_logs").select("contact_id").eq("campaign_id", campaignId);
  const done = new Set((logs || []).map((l: any) => l.contact_id));
  const remaining = (contacts || []).filter((c: any) => !done.has(c.id)).length;
  if (!remaining) return NextResponse.json({ error: "Semua kontak sudah diproses untuk campaign ini. Minta admin membuat campaign baru." }, { status: 409 });
  const now = new Date().toISOString();
  const { error } = await db.from("user_runs").upsert({ user_id: user.id, campaign_id: campaignId, status: "running", speed_mode: mode, started_at: now, updated_at: now }, { onConflict: "user_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ message: `Pengiriman dimulai (${mode}). Sisa target: ${remaining} kontak.` });
}
