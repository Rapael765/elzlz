import { NextRequest, NextResponse } from "next/server";
import { getUser, isAdminUser } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const user = await getUser(request);
  if (!user || !(await isAdminUser(user.id))) return NextResponse.json({ error: "Khusus admin." }, { status: 403 });
  const { userId, maxDevices } = await request.json();
  const n = Number(maxDevices);
  if (!userId || !Number.isInteger(n) || n < 1 || n > 9) return NextResponse.json({ error: "Batas perangkat harus 1 sampai 9." }, { status: 400 });
  const db = createServerClient();
  const { error } = await db.from("profiles").update({ max_devices: n }).eq("id", userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ message: `Batas perangkat diubah jadi ${n}.` });
}
