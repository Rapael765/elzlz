import { NextRequest, NextResponse } from "next/server";
import { getUser, isAdminUser } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";

export const maxDuration = 60;

// Impor nomor dari file .txt (satu nomor per baris).
export async function POST(request: NextRequest) {
  const user = await getUser(request);
  if (!user || !(await isAdminUser(user.id))) return NextResponse.json({ error: "Khusus admin." }, { status: 403 });
  const { text } = await request.json();
  const tokens = String(text || "").split(/[\s,;]+/).filter(Boolean);
  if (!tokens.length) return NextResponse.json({ error: "File kosong." }, { status: 400 });
  const valid = new Set<string>();
  let invalid = 0;
  for (const t of tokens) {
    let d = t.replace(/\D/g, "");
    if (d.startsWith("0")) d = "62" + d.slice(1);
    else if (d.startsWith("8")) d = "62" + d;
    if (/^\d{8,15}$/.test(d)) valid.add(d); else invalid++;
  }
  const rows = Array.from(valid).map((p) => ({ name: p, phone: p, opted_in: true, consent_source: "impor txt (dikonfirmasi admin)" }));
  const db = createServerClient();
  let inserted = 0;
  for (let i = 0; i < rows.length; i += 1000) {
    const { data, error } = await db.from("contacts").upsert(rows.slice(i, i + 1000), { onConflict: "phone", ignoreDuplicates: true }).select("id");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    inserted += data?.length || 0;
  }
  return NextResponse.json({ total: tokens.length, valid: valid.size, inserted, existing: valid.size - inserted, invalid, dupInFile: tokens.length - invalid - valid.size });
}
