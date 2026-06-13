# ingym — Plan 2: Onboarding Anketi (A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Giriş yapan kullanıcının çok adımlı anketle profil oluşturması: vücut bilgileri + hedef/antrenman + sağlık taraması → `profiles` tablosuna kayıt; kırmızı bayrak varsa hekime yönlendirme ekranı; dashboard profil yoksa onboarding'e yönlendirir.

**Architecture:** Saf mantık `src/lib/safety` (kırmızı bayrak + BMI) ve `src/lib/onboarding/validation` (form doğrulama) modüllerinde — birim testli, AI/DB'den bağımsız. Veri Supabase `profiles` tablosunda, RLS ile kullanıcı yalnız kendi satırını görür/yazar. UI: server page + client stepper form + server action.

**Tech Stack:** Mevcut temel (Next.js 16, TS, Tailwind, Supabase, Vitest, Playwright). Yeni bağımlılık YOK.

---

## Dosya Yapısı (bu planın sonunda eklenmiş/değişmiş olacak)

```
ingym/
├── supabase/
│   └── migrations/
│       └── 0001_profiles.sql            # profiles tablosu + RLS (yeni)
├── src/
│   ├── lib/
│   │   ├── safety/index.ts              # bmi() + screenHealth() — saf, test edilir (yeni)
│   │   └── onboarding/validation.ts     # validateOnboarding() — saf, test edilir (yeni)
│   ├── app/(app)/
│   │   ├── onboarding/
│   │   │   ├── page.tsx                 # server sayfa (error param) (yeni)
│   │   │   ├── form.tsx                 # client 3-adımlı sihirbaz (yeni)
│   │   │   ├── actions.ts               # saveProfile server action (yeni)
│   │   │   └── saglik-uyarisi/page.tsx  # kırmızı bayrak yönlendirme ekranı (yeni)
│   │   └── dashboard/page.tsx           # profil yoksa /onboarding'e yönlendir (değişir)
│   └── proxy.ts                         # PROTECTED_PREFIXES += "/onboarding" (değişir)
├── tests/unit/
│   ├── safety.test.ts                   # (yeni)
│   └── onboarding-validation.test.ts    # (yeni)
└── e2e/auth-guard.spec.ts               # oturumsuz koruma testi (yeni)
```

**Supabase bilgileri (uygulama sırasında gerekli):**
- Proje ref: `lxkhmmdfzqzgwuuafmko` · URL: `https://lxkhmmdfzqzgwuuafmko.supabase.co`
- Migration, Management API ile uygulanır; `SUPABASE_ACCESS_TOKEN` controller tarafından sağlanır. Token geçersizse (revoke edilmişse) SQL, kullanıcının Supabase Dashboard → SQL Editor'a yapıştırması için raporlanır.

---

### Task 1: `profiles` tablosu migration'ı (SQL + uygula + doğrula)

**Files:**
- Create: `supabase/migrations/0001_profiles.sql`

- [ ] **Step 1: Migration dosyasını oluştur**

Create `supabase/migrations/0001_profiles.sql`:
```sql
-- ingym: kullanıcı profilleri (onboarding çıktısı)
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  age int not null check (age between 13 and 100),
  gender text not null check (gender in ('male','female','other')),
  height_cm numeric not null check (height_cm between 100 and 250),
  weight_kg numeric not null check (weight_kg between 30 and 300),
  activity_level text not null check (activity_level in ('sedentary','light','moderate','active','very_active')),
  goal text not null check (goal in ('lose','maintain','gain')),
  experience text not null check (experience in ('beginner','intermediate','advanced')),
  days_per_week int not null check (days_per_week between 1 and 7),
  health_flags jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "own profile select" on public.profiles;
create policy "own profile select" on public.profiles
  for select using (auth.uid() = user_id);

drop policy if exists "own profile insert" on public.profiles;
create policy "own profile insert" on public.profiles
  for insert with check (auth.uid() = user_id);

drop policy if exists "own profile update" on public.profiles;
create policy "own profile update" on public.profiles
  for update using (auth.uid() = user_id);
```

- [ ] **Step 2: Migration'ı Management API ile uygula**

Run (Bash; `SUPABASE_ACCESS_TOKEN` env'i controller sağlar):
```bash
node -e "const fs=require('fs');fs.writeFileSync('/tmp/q.json',JSON.stringify({query:fs.readFileSync('supabase/migrations/0001_profiles.sql','utf8')}))"
curl -s -X POST "https://api.supabase.com/v1/projects/lxkhmmdfzqzgwuuafmko/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" -d @/tmp/q.json
```
Expected: `[]` veya boş başarı yanıtı (hata objesi YOK). 401 dönerse token iptal edilmiş demektir → DONE_WITH_CONCERNS raporla ve SQL'in Dashboard → SQL Editor'da çalıştırılması gerektiğini belirt.

- [ ] **Step 3: Tablonun oluştuğunu doğrula**

Run:
```bash
node -e "require('fs').writeFileSync('/tmp/q.json',JSON.stringify({query:\"select tablename from pg_tables where schemaname='public' and tablename='profiles'\"}))"
curl -s -X POST "https://api.supabase.com/v1/projects/lxkhmmdfzqzgwuuafmko/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" -d @/tmp/q.json
```
Expected: `[{"tablename":"profiles"}]`

- [ ] **Step 4: Commit**

```bash
git add supabase/ && git commit -m "feat: add profiles table migration with RLS"
```

---

### Task 2: `lib/safety` — kırmızı bayrak taraması (TDD)

**Files:**
- Create: `src/lib/safety/index.ts`
- Test: `tests/unit/safety.test.ts`

- [ ] **Step 1: Failing test yaz**

Create `tests/unit/safety.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { bmi, screenHealth } from "@/lib/safety";

const noIssues = {
  pregnant: false,
  heartCondition: false,
  diabetes: false,
  eatingDisorderHistory: false,
};

describe("bmi", () => {
  it("kilo ve boydan BMI hesaplar (1 ondalık)", () => {
    expect(bmi(70, 175)).toBe(22.9);
    expect(bmi(90, 180)).toBe(27.8);
  });
});

describe("screenHealth", () => {
  it("sağlıklı yetişkinde bayrak yok, yönlendirme yok", () => {
    const r = screenHealth(noIssues, 70, 175);
    expect(r.flags).toEqual([]);
    expect(r.referToDoctor).toBe(false);
  });

  it("gebelik bayrağı yönlendirme tetikler", () => {
    const r = screenHealth({ ...noIssues, pregnant: true }, 60, 165);
    expect(r.flags).toContain("pregnancy");
    expect(r.referToDoctor).toBe(true);
  });

  it("çok düşük BMI bayraklanır", () => {
    const r = screenHealth(noIssues, 40, 175); // BMI ~13.1
    expect(r.flags).toContain("bmi_very_low");
    expect(r.referToDoctor).toBe(true);
  });

  it("çok yüksek BMI bayraklanır", () => {
    const r = screenHealth(noIssues, 130, 175); // BMI ~42.4
    expect(r.flags).toContain("bmi_very_high");
    expect(r.referToDoctor).toBe(true);
  });

  it("birden çok durum birden çok bayrak üretir", () => {
    const r = screenHealth({ ...noIssues, diabetes: true, heartCondition: true }, 70, 175);
    expect(r.flags).toEqual(expect.arrayContaining(["diabetes", "heart_condition"]));
    expect(r.flags).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "@/lib/safety"`.

- [ ] **Step 3: Implementasyonu yaz**

Create `src/lib/safety/index.ts`:
```ts
export type HealthAnswers = {
  pregnant: boolean;
  heartCondition: boolean;
  diabetes: boolean;
  eatingDisorderHistory: boolean;
};

export type SafetyResult = {
  flags: string[];
  referToDoctor: boolean;
};

const BMI_VERY_LOW = 16;
const BMI_VERY_HIGH = 40;

export function bmi(weightKg: number, heightCm: number): number {
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}

export function screenHealth(
  answers: HealthAnswers,
  weightKg: number,
  heightCm: number
): SafetyResult {
  const flags: string[] = [];
  if (answers.pregnant) flags.push("pregnancy");
  if (answers.heartCondition) flags.push("heart_condition");
  if (answers.diabetes) flags.push("diabetes");
  if (answers.eatingDisorderHistory) flags.push("eating_disorder_history");

  const value = bmi(weightKg, heightCm);
  if (value < BMI_VERY_LOW) flags.push("bmi_very_low");
  if (value > BMI_VERY_HIGH) flags.push("bmi_very_high");

  return { flags, referToDoctor: flags.length > 0 };
}
```

- [ ] **Step 4: Testlerin geçtiğini doğrula**

Run: `npm test`
Expected: PASS — safety testleri dahil tüm birim testler geçer.

- [ ] **Step 5: Commit**

```bash
git add src/lib/safety tests/unit/safety.test.ts
git commit -m "feat: add health red-flag screening module (TDD)"
```

---

### Task 3: `lib/onboarding/validation` — form doğrulama (TDD)

**Files:**
- Create: `src/lib/onboarding/validation.ts`
- Test: `tests/unit/onboarding-validation.test.ts`

- [ ] **Step 1: Failing test yaz**

Create `tests/unit/onboarding-validation.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { validateOnboarding } from "@/lib/onboarding/validation";

const valid = {
  age: "30",
  gender: "male",
  heightCm: "175",
  weightKg: "72,5",
  activityLevel: "moderate",
  goal: "lose",
  experience: "beginner",
  daysPerWeek: "3",
  pregnant: null,
  heartCondition: null,
  diabetes: "on",
  eatingDisorderHistory: null,
};

describe("validateOnboarding", () => {
  it("geçerli girdiyi tipli veriye çevirir (virgüllü ondalık dahil)", () => {
    const r = validateOnboarding(valid);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.age).toBe(30);
      expect(r.data.weightKg).toBe(72.5);
      expect(r.data.health.diabetes).toBe(true);
      expect(r.data.health.pregnant).toBe(false);
    }
  });

  it("aralık dışı yaş hata döndürür", () => {
    const r = validateOnboarding({ ...valid, age: "200" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(" ")).toMatch(/Yaş/);
  });

  it("eksik cinsiyet hata döndürür", () => {
    const r = validateOnboarding({ ...valid, gender: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(" ")).toMatch(/Cinsiyet/);
  });

  it("geçersiz haftalık gün hata döndürür", () => {
    const r = validateOnboarding({ ...valid, daysPerWeek: "9" });
    expect(r.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "@/lib/onboarding/validation"`.

- [ ] **Step 3: Implementasyonu yaz**

Create `src/lib/onboarding/validation.ts`:
```ts
export const GENDERS = ["male", "female", "other"] as const;
export const ACTIVITY_LEVELS = ["sedentary", "light", "moderate", "active", "very_active"] as const;
export const GOALS = ["lose", "maintain", "gain"] as const;
export const EXPERIENCES = ["beginner", "intermediate", "advanced"] as const;

export type OnboardingData = {
  age: number;
  gender: (typeof GENDERS)[number];
  heightCm: number;
  weightKg: number;
  activityLevel: (typeof ACTIVITY_LEVELS)[number];
  goal: (typeof GOALS)[number];
  experience: (typeof EXPERIENCES)[number];
  daysPerWeek: number;
  health: {
    pregnant: boolean;
    heartCondition: boolean;
    diabetes: boolean;
    eatingDisorderHistory: boolean;
  };
};

export type ValidationResult =
  | { ok: true; data: OnboardingData }
  | { ok: false; errors: string[] };

function toNumber(x: unknown): number | null {
  if (typeof x !== "string" || x.trim() === "") return null;
  const n = Number(x.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function oneOf<T extends readonly string[]>(x: unknown, list: T): T[number] | null {
  return typeof x === "string" && (list as readonly string[]).includes(x)
    ? (x as T[number])
    : null;
}

export function validateOnboarding(input: Record<string, unknown>): ValidationResult {
  const errors: string[] = [];

  const age = toNumber(input.age);
  if (age === null || !Number.isInteger(age) || age < 13 || age > 100)
    errors.push("Yaş 13-100 arasında tam sayı olmalı.");

  const gender = oneOf(input.gender, GENDERS);
  if (!gender) errors.push("Cinsiyet seçimi gerekli.");

  const heightCm = toNumber(input.heightCm);
  if (heightCm === null || heightCm < 100 || heightCm > 250)
    errors.push("Boy 100-250 cm arasında olmalı.");

  const weightKg = toNumber(input.weightKg);
  if (weightKg === null || weightKg < 30 || weightKg > 300)
    errors.push("Kilo 30-300 kg arasında olmalı.");

  const activityLevel = oneOf(input.activityLevel, ACTIVITY_LEVELS);
  if (!activityLevel) errors.push("Aktivite seviyesi seçimi gerekli.");

  const goal = oneOf(input.goal, GOALS);
  if (!goal) errors.push("Hedef seçimi gerekli.");

  const experience = oneOf(input.experience, EXPERIENCES);
  if (!experience) errors.push("Antrenman tecrübesi seçimi gerekli.");

  const daysPerWeek = toNumber(input.daysPerWeek);
  if (daysPerWeek === null || !Number.isInteger(daysPerWeek) || daysPerWeek < 1 || daysPerWeek > 7)
    errors.push("Haftalık antrenman günü 1-7 arasında olmalı.");

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    data: {
      age: age!,
      gender: gender!,
      heightCm: heightCm!,
      weightKg: weightKg!,
      activityLevel: activityLevel!,
      goal: goal!,
      experience: experience!,
      daysPerWeek: daysPerWeek!,
      health: {
        pregnant: input.pregnant === "on",
        heartCondition: input.heartCondition === "on",
        diabetes: input.diabetes === "on",
        eatingDisorderHistory: input.eatingDisorderHistory === "on",
      },
    },
  };
}
```

- [ ] **Step 4: Testlerin geçtiğini doğrula**

Run: `npm test`
Expected: PASS — tüm birim testler geçer.

- [ ] **Step 5: Commit**

```bash
git add src/lib/onboarding tests/unit/onboarding-validation.test.ts
git commit -m "feat: add onboarding form validation module (TDD)"
```

---

### Task 4: `saveProfile` server action

**Files:**
- Create: `src/app/(app)/onboarding/actions.ts`

- [ ] **Step 1: Server action'ı oluştur**

Create `src/app/(app)/onboarding/actions.ts`:
```ts
"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { validateOnboarding } from "@/lib/onboarding/validation";
import { screenHealth } from "@/lib/safety";

export async function saveProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const raw = Object.fromEntries(formData.entries());
  const result = validateOnboarding(raw);
  if (!result.ok) {
    redirect(`/onboarding?error=${encodeURIComponent(result.errors[0])}`);
  }

  const d = result.data;
  const safety = screenHealth(d.health, d.weightKg, d.heightCm);

  const { error } = await supabase.from("profiles").upsert({
    user_id: user.id,
    age: d.age,
    gender: d.gender,
    height_cm: d.heightCm,
    weight_kg: d.weightKg,
    activity_level: d.activityLevel,
    goal: d.goal,
    experience: d.experience,
    days_per_week: d.daysPerWeek,
    health_flags: safety.flags,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    redirect(`/onboarding?error=${encodeURIComponent("Profil kaydedilemedi: " + error.message)}`);
  }

  if (safety.referToDoctor) redirect("/onboarding/saglik-uyarisi");
  redirect("/dashboard");
}
```

- [ ] **Step 2: Build'in geçtiğini doğrula**

Run: `npm run build`
Expected: derleme hatasız.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/onboarding/actions.ts"
git commit -m "feat: add saveProfile server action with safety screening"
```

---

### Task 5: Onboarding sihirbazı UI + sağlık uyarısı sayfası + proxy güncellemesi

**Files:**
- Create: `src/app/(app)/onboarding/page.tsx`
- Create: `src/app/(app)/onboarding/form.tsx`
- Create: `src/app/(app)/onboarding/saglik-uyarisi/page.tsx`
- Modify: `src/proxy.ts` (PROTECTED_PREFIXES satırı)

- [ ] **Step 1: Server sayfayı oluştur**

Create `src/app/(app)/onboarding/page.tsx`:
```tsx
import OnboardingForm from "./form";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 p-6">
      <h1 className="text-2xl font-bold">Seni tanıyalım</h1>
      <p className="text-sm text-gray-500">
        Sana uygun programı hazırlamak için birkaç soru soracağız. Bu uygulama
        bilgilendirme amaçlıdır; tıbbi tavsiye yerine geçmez.
      </p>
      <OnboardingForm error={error} />
    </main>
  );
}
```

- [ ] **Step 2: Client sihirbaz formunu oluştur**

Create `src/app/(app)/onboarding/form.tsx`:
```tsx
"use client";

import { useState } from "react";
import { saveProfile } from "./actions";

const STEPS = ["Vücut bilgileri", "Hedef & antrenman", "Sağlık taraması"];

const inputCls = "rounded border p-3";
const labelCls = "flex flex-col gap-1 text-sm font-medium";

export default function OnboardingForm({ error }: { error?: string }) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
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
```

- [ ] **Step 3: Sağlık uyarısı sayfasını oluştur**

Create `src/app/(app)/onboarding/saglik-uyarisi/page.tsx`:
```tsx
import Link from "next/link";

export default function SaglikUyarisiPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-bold">Önce sağlığın 🩺</h1>
      <p className="text-gray-700">
        Verdiğin bilgilere göre, yoğun bir spor veya diyet programına başlamadan
        önce bir sağlık profesyoneline danışmanı öneririz. Profilin kaydedildi;
        program önerilerimiz bu durumu dikkate alacak ve temkinli olacak.
      </p>
      <p className="text-sm text-gray-500">
        ingym bilgilendirme amaçlıdır; tıbbi tavsiye, teşhis veya tedavi yerine geçmez.
      </p>
      <Link href="/dashboard"
        className="rounded bg-black px-6 py-3 text-center font-medium text-white">
        Panele git
      </Link>
    </main>
  );
}
```

- [ ] **Step 4: Proxy'ye /onboarding korumasını ekle**

`src/proxy.ts` içinde şu satırı:
```ts
const PROTECTED_PREFIXES = ["/dashboard"];
```
şununla değiştir:
```ts
const PROTECTED_PREFIXES = ["/dashboard", "/onboarding"];
```

- [ ] **Step 5: Build'in geçtiğini doğrula**

Run: `npm run build`
Expected: derleme hatasız; route tablosunda `/onboarding` ve `/onboarding/saglik-uyarisi` görünür.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(app)/onboarding" src/proxy.ts
git commit -m "feat: add onboarding wizard UI, health-warning page, route guard"
```

---

### Task 6: Dashboard entegrasyonu + e2e koruma testi

**Files:**
- Modify (replace): `src/app/(app)/dashboard/page.tsx`
- Create: `e2e/auth-guard.spec.ts`

- [ ] **Step 1: Dashboard'u profile-aware hale getir**

Replace `src/app/(app)/dashboard/page.tsx` içeriğini tamamen şununla:
```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/(auth)/actions";
import { bmi } from "@/lib/safety";

const GOAL_LABELS: Record<string, string> = {
  lose: "Kilo vermek",
  maintain: "Formu korumak",
  gain: "Kas / kilo almak",
};

export default async function DashboardPage() {
  let user = null;
  let profile = null;
  try {
    const supabase = await createClient();
    const result = await supabase.auth.getUser();
    user = result.data.user;
    if (user) {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      profile = data;
    }
  } catch {
    user = null;
  }

  if (!user) redirect("/login");
  if (!profile) redirect("/onboarding");

  const hasFlags = Array.isArray(profile.health_flags) && profile.health_flags.length > 0;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 p-6">
      <h1 className="text-2xl font-bold">Merhaba 👋</h1>
      <p className="text-gray-600">{user.email}</p>

      <section className="flex flex-col gap-2 rounded border p-4">
        <h2 className="font-semibold">Profilin</h2>
        <p className="text-sm text-gray-600">
          {profile.age} yaş · {profile.height_cm} cm · {profile.weight_kg} kg ·
          BMI {bmi(Number(profile.weight_kg), Number(profile.height_cm))}
        </p>
        <p className="text-sm text-gray-600">
          Hedef: {GOAL_LABELS[profile.goal] ?? profile.goal} · Haftada{" "}
          {profile.days_per_week} gün antrenman
        </p>
        {hasFlags && (
          <p className="rounded bg-amber-50 p-2 text-sm text-amber-800">
            Sağlık taramasında dikkat gerektiren durum(lar) var; programın
            temkinli hazırlanacak. Bir hekime danışmanı öneririz.
          </p>
        )}
      </section>

      <p className="text-sm text-gray-500">
        Spor + diyet programın bir sonraki sürümde burada olacak.
      </p>

      <form action={signOut}>
        <button className="rounded border p-3 font-medium">Çıkış yap</button>
      </form>
    </main>
  );
}
```

- [ ] **Step 2: e2e koruma testini yaz**

Create `e2e/auth-guard.spec.ts`:
```ts
import { test, expect } from "@playwright/test";

test("korumalı sayfalar oturumsuz login'e yönlendirir", async ({ page }) => {
  await page.goto("/onboarding");
  await expect(page).toHaveURL(/\/login/);

  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});
```

- [ ] **Step 3: Testleri çalıştır**

Run: `npm run e2e`
Expected: PASS — 2 test (smoke + auth-guard). Not: bu test gerçek Supabase'e bağlı yerel dev sunucusuyla çalışır (`.env.local` mevcut).

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/dashboard/page.tsx" e2e/auth-guard.spec.ts
git commit -m "feat: profile-aware dashboard with onboarding redirect + auth-guard e2e"
```

---

### Task 7: README yol haritası + tam doğrulama

**Files:**
- Modify: `README.md` (yol haritası satırı)

- [ ] **Step 1: Yol haritasını güncelle**

`README.md` içinde şu satırı:
```markdown
- [ ] Plan 2 — Onboarding anketi (A)
```
şununla değiştir:
```markdown
- [x] Plan 2 — Onboarding anketi (A)
```

- [ ] **Step 2: Tam doğrulama**

Run: `npm test && npm run build && npm run e2e`
Expected: birim testler PASS (env+safety+validation), build temiz, e2e 2/2 PASS.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: mark Plan 2 (onboarding) complete in roadmap"
```

---

## Self-Review Notu (yazar tarafından dolduruldu)

- **Spec kapsamı:** Spec §3-6'daki onboarding akışı (anket → kırmızı bayrak → profil kaydı), `profiles` veri modeli (jsonb sağlık bayrakları dahil), hata yönetimi (geçersiz anket → form hatası; bayrak → yönlendirme ekranı) ve test stratejisi (saf modüllere birim test) karşılanıyor. `plans`/`daily_logs` tabloları bilinçli olarak Plan 3/4'e bırakıldı (YAGNI).
- **Placeholder taraması:** Tüm kod adımları tam; "TBD" yok. Migration token'ı plan dışı (controller sağlar) — fallback yolu tanımlı.
- **Tip tutarlılığı:** `validateOnboarding` çıktı alanları (`heightCm`, `weightKg`, `activityLevel`…) ↔ `saveProfile`'daki DB kolonları (`height_cm`, `weight_kg`, `activity_level`) eşlemesi action içinde açıkça yapılıyor; `screenHealth(answers, weightKg, heightCm)` imzası Task 2 ve Task 4'te aynı; `bmi()` dashboard'da aynı imzayla kullanılıyor.
