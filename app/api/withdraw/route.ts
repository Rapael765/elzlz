import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: "Silakan login ulang." }, { status: 401 });
  const { amount, method, accountNumber, accountName } = await request.json();
  const amt = Number(amount);
  const acc = String(accountNumber || "").replace(/[\s-]/g, "");
  const nm = String(accountName || "").trim();
  if (!Number.isInteger(amt) || amt <= 0) return NextResponse.json({ error: "Isi jumlah penarikan dengan angka." }, { status: 400 });
  if (!["dana", "seabank"].includes(method)) return NextResponse.json({ error: "Pilih Dana atau SeaBank." }, { status: 400 });
  if (!/^\d{8,16}$/.test(acc)) return NextResponse.json({ error: "Nomor Dana / rekening SeaBank harus angka 8-16 digit." }, { status: 400 });
  if (nm.length < 2 || nm.length > 60) return NextResponse.json({ error: "Isi nama pemilik akun." }, { status: 400 });
  const db = createServerClient();
  const { error } = await db.rpc("request_withdrawal", { uid: user.id, amt, m: method, acc, nm });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ message: "Permintaan penarikan terkirim ke admin. Saldo ditahan sampai diproses." });
}
