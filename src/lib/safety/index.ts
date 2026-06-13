export type HealthAnswers = {
  pregnant: boolean;
  heartCondition: boolean;
  diabetes: boolean;
  eatingDisorderHistory: boolean;
};

export type SafetyResult = {
  flags: string[];
  referToDoctor: boolean;
};

const BMI_VERY_LOW = 16;
const BMI_VERY_HIGH = 40;

export function bmi(weightKg: number, heightCm: number): number {
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}

export function screenHealth(
  answers: HealthAnswers,
  weightKg: number,
  heightCm: number
): SafetyResult {
  const flags: string[] = [];
  if (answers.pregnant) flags.push("pregnancy");
  if (answers.heartCondition) flags.push("heart_condition");
  if (answers.diabetes) flags.push("diabetes");
  if (answers.eatingDisorderHistory) flags.push("eating_disorder_history");

  const value = bmi(weightKg, heightCm);
  if (value < BMI_VERY_LOW) flags.push("bmi_very_low");
  if (value > BMI_VERY_HIGH) flags.push("bmi_very_high");

  return { flags, referToDoctor: flags.length > 0 };
}
