import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BodyUploader from "./uploader";
import { deleteMeasurement, addMeasurementManual } from "./actions";

type MRow = {
  id: string;
  measured_date: string;
  weight_kg: number | null;
  body_fat_pct: number | null;
  muscle_mass_kg: number | null;
};

const inputCls =
  "rounded-lg border border-border bg-base p-2 text-sm text-fg placeholder:text-faint";

export default async function OlcumPage({
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

  const { data } = await supabase
    .from("measurements")
    .select("id, measured_date, weight_kg, body_fat_pct, muscle_mass_kg")
    .eq("user_id", user.id)
    .order("measured_date", { ascending: false })
    .limit(10);
  const rows = (data ?? []) as MRow[];

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 p-6">
      <h1 className="text-2xl font-bold">Ölçümler</h1>
      <p className="text-sm text-muted">
        Tartına çık, değeri buraya yaz. Kilonu (istersen yağ % ve kas kütleni de) kaydet,
        zamanla değişimini aşağıdaki geçmişten takip et.
      </p>
      {error && <p className="rounded-lg border border-red-900 bg-red-950 p-3 text-sm text-red-300">{error}</p>}

      <form action={addMeasurementManual} className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Kilo (kg)
          <input name="weightKg" type="number" inputMode="decimal" step="0.1" required
            placeholder="örn. 72.5" aria-label="Kilo (kg)" className={inputCls} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-xs text-faint">
            Yağ oranı (%) — opsiyonel
            <input name="bodyFatPct" type="number" inputMode="decimal" step="0.1"
              placeholder="örn. 18" aria-label="Yağ oranı yüzde" className={inputCls} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-faint">
            Kas kütlesi (kg) — opsiyonel
            <input name="muscleMassKg" type="number" inputMode="decimal" step="0.1"
              placeholder="örn. 34" aria-label="Kas kütlesi (kg)" className={inputCls} />
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" name="applyWeight" defaultChecked />
          Profilimdeki kiloyu da güncelle
        </label>
        <button className="rounded-lg bg-accent px-6 py-3 font-semibold text-black hover:bg-accent-hover">
          Kaydet
        </button>
      </form>

      <details className="rounded-xl border border-border bg-surface p-3">
        <summary className="cursor-pointer select-none text-sm font-medium text-fg">
          Fotoğraftan oku <span className="font-normal text-faint">— InBody / tahlil / tartı</span>
        </summary>
        <div className="mt-3 flex flex-col gap-3">
          <p className="text-xs text-faint">
            Elle yazmak istemezsen raporun veya tartının fotoğrafını çek; değerleri okuyup forma getirelim.
          </p>
          <BodyUploader />
          <p className="text-xs text-faint">
            Değerler yapay zekâ foto okumasıdır; cihaz/laboratuvar sonucu esastır.
          </p>
        </div>
      </details>

      {rows.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-semibold">Geçmiş ölçümler</h2>
          {rows.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-2 rounded-xl border border-border bg-surface p-3 text-sm">
              <div>
                <strong className="text-fg">{m.measured_date}</strong>
                <p className="text-faint">
                  {m.weight_kg != null && <>{Number(m.weight_kg)} kg</>}
                  {m.body_fat_pct != null && <> · %{Number(m.body_fat_pct)} yağ</>}
                  {m.muscle_mass_kg != null && <> · {Number(m.muscle_mass_kg)} kg kas</>}
                </p>
              </div>
              <form action={deleteMeasurement}>
                <input type="hidden" name="id" value={m.id} />
                <button className="text-faint hover:text-red-400" aria-label="Sil">✕</button>
              </form>
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
