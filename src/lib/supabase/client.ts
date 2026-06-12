import { createBrowserClient } from "@supabase/ssr";
import { readEnv } from "@/lib/env";

export function createClient() {
  const { supabaseUrl, supabaseAnonKey } = readEnv(process.env);
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
