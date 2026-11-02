import { NextRequest, NextResponse } from "next/server";
import { getUser, isAdminUser } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const user = await getUser(request);
  if (!user || !(await isAdminUser(user.id))) return NextResponse.json({ error: "Khusus admin." }, { status: 403 });
  const { id, action, note } = await request.json();
  if (!id || !["paid", "rejected"].includes(action)) return NextResponse.json({ error: "Data tidak valid." }, { status: 400 });
  const db = createServerClient();
  const { error } = await db.rpc("process_withdrawal", { wid: id, new_status: action, note_text: String(note || "").slice(0, 200) });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ message: action === "paid" ? "Ditandai sudah dibayar." : "Penarikan ditolak, saldo dikembalikan." });
}
