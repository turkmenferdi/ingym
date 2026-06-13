import { describe, it, expect } from "vitest";
import { validateDailyLog } from "@/lib/daily/validation";

describe("validateDailyLog", () => {
  it("antrenman ve kilo ile geçerli girdiyi çevirir (virgüllü ondalık)", () => {
    const r = validateDailyLog({ trained: "on", weightKg: "72,3", notes: "iyi gün" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.trained).toBe(true);
      expect(r.data.weightKg).toBe(72.3);
      expect(r.data.notes).toBe("iyi gün");
    }
  });

  it("kilo opsiyoneldir (boşsa null)", () => {
    const r = validateDailyLog({ notes: "" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.trained).toBe(false);
      expect(r.data.weightKg).toBeNull();
      expect(r.data.notes).toBe("");
    }
  });

  it("aralık dışı kilo hata döndürür", () => {
    const r = validateDailyLog({ weightKg: "500" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(" ")).toMatch(/Kilo/);
  });

  it("çok uzun not hata döndürür", () => {
    const r = validateDailyLog({ notes: "x".repeat(2001) });
    expect(r.ok).toBe(false);
  });
});
