import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/(auth)/actions";
import { bmi } from "@/lib/safety";
import { todayInTR } from "@/lib/daily/today";
import PushButton from "@/app/(app)/_components/PushButton";

const GOAL_LABELS: Record<string, string> = {
  lose: "Kilo vermek",
  maintain: "Formu korumak",
  gain: "Kas / kilo almak",
};

export default async function DashboardPage() {
  let user = null;
  let profile = null;
  let profileReadFailed = false;
  // eslint-disable-next-line prefer-const
  let supabase: Awaited<ReturnType<typeof createClient>> | null = null;
  try {
    supabase = await createClient();
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
        <p className="text-muted">
          Profilin yüklenemedi. Lütfen sayfayı yenile; sorun sürerse biraz sonra tekrar dene.
        </p>
      </main>
    );
  }

  if (!profile) redirect("/onboarding");

  const today = todayInTR();
  const { data: todayLog } = await supabase!
    .from("daily_logs")
    .select("id")
    .eq("user_id", user!.id)
    .eq("log_date", today)
    .maybeSingle();
  const { count: mealCount } = await supabase!
    .from("meals")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user!.id)
    .eq("log_date", today);
  const loggedToday = !!todayLog;
  const hasMeals = (mealCount ?? 0) > 0;

  const hasFlags = Array.isArray(profile.health_flags) && profile.health_flags.length > 0;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 p-6">
      <h1 className="text-2xl font-bold">Merhaba 👋</h1>
      <p className="text-muted">{user.email}</p>

      <section className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
        <h2 className="font-semibold">Bugün</h2>
        {loggedToday && hasMeals ? (
          <p className="text-sm text-accent">Bugünü tamamladın 💪 Günlük ve öğünlerin girildi.</p>
        ) : (
          <>
            {!loggedToday && (
              <a
                href="/gunluk"
                className="flex items-center justify-between gap-2 rounded-lg border border-border bg-base p-3 text-sm text-fg hover:bg-surface"
              >
                <span>Bugünkü gününü henüz loglamadın</span>
                <span className="text-accent">Günlüğe git →</span>
              </a>
            )}
            {!hasMeals && (
              <a
                href="/yemek"
                className="flex items-center justify-between gap-2 rounded-lg border border-border bg-base p-3 text-sm text-fg hover:bg-surface"
              >
                <span>Bugün öğün eklemedin</span>
                <span className="text-accent">Yemek ekle →</span>
              </a>
            )}
          </>
        )}
        <PushButton />
      </section>

      <section className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
        <h2 className="font-semibold">Profilin</h2>
        <p className="text-sm text-muted">
          {profile.age} yaş · {profile.height_cm} cm · {profile.weight_kg} kg ·
          BMI {bmi(Number(profile.weight_kg), Number(profile.height_cm))}
        </p>
        <p className="text-sm text-muted">
          Hedef: {GOAL_LABELS[profile.goal] ?? profile.goal} · Haftada{" "}
          {profile.days_per_week} gün antrenman
        </p>
        {hasFlags && (
          <p className="rounded-lg bg-amber-950/40 p-2 text-sm text-amber-300">
            Sağlık taramasında dikkat gerektiren durum(lar) var; programın
            temkinli hazırlanacak. Bir hekime danışmanı öneririz.
          </p>
        )}
      </section>

      <div className="grid grid-cols-2 gap-3">
        <a href="/antrenman"
          className="rounded-lg bg-accent px-6 py-3 text-center font-semibold text-black hover:bg-accent-hover">
          Antrenmanım
        </a>
        <a href="/diyet"
          className="rounded-lg bg-accent px-6 py-3 text-center font-semibold text-black hover:bg-accent-hover">
          Diyetim
        </a>
      </div>
      <a href="/gunluk"
        className="rounded-lg border border-border px-6 py-3 text-center font-medium text-fg hover:bg-surface">
        Günlük takip
      </a>

      <form action={signOut}>
        <button className="rounded-lg border border-border p-3 font-medium text-fg hover:bg-surface">Çıkış yap</button>
      </form>
    </main>
  );
}
