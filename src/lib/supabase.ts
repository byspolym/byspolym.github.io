import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL = "https://uucwfokbycoifllfuanz.supabase.co";
export const SUPABASE_ANON_KEY =
  "sb_publishable_bYoucbWmikUv2u1uVzeDCg_FHxytQtP";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export async function supabaseTablesReady() {
  const { error } = await supabase.from("profiles").select("id").limit(1);
  if (!error) return true;
  const msg = (error.message || "").toLowerCase();
  const code = error.code || "";
  if (code === "PGRST205" || msg.includes("schema cache") || msg.includes("could not find the table")) {
    return false;
  }
  // Table exists but RLS blocked the select — still "ready"
  return true;
}
