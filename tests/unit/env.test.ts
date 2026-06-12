import { describe, it, expect } from "vitest";
import { readEnv } from "@/lib/env";

describe("readEnv", () => {
  it("geçerli env'de değerleri döndürür", () => {
    const env = readEnv({
      NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
    });
    expect(env.supabaseUrl).toBe("https://x.supabase.co");
    expect(env.supabaseAnonKey).toBe("anon-key");
  });

  it("eksik değişkende anlamlı hata fırlatır", () => {
    expect(() => readEnv({})).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });
});
