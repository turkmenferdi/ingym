import { describe, it, expect } from "vitest";
import { todayInTR } from "@/lib/daily/today";

describe("todayInTR", () => {
  it("UTC gece yarısı sonrası Türkiye'de ertesi gün sayılır", () => {
    // 2026-06-13 23:30 UTC = 2026-06-14 02:30 TR
    expect(todayInTR(new Date("2026-06-13T23:30:00Z"))).toBe("2026-06-14");
  });
  it("öğlen UTC'de aynı gün", () => {
    expect(todayInTR(new Date("2026-06-13T09:00:00Z"))).toBe("2026-06-13");
  });
  it("YYYY-MM-DD formatında döner", () => {
    expect(todayInTR(new Date("2026-01-05T12:00:00Z"))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
