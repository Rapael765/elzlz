import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { processRun } from "@/lib/sender";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = createServerClient();
  const { data: runs } = await db.from("user_runs").select("*").eq("status", "running").limit(30);
  if (!runs?.length) return NextResponse.json({ message: "Tidak ada campaign aktif." });
  const { data: st } = await db.from("app_settings").select("price_per_message").eq("id", 1).maybeSingle();
  const results = await Promise.all(runs.map((run: any) => processRun(db, run, st?.price_per_message || 0)));
  return NextResponse.json({ sent: results.reduce((a, r) => a + r.sent, 0), failed: results.reduce((a, r) => a + r.failed, 0), notes: results.map((r) => r.note).filter(Boolean) });
}
