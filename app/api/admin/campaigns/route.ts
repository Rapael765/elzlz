import { NextRequest, NextResponse } from "next/server";
import { getUser, isAdminUser } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

// Admin: pilih campaign aktif, hapus satu campaign, atau hapus semua campaign lama (selain yang aktif).
export async function POST(request: NextRequest) {
  const user = await getUser(request);
  if (!user || !(await isAdminUser(user.id))) return NextResponse.json({ error: "Khusus admin." }, { status: 403 });
  const { action, id } = await request.json();
  const db = createServerClient();
  if (action === "activate") {
    if (!id) return NextResponse.json({ error: "Campaign tidak valid." }, { status: 400 });
    const { error } = await db.from("app_settings").update({ active_campaign_id: id }).eq("id", 1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ message: "Campaign diaktifkan. Pengguna akan memakai campaign ini." });
  }
  if (action === "delete") {
    if (!id) return NextResponse.json({ error: "Campaign tidak valid." }, { status: 400 });
    const { error } = await db.from("campaigns").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ message: "Campaign dihapus." });
  }
  if (action === "deleteInactive") {
    const { data: cfg } = await db.from("app_settings").select("active_campaign_id").eq("id", 1).maybeSingle();
    const q = db.from("campaigns").delete({ count: "exact" });
    const { error, count } = await (cfg?.active_campaign_id ? q.neq("id", cfg.active_campaign_id) : q.not("id", "is", null));
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ message: `${count ?? 0} campaign lama dihapus.` });
  }
  return NextResponse.json({ error: "Aksi tidak dikenal." }, { status: 400 });
}
