"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { validateOnboarding } from "@/lib/onboarding/validation";
import { screenHealth } from "@/lib/safety";

export async function saveProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const raw = Object.fromEntries(formData.entries());
  const result = validateOnboarding(raw);
  if (!result.ok) {
    redirect(`/onboarding?error=${encodeURIComponent(result.errors[0])}`);
  }

  const d = result.data;
  const safety = screenHealth(d.health, d.weightKg, d.heightCm);

  const { error } = await supabase.from("profiles").upsert({
    user_id: user.id,
    age: d.age,
    gender: d.gender,
    height_cm: d.heightCm,
    weight_kg: d.weightKg,
    activity_level: d.activityLevel,
    goal: d.goal,
    experience: d.experience,
    days_per_week: d.daysPerWeek,
    health_flags: safety.flags,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    redirect(`/onboarding?error=${encodeURIComponent("Profil kaydedilemedi: " + error.message)}`);
  }

  if (safety.referToDoctor) redirect("/onboarding/saglik-uyarisi");
  redirect("/dashboard");
}
