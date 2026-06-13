"use client";

import { useState } from "react";
import { saveProfile } from "./actions";
import { validateOnboarding } from "@/lib/onboarding/validation";

const STEPS = ["Vücut bilgileri", "Hedef & antrenman", "Sağlık taraması"];

const inputCls = "rounded border p-3";
const labelCls = "flex flex-col gap-1 text-sm font-medium";

export default function OnboardingForm({ error }: { error?: string }) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [v, setV] = useState({
    age: "",
    gender: "",
    heightCm: "",
    weightKg: "",
    activityLevel: "",
    goal: "",
    experience: "",
    daysPerWeek: "",
    pregnant: false,
    heartCondition: false,
    diabetes: false,
    eatingDisorderHistory: false,
  });

  function set<K extends keyof typeof v>(key: K, value: (typeof v)[K]) {
    setV((p) => ({ ...p, [key]: value }));
  }

  const stepValid = [
    Boolean(v.age && v.gender && v.heightCm && v.weightKg),
    Boolean(v.activityLevel && v.goal && v.experience && v.daysPerWeek),
    true,
  ][step];

  async function submit() {
    // Önce client tarafında doğrula: hatalıysa formu GÖNDERME, böylece girilen
    // veriler korunur (sunucuya redirect olup state sıfırlanmaz).
    const raw = {
      age: v.age,
      gender: v.gender,
      heightCm: v.heightCm,
      weightKg: v.weightKg,
      activityLevel: v.activityLevel,
      goal: v.goal,
      experience: v.experience,
      daysPerWeek: v.daysPerWeek,
      pregnant: v.pregnant ? "on" : "",
      heartCondition: v.heartCondition ? "on" : "",
      diabetes: v.diabetes ? "on" : "",
      eatingDisorderHistory: v.eatingDisorderHistory ? "on" : "",
    };
    const check = validateOnboarding(raw);
    if (!check.ok) {
      setErrors(check.errors);
      setStep(0); // hatalı alanlar genelde ilk adımda; kullanıcıyı oraya getir
      return;
    }

    setErrors([]);
    setSaving(true);
    const fd = new FormData();
    fd.set("age", v.age);
    fd.set("gender", v.gender);
    fd.set("heightCm", v.heightCm);
    fd.set("weightKg", v.weightKg);
    fd.set("activityLevel", v.activityLevel);
    fd.set("goal", v.goal);
    fd.set("experience", v.experience);
    fd.set("daysPerWeek", v.daysPerWeek);
    if (v.pregnant) fd.set("pregnant", "on");
    if (v.heartCondition) fd.set("heartCondition", "on");
    if (v.diabetes) fd.set("diabetes", "on");
    if (v.eatingDisorderHistory) fd.set("eatingDisorderHistory", "on");
    await saveProfile(fd);
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-gray-400">
        Adım {step + 1}/{STEPS.length} — {STEPS[step]}
      </p>
      {error && <p className="rounded bg-red-100 p-2 text-sm text-red-700">{error}</p>}
      {errors.length > 0 && (
        <ul className="flex flex-col gap-1 rounded bg-red-100 p-3 text-sm text-red-700">
          {errors.map((e, i) => (
            <li key={i}>• {e}</li>
          ))}
        </ul>
      )}

      {step === 0 && (
        <div className="flex flex-col gap-3">
          <label className={labelCls}>
            Yaş
            <input className={inputCls} type="number" inputMode="numeric"
              value={v.age} onChange={(e) => set("age", e.target.value)} />
          </label>
          <label className={labelCls}>
            Cinsiyet
            <select className={inputCls} value={v.gender}
              onChange={(e) => set("gender", e.target.value)}>
              <option value="">Seçiniz</option>
              <option value="male">Erkek</option>
              <option value="female">Kadın</option>
              <option value="other">Diğer</option>
            </select>
          </label>
          <label className={labelCls}>
            Boy (cm)
            <input className={inputCls} type="number" inputMode="decimal"
              value={v.heightCm} onChange={(e) => set("heightCm", e.target.value)} />
          </label>
          <label className={labelCls}>
            Kilo (kg)
            <input className={inputCls} type="number" inputMode="decimal" step="0.1"
              value={v.weightKg} onChange={(e) => set("weightKg", e.target.value)} />
          </label>
        </div>
      )}

      {step === 1 && (
        <div className="flex flex-col gap-3">
          <label className={labelCls}>
            Günlük aktivite seviyesi
            <select className={inputCls} value={v.activityLevel}
              onChange={(e) => set("activityLevel", e.target.value)}>
              <option value="">Seçiniz</option>
              <option value="sedentary">Masa başı (hareketsiz)</option>
              <option value="light">Hafif hareketli</option>
              <option value="moderate">Orta (haftada birkaç yürüyüş)</option>
              <option value="active">Aktif</option>
              <option value="very_active">Çok aktif (fiziksel iş)</option>
            </select>
          </label>
          <label className={labelCls}>
            Hedefin
            <select className={inputCls} value={v.goal}
              onChange={(e) => set("goal", e.target.value)}>
              <option value="">Seçiniz</option>
              <option value="lose">Kilo vermek</option>
              <option value="maintain">Formumu korumak</option>
              <option value="gain">Kas / kilo almak</option>
            </select>
          </label>
          <label className={labelCls}>
            Antrenman tecrübesi
            <select className={inputCls} value={v.experience}
              onChange={(e) => set("experience", e.target.value)}>
              <option value="">Seçiniz</option>
              <option value="beginner">Yeni başlıyorum</option>
              <option value="intermediate">Ara sıra yapıyorum</option>
              <option value="advanced">Düzenli yapıyorum</option>
            </select>
          </label>
          <label className={labelCls}>
            Haftada kaç gün antrenman?
            <select className={inputCls} value={v.daysPerWeek}
              onChange={(e) => set("daysPerWeek", e.target.value)}>
              <option value="">Seçiniz</option>
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <option key={n} value={String(n)}>{n} gün</option>
              ))}
            </select>
          </label>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-gray-600">
            Aşağıdakilerden sana uyan varsa işaretle. Bu bilgiler programını
            güvenli hale getirmek için kullanılır.
          </p>
          {(
            [
              ["pregnant", "Gebelik / yeni doğum"],
              ["heartCondition", "Kalp rahatsızlığı"],
              ["diabetes", "Diyabet"],
              ["eatingDisorderHistory", "Yeme bozukluğu geçmişi"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-3 rounded border p-3 text-sm">
              <input type="checkbox" checked={v[key]}
                onChange={(e) => set(key, e.target.checked)} />
              {label}
            </label>
          ))}
        </div>
      )}

      <div className="flex gap-3">
        {step > 0 && (
          <button type="button" className="rounded border p-3 font-medium"
            onClick={() => setStep(step - 1)}>
            Geri
          </button>
        )}
        {step < STEPS.length - 1 ? (
          <button type="button" disabled={!stepValid}
            className="flex-1 rounded bg-black p-3 font-medium text-white disabled:opacity-40"
            onClick={() => setStep(step + 1)}>
            Devam
          </button>
        ) : (
          <button type="button" disabled={saving}
            className="flex-1 rounded bg-black p-3 font-medium text-white disabled:opacity-40"
            onClick={submit}>
            {saving ? "Kaydediliyor…" : "Profili oluştur"}
          </button>
        )}
      </div>
    </div>
  );
}
