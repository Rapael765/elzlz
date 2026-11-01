import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: "Silakan login ulang." }, { status: 401 });
  const { campaignId, speed } = await request.json();
  const mode = ["slow", "medium", "fast"].includes(speed) ? speed : "slow";
  if (!campaignId) return NextResponse.json({ error: "Campaign tidak ditemukan." }, { status: 400 });

  if (!process.env.BAILEYS_API_URL || !process.env.BAILEYS_API_KEY) {
    return NextResponse.json({ error: "Backend Baileys belum dikonfigurasi." }, { status: 503 });
  }
  try {
    const statusResponse = await fetch(`${process.env.BAILEYS_API_URL.replace(/\/$/, "")}/status`, {
      headers: { Authorization: `Bearer ${process.env.BAILEYS_API_KEY}` }, cache: "no-store", signal: AbortSignal.timeout(10000)
    });
    const status = await statusResponse.json();
    if (!statusResponse.ok || !status.connected) return NextResponse.json({ error: "Hubungkan WhatsApp terlebih dahulu sebelum memulai campaign." }, { status: 409 });
  } catch {
    return NextResponse.json({ error: "Backend Baileys tidak dapat dijangkau. Periksa Pterodactyl." }, { status: 502 });
  }
  const db = createServerClient();
  const { data: campaign } = await db.from("campaigns").select("*").eq("id", campaignId).single();
  if (!campaign) return NextResponse.json({ error: "Campaign tidak ditemukan." }, { status: 404 });
  if (campaign.status === "completed") return NextResponse.json({ error: "Campaign ini sudah selesai. Minta admin membuat campaign baru." }, { status: 409 });
  const { count } = await db.from("contacts").select("*", { count: "exact", head: true }).eq("opted_in", true).is("unsubscribed_at", null);
  if (!count) return NextResponse.json({ error: "Belum ada pelanggan yang menyetujui promosi." }, { status: 400 });
  const { error } = await db.from("campaigns").update({ status: "running", speed_mode: mode, started_by: user.id, started_at: new Date().toISOString() }).eq("id", campaignId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ message: `Campaign dimulai. Sistem akan memproses pelanggan yang setuju secara bertahap. Target saat ini: ${count}.` });
}
