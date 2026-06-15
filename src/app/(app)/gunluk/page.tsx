import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DailyForm from "./form";
import { todayInTR } from "@/lib/daily/today";
import { deleteMeal, addMealManual } from "./actions";
import FoodUploader from "./food-uploader";

type LogRow = {
  log_date: string;
  trained: boolean;
  weight_kg: number | null;
  notes: string;
  ai_feedback: { message?: string; tip?: string } | null;
};

type MealRow = {
  id: string;
  name: string;
  calories: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
};

export default async function GunlukPage({
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

  const today = todayInTR();

  const { data: logs } = await supabase
    .from("daily_logs")
    .select("log_date, trained, weight_kg, notes, ai_feedback")
    .eq("user_id", user.id)
    .order("log_date", { ascending: false })
    .limit(8);

  const rows = (logs ?? []) as LogRow[];
  const todayLog = rows.find((r) => r.log_date === today);
  const history = rows.filter((r) => r.log_date !== today);

  const { data: mealsData } = await supabase
    .from("meals")
    .select("id, name, calories, protein_g, fat_g, carbs_g")
    .eq("user_id", user.id)
    .eq("log_date", today)
    .order("created_at", { ascending: true });
  const meals = (mealsData ?? []) as MealRow[];
  const totalKcal = meals.reduce((s, m) => s + Number(m.calories), 0);

  const { data: planRow } = await supabase
    .from("plans")
    .select("targets")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const targetKcal = (planRow?.targets as { calories?: number } | undefined)?.calories;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 p-6">
      <h1 className="text-2xl font-bold">Günlük takip</h1>
      <p className="text-xs text-gray-400">
        ingym bilgilendirme amaçlıdır; tıbbi tavsiye yerine geçmez.
      </p>
      {error && <p className="rounded-lg border border-red-900 bg-red-950 p-3 text-sm text-red-300">{error}</p>}

      <DailyForm
        initial={{
          trained: todayLog?.trained ?? false,
          weightKg: todayLog?.weight_kg != null ? String(todayLog.weight_kg) : "",
          notes: todayLog?.notes ?? "",
        }}
      />

      <section className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold">Bugünün öğünleri</h2>
          <span className="text-sm text-muted">
            {totalKcal} kcal{targetKcal ? ` / ${targetKcal}` : ""}
          </span>
        </div>
        {meals.length === 0 ? (
          <p className="text-sm text-faint">
            Henüz öğün yok. Aşağıdan fotoğraf çekerek ya da elle ekleyebilirsin.
          </p>
        ) : (
          meals.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between gap-2 rounded-xl border border-border bg-surface p-3 text-sm"
            >
              <div>
                <strong className="text-fg">{m.name}</strong>
                <p className="text-faint">
                  ~{Number(m.calories)} kcal · Protein {Number(m.protein_g)}g · Yağ{" "}
                  {Number(m.fat_g)}g · Karb {Number(m.carbs_g)}g
                </p>
              </div>
              <form action={deleteMeal}>
                <input type="hidden" name="id" value={m.id} />
                <button className="text-faint hover:text-red-400" aria-label="Sil">
                  ✕
                </button>
              </form>
            </div>
          ))
        )}
        <div className="flex flex-col gap-2 rounded-xl border border-accent/40 bg-accent/5 p-3">
          <p className="text-sm font-medium text-fg">Fotoğrafla öğün ekle</p>
          <p className="text-xs text-faint">
            En kolay yol: yemeğinin fotoğrafını çek, yaklaşık kalori ve makroları tahmin edip ekleyelim.
          </p>
          <FoodUploader />
        </div>

        <details className="rounded-xl border border-border bg-surface p-3">
          <summary className="cursor-pointer select-none text-sm font-medium text-fg">
            Elle ekle <span className="font-normal text-faint">— kaloriyi biliyorsan</span>
          </summary>
          <form action={addMealManual} className="mt-3 flex flex-col gap-2">
            <input
              name="name"
              placeholder="Öğün adı"
              aria-label="Öğün adı"
              required
              className="rounded-lg border border-border bg-base p-2 text-sm text-fg placeholder:text-faint"
            />
            <div className="grid grid-cols-4 gap-2">
              <label className="flex flex-col gap-1 text-xs text-faint">
                kcal
                <input name="calories" type="number" inputMode="numeric" required aria-label="Kalori (kcal)" placeholder="0"
                  className="rounded-lg border border-border bg-base p-2 text-sm text-fg placeholder:text-faint" />
              </label>
              <label className="flex flex-col gap-1 text-xs text-faint">
                Protein
                <input name="proteinG" type="number" inputMode="numeric" aria-label="Protein (gram)" placeholder="0"
                  className="rounded-lg border border-border bg-base p-2 text-sm text-fg placeholder:text-faint" />
              </label>
              <label className="flex flex-col gap-1 text-xs text-faint">
                Yağ
                <input name="fatG" type="number" inputMode="numeric" aria-label="Yağ (gram)" placeholder="0"
                  className="rounded-lg border border-border bg-base p-2 text-sm text-fg placeholder:text-faint" />
              </label>
              <label className="flex flex-col gap-1 text-xs text-faint">
                Karb
                <input name="carbsG" type="number" inputMode="numeric" aria-label="Karbonhidrat (gram)" placeholder="0"
                  className="rounded-lg border border-border bg-base p-2 text-sm text-fg placeholder:text-faint" />
              </label>
            </div>
            <button className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-fg hover:bg-base">
              Ekle
            </button>
          </form>
        </details>
      </section>

      {todayLog?.ai_feedback?.message && (
        <section className="flex flex-col gap-1 rounded-xl border border-accent/30 bg-accent/10 p-4">
          <h2 className="font-semibold">Bugünün geri bildirimi</h2>
          <p className="text-sm text-muted">{todayLog.ai_feedback.message}</p>
          {todayLog.ai_feedback.tip && (
            <p className="text-sm text-muted">💡 {todayLog.ai_feedback.tip}</p>
          )}
        </section>
      )}

      {history.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-semibold">Geçmiş</h2>
          {history.map((r) => (
            <div key={r.log_date} className="rounded-xl border border-border bg-surface p-3 text-sm text-muted">
              <strong>{r.log_date}</strong> — {r.trained ? "✅ antrenman" : "— antrenman yok"}
              {r.weight_kg != null && ` · ${r.weight_kg} kg`}
              {r.ai_feedback?.message && (
                <p className="mt-1 text-faint">{r.ai_feedback.message}</p>
              )}
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
