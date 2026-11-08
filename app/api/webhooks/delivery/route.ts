import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Dipanggil server WhatsApp (Pterodactyl) saat pesan sudah SAMPAI (centang 2). Saldo baru ditambah di sini.
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { messageId } = await request.json();
  if (!messageId) return NextResponse.json({ error: "messageId kosong." }, { status: 400 });
  const db = createServerClient();
  const { data: log } = await db.from("message_logs").select("id, sent_by, reward, status").eq("provider_message_id", messageId).maybeSingle();
  if (!log) return NextResponse.json({ error: "Pesan belum tercatat." }, { status: 404 }); // server akan mencoba lagi
  if (log.status !== "sent") return NextResponse.json({ ok: true, ignored: log.status });
  // ubah status hanya jika masih 'sent' (mencegah saldo ganda)
  const { data: upd } = await db.from("message_logs").update({ status: "delivered" }).eq("id", log.id).eq("status", "sent").select("id");
  if (upd?.length) await db.rpc("credit_user", { uid: log.sent_by, amount: log.reward || 0 });
  return NextResponse.json({ ok: true, credited: Boolean(upd?.length) });
}
