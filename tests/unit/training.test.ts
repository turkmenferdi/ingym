import { describe, it, expect } from "vitest";
import { buildSkeleton } from "@/lib/training";

describe("buildSkeleton", () => {
  it("3 gün için 3 günlük split üretir", () => {
    const s = buildSkeleton("beginner", 3);
    expect(s.days).toHaveLength(3);
  });

  it("6 gün için 6 günlük split üretir", () => {
    const s = buildSkeleton("intermediate", 6);
    expect(s.days).toHaveLength(6);
  });

  it("başlangıç seviyesi daha düşük set sayısı verir", () => {
    const beginner = buildSkeleton("beginner", 3);
    const advanced = buildSkeleton("advanced", 3);
    expect(advanced.setsPerExercise).toBeGreaterThan(beginner.setsPerExercise);
  });

  it("her gün bir odak etiketi taşır", () => {
    const s = buildSkeleton("intermediate", 4);
    s.days.forEach((d) => expect(typeof d.focus).toBe("string"));
    expect(s.days[0].focus.length).toBeGreaterThan(0);
  });

  it("gün sayısını 1-7 aralığına sıkıştırır", () => {
    expect(buildSkeleton("beginner", 0).days.length).toBe(1);
    expect(buildSkeleton("beginner", 9).days.length).toBe(7);
  });
});
