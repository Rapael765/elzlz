import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: "Silakan login ulang." }, { status: 401 });
  const { campaignId } = await request.json();
  if (!campaignId) return NextResponse.json({ error: "Campaign tidak ditemukan." }, { status: 400 });
  const db = createServerClient();
  const { error } = await db.from("campaigns").update({ status: "stopped" }).eq("id", campaignId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ message: "Pengiriman dihentikan." });
}
