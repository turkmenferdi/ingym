"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { computeTargets } from "@/lib/nutrition";
import { buildSkeleton } from "@/lib/training";
import { GeminiProvider } from "@/lib/ai/gemini";

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
  if (pErr) redirect("/program?error=" + encodeURIComponent("Profil okunamadı, tekrar dene."));
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

  await supabase
    .from("plans")
    .update({ status: "archived" })
    .eq("user_id", user.id)
    .eq("status", "active");

  const { error } = await supabase.from("plans").insert({
    user_id: user.id,
    status: "active",
    targets,
    skeleton,
    content,
  });
  if (error) {
    redirect("/program?error=" + encodeURIComponent("Plan kaydedilemedi: " + error.message));
  }

  redirect("/program");
}
