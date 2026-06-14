import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DailyForm from "./form";
import { todayInTR } from "@/lib/daily/today";

type LogRow = {
  log_date: string;
  trained: boolean;
  weight_kg: number | null;
  notes: string;
  ai_feedback: { message?: string; tip?: string } | null;
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
