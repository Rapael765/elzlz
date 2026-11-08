import { NextRequest, NextResponse } from "next/server";
import { getUser, isAdminUser } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

export const maxDuration = 60;

// Hapus satu nomor, semua nomor, atau semua nomor yang sudah terpakai (khusus admin).
export async function POST(request: NextRequest) {
  const user = await getUser(request);
  if (!user || !(await isAdminUser(user.id))) return NextResponse.json({ error: "Khusus admin." }, { status: 403 });
  const { action, id } = await request.json();
  const db = createServerClient();
  if (action === "delete") {
    if (!id) return NextResponse.json({ error: "Nomor tidak valid." }, { status: 400 });
    const { error } = await db.from("contacts").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ message: "Nomor dihapus." });
  }
  if (action === "deleteUsed" || action === "deleteAll") {
    const q = db.from("contacts").delete({ count: "exact" });
    const { error, count } = await (action === "deleteUsed" ? q.not("used_at", "is", null) : q.not("id", "is", null));
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ message: `${count ?? 0} nomor dihapus.` });
  }
  if (action === "restockUndelivered") {
    const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: stale, error } = await db.from("message_logs").select("id, contact_id").eq("status", "sent").lt("created_at", cutoff).limit(5000);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const logIds = (stale || []).map((l: any) => l.id);
    const contactIds = (stale || []).map((l: any) => l.contact_id).filter(Boolean);
    for (let i = 0; i < contactIds.length; i += 500) await db.from("contacts").update({ used_at: null, used_by: null }).in("id", contactIds.slice(i, i + 500));
    for (let i = 0; i < logIds.length; i += 500) await db.from("message_logs").update({ status: "undelivered" }).in("id", logIds.slice(i, i + 500));
    return NextResponse.json({ message: `${contactIds.length} nomor dikembalikan ke database (pesan tidak sampai lebih dari 30 menit).` });
  }
  return NextResponse.json({ error: "Aksi tidak dikenal." }, { status: 400 });
}
