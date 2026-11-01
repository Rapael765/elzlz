import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { processRun } from "@/lib/sender";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Tombol "Kirim sekarang": memproses pengiriman milik pengguna ini langsung dan menampilkan hasilnya.
export async function POST(request: NextRequest) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: "Silakan login ulang." }, { status: 401 });
  const db = createServerClient();
  const { data: run } = await db.from("user_runs").select("*").eq("user_id", user.id).eq("status", "running").maybeSingle();
  if (!run) return NextResponse.json({ error: "Belum ada pengiriman berjalan. Tekan Mulai dulu." }, { status: 409 });
  const { data: st } = await db.from("app_settings").select("price_per_message").eq("id", 1).maybeSingle();
  const r = await processRun(db, run, st?.price_per_message || 0);
  return NextResponse.json({ message: `Terkirim ${r.sent}, gagal ${r.failed}.${r.note ? " Info: " + r.note : ""}` });
}
