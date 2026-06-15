"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { estimateFood, addMeal, type EstimateResult } from "./food-actions";
import { downscaleImage } from "@/lib/image";

export default function FoodUploader() {
  const router = useRouter();
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EstimateResult | null>(null);
  const [added, setAdded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [edit, setEdit] = useState({ name: "", calories: 0, proteinG: 0, fatG: 0, carbsG: 0 });

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult(null);
    setAdded(false);
    setPreview(URL.createObjectURL(file));
    setLoading(true);
    try {
      const blob = await downscaleImage(file);
      const fd = new FormData();
      fd.set("image", blob, "food.jpg");
      const res = await estimateFood(fd);
      if (res.ok) {
        setEdit({
          name: res.estimate.name,
          calories: res.estimate.calories,
          proteinG: res.estimate.proteinG,
          fatG: res.estimate.fatG,
          carbsG: res.estimate.carbsG,
        });
      }
      setResult(res);
    } catch {
      setResult({ ok: false, error: "Fotoğraf işlenemedi, tekrar dene." });
    } finally {
      setLoading(false);
    }
  }

  function applyPortion(mult: number) {
    if (!result || !result.ok) return;
    const e = result.estimate;
    setEdit({
      name: e.name,
      calories: Math.round(e.calories * mult),
      proteinG: Math.round(e.proteinG * mult),
      fatG: Math.round(e.fatG * mult),
      carbsG: Math.round(e.carbsG * mult),
    });
  }

  async function onAdd() {
    if (!result || !result.ok) return;
    setAdding(true);
    const fd = new FormData();
    fd.set("name", edit.name);
    fd.set("calories", String(edit.calories));
    fd.set("proteinG", String(edit.proteinG));
    fd.set("fatG", String(edit.fatG));
    fd.set("carbsG", String(edit.carbsG));
    const res = await addMeal(fd);
    setAdding(false);
    if (res.ok) {
      setAdded(true);
      // Öğün listesi (server component) yeni öğünü göstersin diye sayfayı tazele.
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="rounded-lg bg-accent px-6 py-3 text-center font-semibold text-black hover:bg-accent-hover">
        {loading ? "Analiz ediliyor…" : "Fotoğraf çek / yükle"}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          disabled={loading}
          onChange={onPick}
        />
      </label>

      {preview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="Yemek" className="w-full rounded-xl border border-border object-cover" />
      )}

      {result && !result.ok && (
        <p className="rounded-lg border border-red-900 bg-red-950 p-3 text-sm text-red-300">
          {result.error}
        </p>
      )}

      {result && result.ok && (
        <section className="flex flex-col gap-1 rounded-xl border border-accent/30 bg-accent/10 p-4">
          <h2 className="font-semibold">Tahmin (düzenleyebilirsin)</h2>
          <label className="flex flex-col gap-1 text-sm text-muted">
            Yemek
            <input
              value={edit.name}
              onChange={(e) => setEdit({ ...edit, name: e.target.value })}
              className="rounded-lg border border-border bg-surface p-2 text-fg"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            {([
              ["calories", "Kalori"],
              ["proteinG", "Protein (g)"],
              ["fatG", "Yağ (g)"],
              ["carbsG", "Karbonhidrat (g)"],
            ] as const).map(([key, label]) => (
              <label key={key} className="flex flex-col gap-1 text-xs text-faint">
                {label}
                <input
                  type="number"
                  inputMode="numeric"
                  value={edit[key]}
                  onChange={(e) => setEdit({ ...edit, [key]: Number(e.target.value) || 0 })}
                  className="rounded-lg border border-border bg-surface p-2 text-sm text-fg"
                />
              </label>
            ))}
          </div>
          <div className="flex gap-2">
            {[0.5, 1, 1.5, 2].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => applyPortion(m)}
                className="flex-1 rounded-lg border border-border py-1 text-xs font-medium text-fg hover:bg-surface"
              >
                {m === 0.5 ? "½×" : m === 1.5 ? "1½×" : `${m}×`}
              </button>
            ))}
          </div>
          <p className="text-xs text-faint">{result.estimate.note}</p>
          {added ? (
            <p className="text-sm font-medium text-accent">✓ Bugüne eklendi</p>
          ) : (
            <button
              type="button"
              onClick={onAdd}
              disabled={adding}
              className="mt-1 rounded-lg border border-border px-4 py-2 text-sm font-medium text-fg hover:bg-surface disabled:opacity-40"
            >
              {adding ? "Ekleniyor…" : "Bugüne ekle"}
            </button>
          )}
        </section>
      )}
    </div>
  );
}
