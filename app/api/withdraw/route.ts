import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: "Silakan login ulang." }, { status: 401 });
  const { amount } = await request.json();
  const amt = Number(amount);
  if (!Number.isInteger(amt) || amt <= 0) return NextResponse.json({ error: "Isi jumlah penarikan dengan angka." }, { status: 400 });
  const db = createServerClient();
  const { data: prof } = await db.from("profiles").select("payout_method, payout_account, payout_name").eq("id", user.id).maybeSingle();
  if (!prof?.payout_method || !prof.payout_account || !prof.payout_name) return NextResponse.json({ error: "Atur metode penarikan di halaman Profile dulu." }, { status: 400 });
  const { error } = await db.rpc("request_withdrawal", { uid: user.id, amt, m: prof.payout_method, acc: prof.payout_account, nm: prof.payout_name });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ message: "Permintaan penarikan terkirim ke admin. Saldo ditahan sampai diproses." });
}
