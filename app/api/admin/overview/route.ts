import { NextRequest, NextResponse } from "next/server";
import { getUser, isAdminUser } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await getUser(request);
  if (!user || !(await isAdminUser(user.id))) return NextResponse.json({ error: "Khusus admin." }, { status: 403 });
  const base = process.env.BAILEYS_API_URL?.replace(/\/$/, "");
  const key = process.env.BAILEYS_API_KEY;
  const onlineIds = new Set<string>();
  if (base && key) {
    try {
      const r = await fetch(`${base}/sessions`, { headers: { Authorization: `Bearer ${key}` }, cache: "no-store", signal: AbortSignal.timeout(10000) });
      for (const s of (await r.json()).sessions || []) if (s.connected) onlineIds.add(s.userId);
    } catch {}
  }
  const db = createServerClient();
  const { data: profiles } = await db.from("profiles").select("id, full_name, role, balance, earned, success_count");
  const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 });
  const emails = new Map((list?.users || []).map((u: any) => [u.id, u.email]));
  const users = (profiles || []).map((p: any) => ({ id: p.id, name: p.full_name, email: emails.get(p.id) || "", role: p.role, balance: p.balance, earned: p.earned, success_count: p.success_count, online: onlineIds.has(p.id) }));
  const online = users.filter((u) => u.online).length;
  const sum = (k: "balance" | "earned" | "success_count") => users.reduce((a, u: any) => a + (u[k] || 0), 0);
  return NextResponse.json({ online, offline: users.length - online, balanceTotal: sum("balance"), earnedTotal: sum("earned"), successTotal: sum("success_count"), users });
}
