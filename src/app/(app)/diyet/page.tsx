import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { generateProgram } from "../antrenman/actions";

export default async function DiyetPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: plan } = await supabase
    .from("plans")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const t = plan?.targets as
    | { calories: number; proteinG: number; fatG: number; carbsG: number }
    | undefined;
  const content = (plan?.content ?? {}) as {
    nutrition?: { dailyNote?: string; meals?: { meal: string; idea: string; approxCalories: number }[] };
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 p-6">
      <h1 className="text-2xl font-bold">Diyet</h1>
      {error && <p className="rounded-lg border border-red-900 bg-red-950 p-3 text-sm text-red-300">{error}</p>}

      {!plan ? (
        <>
          <p className="text-muted">
            Henüz beslenme planın yok. Profiline göre günlük kalori hedefin ve öğün
            fikirleri oluşturalım.
          </p>
          <form action={generateProgram}>
            <button className="rounded-lg bg-accent px-6 py-3 font-semibold text-black hover:bg-accent-hover disabled:opacity-40">
              Programımı oluştur
            </button>
          </form>
        </>
      ) : (
        <>
          <p className="text-xs text-faint">
            Bu plan bilgilendirme amaçlıdır; tıbbi tavsiye yerine geçmez.
          </p>

          <section className="flex flex-col gap-1 rounded-xl border border-border bg-surface p-4">
            <h2 className="font-semibold">Günlük hedef</h2>
            <p className="text-sm text-muted">
              {t?.calories} kcal · {t?.proteinG}g protein · {t?.fatG}g yağ · {t?.carbsG}g karbonhidrat
            </p>
            {content.nutrition?.dailyNote && (
              <p className="text-sm text-muted">{content.nutrition.dailyNote}</p>
            )}
          </section>

          {content.nutrition?.meals && content.nutrition.meals.length > 0 && (
            <section className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
              <h2 className="font-semibold">Öğün fikirleri</h2>
              {content.nutrition.meals.map((m, i) => (
                <p key={i} className="text-sm text-muted">
                  • <strong>{m.meal}:</strong> {m.idea} (~{m.approxCalories} kcal)
                </p>
              ))}
            </section>
          )}

          <form action={generateProgram}>
            <button className="rounded-lg border border-border px-6 py-3 font-medium text-fg hover:bg-surface">
              Yeniden oluştur
            </button>
          </form>
        </>
      )}
    </main>
  );
}
