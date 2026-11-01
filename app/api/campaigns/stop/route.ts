import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: "Silakan login ulang." }, { status: 401 });
  const db = createServerClient();
  const { error } = await db.from("user_runs").update({ status: "stopped", updated_at: new Date().toISOString() }).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ message: "Pengiriman dihentikan." });
}
