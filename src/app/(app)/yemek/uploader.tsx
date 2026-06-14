"use client";

import { useState } from "react";
import { estimateFood, addMeal, type EstimateResult } from "./actions";
import { downscaleImage } from "@/lib/image";

export default function FoodUploader() {
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EstimateResult | null>(null);
  const [added, setAdded] = useState(false);
  const [adding, setAdding] = useState(false);

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
      setResult(await estimateFood(fd));
    } catch {
      setResult({ ok: false, error: "Fotoğraf işlenemedi, tekrar dene." });
    } finally {
      setLoading(false);
    }
  }

  async function onAdd() {
    if (!result || !result.ok) return;
    setAdding(true);
    const fd = new FormData();
    fd.set("name", result.estimate.name);
    fd.set("calories", String(result.estimate.calories));
    fd.set("proteinG", String(result.estimate.proteinG));
    fd.set("fatG", String(result.estimate.fatG));
    fd.set("carbsG", String(result.estimate.carbsG));
    const res = await addMeal(fd);
    setAdding(false);
    if (res.ok) setAdded(true);
  }

  return (
    <div className="flex flex-col gap-4">
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
          <h2 className="font-semibold">{result.estimate.name}</h2>
          <p className="text-sm text-muted">
            ~{result.estimate.calories} kcal · P {result.estimate.proteinG}g · Y{" "}
            {result.estimate.fatG}g · K {result.estimate.carbsG}g
          </p>
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
