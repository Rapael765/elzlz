import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!process.env.BAILEYS_API_URL || !process.env.BAILEYS_API_KEY) {
    return NextResponse.json({ error: "Backend Baileys belum dikonfigurasi." }, { status: 503 });
  }
  const db = createServerClient();
  const { data: campaigns } = await db.from("campaigns").select("*").eq("status", "running").limit(3);
  if (!campaigns?.length) return NextResponse.json({ message: "Tidak ada campaign aktif." });

  let sent = 0, failed = 0;
  for (const campaign of campaigns) {
    const { data: allContacts } = await db.from("contacts").select("*")
      .eq("opted_in", true).is("unsubscribed_at", null).order("created_at", {ascending:true}).limit(5000);
    const { data: previousLogs } = await db.from("message_logs").select("contact_id").eq("campaign_id", campaign.id);
    const alreadyProcessed = new Set((previousLogs || []).map((row: any) => row.contact_id));
    const contacts = (allContacts || []).filter((contact: any) => !alreadyProcessed.has(contact.id)).slice(0, 2);
    if (!contacts.length) {
      await db.from("campaigns").update({status:"completed", completed_at:new Date().toISOString()}).eq("id", campaign.id);
      continue;
    }
    for (const contact of contacts) {
      // Pesan dikirim melalui backend Baileys di server Pterodactyl.
      // Kontak harus opt-in; backend juga menerapkan jeda antar-pesan dan daftar opt-out.
      try {
        const response = await fetch(`${process.env.BAILEYS_API_URL?.replace(/\/$/, "")}/send`, {
          method: "POST",
          headers: { Authorization: `Bearer ${process.env.BAILEYS_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ phone: contact.phone, text: campaign.template_name }),
          signal: AbortSignal.timeout(20000)
        });
        const payload = await response.json().catch(() => ({}));
        const ok = response.ok;
        await db.from("message_logs").insert({
          campaign_id: campaign.id, contact_id: contact.id, phone: contact.phone,
          status: ok ? "sent" : "failed", provider_message_id: payload?.messageId || null,
          error: ok ? null : String(payload?.error || `Backend error ${response.status}`).slice(0,900)
        });
        if (ok) sent++; else failed++;
      } catch (e: any) {
        await db.from("message_logs").insert({campaign_id:campaign.id,contact_id:contact.id,phone:contact.phone,status:"failed",error:String(e).slice(0,900)});
        failed++;
      }
    }
  }
  return NextResponse.json({ sent, failed });
}
