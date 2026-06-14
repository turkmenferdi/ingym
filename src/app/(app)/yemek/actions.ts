"use server";

import { createClient } from "@/lib/supabase/server";
import { GeminiProvider } from "@/lib/ai/gemini";
import type { FoodEstimate } from "@/lib/ai/types";

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
