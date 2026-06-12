export type AppEnv = {
  supabaseUrl: string;
  supabaseAnonKey: string;
};

export function readEnv(source: Record<string, string | undefined>): AppEnv {
  const supabaseUrl = source.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = source.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) throw new Error("Eksik ortam değişkeni: NEXT_PUBLIC_SUPABASE_URL");
  if (!supabaseAnonKey) throw new Error("Eksik ortam değişkeni: NEXT_PUBLIC_SUPABASE_ANON_KEY");

  return { supabaseUrl, supabaseAnonKey };
}
