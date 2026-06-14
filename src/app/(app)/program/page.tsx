import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { generateProgram } from "./actions";

export default async function ProgramPage({
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
    summary?: string;
    nutrition?: { dailyNote?: string; meals?: { meal: string; idea: string; approxCalories: number }[] };
    workout?: { focus: string; exercises: string[] }[];
  };
  const skeleton = plan?.skeleton as
    | { setsPerExercise: number; repRange: string; days: { focus: string }[] }
    | undefined;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 p-6">
      <h1 className="text-2xl font-bold">Programım</h1>
      {error && <p className="rounded-lg border border-red-900 bg-red-950 p-3 text-sm text-red-300">{error}</p>}

      {!plan ? (
        <>
          <p className="text-muted">
            Henüz bir programın yok. Profilinden sana özel haftalık antrenman +
            beslenme planı oluşturalım.
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
          {content.summary && <p className="text-muted">{content.summary}</p>}

          <section className="flex flex-col gap-1 rounded-xl border border-border bg-surface p-4">
            <h2 className="font-semibold">Günlük hedef</h2>
            <p className="text-sm text-muted">
              {t?.calories} kcal · P {t?.proteinG}g · Y {t?.fatG}g · K {t?.carbsG}g
            </p>
            {content.nutrition?.dailyNote && (
              <p className="text-sm text-muted">{content.nutrition.dailyNote}</p>
            )}
            {content.nutrition?.meals?.map((m, i) => (
              <p key={i} className="text-sm text-muted">
                • <strong>{m.meal}:</strong> {m.idea} (~{m.approxCalories} kcal)
              </p>
            ))}
          </section>

          <section className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
            <h2 className="font-semibold">Haftalık antrenman</h2>
            <p className="text-xs text-faint">
              Her egzersiz {skeleton?.setsPerExercise} set · {skeleton?.repRange} tekrar
            </p>
            {(content.workout && content.workout.length > 0
              ? content.workout
              : skeleton?.days.map((d) => ({ focus: d.focus, exercises: [] })) ?? []
            ).map((d, i) => (
              <div key={i} className="text-sm text-muted">
                <strong>{i + 1}. gün — {d.focus}</strong>
                {d.exercises.length > 0 && (
                  <ul className="ml-4 list-disc">
                    {d.exercises.map((ex, j) => <li key={j}>{ex}</li>)}
                  </ul>
                )}
              </div>
            ))}
          </section>

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
