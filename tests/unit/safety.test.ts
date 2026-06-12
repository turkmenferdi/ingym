import { describe, it, expect } from "vitest";
import { bmi, screenHealth } from "@/lib/safety";

const noIssues = {
  pregnant: false,
  heartCondition: false,
  diabetes: false,
  eatingDisorderHistory: false,
};

describe("bmi", () => {
  it("kilo ve boydan BMI hesaplar (1 ondalık)", () => {
    expect(bmi(70, 175)).toBe(22.9);
    expect(bmi(90, 180)).toBe(27.8);
  });
});

describe("screenHealth", () => {
  it("sağlıklı yetişkinde bayrak yok, yönlendirme yok", () => {
    const r = screenHealth(noIssues, 70, 175);
    expect(r.flags).toEqual([]);
    expect(r.referToDoctor).toBe(false);
  });

  it("gebelik bayrağı yönlendirme tetikler", () => {
    const r = screenHealth({ ...noIssues, pregnant: true }, 60, 165);
    expect(r.flags).toContain("pregnancy");
    expect(r.referToDoctor).toBe(true);
  });

  it("çok düşük BMI bayraklanır", () => {
    const r = screenHealth(noIssues, 40, 175); // BMI ~13.1
    expect(r.flags).toContain("bmi_very_low");
    expect(r.referToDoctor).toBe(true);
  });

  it("çok yüksek BMI bayraklanır", () => {
    const r = screenHealth(noIssues, 130, 175); // BMI ~42.4
    expect(r.flags).toContain("bmi_very_high");
    expect(r.referToDoctor).toBe(true);
  });

  it("birden çok durum birden çok bayrak üretir", () => {
    const r = screenHealth({ ...noIssues, diabetes: true, heartCondition: true }, 70, 175);
    expect(r.flags).toEqual(expect.arrayContaining(["diabetes", "heart_condition"]));
    expect(r.flags).toHaveLength(2);
  });
});
