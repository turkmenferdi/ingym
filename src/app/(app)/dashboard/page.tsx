import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/(auth)/actions";
import { bmi } from "@/lib/safety";

const GOAL_LABELS: Record<string, string> = {
  lose: "Kilo vermek",
  maintain: "Formu korumak",
  gain: "Kas / kilo almak",
};

export default async function DashboardPage() {
  let user = null;
  let profile = null;
  let profileReadFailed = false;
  try {
    const supabase = await createClient();
    const result = await supabase.auth.getUser();
    user = result.data.user;
    if (user) {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) {
        profileReadFailed = true;
      } else {
        profile = data;
      }
    }
  } catch {
    user = null;
  }

  if (!user) redirect("/login");

  if (profileReadFailed) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-6">
        <h1 className="text-2xl font-bold">Bir sorun oluştu</h1>
        <p className="text-gray-600">
          Profilin yüklenemedi. Lütfen sayfayı yenile; sorun sürerse biraz sonra tekrar dene.
        </p>
      </main>
    );
  }

  if (!profile) redirect("/onboarding");

  const hasFlags = Array.isArray(profile.health_flags) && profile.health_flags.length > 0;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 p-6">
      <h1 className="text-2xl font-bold">Merhaba 👋</h1>
      <p className="text-gray-600">{user.email}</p>

      <section className="flex flex-col gap-2 rounded border p-4">
        <h2 className="font-semibold">Profilin</h2>
        <p className="text-sm text-gray-600">
          {profile.age} yaş · {profile.height_cm} cm · {profile.weight_kg} kg ·
          BMI {bmi(Number(profile.weight_kg), Number(profile.height_cm))}
        </p>
        <p className="text-sm text-gray-600">
          Hedef: {GOAL_LABELS[profile.goal] ?? profile.goal} · Haftada{" "}
          {profile.days_per_week} gün antrenman
        </p>
        {hasFlags && (
          <p className="rounded bg-amber-50 p-2 text-sm text-amber-800">
            Sağlık taramasında dikkat gerektiren durum(lar) var; programın
            temkinli hazırlanacak. Bir hekime danışmanı öneririz.
          </p>
        )}
      </section>

      <a href="/program"
        className="rounded bg-black px-6 py-3 text-center font-medium text-white">
        Programıma git
      </a>

      <form action={signOut}>
        <button className="rounded border p-3 font-medium">Çıkış yap</button>
      </form>
    </main>
  );
}
