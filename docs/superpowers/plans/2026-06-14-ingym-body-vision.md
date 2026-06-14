# ingym — v2-B: Vücut/Belge Foto Okuma Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kullanıcı bir InBody raporu / kan tahlili / tartı ekranı fotoğrafı çeker; Gemini vision görseldeki değerleri (kilo, vücut yağ %, kas kütlesi) okur; sonuç gösterilir, `measurements` geçmişine kaydedilir ve istenirse kilo profile uygulanır.

**Architecture:** `estimateFood` vision desenini izler. `readBodyDocument` AI metodu görseli okur → `BodyReading` (bulunmayan değer = 0). Ortak görüntü-küçültme `src/lib/image.ts`'e çıkarılır (yemek + ölçüm uploader paylaşır — DRY). `measurements` tablosu (RLS). `/olcum` sayfası: analiz → göster → kaydet (+ kilo profile uygula) → geçmiş; `router.refresh()` ile geçmiş güncellenir.

**Tech Stack:** Mevcut (Next.js 16, TS, Gemini `gemini-2.5-flash`). Yeni paket YOK.

---

## Dosya Yapısı

```
ingym/
├── supabase/migrations/0006_measurements.sql     # measurements + RLS (yeni)
├── src/
│   ├── lib/
│   │   ├── image.ts                                # downscaleImage() ortak util (yeni)
│   │   └── ai/{types.ts, gemini.ts}                # readBodyDocument (değişir)
│   └── app/(app)/
│       ├── yemek/uploader.tsx                       # ortak downscale'i kullan (değişir)
│       ├── olcum/
│       │   ├── page.tsx                             # analiz + geçmiş (yeni)
│       │   ├── uploader.tsx                         # client analiz/kaydet (yeni)
│       │   └── actions.ts                           # analyzeBody/saveMeasurement/deleteMeasurement (yeni)
│       └── _components/BottomNav.tsx                 # "Ölçüm" sekmesi (değişir)
└── src/proxy.ts                                     # /olcum guard (değişir)
```

---

### Task 1: `measurements` tablosu migration'ı

**Files:** Create `supabase/migrations/0006_measurements.sql`

- [ ] **Step 1: Migration dosyasını oluştur**

Create `supabase/migrations/0006_measurements.sql`:
```sql
-- ingym: vücut ölçümleri (InBody/tahlil/tartı foto okumasından)
create table if not exists public.measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  measured_date date not null default current_date,
  weight_kg numeric,
  body_fat_pct numeric,
  muscle_mass_kg numeric,
  summary text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists measurements_user_date_idx on public.measurements (user_id, measured_date desc);

alter table public.measurements enable row level security;

drop policy if exists "own measurements select" on public.measurements;
create policy "own measurements select" on public.measurements
  for select using (auth.uid() = user_id);

drop policy if exists "own measurements insert" on public.measurements;
create policy "own measurements insert" on public.measurements
  for insert with check (auth.uid() = user_id);

drop policy if exists "own measurements delete" on public.measurements;
create policy "own measurements delete" on public.measurements
  for delete using (auth.uid() = user_id);
```

- [ ] **Step 2: Management API ile uygula** (q.json repo dizinine, `/tmp` KULLANMA, sonra sil; token `$SUPABASE_ACCESS_TOKEN`)
```bash
node -e "const fs=require('fs');fs.writeFileSync('q.json',JSON.stringify({query:fs.readFileSync('supabase/migrations/0006_measurements.sql','utf8')}))"
curl -s -X POST "https://api.supabase.com/v1/projects/lxkhmmdfzqzgwuuafmko/database/query" -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" -d @q.json
rm q.json
```
Expected: `[]`. 401 → DONE_WITH_CONCERNS, SQL'i kullanıcıya ver.

- [ ] **Step 3: Doğrula**
```bash
node -e "require('fs').writeFileSync('q.json',JSON.stringify({query:\"select tablename from pg_tables where schemaname='public' and tablename='measurements'\"}))"
curl -s -X POST "https://api.supabase.com/v1/projects/lxkhmmdfzqzgwuuafmko/database/query" -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" -d @q.json
rm q.json
```
Expected: `[{"tablename":"measurements"}]`. Ayrıca `select relrowsecurity from pg_class where relname='measurements'` → `[{"relrowsecurity":true}]`.

- [ ] **Step 4: Commit**
```bash
git add supabase/migrations/0006_measurements.sql && git commit -m "feat: add measurements table migration with RLS"
```

---

### Task 2: Ortak `downscaleImage` util'i çıkar (DRY)

**Files:** Create `src/lib/image.ts`, Modify `src/app/(app)/yemek/uploader.tsx`

- [ ] **Step 1: Ortak util'i oluştur**

Create `src/lib/image.ts`:
```ts
// Görüntüyü tarayıcıda küçült (server action body limitine takılmamak + hız).
export async function downscaleImage(file: File, max = 1024, quality = 0.7): Promise<Blob> {
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
```

- [ ] **Step 2: yemek/uploader.tsx'i ortak util'e geçir**

`src/app/(app)/yemek/uploader.tsx`:
- Dosyanın başındaki local `async function downscale(...) {...}` tanımını TAMAMEN SİL.
- En üste import ekle: `import { downscaleImage } from "@/lib/image";`
- `onPick` içindeki `const blob = await downscale(file);` çağrısını `const blob = await downscaleImage(file);` yap.

- [ ] **Step 3: Derleme + e2e** — `npm run build` → hatasız; `npm run e2e` → 2/2 (davranış değişmedi).

- [ ] **Step 4: Commit**
```bash
git add src/lib/image.ts "src/app/(app)/yemek/uploader.tsx"
git commit -m "refactor: extract shared downscaleImage util (DRY)"
```

---

### Task 3: `lib/ai` — `readBodyDocument` (vision)

**Files:** Modify `src/lib/ai/types.ts`, Modify `src/lib/ai/gemini.ts`

- [ ] **Step 1: types.ts'e tip + metot ekle**

`src/lib/ai/types.ts` SONUNA:
```ts
export type BodyReading = {
  weightKg: number; // 0 = okunamadı
  bodyFatPct: number; // 0 = okunamadı
  muscleMassKg: number; // 0 = okunamadı
  summary: string;
};
```
`AiProvider` arayüzüne ekle (mevcut `FoodImageInput` tipini yeniden kullanır):
```ts
  readBodyDocument(input: FoodImageInput): Promise<BodyReading | null>;
```
(Arayüz artık 4 metot: generatePlanContent, generateDailyFeedback, estimateFood, readBodyDocument.)

- [ ] **Step 2: gemini.ts'e implementasyon ekle**

`src/lib/ai/gemini.ts`:
(a) import'a `BodyReading` ekle.
(b) Modül düzeyinde:
```ts
const BODY_SCHEMA = {
  type: "object",
  properties: {
    weightKg: { type: "number" },
    bodyFatPct: { type: "number" },
    muscleMassKg: { type: "number" },
    summary: { type: "string" },
  },
  required: ["weightKg", "bodyFatPct", "muscleMassKg", "summary"],
};

const BODY_PROMPT = [
  "Bu görsel bir vücut analiz raporu (InBody vb.), kan tahlili veya tartı ekranı olabilir. Görseldeki sayısal değerleri oku.",
  "weightKg: kilo (kg). bodyFatPct: vücut yağ oranı (%). muscleMassKg: kas kütlesi (kg).",
  "Bir değer görselde YOKSA 0 ver (uydurma).",
  "summary: hangi değerleri okuduğunu 1-2 cümleyle Türkçe özetle ve bunun bir foto okuması olduğunu, kesin olmadığını belirt.",
].join("\n");
```
(c) `GeminiProvider` içine:
```ts
  async readBodyDocument(input: FoodImageInput): Promise<BodyReading | null> {
    if (!this.apiKey) return null;
    try {
      const res = await fetch(`${ENDPOINT}?key=${this.apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { inlineData: { mimeType: input.mimeType, data: input.imageBase64 } },
                { text: BODY_PROMPT },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: BODY_SCHEMA,
          },
        }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) return null;
      return JSON.parse(text) as BodyReading;
    } catch {
      return null;
    }
  }
```

- [ ] **Step 3: Derleme + test** — `npm run build` → hatasız (GeminiProvider 4 metodu karşılar); `npm test` → 32 PASS.

- [ ] **Step 4: Commit**
```bash
git add src/lib/ai
git commit -m "feat: add readBodyDocument (Gemini vision) to AI provider"
```

---

### Task 4: `/olcum` server action'ları

**Files:** Create `src/app/(app)/olcum/actions.ts`

- [ ] **Step 1: Action'ları oluştur**

Create `src/app/(app)/olcum/actions.ts`:
```ts
"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GeminiProvider } from "@/lib/ai/gemini";
import type { BodyReading } from "@/lib/ai/types";
import { todayInTR } from "@/lib/daily/today";

export type AnalyzeResult =
  | { ok: true; reading: BodyReading }
  | { ok: false; error: string };

const MAX_BYTES = 6 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

export async function analyzeBody(formData: FormData): Promise<AnalyzeResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Oturum bulunamadı, tekrar giriş yap." };

  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Fotoğraf bulunamadı." };
  if (!ALLOWED.includes(file.type)) return { ok: false, error: "Desteklenmeyen görüntü türü." };
  if (file.size > MAX_BYTES) return { ok: false, error: "Fotoğraf çok büyük (en fazla 6MB)." };

  const imageBase64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  const reading = await new GeminiProvider().readBodyDocument({ imageBase64, mimeType: file.type });
  if (!reading) return { ok: false, error: "Okunamadı, tekrar dene." };
  return { ok: true, reading };
}

export type SaveMeasurementResult = { ok: true } | { ok: false; error: string };

export async function saveMeasurement(formData: FormData): Promise<SaveMeasurementResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Oturum bulunamadı." };

  const numOrNull = (k: string) => {
    const raw = formData.get(k);
    if (raw === null || String(raw).trim() === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const weightKg = numOrNull("weightKg");
  const bodyFatPct = numOrNull("bodyFatPct");
  const muscleMassKg = numOrNull("muscleMassKg");
  const summary = String(formData.get("summary") ?? "").trim().slice(0, 500);

  if (weightKg === null && bodyFatPct === null && muscleMassKg === null) {
    return { ok: false, error: "Kaydedilecek bir değer okunamadı." };
  }

  const { error } = await supabase.from("measurements").insert({
    user_id: user.id,
    measured_date: todayInTR(),
    weight_kg: weightKg,
    body_fat_pct: bodyFatPct,
    muscle_mass_kg: muscleMassKg,
    summary,
  });
  if (error) return { ok: false, error: "Kaydedilemedi: " + error.message };

  // İstenirse kiloyu profile uygula
  if (formData.get("applyWeight") === "on" && weightKg !== null) {
    await supabase
      .from("profiles")
      .update({ weight_kg: weightKg, updated_at: new Date().toISOString() })
      .eq("user_id", user.id);
  }
  return { ok: true };
}

export async function deleteMeasurement(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return redirect("/login");
  const id = String(formData.get("id") ?? "");
  if (id) await supabase.from("measurements").delete().eq("id", id).eq("user_id", user.id);
  return redirect("/olcum");
}
```

- [ ] **Step 2: Derleme** — `npm run build` → hatasız.

- [ ] **Step 3: Commit**
```bash
git add "src/app/(app)/olcum/actions.ts"
git commit -m "feat: add olcum actions (analyzeBody, saveMeasurement, deleteMeasurement)"
```

---

### Task 5: `/olcum` sayfası + client uploader

**Files:** Create `src/app/(app)/olcum/uploader.tsx`, Create `src/app/(app)/olcum/page.tsx`

- [ ] **Step 1: Client uploader'ı oluştur**

Create `src/app/(app)/olcum/uploader.tsx`:
```tsx
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
```

- [ ] **Step 2: Server sayfayı oluştur**

Create `src/app/(app)/olcum/page.tsx`:
```tsx
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
```

- [ ] **Step 3: Derleme** — `npm run build` → hatasız; route tablosunda `/olcum`.

- [ ] **Step 4: Commit**
```bash
git add "src/app/(app)/olcum/page.tsx" "src/app/(app)/olcum/uploader.tsx"
git commit -m "feat: add olcum page (body/document reading) with uploader + history"
```

---

### Task 6: Nav "Ölçüm" sekmesi + koruma + README + doğrulama

**Files:** Modify `src/app/(app)/_components/BottomNav.tsx`, Modify `src/proxy.ts`, Modify `README.md`

- [ ] **Step 1: BottomNav'a sekme ekle** — `TABS` dizisine, Yemek'ten sonra:
```tsx
  { href: "/olcum", label: "Ölçüm", icon: "📏" },
```
(5 sekme: Panel, Program, Günlük, Yemek, Ölçüm.)

- [ ] **Step 2: Proxy** — `PROTECTED_PREFIXES`'e `"/olcum"` ekle.

- [ ] **Step 3: README** — roadmap'e ekle: `- [x] v2-B — Vücut/belge foto okuma (ölçümler)`.

- [ ] **Step 4: Tam doğrulama** — `npm test && npm run build && npm run e2e` → 32 PASS, build temiz (`/olcum`), e2e 2/2.

- [ ] **Step 5: Commit**
```bash
git add "src/app/(app)/_components/BottomNav.tsx" src/proxy.ts README.md
git commit -m "feat: add Olcum nav tab, route guard, roadmap update"
```

---

## Self-Review Notu (yazar tarafından dolduruldu)

- **Spec kapsamı:** Spec'in **B** parçası (vücut/belge foto okuma). Gemini multimodal ile, `estimateFood` deseninin aynısı. `measurements` geçmişi + kiloyu profile uygulama. Tahlil değerlerinin detaylı yorumu (tıbbi) bilinçli olarak DIŞARIDA — yalnız okuma + saklama (güvenli, spec §9 ile uyumlu).
- **DRY:** `downscaleImage` ortak util'e çıkarıldı; yemek + ölçüm uploader paylaşır.
- **Tip tutarlılığı:** `BodyReading{weightKg,bodyFatPct,muscleMassKg,summary}` (0=okunamadı) ↔ `BODY_SCHEMA` ↔ uploader gösterimi ↔ `saveMeasurement` (0/boş → null) ↔ `measurements` kolonları (snake_case, nullable). `todayInTR()` ile tarih. `FoodImageInput` görüntü tipi yeniden kullanıldı (isim yemek'e özgü ama yapı genel — kabul edildi).
- **Güvenlik:** `measurements` RLS select/insert/delete own. Görüntü tür/boyut doğrulanır (≤6MB), saklanmaz. GEMINI_API_KEY sunucu-only. Kiloyu profile uygulama yalnız kullanıcının kendi profilini (RLS) günceller. `/olcum` proxy + sayfa guard.
- **Not (UI):** Alt menü artık 5 sekme — kalabalıklaşıyor; UI cilası işinde (sıradaki) gözden geçirilecek (örn. Yemek+Ölçüm'ü "Tara" altında birleştirme).
