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
  return NextResponse.json({ error: "Aksi tidak dikenal." }, { status: 400 });
}
