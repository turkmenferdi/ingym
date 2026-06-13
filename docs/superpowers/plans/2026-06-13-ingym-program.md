# ingym — Plan 3: Program Üretimi (C) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kullanıcının profilinden kişiye özel **haftalık antrenman + beslenme planı** üretmek: kurallı sayısal çekirdek (kalori/makro + antrenman iskeleti) kodla hesaplanır, içerik (yemek/egzersiz önerileri, açıklama) Gemini ile kişiselleştirilir; sonuç `plans` tablosuna kaydedilir ve dashboard'da gösterilir.

**Architecture:** Hibrit. `lib/nutrition` (Mifflin-St Jeor → TDEE → hedef kalori → makro) ve `lib/training` (seviye+gün → antrenman iskeleti) saf/test edilir fonksiyonlar. `lib/ai` Gemini'yi sağlayıcı-bağımsız arayüz arkasında çağırır; hata/rate-limit'te sayısal plan yine üretilir (zarif düşüş). `generateProgram` server action bunları birleştirir, `plans`'a yazar.

**Tech Stack:** Mevcut (Next.js 16, TS, Supabase, Vitest). Yeni: **Gemini API** (REST `fetch`, ek paket yok) + `GEMINI_API_KEY` env değişkeni.

---

## ⚠️ Ön koşul: Gemini API anahtarı
Bu plan Gemini ücretsiz katmanını kullanır. Uygulamadan önce kullanıcı:
1. https://aistudio.google.com/apikey → "Create API key" (ücretsiz)
2. Anahtarı verir; controller bunu `.env.local`'a (`GEMINI_API_KEY=...`) ve Vercel env'e (production+development) ekler.
Anahtar yoksa: sayısal çekirdek (nutrition/training) yine de geliştirilip test edilebilir; yalnız AI içerik adımı (Task 4-5) canlı doğrulanamaz — bu durumda AI katmanı zarif düşüşle boş içerik döndürür ve plan sayısal-only gösterilir.

---

## Dosya Yapısı (bu planın sonunda)

```
ingym/
├── supabase/migrations/0003_plans.sql        # plans tablosu + RLS (yeni)
├── src/
│   ├── lib/
│   │   ├── nutrition/index.ts                # computeTargets() — saf, TDD (yeni)
│   │   ├── training/index.ts                 # buildSkeleton() — saf, TDD (yeni)
│   │   └── ai/
│   │       ├── types.ts                      # PlanContent + AiProvider arayüzü (yeni)
│   │       └── gemini.ts                      # generatePlanContent() Gemini impl (yeni)
│   └── app/(app)/
│       ├── program/
│       │   ├── page.tsx                       # planı göster / "oluştur" (yeni)
│       │   └── actions.ts                     # generateProgram server action (yeni)
│       └── dashboard/page.tsx                 # "Programım" kartı/linki (değişir)
├── tests/unit/
│   ├── nutrition.test.ts                      # (yeni)
│   └── training.test.ts                       # (yeni)
```

**Supabase:** ref `lxkhmmdfzqzgwuuafmko`. Migration Management API ile uygulanır (token controller'da; 401 ise SQL kullanıcıya verilir).

---

### Task 1: `plans` tablosu migration'ı

**Files:** Create `supabase/migrations/0003_plans.sql`

- [ ] **Step 1: Migration dosyasını oluştur**

Create `supabase/migrations/0003_plans.sql`:
```sql
-- ingym: üretilen spor + diyet planları
create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active','archived')),
  targets jsonb not null,        -- kalori/makro hedefleri (lib/nutrition çıktısı)
  skeleton jsonb not null,       -- antrenman iskeleti (lib/training çıktısı)
  content jsonb not null default '{}',  -- Gemini içeriği (boş = AI düşüşü)
  created_at timestamptz not null default now()
);

create index if not exists plans_user_active_idx on public.plans (user_id, created_at desc);

alter table public.plans enable row level security;

drop policy if exists "own plans select" on public.plans;
create policy "own plans select" on public.plans
  for select using (auth.uid() = user_id);

drop policy if exists "own plans insert" on public.plans;
create policy "own plans insert" on public.plans
  for insert with check (auth.uid() = user_id);

drop policy if exists "own plans update" on public.plans;
create policy "own plans update" on public.plans
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

- [ ] **Step 2: Management API ile uygula** (Task 1/Plan2 ile aynı yöntem; `$SUPABASE_ACCESS_TOKEN`)

```bash
node -e "const fs=require('fs');fs.writeFileSync('q.json',JSON.stringify({query:fs.readFileSync('supabase/migrations/0003_plans.sql','utf8')}))"
curl -s -X POST "https://api.supabase.com/v1/projects/lxkhmmdfzqzgwuuafmko/database/query" -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" -d @q.json
rm q.json
```
Expected: `[]`. 401 → DONE_WITH_CONCERNS, SQL'i kullanıcıya ver.

- [ ] **Step 3: Doğrula**

```bash
node -e "require('fs').writeFileSync('q.json',JSON.stringify({query:\"select tablename from pg_tables where schemaname='public' and tablename='plans'\"}))"
curl -s -X POST "https://api.supabase.com/v1/projects/lxkhmmdfzqzgwuuafmko/database/query" -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" -d @q.json
rm q.json
```
Expected: `[{"tablename":"plans"}]`

- [ ] **Step 4: Commit**
```bash
git add supabase/migrations/0003_plans.sql && git commit -m "feat: add plans table migration with RLS"
```

---

### Task 2: `lib/nutrition` — kalori & makro çekirdeği (TDD)

**Files:** Create `src/lib/nutrition/index.ts`, Test `tests/unit/nutrition.test.ts`

- [ ] **Step 1: Failing test yaz**

Create `tests/unit/nutrition.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { bmr, computeTargets } from "@/lib/nutrition";

describe("bmr (Mifflin-St Jeor)", () => {
  it("erkek için doğru hesaplar", () => {
    // 10*80 + 6.25*180 - 5*30 + 5 = 1780
    expect(bmr("male", 80, 180, 30)).toBe(1780);
  });
  it("kadın için doğru hesaplar", () => {
    // 10*60 + 6.25*165 - 5*30 - 161 = 1320.25 -> 1320
    expect(bmr("female", 60, 165, 30)).toBe(1320);
  });
});

describe("computeTargets", () => {
  const base = {
    gender: "male" as const,
    weightKg: 80,
    heightCm: 180,
    age: 30,
    activityLevel: "moderate" as const,
  };

  it("kilo verme hedefinde kalori açığı uygular", () => {
    const t = computeTargets({ ...base, goal: "lose" });
    // TDEE = 1780 * 1.55 = 2759 -> lose -500 = 2259
    expect(t.tdee).toBe(2759);
    expect(t.calories).toBe(2259);
  });

  it("kas alma hedefinde kalori fazlası uygular", () => {
    const t = computeTargets({ ...base, goal: "gain" });
    expect(t.calories).toBe(2759 + 300);
  });

  it("koruma hedefinde TDEE'ye eşit", () => {
    const t = computeTargets({ ...base, goal: "maintain" });
    expect(t.calories).toBe(2759);
  });

  it("güvenlik tabanı: kalori asla 1200 altına inmez", () => {
    const t = computeTargets({
      gender: "female", weightKg: 45, heightCm: 150, age: 60,
      activityLevel: "sedentary", goal: "lose",
    });
    expect(t.calories).toBeGreaterThanOrEqual(1200);
  });

  it("makrolar pozitif ve kalori ile tutarlı (±20 kcal)", () => {
    const t = computeTargets({ ...base, goal: "maintain" });
    expect(t.proteinG).toBeGreaterThan(0);
    expect(t.fatG).toBeGreaterThan(0);
    expect(t.carbsG).toBeGreaterThan(0);
    const kcal = t.proteinG * 4 + t.carbsG * 4 + t.fatG * 9;
    expect(Math.abs(kcal - t.calories)).toBeLessThanOrEqual(20);
  });
});
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula** — `npm test` → FAIL (`@/lib/nutrition` yok).

- [ ] **Step 3: Implementasyonu yaz**

Create `src/lib/nutrition/index.ts`:
```ts
export type Gender = "male" | "female" | "other";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";
export type Goal = "lose" | "maintain" | "gain";

export type Targets = {
  bmr: number;
  tdee: number;
  calories: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
};

const ACTIVITY: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

const GOAL_DELTA: Record<Goal, number> = { lose: -500, maintain: 0, gain: 300 };
const MIN_CALORIES = 1200;

export function bmr(gender: Gender, weightKg: number, heightCm: number, age: number): number {
  const baseConst = gender === "male" ? 5 : gender === "female" ? -161 : -78; // other = ortalama
  return Math.round(10 * weightKg + 6.25 * heightCm - 5 * age + baseConst);
}

export function computeTargets(input: {
  gender: Gender;
  weightKg: number;
  heightCm: number;
  age: number;
  activityLevel: ActivityLevel;
  goal: Goal;
}): Targets {
  const b = bmr(input.gender, input.weightKg, input.heightCm, input.age);
  const tdee = Math.round(b * ACTIVITY[input.activityLevel]);
  const calories = Math.max(MIN_CALORIES, tdee + GOAL_DELTA[input.goal]);

  // Makro: protein 1.8 g/kg, yağ kalorinin %25'i, kalan karbonhidrat
  const proteinG = Math.round(1.8 * input.weightKg);
  const fatG = Math.round((calories * 0.25) / 9);
  const remaining = calories - (proteinG * 4 + fatG * 9);
  const carbsG = Math.max(0, Math.round(remaining / 4));

  return { bmr: b, tdee, calories, proteinG, fatG, carbsG };
}
```

- [ ] **Step 4: Testlerin geçtiğini doğrula** — `npm test` → PASS.

- [ ] **Step 5: Commit**
```bash
git add src/lib/nutrition tests/unit/nutrition.test.ts
git commit -m "feat: add nutrition core (Mifflin-St Jeor TDEE + macros, TDD)"
```

---

### Task 3: `lib/training` — antrenman iskeleti (TDD)

**Files:** Create `src/lib/training/index.ts`, Test `tests/unit/training.test.ts`

- [ ] **Step 1: Failing test yaz**

Create `tests/unit/training.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildSkeleton } from "@/lib/training";

describe("buildSkeleton", () => {
  it("3 gün için 3 günlük split üretir", () => {
    const s = buildSkeleton("beginner", 3);
    expect(s.days).toHaveLength(3);
  });

  it("6 gün için 6 günlük split üretir", () => {
    const s = buildSkeleton("intermediate", 6);
    expect(s.days).toHaveLength(6);
  });

  it("başlangıç seviyesi daha düşük set sayısı verir", () => {
    const beginner = buildSkeleton("beginner", 3);
    const advanced = buildSkeleton("advanced", 3);
    expect(advanced.setsPerExercise).toBeGreaterThan(beginner.setsPerExercise);
  });

  it("her gün bir odak etiketi taşır", () => {
    const s = buildSkeleton("intermediate", 4);
    s.days.forEach((d) => expect(typeof d.focus).toBe("string"));
    expect(s.days[0].focus.length).toBeGreaterThan(0);
  });

  it("gün sayısını 1-7 aralığına sıkıştırır", () => {
    expect(buildSkeleton("beginner", 0).days.length).toBe(1);
    expect(buildSkeleton("beginner", 9).days.length).toBe(7);
  });
});
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula** — `npm test` → FAIL.

- [ ] **Step 3: Implementasyonu yaz**

Create `src/lib/training/index.ts`:
```ts
export type Experience = "beginner" | "intermediate" | "advanced";

export type TrainingDay = { focus: string };
export type Skeleton = {
  daysPerWeek: number;
  setsPerExercise: number;
  repRange: string;
  days: TrainingDay[];
};

const SPLITS: Record<number, string[]> = {
  1: ["Tüm vücut"],
  2: ["Tüm vücut A", "Tüm vücut B"],
  3: ["İtiş (göğüs/omuz/triceps)", "Çekiş (sırt/biceps)", "Bacak"],
  4: ["Üst vücut", "Alt vücut", "Üst vücut", "Alt vücut"],
  5: ["İtiş", "Çekiş", "Bacak", "Üst vücut", "Alt vücut"],
  6: ["İtiş", "Çekiş", "Bacak", "İtiş", "Çekiş", "Bacak"],
  7: ["İtiş", "Çekiş", "Bacak", "İtiş", "Çekiş", "Bacak", "Aktif dinlenme/kardiyo"],
};

const SETS: Record<Experience, number> = { beginner: 3, intermediate: 4, advanced: 5 };

function clampDays(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.min(7, Math.max(1, Math.round(n)));
}

export function buildSkeleton(experience: Experience, daysPerWeek: number): Skeleton {
  const d = clampDays(daysPerWeek);
  return {
    daysPerWeek: d,
    setsPerExercise: SETS[experience],
    repRange: experience === "advanced" ? "6-12" : "8-12",
    days: SPLITS[d].map((focus) => ({ focus })),
  };
}
```

- [ ] **Step 4: Testlerin geçtiğini doğrula** — `npm test` → PASS.

- [ ] **Step 5: Commit**
```bash
git add src/lib/training tests/unit/training.test.ts
git commit -m "feat: add training skeleton builder (TDD)"
```

---

### Task 4: `lib/ai` — Gemini sağlayıcı (arayüz + impl)

**Files:** Create `src/lib/ai/types.ts`, Create `src/lib/ai/gemini.ts`

> Not: Bu modül dış API çağırır; birim test mock gerektirir ve plan kapsamında tutulmaz. Doğrulama: derleme + (anahtar varsa) Task 6'da canlı action denemesi. Anahtar yoksa fonksiyon `null` döndürmeli (zarif düşüş) — bu davranış kod içinde garanti edilir.

- [ ] **Step 1: Tip + arayüzü oluştur**

Create `src/lib/ai/types.ts`:
```ts
export type MealSuggestion = { meal: string; idea: string; approxCalories: number };
export type WorkoutDayContent = { focus: string; exercises: string[] };

export type PlanContent = {
  summary: string;
  nutrition: { dailyNote: string; meals: MealSuggestion[] };
  workout: WorkoutDayContent[];
};

export type PlanInputs = {
  targets: { calories: number; proteinG: number; fatG: number; carbsG: number };
  skeleton: { setsPerExercise: number; repRange: string; days: { focus: string }[] };
  profile: { goal: string; experience: string; cautious: boolean };
};

export interface AiProvider {
  generatePlanContent(inputs: PlanInputs): Promise<PlanContent | null>;
}
```

- [ ] **Step 2: Gemini implementasyonunu oluştur**

Create `src/lib/ai/gemini.ts`:
```ts
import type { AiProvider, PlanContent, PlanInputs } from "./types";

const MODEL = "gemini-2.5-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    nutrition: {
      type: "object",
      properties: {
        dailyNote: { type: "string" },
        meals: {
          type: "array",
          items: {
            type: "object",
            properties: {
              meal: { type: "string" },
              idea: { type: "string" },
              approxCalories: { type: "number" },
            },
            required: ["meal", "idea", "approxCalories"],
          },
        },
      },
      required: ["dailyNote", "meals"],
    },
    workout: {
      type: "array",
      items: {
        type: "object",
        properties: {
          focus: { type: "string" },
          exercises: { type: "array", items: { type: "string" } },
        },
        required: ["focus", "exercises"],
      },
    },
  },
  required: ["summary", "nutrition", "workout"],
};

function buildPrompt(inputs: PlanInputs): string {
  const { targets, skeleton, profile } = inputs;
  const days = skeleton.days.map((d, i) => `${i + 1}. gün: ${d.focus}`).join("\n");
  return [
    "Bir spor koçu ve diyetisyen olarak Türkçe, kişiye özel bir haftalık plan içeriği üret.",
    profile.cautious
      ? "ÖNEMLİ: Kullanıcıda sağlık riski işareti var; önerileri TEMKİNLİ, düşük yoğunluklu tut ve hekime danışmayı hatırlat."
      : "",
    `Hedef: ${profile.goal}. Tecrübe: ${profile.experience}.`,
    `Günlük kalori hedefi: ${targets.calories} kcal (protein ${targets.proteinG}g, yağ ${targets.fatG}g, karbonhidrat ${targets.carbsG}g).`,
    `Antrenman: her egzersiz ${skeleton.setsPerExercise} set, ${skeleton.repRange} tekrar. Günler:`,
    days,
    "Her antrenman günü için 4-6 egzersiz öner. Beslenme için 3-4 öğün fikri ver (yaklaşık kalorileriyle). Kısa ve uygulanabilir ol.",
  ].filter(Boolean).join("\n");
}

export class GeminiProvider implements AiProvider {
  constructor(private apiKey: string | undefined = process.env.GEMINI_API_KEY) {}

  async generatePlanContent(inputs: PlanInputs): Promise<PlanContent | null> {
    if (!this.apiKey) return null; // anahtar yoksa zarif düşüş
    try {
      const res = await fetch(`${ENDPOINT}?key=${this.apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: buildPrompt(inputs) }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: RESPONSE_SCHEMA,
          },
        }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) return null;
      return JSON.parse(text) as PlanContent;
    } catch {
      return null; // rate-limit/ağ/parse hatası → sayısal plan yine gösterilir
    }
  }
}
```

- [ ] **Step 3: Derlemeyi doğrula** — `npm run build` → hatasız.

- [ ] **Step 4: Commit**
```bash
git add src/lib/ai
git commit -m "feat: add Gemini AI provider with graceful fallback"
```

---

### Task 5: `generateProgram` server action

**Files:** Create `src/app/(app)/program/actions.ts`

- [ ] **Step 1: Action'ı oluştur**

Create `src/app/(app)/program/actions.ts`:
```ts
"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { computeTargets } from "@/lib/nutrition";
import { buildSkeleton } from "@/lib/training";
import { GeminiProvider } from "@/lib/ai/gemini";

export async function generateProgram() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile, error: pErr } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  if (pErr) redirect("/program?error=" + encodeURIComponent("Profil okunamadı, tekrar dene."));
  if (!profile) redirect("/onboarding");

  const cautious =
    Array.isArray(profile.health_flags) && profile.health_flags.length > 0;

  const targets = computeTargets({
    gender: profile.gender,
    weightKg: Number(profile.weight_kg),
    heightCm: Number(profile.height_cm),
    age: profile.age,
    activityLevel: profile.activity_level,
    goal: profile.goal,
  });
  const skeleton = buildSkeleton(profile.experience, profile.days_per_week);

  const content =
    (await new GeminiProvider().generatePlanContent({
      targets,
      skeleton,
      profile: { goal: profile.goal, experience: profile.experience, cautious },
    })) ?? {};

  // Eski aktif planları arşivle, yenisini ekle
  await supabase
    .from("plans")
    .update({ status: "archived" })
    .eq("user_id", user.id)
    .eq("status", "active");

  const { error } = await supabase.from("plans").insert({
    user_id: user.id,
    status: "active",
    targets,
    skeleton,
    content,
  });
  if (error) {
    redirect("/program?error=" + encodeURIComponent("Plan kaydedilemedi: " + error.message));
  }

  redirect("/program");
}
```

- [ ] **Step 2: Derlemeyi doğrula** — `npm run build` → hatasız.

- [ ] **Step 3: Commit**
```bash
git add "src/app/(app)/program/actions.ts"
git commit -m "feat: add generateProgram action (numeric core + Gemini content)"
```

---

### Task 6: Program sayfası + dashboard linki

**Files:** Create `src/app/(app)/program/page.tsx`, Modify `src/app/(app)/dashboard/page.tsx`

- [ ] **Step 1: Program sayfasını oluştur**

Create `src/app/(app)/program/page.tsx`:
```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { generateProgram } from "./actions";

export default async function ProgramPage({
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

  const { data: plan } = await supabase
    .from("plans")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const t = plan?.targets as
    | { calories: number; proteinG: number; fatG: number; carbsG: number }
    | undefined;
  const content = (plan?.content ?? {}) as {
    summary?: string;
    nutrition?: { dailyNote?: string; meals?: { meal: string; idea: string; approxCalories: number }[] };
    workout?: { focus: string; exercises: string[] }[];
  };
  const skeleton = plan?.skeleton as
    | { setsPerExercise: number; repRange: string; days: { focus: string }[] }
    | undefined;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 p-6">
      <h1 className="text-2xl font-bold">Programım</h1>
      {error && <p className="rounded bg-red-100 p-2 text-sm text-red-700">{error}</p>}

      {!plan ? (
        <>
          <p className="text-gray-600">
            Henüz bir programın yok. Profilinden sana özel haftalık antrenman +
            beslenme planı oluşturalım.
          </p>
          <form action={generateProgram}>
            <button className="rounded bg-black px-6 py-3 font-medium text-white">
              Programımı oluştur
            </button>
          </form>
        </>
      ) : (
        <>
          {content.summary && <p className="text-gray-700">{content.summary}</p>}

          <section className="flex flex-col gap-1 rounded border p-4">
            <h2 className="font-semibold">Günlük hedef</h2>
            <p className="text-sm text-gray-600">
              {t?.calories} kcal · P {t?.proteinG}g · Y {t?.fatG}g · K {t?.carbsG}g
            </p>
            {content.nutrition?.dailyNote && (
              <p className="text-sm text-gray-500">{content.nutrition.dailyNote}</p>
            )}
            {content.nutrition?.meals?.map((m, i) => (
              <p key={i} className="text-sm text-gray-600">
                • <strong>{m.meal}:</strong> {m.idea} (~{m.approxCalories} kcal)
              </p>
            ))}
          </section>

          <section className="flex flex-col gap-2 rounded border p-4">
            <h2 className="font-semibold">Haftalık antrenman</h2>
            <p className="text-xs text-gray-400">
              Her egzersiz {skeleton?.setsPerExercise} set · {skeleton?.repRange} tekrar
            </p>
            {(content.workout && content.workout.length > 0
              ? content.workout
              : skeleton?.days.map((d) => ({ focus: d.focus, exercises: [] })) ?? []
            ).map((d, i) => (
              <div key={i} className="text-sm text-gray-600">
                <strong>{i + 1}. gün — {d.focus}</strong>
                {d.exercises.length > 0 && (
                  <ul className="ml-4 list-disc">
                    {d.exercises.map((ex, j) => <li key={j}>{ex}</li>)}
                  </ul>
                )}
              </div>
            ))}
          </section>

          <form action={generateProgram}>
            <button className="rounded border px-6 py-3 font-medium">
              Yeniden oluştur
            </button>
          </form>
        </>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Dashboard'a "Programım" linki ekle**

`src/app/(app)/dashboard/page.tsx` içinde, `<p className="text-sm text-gray-500">Spor + diyet programın bir sonraki sürümde burada olacak.</p>` satırını şununla değiştir:
```tsx
      <a href="/program"
        className="rounded bg-black px-6 py-3 text-center font-medium text-white">
        Programıma git
      </a>
```

- [ ] **Step 3: Derleme + (anahtar varsa) canlı dev denemesi**

Run: `npm run build` → hatasız; route tablosunda `/program` görünür.
(GEMINI_API_KEY `.env.local`'de varsa: `npm run dev`, giriş yap, `/program` → "Programımı oluştur" → AI içerikli plan görünmeli. Anahtar yoksa: sayısal hedef + iskelet görünür, AI içeriği boş — bu beklenen zarif düşüş.)

- [ ] **Step 4: Commit**
```bash
git add "src/app/(app)/program" "src/app/(app)/dashboard/page.tsx"
git commit -m "feat: add program page (AI plan display) and dashboard link"
```

---

### Task 7: `/program` rota koruması + README + tam doğrulama

**Files:** Modify `src/proxy.ts`, Modify `README.md`

- [ ] **Step 1: Proxy korumasına /program ekle**

`src/proxy.ts` içinde `const PROTECTED_PREFIXES = ["/dashboard", "/onboarding"];` satırını şununla değiştir:
```ts
const PROTECTED_PREFIXES = ["/dashboard", "/onboarding", "/program"];
```

- [ ] **Step 2: README yol haritasını güncelle**

`README.md` içinde `- [ ] Plan 3 — Program üretimi (C)` satırını `- [x] Plan 3 — Program üretimi (C)` yap.

- [ ] **Step 3: Tam doğrulama**

Run: `npm test && npm run build`
Expected: birim testler PASS (env + safety + validation + nutrition + training), build temiz, route tablosunda `/program` + proxy.

- [ ] **Step 4: Commit**
```bash
git add src/proxy.ts README.md
git commit -m "feat: guard /program route; mark Plan 3 complete in roadmap"
```

---

## Self-Review Notu (yazar tarafından dolduruldu)

- **Spec kapsamı:** Spec §2 (hibrit yaklaşım), §3 (`lib/nutrition`/`lib/training`/`lib/ai` ayrımı), §5 (`plans` veri modeli), §6.2 (plan üretim akışı: çekirdek → safety/cautious → AI → kaydet → göster), §7 (Gemini hatası/rate-limit → sayısal plan yine üretilir) karşılanıyor. `daily_logs`/feedback Plan 4'e bırakıldı (YAGNI).
- **Placeholder taraması:** Pure modüller tam kod + TDD. AI modülü dış API olduğu için birim test yerine derleme + zarif-düşüş garantisi (`apiKey` yoksa/`catch`'te `null`) ile doğrulanıyor — bilinçli.
- **Tip tutarlılığı:** `computeTargets` çıktısı `Targets{calories,proteinG,fatG,carbsG}` ↔ `PlanInputs.targets` ↔ program sayfası gösterimi aynı alan adları. `buildSkeleton` çıktısı `Skeleton{setsPerExercise,repRange,days[].focus}` ↔ `PlanInputs.skeleton` ↔ sayfa aynı. DB kolonları snake_case (`weight_kg` vb.) action içinde `Number()` ile sarılıyor (reviewer Plan 2 notu uygulandı). `health_flags` boş değilse `cautious=true` → prompt temkinli.
- **Güvenlik:** `plans` RLS select/insert/update hepsi `auth.uid() = user_id` (+ with check). GEMINI_API_KEY yalnız sunucuda (`process.env`, NEXT_PUBLIC değil) kullanılıyor — tarayıcıya sızmaz.
