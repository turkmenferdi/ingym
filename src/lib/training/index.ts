export type Experience = "beginner" | "intermediate" | "advanced";

export type TrainingDay = { focus: string };
export type Skeleton = {
  daysPerWeek: number;
  setsPerExercise: number;
  repRange: string;
  days: TrainingDay[];
};

const SPLITS: Record<number, string[]> = {
  1: ["Tüm vücut"],
  2: ["Tüm vücut A", "Tüm vücut B"],
  3: ["İtiş (göğüs/omuz/triceps)", "Çekiş (sırt/biceps)", "Bacak"],
  4: ["Üst vücut", "Alt vücut", "Üst vücut", "Alt vücut"],
  5: ["İtiş", "Çekiş", "Bacak", "Üst vücut", "Alt vücut"],
  6: ["İtiş", "Çekiş", "Bacak", "İtiş", "Çekiş", "Bacak"],
  7: ["İtiş", "Çekiş", "Bacak", "İtiş", "Çekiş", "Bacak", "Aktif dinlenme/kardiyo"],
};

const SETS: Record<Experience, number> = { beginner: 3, intermediate: 4, advanced: 5 };

function clampDays(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.min(7, Math.max(1, Math.round(n)));
}

export function buildSkeleton(experience: Experience, daysPerWeek: number): Skeleton {
  const d = clampDays(daysPerWeek);
  return {
    daysPerWeek: d,
    setsPerExercise: SETS[experience],
    repRange: experience === "advanced" ? "6-12" : "8-12",
    days: SPLITS[d].map((focus) => ({ focus })),
  };
}
