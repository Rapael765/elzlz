import { createClient } from "@supabase/supabase-js";

// Semua permintaan Supabase dari server TIDAK boleh di-cache oleh Next.js (supaya tarif/saldo selalu terbaru).
const noStoreFetch: typeof fetch = (input, init) => fetch(input, { ...init, cache: "no-store" });

export function createServerClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: noStoreFetch }
  });
}
