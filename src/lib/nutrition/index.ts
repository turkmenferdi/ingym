export type Gender = "male" | "female" | "other";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";
export type Goal = "lose" | "maintain" | "gain";

export type Targets = {
  bmr: number;
  tdee: number;
  calories: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
};

const ACTIVITY: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

const GOAL_DELTA: Record<Goal, number> = { lose: -500, maintain: 0, gain: 300 };
const MIN_CALORIES = 1200;

export function bmr(gender: Gender, weightKg: number, heightCm: number, age: number): number {
  const baseConst = gender === "male" ? 5 : gender === "female" ? -161 : -78;
  return Math.round(10 * weightKg + 6.25 * heightCm - 5 * age + baseConst);
}

export function computeTargets(input: {
  gender: Gender;
  weightKg: number;
  heightCm: number;
  age: number;
  activityLevel: ActivityLevel;
  goal: Goal;
}): Targets {
  const b = bmr(input.gender, input.weightKg, input.heightCm, input.age);
  const tdee = Math.round(b * ACTIVITY[input.activityLevel]);
  const calories = Math.max(MIN_CALORIES, tdee + GOAL_DELTA[input.goal]);

  const proteinG = Math.round(1.8 * input.weightKg);
  const fatG = Math.round((calories * 0.25) / 9);
  const remaining = calories - (proteinG * 4 + fatG * 9);
  const carbsG = Math.max(0, Math.round(remaining / 4));

  return { bmr: b, tdee, calories, proteinG, fatG, carbsG };
}
