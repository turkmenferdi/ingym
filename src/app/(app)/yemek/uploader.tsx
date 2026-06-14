"use client";

import { useState } from "react";
import { estimateFood, type EstimateResult } from "./actions";

// Görüntüyü tarayıcıda küçült (server action body limitine takılmamak + hız).
async function downscale(file: File, max = 1024, quality = 0.7): Promise<Blob> {
  const dataUrl: string = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = dataUrl;
  });
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas yok");
  ctx.drawImage(img, 0, 0, w, h);
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("blob yok"))), "image/jpeg", quality)
  );
}

export default function FoodUploader() {
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EstimateResult | null>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult(null);
    setPreview(URL.createObjectURL(file));
    setLoading(true);
    try {
      const blob = await downscale(file);
      const fd = new FormData();
      fd.set("image", blob, "food.jpg");
      setResult(await estimateFood(fd));
    } catch {
      setResult({ ok: false, error: "Fotoğraf işlenemedi, tekrar dene." });
    } finally {
      setLoading(false);
    }
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
        </section>
      )}
    </div>
  );
}
