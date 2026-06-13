import { describe, it, expect } from "vitest";
import { bmr, computeTargets } from "@/lib/nutrition";

describe("bmr (Mifflin-St Jeor)", () => {
  it("erkek için doğru hesaplar", () => {
    expect(bmr("male", 80, 180, 30)).toBe(1780);
  });
  it("kadın için doğru hesaplar", () => {
    expect(bmr("female", 60, 165, 30)).toBe(1320);
  });
});

describe("computeTargets", () => {
  const base = {
    gender: "male" as const,
    weightKg: 80,
    heightCm: 180,
    age: 30,
    activityLevel: "moderate" as const,
  };

  it("kilo verme hedefinde kalori açığı uygular", () => {
    const t = computeTargets({ ...base, goal: "lose" });
    expect(t.tdee).toBe(2759);
    expect(t.calories).toBe(2259);
  });

  it("kas alma hedefinde kalori fazlası uygular", () => {
    const t = computeTargets({ ...base, goal: "gain" });
    expect(t.calories).toBe(2759 + 300);
  });

  it("koruma hedefinde TDEE'ye eşit", () => {
    const t = computeTargets({ ...base, goal: "maintain" });
    expect(t.calories).toBe(2759);
  });

  it("güvenlik tabanı: kalori asla 1200 altına inmez", () => {
    const t = computeTargets({
      gender: "female", weightKg: 45, heightCm: 150, age: 60,
      activityLevel: "sedentary", goal: "lose",
    });
    expect(t.calories).toBeGreaterThanOrEqual(1200);
  });

  it("makrolar pozitif ve kalori ile tutarlı (±20 kcal)", () => {
    const t = computeTargets({ ...base, goal: "maintain" });
    expect(t.proteinG).toBeGreaterThan(0);
    expect(t.fatG).toBeGreaterThan(0);
    expect(t.carbsG).toBeGreaterThan(0);
    const kcal = t.proteinG * 4 + t.carbsG * 4 + t.fatG * 9;
    expect(Math.abs(kcal - t.calories)).toBeLessThanOrEqual(20);
  });
});
