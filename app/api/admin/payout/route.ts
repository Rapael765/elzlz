import { NextRequest, NextResponse } from "next/server";
import { getUser, isAdminUser } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const user = await getUser(request);
  if (!user || !(await isAdminUser(user.id))) return NextResponse.json({ error: "Khusus admin." }, { status: 403 });
  const { userId } = await request.json();
  if (!userId) return NextResponse.json({ error: "Pengguna tidak valid." }, { status: 400 });
  const db = createServerClient();
  const { error } = await db.from("profiles").update({ balance: 0 }).eq("id", userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ message: "Saldo pengguna direset (sudah dibayar)." });
}
