export type DailyLogData = {
  trained: boolean;
  weightKg: number | null;
  notes: string;
};

export type DailyValidationResult =
  | { ok: true; data: DailyLogData }
  | { ok: false; errors: string[] };

const MAX_NOTES = 2000;

function toNumberOrNull(x: unknown): number | null | undefined {
  if (typeof x !== "string" || x.trim() === "") return null;
  const n = Number(x.replace(",", "."));
  return Number.isFinite(n) ? n : undefined; // undefined = geçersiz
}

export function validateDailyLog(input: Record<string, unknown>): DailyValidationResult {
  const errors: string[] = [];

  const trained = input.trained === "on";

  const weight = toNumberOrNull(input.weightKg);
  let weightKg: number | null = null;
  if (weight === undefined) {
    errors.push("Kilo geçerli bir sayı olmalı.");
  } else if (weight !== null && (weight < 30 || weight > 300)) {
    errors.push("Kilo 30-300 kg arasında olmalı.");
  } else {
    weightKg = weight;
  }

  const notes = typeof input.notes === "string" ? input.notes.trim() : "";
  if (notes.length > MAX_NOTES) errors.push("Not çok uzun (en fazla 2000 karakter).");

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, data: { trained, weightKg, notes } };
}
