import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

// Simpan metode penarikan (Dana / SeaBank) milik pengguna yang login.
export async function POST(request: NextRequest) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: "Silakan login ulang." }, { status: 401 });
  const { method, account, name } = await request.json();
  const acc = String(account || "").replace(/[\s-]/g, "");
  const nm = String(name || "").trim();
  if (!["dana", "seabank"].includes(method)) return NextResponse.json({ error: "Pilih Dana atau SeaBank." }, { status: 400 });
  if (!/^\d{8,16}$/.test(acc)) return NextResponse.json({ error: "Nomor Dana / rekening SeaBank harus angka 8-16 digit." }, { status: 400 });
  if (nm.length < 2 || nm.length > 60) return NextResponse.json({ error: "Isi nama pemilik akun." }, { status: 400 });
  const db = createServerClient();
  const { error } = await db.from("profiles").update({ payout_method: method, payout_account: acc, payout_name: nm }).eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ message: "Metode penarikan disimpan." });
}
