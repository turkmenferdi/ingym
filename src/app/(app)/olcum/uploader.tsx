"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { downscaleImage } from "@/lib/image";
import { analyzeBody, saveMeasurement, type AnalyzeResult } from "./actions";

export default function BodyUploader() {
  const router = useRouter();
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [applyWeight, setApplyWeight] = useState(true);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult(null);
    setSaved(false);
    setPreview(URL.createObjectURL(file));
    setLoading(true);
    try {
      const blob = await downscaleImage(file);
      const fd = new FormData();
      fd.set("image", blob, "olcum.jpg");
      setResult(await analyzeBody(fd));
    } catch {
      setResult({ ok: false, error: "Fotoğraf işlenemedi, tekrar dene." });
    } finally {
      setLoading(false);
    }
  }

  async function onSave() {
    if (!result || !result.ok) return;
    setSaving(true);
    const fd = new FormData();
    fd.set("weightKg", String(result.reading.weightKg || ""));
    fd.set("bodyFatPct", String(result.reading.bodyFatPct || ""));
    fd.set("muscleMassKg", String(result.reading.muscleMassKg || ""));
    fd.set("summary", result.reading.summary);
    if (applyWeight) fd.set("applyWeight", "on");
    const res = await saveMeasurement(fd);
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      router.refresh();
    }
  }

  const r = result && result.ok ? result.reading : null;

  return (
    <div className="flex flex-col gap-4">
      <label className="rounded-lg bg-accent px-6 py-3 text-center font-semibold text-black hover:bg-accent-hover">
        {loading ? "Okunuyor…" : "Rapor/tartı fotoğrafı çek / yükle"}
        <input type="file" accept="image/*" capture="environment" className="hidden" disabled={loading} onChange={onPick} />
      </label>

      {preview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="Ölçüm" className="w-full rounded-xl border border-border object-cover" />
      )}

      {result && !result.ok && (
        <p className="rounded-lg border border-red-900 bg-red-950 p-3 text-sm text-red-300">{result.error}</p>
      )}

      {r && (
        <section className="flex flex-col gap-2 rounded-xl border border-accent/30 bg-accent/10 p-4">
          <h2 className="font-semibold">Okunan değerler</h2>
          <p className="text-sm text-muted">
            {r.weightKg > 0 && <>Kilo: {r.weightKg} kg</>}
            {r.bodyFatPct > 0 && <> · Yağ: %{r.bodyFatPct}</>}
            {r.muscleMassKg > 0 && <> · Kas: {r.muscleMassKg} kg</>}
            {r.weightKg <= 0 && r.bodyFatPct <= 0 && r.muscleMassKg <= 0 && <>Sayısal değer okunamadı</>}
          </p>
          <p className="text-xs text-faint">{r.summary}</p>

          {r.weightKg > 0 && (
            <label className="flex items-center gap-2 text-sm text-muted">
              <input type="checkbox" checked={applyWeight} onChange={(e) => setApplyWeight(e.target.checked)} />
              Kiloyu profilime uygula ({r.weightKg} kg)
            </label>
          )}

          {saved ? (
            <p className="text-sm font-medium text-accent">✓ Kaydedildi</p>
          ) : (
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="mt-1 rounded-lg border border-border px-4 py-2 text-sm font-medium text-fg hover:bg-surface disabled:opacity-40"
            >
              {saving ? "Kaydediliyor…" : "Kaydet"}
            </button>
          )}
        </section>
      )}
    </div>
  );
}
