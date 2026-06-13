import { describe, it, expect } from "vitest";
import { validateOnboarding } from "@/lib/onboarding/validation";

const valid = {
  age: "30",
  gender: "male",
  heightCm: "175",
  weightKg: "72,5",
  activityLevel: "moderate",
  goal: "lose",
  experience: "beginner",
  daysPerWeek: "3",
  pregnant: null,
  heartCondition: null,
  diabetes: "on",
  eatingDisorderHistory: null,
};

describe("validateOnboarding", () => {
  it("geçerli girdiyi tipli veriye çevirir (virgüllü ondalık dahil)", () => {
    const r = validateOnboarding(valid);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.age).toBe(30);
      expect(r.data.weightKg).toBe(72.5);
      expect(r.data.health.diabetes).toBe(true);
      expect(r.data.health.pregnant).toBe(false);
    }
  });

  it("aralık dışı yaş hata döndürür", () => {
    const r = validateOnboarding({ ...valid, age: "200" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(" ")).toMatch(/Yaş/);
  });

  it("eksik cinsiyet hata döndürür", () => {
    const r = validateOnboarding({ ...valid, gender: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(" ")).toMatch(/Cinsiyet/);
  });

  it("geçersiz haftalık gün hata döndürür", () => {
    const r = validateOnboarding({ ...valid, daysPerWeek: "9" });
    expect(r.ok).toBe(false);
  });
});
