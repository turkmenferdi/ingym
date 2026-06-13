# ingym — Plan 4: Günlük Takip + Feedback (D) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kullanıcının gününü loglaması (antrenman yaptı mı, kilo opsiyonel, öğün/notlar) ve aktif planına + hedefine göre Gemini'den kısa, kişisel günlük geri bildirim alması; her gün için tek log (upsert), son günlerin geçmişi gösterilir.

**Architecture:** `lib/daily/validation` saf/test edilir form doğrulama. `lib/ai` mevcut sağlayıcıya `generateDailyFeedback` eklenir (hata/anahtar yoksa `null` → zarif düşüş). `daily_logs` tablosu (RLS, kullanıcı başına gün başına tek satır). `saveDailyLog` server action + `/gunluk` sayfası (bugünün formu + AI feedback + geçmiş).

**Tech Stack:** Mevcut (Next.js 16, TS, Supabase, Gemini `gemini-2.5-flash`, Vitest). Yeni paket/ön koşul YOK.

---

## Dosya Yapısı

```
ingym/
├── supabase/migrations/0004_daily_logs.sql      # daily_logs + RLS (yeni)
├── src/
│   ├── lib/
│   │   ├── daily/validation.ts                  # validateDailyLog() — saf, TDD (yeni)
│   │   └── ai/
│   │       ├── types.ts                         # DailyFeedback + arayüze metot (değişir)
│   │       └── gemini.ts                         # generateDailyFeedback() (değişir)
│   └── app/(app)/
│       ├── gunluk/
│       │   ├── page.tsx                          # bugünün formu + feedback + geçmiş (yeni)
│       │   ├── form.tsx                          # client form (yeni)
│       │   └── actions.ts                        # saveDailyLog action (yeni)
│       └── dashboard/page.tsx                    # "Günlük takip" linki (değişir)
├── src/proxy.ts                                  # PROTECTED_PREFIXES += "/gunluk" (değişir)
└── tests/unit/daily-validation.test.ts          # (yeni)
```

**Supabase:** ref `lxkhmmdfzqzgwuuafmko`. Migration Management API ile (token controller'da; 401 ise SQL kullanıcıya).

---

### Task 1: `daily_logs` tablosu migration'ı

**Files:** Create `supabase/migrations/0004_daily_logs.sql`

- [ ] **Step 1: Migration dosyasını oluştur**

Create `supabase/migrations/0004_daily_logs.sql`:
```sql
-- ingym: günlük takip kayıtları (kullanıcı başına gün başına tek satır)
create table if not exists public.daily_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null default current_date,
  trained boolean not null default false,
  weight_kg numeric check (weight_kg is null or weight_kg between 30 and 300),
  notes text not null default '',
  ai_feedback jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (user_id, log_date)
);

create index if not exists daily_logs_user_date_idx on public.daily_logs (user_id, log_date desc);

alter table public.daily_logs enable row level security;

drop policy if exists "own logs select" on public.daily_logs;
create policy "own logs select" on public.daily_logs
  for select using (auth.uid() = user_id);

drop policy if exists "own logs insert" on public.daily_logs;
create policy "own logs insert" on public.daily_logs
  for insert with check (auth.uid() = user_id);

drop policy if exists "own logs update" on public.daily_logs;
create policy "own logs update" on public.daily_logs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

- [ ] **Step 2: Management API ile uygula** (q.json'u repo dizinine yaz; node Windows'ta `/tmp`'i `C:\tmp` çözer, KULLANMA; `q.json` kullan ve sil)
```bash
node -e "const fs=require('fs');fs.writeFileSync('q.json',JSON.stringify({query:fs.readFileSync('supabase/migrations/0004_daily_logs.sql','utf8')}))"
curl -s -X POST "https://api.supabase.com/v1/projects/lxkhmmdfzqzgwuuafmko/database/query" -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" -d @q.json
rm q.json
```
Expected: `[]`. 401 → DONE_WITH_CONCERNS, SQL'i kullanıcıya ver.

- [ ] **Step 3: Doğrula** (tablo + RLS)
```bash
node -e "require('fs').writeFileSync('q.json',JSON.stringify({query:\"select tablename from pg_tables where schemaname='public' and tablename='daily_logs'\"}))"
curl -s -X POST "https://api.supabase.com/v1/projects/lxkhmmdfzqzgwuuafmko/database/query" -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" -d @q.json
rm q.json
```
Expected: `[{"tablename":"daily_logs"}]`. Ayrıca `select relrowsecurity from pg_class where relname='daily_logs'` → `[{"relrowsecurity":true}]`.

- [ ] **Step 4: Commit**
```bash
git add supabase/migrations/0004_daily_logs.sql && git commit -m "feat: add daily_logs table migration with RLS"
```

---

### Task 2: `lib/daily/validation` — günlük log doğrulama (TDD)

**Files:** Create `src/lib/daily/validation.ts`, Test `tests/unit/daily-validation.test.ts`

- [ ] **Step 1: Failing test yaz**

Create `tests/unit/daily-validation.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { validateDailyLog } from "@/lib/daily/validation";

describe("validateDailyLog", () => {
  it("antrenman ve kilo ile geçerli girdiyi çevirir (virgüllü ondalık)", () => {
    const r = validateDailyLog({ trained: "on", weightKg: "72,3", notes: "iyi gün" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.trained).toBe(true);
      expect(r.data.weightKg).toBe(72.3);
      expect(r.data.notes).toBe("iyi gün");
    }
  });

  it("kilo opsiyoneldir (boşsa null)", () => {
    const r = validateDailyLog({ notes: "" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.trained).toBe(false);
      expect(r.data.weightKg).toBeNull();
      expect(r.data.notes).toBe("");
    }
  });

  it("aralık dışı kilo hata döndürür", () => {
    const r = validateDailyLog({ weightKg: "500" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(" ")).toMatch(/Kilo/);
  });

  it("çok uzun not hata döndürür", () => {
    const r = validateDailyLog({ notes: "x".repeat(2001) });
    expect(r.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula** — `npm test` → FAIL (`@/lib/daily/validation` yok).

- [ ] **Step 3: Implementasyonu yaz**

Create `src/lib/daily/validation.ts`:
```ts
export type DailyLogData = {
  trained: boolean;
  weightKg: number | null;
  notes: string;
};

export type DailyValidationResult =
  | { ok: true; data: DailyLogData }
  | { ok: false; errors: string[] };

const MAX_NOTES = 2000;

function toNumberOrNull(x: unknown): number | null | undefined {
  if (typeof x !== "string" || x.trim() === "") return null;
  const n = Number(x.replace(",", "."));
  return Number.isFinite(n) ? n : undefined; // undefined = geçersiz
}

export function validateDailyLog(input: Record<string, unknown>): DailyValidationResult {
  const errors: string[] = [];

  const trained = input.trained === "on";

  const weight = toNumberOrNull(input.weightKg);
  let weightKg: number | null = null;
  if (weight === undefined) {
    errors.push("Kilo geçerli bir sayı olmalı.");
  } else if (weight !== null && (weight < 30 || weight > 300)) {
    errors.push("Kilo 30-300 kg arasında olmalı.");
  } else {
    weightKg = weight;
  }

  const notes = typeof input.notes === "string" ? input.notes.trim() : "";
  if (notes.length > MAX_NOTES) errors.push("Not çok uzun (en fazla 2000 karakter).");

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, data: { trained, weightKg, notes } };
}
```

- [ ] **Step 4: Testlerin geçtiğini doğrula** — `npm test` → PASS.

- [ ] **Step 5: Commit**
```bash
git add src/lib/daily tests/unit/daily-validation.test.ts
git commit -m "feat: add daily log validation module (TDD)"
```

---

### Task 3: `lib/ai` — `generateDailyFeedback` ekle

**Files:** Modify `src/lib/ai/types.ts`, Modify `src/lib/ai/gemini.ts`

- [ ] **Step 1: types.ts'e tip + metot ekle**

`src/lib/ai/types.ts` dosyasının SONUNA (mevcut içerik korunarak) ekle:
```ts
export type DailyFeedback = { message: string; tip: string };

export type DailyFeedbackInputs = {
  goal: string;
  calories: number;
  trained: boolean;
  weightKg: number | null;
  notes: string;
};
```
Ve mevcut `AiProvider` arayüzüne (interface gövdesine) şu metodu ekle:
```ts
  generateDailyFeedback(inputs: DailyFeedbackInputs): Promise<DailyFeedback | null>;
```
(interface şu hale gelir:)
```ts
export interface AiProvider {
  generatePlanContent(inputs: PlanInputs): Promise<PlanContent | null>;
  generateDailyFeedback(inputs: DailyFeedbackInputs): Promise<DailyFeedback | null>;
}
```

- [ ] **Step 2: gemini.ts'e implementasyon ekle**

`src/lib/ai/gemini.ts` dosyasında:
(a) import satırını genişlet:
```ts
import type {
  AiProvider,
  PlanContent,
  PlanInputs,
  DailyFeedback,
  DailyFeedbackInputs,
} from "./types";
```
(b) Dosyaya (sınıf dışına, diğer sabitlerin yanına) bu şema + prompt'u ekle:
```ts
const FEEDBACK_SCHEMA = {
  type: "object",
  properties: {
    message: { type: "string" },
    tip: { type: "string" },
  },
  required: ["message", "tip"],
};

function buildFeedbackPrompt(inputs: DailyFeedbackInputs): string {
  const parts = [
    "Bir spor koçu ve diyetisyen olarak, kullanıcının bugünkü günlük kaydına Türkçe, kısa ve motive edici bir geri bildirim ver.",
    `Hedef: ${inputs.goal}. Günlük kalori hedefi: ${inputs.calories} kcal.`,
    `Bugün antrenman yaptı mı: ${inputs.trained ? "evet" : "hayır"}.`,
    inputs.weightKg !== null ? `Bugünkü kilo: ${inputs.weightKg} kg.` : "Kilo girilmedi.",
    inputs.notes ? `Notları: ${inputs.notes}` : "Not yok.",
    "message: 1-2 cümlelik kişisel geri bildirim. tip: yarına dair tek küçük, uygulanabilir öneri.",
  ];
  return parts.join("\n");
}
```
(c) `GeminiProvider` sınıfının İÇİNE (mevcut `generatePlanContent` metodunun yanına) bu metodu ekle:
```ts
  async generateDailyFeedback(inputs: DailyFeedbackInputs): Promise<DailyFeedback | null> {
    if (!this.apiKey) return null;
    try {
      const res = await fetch(`${ENDPOINT}?key=${this.apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: buildFeedbackPrompt(inputs) }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: FEEDBACK_SCHEMA,
          },
        }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) return null;
      return JSON.parse(text) as DailyFeedback;
    } catch {
      return null;
    }
  }
```

- [ ] **Step 3: Derlemeyi doğrula** — `npm run build` → hatasız (AiProvider'a metot eklendi; GeminiProvider hâlâ uyumlu).

- [ ] **Step 4: Commit**
```bash
git add src/lib/ai
git commit -m "feat: add generateDailyFeedback to AI provider"
```

---

### Task 4: `saveDailyLog` server action

**Files:** Create `src/app/(app)/gunluk/actions.ts`

- [ ] **Step 1: Action'ı oluştur**

Create `src/app/(app)/gunluk/actions.ts`:
```ts
"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { validateDailyLog } from "@/lib/daily/validation";
import { GeminiProvider } from "@/lib/ai/gemini";

export async function saveDailyLog(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const result = validateDailyLog(Object.fromEntries(formData.entries()));
  if (!result.ok) {
    redirect("/gunluk?error=" + encodeURIComponent(result.errors[0]));
  }
  const d = result.data;

  const { data: plan } = await supabase
    .from("plans")
    .select("targets")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: profile } = await supabase
    .from("profiles")
    .select("goal")
    .eq("user_id", user.id)
    .maybeSingle();

  const targets = plan?.targets as { calories?: number } | undefined;
  const feedback =
    (await new GeminiProvider().generateDailyFeedback({
      goal: profile?.goal ?? "maintain",
      calories: targets?.calories ?? 0,
      trained: d.trained,
      weightKg: d.weightKg,
      notes: d.notes,
    })) ?? {};

  const today = new Date().toISOString().slice(0, 10);

  const { error } = await supabase.from("daily_logs").upsert(
    {
      user_id: user.id,
      log_date: today,
      trained: d.trained,
      weight_kg: d.weightKg,
      notes: d.notes,
      ai_feedback: feedback,
    },
    { onConflict: "user_id,log_date" }
  );
  if (error) {
    redirect("/gunluk?error=" + encodeURIComponent("Kayıt başarısız: " + error.message));
  }

  redirect("/gunluk");
}
```

- [ ] **Step 2: Derlemeyi doğrula** — `npm run build` → hatasız.

- [ ] **Step 3: Commit**
```bash
git add "src/app/(app)/gunluk/actions.ts"
git commit -m "feat: add saveDailyLog action with daily AI feedback"
```

---

### Task 5: `/gunluk` sayfası + form

**Files:** Create `src/app/(app)/gunluk/page.tsx`, Create `src/app/(app)/gunluk/form.tsx`

- [ ] **Step 1: Client formu oluştur**

Create `src/app/(app)/gunluk/form.tsx`:
```tsx
"use client";

import { useState } from "react";
import { saveDailyLog } from "./actions";

const inputCls = "rounded border p-3";
const labelCls = "flex flex-col gap-1 text-sm font-medium";

export default function DailyForm({
  initial,
}: {
  initial: { trained: boolean; weightKg: string; notes: string };
}) {
  const [trained, setTrained] = useState(initial.trained);
  const [saving, setSaving] = useState(false);

  return (
    <form
      action={async (fd) => {
        setSaving(true);
        await saveDailyLog(fd);
      }}
      className="flex flex-col gap-3"
    >
      <label className="flex items-center gap-3 rounded border p-3 text-sm">
        <input type="checkbox" name="trained" checked={trained}
          onChange={(e) => setTrained(e.target.checked)} />
        Bugün antrenman yaptım
      </label>
      <label className={labelCls}>
        Kilo (kg) — opsiyonel
        <input className={inputCls} name="weightKg" type="number" inputMode="decimal"
          step="0.1" defaultValue={initial.weightKg} placeholder="örn. 72.5" />
      </label>
      <label className={labelCls}>
        Bugün ne yedin / nasıl geçti?
        <textarea className={inputCls} name="notes" rows={4}
          defaultValue={initial.notes} placeholder="Öğünler, notlar…" />
      </label>
      <button disabled={saving}
        className="rounded bg-black p-3 font-medium text-white disabled:opacity-40">
        {saving ? "Kaydediliyor…" : "Günü kaydet ve geri bildirim al"}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Server sayfayı oluştur**

Create `src/app/(app)/gunluk/page.tsx`:
```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DailyForm from "./form";

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

  const today = new Date().toISOString().slice(0, 10);

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
      {error && <p className="rounded bg-red-100 p-2 text-sm text-red-700">{error}</p>}

      <DailyForm
        initial={{
          trained: todayLog?.trained ?? false,
          weightKg: todayLog?.weight_kg != null ? String(todayLog.weight_kg) : "",
          notes: todayLog?.notes ?? "",
        }}
      />

      {todayLog?.ai_feedback?.message && (
        <section className="flex flex-col gap-1 rounded border bg-green-50 p-4">
          <h2 className="font-semibold">Bugünün geri bildirimi</h2>
          <p className="text-sm text-gray-700">{todayLog.ai_feedback.message}</p>
          {todayLog.ai_feedback.tip && (
            <p className="text-sm text-gray-600">💡 {todayLog.ai_feedback.tip}</p>
          )}
        </section>
      )}

      {history.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-semibold">Geçmiş</h2>
          {history.map((r) => (
            <div key={r.log_date} className="rounded border p-3 text-sm text-gray-600">
              <strong>{r.log_date}</strong> — {r.trained ? "✅ antrenman" : "— antrenman yok"}
              {r.weight_kg != null && ` · ${r.weight_kg} kg`}
              {r.ai_feedback?.message && (
                <p className="mt-1 text-gray-500">{r.ai_feedback.message}</p>
              )}
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
```

- [ ] **Step 3: Derlemeyi doğrula** — `npm run build` → hatasız; route tablosunda `/gunluk`.

- [ ] **Step 4: Commit**
```bash
git add "src/app/(app)/gunluk/page.tsx" "src/app/(app)/gunluk/form.tsx"
git commit -m "feat: add daily tracking page with form, feedback, and history"
```

---

### Task 6: Dashboard linki + `/gunluk` rota koruması

**Files:** Modify `src/app/(app)/dashboard/page.tsx`, Modify `src/proxy.ts`

- [ ] **Step 1: Dashboard'a "Günlük takip" linki ekle**

`src/app/(app)/dashboard/page.tsx` içinde, `Programıma git` linkini içeren `<a ...>...</a>` öğesinden hemen SONRA şunu ekle:
```tsx
      <a href="/gunluk"
        className="rounded border px-6 py-3 text-center font-medium">
        Günlük takip
      </a>
```

- [ ] **Step 2: Proxy korumasına /gunluk ekle**

`src/proxy.ts` içinde `const PROTECTED_PREFIXES = ["/dashboard", "/onboarding", "/program"];` satırını şununla değiştir:
```ts
const PROTECTED_PREFIXES = ["/dashboard", "/onboarding", "/program", "/gunluk"];
```

- [ ] **Step 3: Derlemeyi doğrula** — `npm run build` → hatasız.

- [ ] **Step 4: Commit**
```bash
git add "src/app/(app)/dashboard/page.tsx" src/proxy.ts
git commit -m "feat: add daily tracking link and route guard"
```

---

### Task 7: README + tam doğrulama

**Files:** Modify `README.md`

- [ ] **Step 1: Yol haritasını güncelle**

`README.md` içinde `- [ ] Plan 4 — Günlük takip + feedback (D)` satırını `- [x] Plan 4 — Günlük takip + feedback (D)` yap.

- [ ] **Step 2: Tam doğrulama**

Run: `npm test && npm run build && npm run e2e`
Expected: birim testler PASS (env + safety + onboarding-validation + nutrition + training + daily-validation), build temiz (`/gunluk` route'u dahil), e2e 2/2 PASS.

- [ ] **Step 3: Commit**
```bash
git add README.md
git commit -m "docs: mark Plan 4 (daily tracking) complete in roadmap"
```

---

## Self-Review Notu (yazar tarafından dolduruldu)

- **Spec kapsamı:** Spec §6.3 (günlük log → AI feedback → kaydet & göster), §5 `daily_logs` veri modeli, §7 (Gemini hatası → feedback boş `{}`, log yine kaydedilir), §8 (saf doğrulama modülüne birim test) karşılanıyor. Bu, v1'in (A+C+D) son parçası.
- **Placeholder taraması:** Pure modül + AI metodu tam kod. AI dış API olduğu için derleme + zarif-düşüş (`apiKey` yoksa/`catch` → `null`) ile doğrulanıyor.
- **Tip tutarlılığı:** `validateDailyLog` çıktısı `{trained, weightKg, notes}` ↔ action upsert kolonları `trained/weight_kg/notes`. `DailyFeedback{message,tip}` ↔ `ai_feedback` jsonb ↔ sayfa gösterimi (`ai_feedback.message/tip`) aynı. `onConflict: "user_id,log_date"` ↔ tablo `unique (user_id, log_date)`. Gün başına tek log; aynı gün tekrar kaydetme upsert ile günceller (reviewer'ın Plan 3'teki "tek aktif kayıt" endişesi burada unique constraint ile yapısal çözülür).
- **Güvenlik:** `daily_logs` RLS select/insert/update hepsi `auth.uid() = user_id` (+ with check). GEMINI_API_KEY yalnız sunucuda. Not alanı 2000 karakterle sınırlı; serbest metin Gemini prompt'una giriyor (kullanıcı yalnız kendi feedback'ini etkiler — düşük risk, spec ile uyumlu).
