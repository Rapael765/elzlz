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
