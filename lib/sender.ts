export const PER_RUN: Record<string, number> = { slow: 2, medium: 5, fast: 8 }; // pesan per menit PER PERANGKAT

export async function processRun(db: any, run: any, price: number) {
  const base = process.env.BAILEYS_API_URL?.replace(/\/$/, "");
  const key = process.env.BAILEYS_API_KEY;
  const out = { sent: 0, failed: 0, note: "" };
  if (!base || !key) { out.note = "BAILEYS_API_URL / BAILEYS_API_KEY belum diisi di Vercel."; return out; }
  const H = (slot?: number): Record<string, string> => ({ Authorization: `Bearer ${key}`, "Content-Type": "application/json", "x-user-id": run.user_id, ...(slot ? { "x-slot": String(slot) } : {}) });
  const setStatus = (status: string) => db.from("user_runs").update({ status, updated_at: new Date().toISOString() }).eq("user_id", run.user_id);

  const { data: campaign } = await db.from("campaigns").select("*").eq("id", run.campaign_id).maybeSingle();
  if (!campaign) { await setStatus("stopped"); out.note = "Campaign tidak ditemukan."; return out; }

  let slots: number[] = [];
  try {
    const r = await fetch(`${base}/devices`, { headers: H(), cache: "no-store", signal: AbortSignal.timeout(10000) });
    slots = ((await r.json()).devices || []).filter((d: any) => d.connected).map((d: any) => d.slot);
  } catch { out.note = "Server Pterodactyl tidak dapat dijangkau dari Vercel."; return out; }
  if (!slots.length) { await setStatus("stopped"); out.note = "Tidak ada perangkat online, pengiriman dihentikan."; return out; }

  const { data: contacts } = await db.from("contacts").select("*").eq("opted_in", true).is("unsubscribed_at", null).order("created_at", { ascending: true }).limit(5000);
  const { data: logs } = await db.from("message_logs").select("contact_id").eq("campaign_id", campaign.id);
  const done = new Set((logs || []).map((l: any) => l.contact_id));
  const todo = (contacts || []).filter((c: any) => !done.has(c.id)).slice(0, (PER_RUN[run.speed_mode] || 2) * slots.length);
  if (!todo.length) { await setStatus("completed"); out.note = "Semua kontak sudah diproses."; return out; }

  await Promise.all(slots.map(async (slot, i) => {
    for (const contact of todo.filter((_: any, j: number) => j % slots.length === i)) {
      const { data: claim, error: claimErr } = await db.from("message_logs").insert({ campaign_id: campaign.id, contact_id: contact.id, phone: contact.phone, status: "pending", sent_by: run.user_id }).select("id").single();
      if (claimErr || !claim) { if (claimErr && claimErr.code !== "23505") out.note = `Database: ${claimErr.message}`; continue; }
      try {
        const r = await fetch(`${base}/send`, { method: "POST", headers: H(slot), body: JSON.stringify({ phone: contact.phone, text: campaign.template_name }), signal: AbortSignal.timeout(25000) });
        const payload: any = await r.json().catch(() => ({}));
        if (r.ok) {
          await db.from("message_logs").update({ status: "sent", provider_message_id: payload?.messageId || null, reward: price }).eq("id", claim.id);
          await db.rpc("credit_user", { uid: run.user_id, amount: price });
          out.sent++;
        } else if (r.status === 409) {
          await db.from("message_logs").delete().eq("id", claim.id); // perangkat offline: tidak dihitung
          out.note = `Perangkat ${slot} offline.`;
          break;
        } else {
          const msg = String(payload?.error || `Backend error ${r.status}`).slice(0, 300);
          await db.from("message_logs").update({ status: "failed", error: msg }).eq("id", claim.id);
          out.failed++; out.note = msg;
        }
      } catch (e: any) {
        await db.from("message_logs").update({ status: "failed", error: String(e).slice(0, 300) }).eq("id", claim.id);
        out.failed++; out.note = String(e).slice(0, 200);
      }
    }
  }));
  return out;
}
