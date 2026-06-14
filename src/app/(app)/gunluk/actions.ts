"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { validateDailyLog } from "@/lib/daily/validation";
import { GeminiProvider } from "@/lib/ai/gemini";
import { todayInTR } from "@/lib/daily/today";

export async function saveDailyLog(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return redirect("/login");

  const result = validateDailyLog(Object.fromEntries(formData.entries()));
  if (!result.ok) {
    return redirect("/gunluk?error=" + encodeURIComponent(result.errors[0]));
  }
  const d = result.data;

  const { data: plan } = await supabase
    .from("plans")
    .select("targets")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: profile } = await supabase
    .from("profiles")
    .select("goal")
    .eq("user_id", user.id)
    .maybeSingle();

  const targets = plan?.targets as { calories?: number } | undefined;
  const feedback =
    (await new GeminiProvider().generateDailyFeedback({
      goal: profile?.goal ?? "maintain",
      calories: targets?.calories ?? 0,
      trained: d.trained,
      weightKg: d.weightKg,
      notes: d.notes,
    })) ?? {};

  const today = todayInTR();

  const { error } = await supabase.from("daily_logs").upsert(
    {
      user_id: user.id,
      log_date: today,
      trained: d.trained,
      weight_kg: d.weightKg,
      notes: d.notes,
      ai_feedback: feedback,
    },
    { onConflict: "user_id,log_date" }
  );
  if (error) {
    return redirect("/gunluk?error=" + encodeURIComponent("Kayıt başarısız: " + error.message));
  }

  return redirect("/gunluk");
}

export async function deleteMeal(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return redirect("/login");

  const id = String(formData.get("id") ?? "");
  if (id) {
    await supabase.from("meals").delete().eq("id", id).eq("user_id", user.id);
  }
  return redirect("/gunluk");
}

export async function addMealManual(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return redirect("/login");

  const name = String(formData.get("name") ?? "").trim().slice(0, 120);
  const num = (k: string) => {
    const n = Number(String(formData.get(k) ?? "").replace(",", "."));
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };
  if (!name || num("calories") <= 0) {
    return redirect("/gunluk?error=" + encodeURIComponent("Öğün adı ve kalori gerekli."));
  }

  await supabase.from("meals").insert({
    user_id: user.id,
    log_date: todayInTR(),
    name,
    calories: num("calories"),
    protein_g: num("proteinG"),
    fat_g: num("fatG"),
    carbs_g: num("carbsG"),
  });
  return redirect("/gunluk");
}
