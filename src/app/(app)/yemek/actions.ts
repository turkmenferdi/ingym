"use server";

import { createClient } from "@/lib/supabase/server";
import { GeminiProvider } from "@/lib/ai/gemini";
import type { FoodEstimate } from "@/lib/ai/types";
import { todayInTR } from "@/lib/daily/today";

export type EstimateResult =
  | { ok: true; estimate: FoodEstimate }
  | { ok: false; error: string };

const MAX_BYTES = 6 * 1024 * 1024; // 6MB güvenlik üst sınırı
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

export async function estimateFood(formData: FormData): Promise<EstimateResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Oturum bulunamadı, tekrar giriş yap." };

  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Fotoğraf bulunamadı." };
  }
  if (!ALLOWED.includes(file.type)) {
    return { ok: false, error: "Desteklenmeyen görüntü türü." };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: "Fotoğraf çok büyük (en fazla 6MB)." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const imageBase64 = buffer.toString("base64");

  const estimate = await new GeminiProvider().estimateFood({
    imageBase64,
    mimeType: file.type,
  });
  if (!estimate) {
    return { ok: false, error: "Tahmin yapılamadı, tekrar dene." };
  }
  return { ok: true, estimate };
}

export type AddMealResult = { ok: true } | { ok: false; error: string };

export async function addMeal(formData: FormData): Promise<AddMealResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Oturum bulunamadı, tekrar giriş yap." };

  const name = String(formData.get("name") ?? "").trim().slice(0, 120);
  if (!name) return { ok: false, error: "Yemek adı yok." };

  const num = (k: string) => {
    const n = Number(formData.get(k));
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };

  const { error } = await supabase.from("meals").insert({
    user_id: user.id,
    log_date: todayInTR(),
    name,
    calories: num("calories"),
    protein_g: num("proteinG"),
    fat_g: num("fatG"),
    carbs_g: num("carbsG"),
  });
  if (error) return { ok: false, error: "Eklenemedi: " + error.message };
  return { ok: true };
}
