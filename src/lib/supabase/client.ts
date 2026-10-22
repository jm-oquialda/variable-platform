import { createBrowserClient } from "@supabase/ssr";

// Supabase client for Client Components. Never use it to read talent rates
// or margins: those are admin and owner only, and prices come from the server.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
