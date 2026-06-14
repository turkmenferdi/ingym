import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BodyUploader from "./uploader";
import { deleteMeasurement } from "./actions";

type MRow = {
  id: string;
  measured_date: string;
  weight_kg: number | null;
  body_fat_pct: number | null;
  muscle_mass_kg: number | null;
};

export default async function OlcumPage() {
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
      <h1 className="text-2xl font-bold">Ölçüm okuma</h1>
      <p className="text-sm text-muted">
        InBody raporu, tahlil veya tartı fotoğrafını çek; değerleri okuyup geçmişine kaydedelim.
      </p>
      <BodyUploader />

      {rows.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-semibold">Geçmiş</h2>
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

      <p className="text-xs text-faint">
        Değerler yapay zekâ foto okumasıdır; cihaz/laboratuvar sonucu esastır.
      </p>
    </main>
  );
}
