"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { computeTargets } from "@/lib/nutrition";
import { buildSkeleton } from "@/lib/training";
import { GeminiProvider } from "@/lib/ai/gemini";

// Tek "program" = antrenman + beslenme birlikte üretilir ve tek plan satırına
// yazılır. Görüntüleme /antrenman ve /diyet diye ikiye ayrıldı, ama üretim ortak;
// bu yüzden iki sayfa da bu action'ı çağırır. Üretim sonrası /antrenman'a döner.
export async function generateProgram() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile, error: pErr } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  if (pErr) redirect("/antrenman?error=" + encodeURIComponent("Profil okunamadı, tekrar dene."));
  if (!profile) redirect("/onboarding");

  const cautious =
    Array.isArray(profile.health_flags) && profile.health_flags.length > 0;

  const targets = computeTargets({
    gender: profile.gender,
    weightKg: Number(profile.weight_kg),
    heightCm: Number(profile.height_cm),
    age: profile.age,
    activityLevel: profile.activity_level,
    goal: profile.goal,
  });
  const skeleton = buildSkeleton(profile.experience, profile.days_per_week);

  const content =
    (await new GeminiProvider().generatePlanContent({
      targets,
      skeleton,
      profile: { goal: profile.goal, experience: profile.experience, cautious },
    })) ?? {};

  const { data: inserted, error } = await supabase
    .from("plans")
    .insert({
      user_id: user.id,
      status: "active",
      targets,
      skeleton,
      content,
    })
    .select("id")
    .single();
  if (error || !inserted) {
    redirect(
      "/antrenman?error=" +
        encodeURIComponent("Plan kaydedilemedi: " + (error?.message ?? ""))
    );
  }

  // Yeni plan kaydedildi; önceki aktif planları arşivle (sıfır-aktif-plan penceresi olmaz).
  await supabase
    .from("plans")
    .update({ status: "archived" })
    .eq("user_id", user.id)
    .eq("status", "active")
    .neq("id", inserted.id);

  redirect("/antrenman");
}
