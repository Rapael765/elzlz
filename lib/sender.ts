export const PER_RUN: Record<string, number> = { slow: 2, medium: 5, fast: 8 }; // pesan per menit PER PERANGKAT

export async function processRun(db: any, run: any, price: number) {
  const base = process.env.BAILEYS_API_URL?.replace(/\/$/, "");
  const key = process.env.BAILEYS_API_KEY;
  const out = { sent: 0, failed: 0, note: "" };
  if (!base || !key) { out.note = "BAILEYS_API_URL / BAILEYS_API_KEY belum diisi di Vercel."; return out; }
  const H = (slot?: number): Record<string, string> => ({ Authorization: `Bearer ${key}`, "Content-Type": "application/json", "x-user-id": run.user_id, ...(slot ? { "x-slot": String(slot) } : {}) });
  const setStatus = (status: string) => db.from("user_runs").update({ status, updated_at: new Date().toISOString() }).eq("user_id", run.user_id);

  const { data: cfg } = await db.from("app_settings").select("active_campaign_id").eq("id", 1).maybeSingle();
  const { data: campaign } = await db.from("campaigns").select("*").eq("id", cfg?.active_campaign_id || run.campaign_id).maybeSingle();
  if (!campaign) { await setStatus("stopped"); out.note = "Campaign tidak ditemukan."; return out; }

  const messageText = campaign.button_url ? `${campaign.template_name}\n\n👉 *${campaign.button_label || "Buka link"}*\n${campaign.button_url}` : campaign.template_name;
  let slots: number[] = [];
  try {
    const r = await fetch(`${base}/devices`, { headers: H(), cache: "no-store", signal: AbortSignal.timeout(10000) });
    slots = ((await r.json()).devices || []).filter((d: any) => d.connected).map((d: any) => d.slot);
  } catch { out.note = "Server Pterodactyl tidak dapat dijangkau dari Vercel."; return out; }
  if (!slots.length) { await setStatus("stopped"); out.note = "Tidak ada perangkat online, pengiriman dihentikan."; return out; }

  // Ambil nomor yang belum pernah dipakai akun mana pun; langsung ditandai terpakai (tidak muncul di akun lain).
  const { data: claimed, error: claimError } = await db.rpc("claim_contacts", { uid: run.user_id, n: (PER_RUN[run.speed_mode] || 2) * slots.length });
  if (claimError) { out.note = `Database: ${claimError.message}`; return out; }
  const todo: any[] = claimed || [];
  if (!todo.length) { await setStatus("completed"); out.note = "Database habis, tidak ada nomor baru."; return out; }
  const release = (ids: string[]) => ids.length ? db.from("contacts").update({ used_at: null, used_by: null }).in("id", ids) : null;

  await Promise.all(slots.map(async (slot, i) => {
    const mine = todo.filter((_: any, j: number) => j % slots.length === i);
    for (let k = 0; k < mine.length; k++) {
      const contact = mine[k];
      const { data: claim, error: logErr } = await db.from("message_logs").insert({ campaign_id: campaign.id, contact_id: contact.id, phone: contact.phone, status: "pending", sent_by: run.user_id, device_slot: slot }).select("id").single();
      if (logErr || !claim) { out.note = `Database: ${logErr?.message || "gagal mencatat"}`; await release([contact.id]); continue; }
      try {
        const r = await fetch(`${base}/send`, { method: "POST", headers: H(slot), body: JSON.stringify(campaign.button_url && campaign.button_native ? { phone: contact.phone, text: campaign.template_name, button: { label: campaign.button_label || "Buka link", url: campaign.button_url }, native: true } : { phone: contact.phone, text: messageText }), signal: AbortSignal.timeout(25000) });
        const payload: any = await r.json().catch(() => ({}));
        if (r.ok) {
          await db.from("message_logs").update({ status: "sent", provider_message_id: payload?.messageId || null, reward: price }).eq("id", claim.id);
          out.sent++;
        } else if (r.status === 409) {
          await db.from("message_logs").delete().eq("id", claim.id); // perangkat offline: nomor dikembalikan ke database
          await release(mine.slice(k).map((c: any) => c.id));
          out.note = `Perangkat ${slot} offline.`;
          break;
        } else if (r.status === 422) {
          await db.from("message_logs").update({ status: "invalid", error: String(payload?.error || "Nomor tidak terdaftar di WhatsApp.").slice(0, 300) }).eq("id", claim.id);
          out.note = "Ada nomor tidak terdaftar WhatsApp: dilewati, tidak dihitung.";
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
