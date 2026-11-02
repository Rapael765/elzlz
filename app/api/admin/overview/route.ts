import { NextRequest, NextResponse } from "next/server";
import { getUser, isAdminUser } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await getUser(request);
  if (!user || !(await isAdminUser(user.id))) return NextResponse.json({ error: "Khusus admin." }, { status: 403 });
  const base = process.env.BAILEYS_API_URL?.replace(/\/$/, "");
  const key = process.env.BAILEYS_API_KEY;
  const dev = new Map<string, { on: number; linked: number }>();
  if (base && key) {
    try {
      const r = await fetch(`${base}/sessions`, { headers: { Authorization: `Bearer ${key}` }, cache: "no-store", signal: AbortSignal.timeout(10000) });
      for (const s of (await r.json()).sessions || []) { if (!s.registered && !s.connected) continue; const d = dev.get(s.userId) || { on: 0, linked: 0 }; d.linked++; if (s.connected) d.on++; dev.set(s.userId, d); }
    } catch {}
  }
  const db = createServerClient();
  const { data: profiles } = await db.from("profiles").select("id, full_name, role, balance, earned, success_count, max_devices");
  const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 });
  const emails = new Map((list?.users || []).map((u: any) => [u.id, u.email]));
  const users = (profiles || []).map((p: any) => ({ id: p.id, name: p.full_name, email: emails.get(p.id) || "", role: p.role, balance: p.balance, earned: p.earned, success_count: p.success_count, max_devices: p.max_devices, on: dev.get(p.id)?.on || 0, linked: dev.get(p.id)?.linked || 0 }));
  const names = new Map(users.map((u) => [u.id, u.name || u.email]));
  const { data: wds } = await db.from("withdrawals").select("*").order("created_at", { ascending: false }).limit(50);
  const withdrawals = (wds || []).map((w: any) => ({ ...w, name: names.get(w.user_id) || "", email: emails.get(w.user_id) || "" }));
  const online = users.reduce((a, u) => a + u.on, 0);
  const offline = users.reduce((a, u) => a + (u.linked - u.on), 0);
  const sum = (k: "balance" | "earned" | "success_count") => users.reduce((a, u: any) => a + (u[k] || 0), 0);
  return NextResponse.json({ online, offline, balanceTotal: sum("balance"), earnedTotal: sum("earned"), successTotal: sum("success_count"), users, withdrawals });
}
