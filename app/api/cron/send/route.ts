import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
const PER_RUN: Record<string, number> = { slow: 2, medium: 5, fast: 8 };

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const base = process.env.BAILEYS_API_URL?.replace(/\/$/, "");
  const key = process.env.BAILEYS_API_KEY;
  if (!base || !key) return NextResponse.json({ error: "Backend Baileys belum dikonfigurasi." }, { status: 503 });
  const db = createServerClient();
  const { data: runs } = await db.from("user_runs").select("*").eq("status", "running").limit(30);
  if (!runs?.length) return NextResponse.json({ message: "Tidak ada campaign aktif." });
  const { data: st } = await db.from("app_settings").select("price_per_message").eq("id", 1).maybeSingle();
  const price = st?.price_per_message || 0;
  let sent = 0, failed = 0;
  await Promise.all(runs.map(async (run: any) => {
    const stop = (status: string) => db.from("user_runs").update({ status, updated_at: new Date().toISOString() }).eq("user_id", run.user_id);
    const { data: campaign } = await db.from("campaigns").select("*").eq("id", run.campaign_id).maybeSingle();
    if (!campaign) { await stop("stopped"); return; }
    const { data: contacts } = await db.from("contacts").select("*").eq("opted_in", true).is("unsubscribed_at", null).order("created_at", { ascending: true }).limit(5000);
    const { data: logs } = await db.from("message_logs").select("contact_id").eq("campaign_id", campaign.id);
    const done = new Set((logs || []).map((l: any) => l.contact_id));
    const todo = (contacts || []).filter((c: any) => !done.has(c.id)).slice(0, PER_RUN[run.speed_mode] || 2);
    if (!todo.length) { await stop("completed"); return; }
    for (const contact of todo) {
      const { data: claim, error: claimErr } = await db.from("message_logs").insert({ campaign_id: campaign.id, contact_id: contact.id, phone: contact.phone, status: "pending", sent_by: run.user_id }).select("id").single();
      if (claimErr || !claim) continue; // sudah diambil perangkat lain
      try {
        const r = await fetch(`${base}/send`, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "x-user-id": run.user_id }, body: JSON.stringify({ phone: contact.phone, text: campaign.template_name }), signal: AbortSignal.timeout(25000) });
        const payload: any = await r.json().catch(() => ({}));
        if (r.ok) {
          await db.from("message_logs").update({ status: "sent", provider_message_id: payload?.messageId || null, reward: price }).eq("id", claim.id);
          await db.rpc("credit_user", { uid: run.user_id, amount: price });
          sent++;
        } else if (r.status === 409) {
          await db.from("message_logs").delete().eq("id", claim.id); // perangkat offline: kontak tidak dihitung
          await stop("stopped");
          break;
        } else {
          await db.from("message_logs").update({ status: "failed", error: String(payload?.error || `Backend error ${r.status}`).slice(0, 900) }).eq("id", claim.id);
          failed++;
        }
      } catch (e: any) {
        await db.from("message_logs").update({ status: "failed", error: String(e).slice(0, 900) }).eq("id", claim.id);
        failed++;
      }
    }
  }));
  return NextResponse.json({ sent, failed });
}
