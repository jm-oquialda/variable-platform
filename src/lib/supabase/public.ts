import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { supabaseAnonKey, supabaseUrl } from "./env";

// Anonymous Supabase client with no session, for public data on cacheable
// pages (tier prices, add-on prices). Sees only what row-level security
// allows the anon role, never a signed-in user's data.
export function createPublicClient() {
  return createSupabaseClient(supabaseUrl(), supabaseAnonKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
