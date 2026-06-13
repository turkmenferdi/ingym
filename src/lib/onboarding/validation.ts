export const GENDERS = ["male", "female", "other"] as const;
export const ACTIVITY_LEVELS = ["sedentary", "light", "moderate", "active", "very_active"] as const;
export const GOALS = ["lose", "maintain", "gain"] as const;
export const EXPERIENCES = ["beginner", "intermediate", "advanced"] as const;

export type OnboardingData = {
  age: number;
  gender: (typeof GENDERS)[number];
  heightCm: number;
  weightKg: number;
  activityLevel: (typeof ACTIVITY_LEVELS)[number];
  goal: (typeof GOALS)[number];
  experience: (typeof EXPERIENCES)[number];
  daysPerWeek: number;
  health: {
    pregnant: boolean;
    heartCondition: boolean;
    diabetes: boolean;
    eatingDisorderHistory: boolean;
  };
};

export type ValidationResult =
  | { ok: true; data: OnboardingData }
  | { ok: false; errors: string[] };

function toNumber(x: unknown): number | null {
  if (typeof x !== "string" || x.trim() === "") return null;
  const n = Number(x.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function oneOf<T extends readonly string[]>(x: unknown, list: T): T[number] | null {
  return typeof x === "string" && (list as readonly string[]).includes(x)
    ? (x as T[number])
    : null;
}

export function validateOnboarding(input: Record<string, unknown>): ValidationResult {
  const errors: string[] = [];

  const age = toNumber(input.age);
  if (age === null || !Number.isInteger(age) || age < 13 || age > 100)
    errors.push("Yaş 13-100 arasında tam sayı olmalı.");

  const gender = oneOf(input.gender, GENDERS);
  if (!gender) errors.push("Cinsiyet seçimi gerekli.");

  const heightCm = toNumber(input.heightCm);
  if (heightCm === null || heightCm < 100 || heightCm > 250)
    errors.push("Boy 100-250 cm arasında olmalı.");

  const weightKg = toNumber(input.weightKg);
  if (weightKg === null || weightKg < 30 || weightKg > 300)
    errors.push("Kilo 30-300 kg arasında olmalı.");

  const activityLevel = oneOf(input.activityLevel, ACTIVITY_LEVELS);
  if (!activityLevel) errors.push("Aktivite seviyesi seçimi gerekli.");

  const goal = oneOf(input.goal, GOALS);
  if (!goal) errors.push("Hedef seçimi gerekli.");

  const experience = oneOf(input.experience, EXPERIENCES);
  if (!experience) errors.push("Antrenman tecrübesi seçimi gerekli.");

  const daysPerWeek = toNumber(input.daysPerWeek);
  if (daysPerWeek === null || !Number.isInteger(daysPerWeek) || daysPerWeek < 1 || daysPerWeek > 7)
    errors.push("Haftalık antrenman günü 1-7 arasında olmalı.");

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    data: {
      age: age!,
      gender: gender!,
      heightCm: heightCm!,
      weightKg: weightKg!,
      activityLevel: activityLevel!,
      goal: goal!,
      experience: experience!,
      daysPerWeek: daysPerWeek!,
      health: {
        pregnant: input.pregnant === "on",
        heartCondition: input.heartCondition === "on",
        diabetes: input.diabetes === "on",
        eatingDisorderHistory: input.eatingDisorderHistory === "on",
      },
    },
  };
}
