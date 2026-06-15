"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GeminiProvider } from "@/lib/ai/gemini";
import type { BodyReading } from "@/lib/ai/types";
import { todayInTR } from "@/lib/daily/today";

export type AnalyzeResult =
  | { ok: true; reading: BodyReading }
  | { ok: false; error: string };

const MAX_BYTES = 6 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

export async function analyzeBody(formData: FormData): Promise<AnalyzeResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Oturum bulunamadı, tekrar giriş yap." };

  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Fotoğraf bulunamadı." };
  if (!ALLOWED.includes(file.type)) return { ok: false, error: "Desteklenmeyen görüntü türü." };
  if (file.size > MAX_BYTES) return { ok: false, error: "Fotoğraf çok büyük (en fazla 6MB)." };

  const imageBase64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  const reading = await new GeminiProvider().readBodyDocument({ imageBase64, mimeType: file.type });
  if (!reading) return { ok: false, error: "Okunamadı, tekrar dene." };
  return { ok: true, reading };
}

export type SaveMeasurementResult = { ok: true } | { ok: false; error: string };

export async function saveMeasurement(formData: FormData): Promise<SaveMeasurementResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Oturum bulunamadı." };

  const numOrNull = (k: string) => {
    const raw = formData.get(k);
    if (raw === null || String(raw).trim() === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const weightKg = numOrNull("weightKg");
  const bodyFatPct = numOrNull("bodyFatPct");
  const muscleMassKg = numOrNull("muscleMassKg");
  const summary = String(formData.get("summary") ?? "").trim().slice(0, 500);

  if (weightKg === null && bodyFatPct === null && muscleMassKg === null) {
    return { ok: false, error: "Kaydedilecek bir değer okunamadı." };
  }

  const { error } = await supabase.from("measurements").insert({
    user_id: user.id,
    measured_date: todayInTR(),
    weight_kg: weightKg,
    body_fat_pct: bodyFatPct,
    muscle_mass_kg: muscleMassKg,
    summary,
  });
  if (error) return { ok: false, error: "Kaydedilemedi: " + error.message };

  if (formData.get("applyWeight") === "on" && weightKg !== null) {
    await supabase
      .from("profiles")
      .update({ weight_kg: weightKg, updated_at: new Date().toISOString() })
      .eq("user_id", user.id);
  }
  return { ok: true };
}

// Elle ölçüm girişi (asıl yol): kullanıcı tartıdaki değeri doğrudan yazar.
// Foto okuma (analyzeBody) opsiyonel kaldı. Sunucu action'ı; başarınca /olcum'a döner.
export async function addMeasurementManual(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return redirect("/login");

  // null = boş bırakıldı (opsiyonel), NaN = girildi ama aralık dışı/geçersiz.
  const numOrNull = (k: string, min: number, max: number) => {
    const raw = formData.get(k);
    if (raw === null || String(raw).trim() === "") return null;
    const n = Number(String(raw).replace(",", "."));
    return Number.isFinite(n) && n >= min && n <= max ? n : NaN;
  };

  const weightKg = numOrNull("weightKg", 20, 400);
  const bodyFatPct = numOrNull("bodyFatPct", 1, 70);
  const muscleMassKg = numOrNull("muscleMassKg", 1, 200);

  if (weightKg === null || Number.isNaN(weightKg)) {
    return redirect("/olcum?error=" + encodeURIComponent("Geçerli bir kilo gir (20-400 kg)."));
  }
  if (Number.isNaN(bodyFatPct) || Number.isNaN(muscleMassKg)) {
    return redirect("/olcum?error=" + encodeURIComponent("Yağ % (1-70) ve kas (1-200 kg) geçerli olmalı."));
  }

  const { error } = await supabase.from("measurements").insert({
    user_id: user.id,
    measured_date: todayInTR(),
    weight_kg: weightKg,
    body_fat_pct: bodyFatPct,
    muscle_mass_kg: muscleMassKg,
    summary: "",
  });
  if (error) {
    return redirect("/olcum?error=" + encodeURIComponent("Kaydedilemedi: " + error.message));
  }

  if (formData.get("applyWeight") === "on") {
    await supabase
      .from("profiles")
      .update({ weight_kg: weightKg, updated_at: new Date().toISOString() })
      .eq("user_id", user.id);
  }
  return redirect("/olcum");
}

export async function deleteMeasurement(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return redirect("/login");
  const id = String(formData.get("id") ?? "");
  if (id) await supabase.from("measurements").delete().eq("id", id).eq("user_id", user.id);
  return redirect("/olcum");
}
