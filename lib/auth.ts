import { createServerClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

export async function getUser(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const supabase = createServerClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

export async function isAdminUser(userId: string) {
  const db = createServerClient();
  const { data } = await db.from("profiles").select("role").eq("id", userId).maybeSingle();
  return data?.role === "admin";
}

export async function getSlot(request: NextRequest, userId: string) {
  const raw = Number(new URL(request.url).searchParams.get("slot") || 1);
  const db = createServerClient();
  const { data } = await db.from("profiles").select("max_devices").eq("id", userId).maybeSingle();
  const max = data?.max_devices ?? 3;
  return Number.isInteger(raw) && raw >= 1 && raw <= max ? raw : null;
}
