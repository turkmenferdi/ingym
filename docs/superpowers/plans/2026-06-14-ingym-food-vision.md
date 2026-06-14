# ingym — v2-E: Yemek Fotoğrafı → Kalori (Vision) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kullanıcı bir yemek fotoğrafı çeker/yükler, Gemini multimodal ile **tahmini kalori + makro** (yemek adı, kcal, protein/yağ/karbonhidrat) döner ve ekranda gösterilir.

**Architecture:** Mevcut sağlayıcı-bağımsız `AiProvider`'a `estimateFood` (vision) eklenir; Gemini `gemini-2.5-flash` inline image ile çağrılır, JSON şema döner, hata/anahtar yoksa `null` (zarif düşüş). `/yemek` sayfası + client yükleyici: fotoğrafı **tarayıcıda küçültür** (canvas, max 1024px, JPEG ~0.7 → ~100-300KB) ve `estimateFood` server action'ına gönderir; action görüntüyü base64'e çevirip Gemini'ye iletir ve tahmini **değer olarak döndürür** (redirect değil). Alt menüye "Yemek" sekmesi.

**Tech Stack:** Mevcut (Next.js 16, TS, Gemini). Yeni paket YOK. Görüntü küçültme tarayıcı canvas API'siyle (server action body limitine takılmamak için).

---

## Dosya Yapısı

```
ingym/
├── src/
│   ├── lib/ai/
│   │   ├── types.ts                       # FoodEstimate + arayüze estimateFood (değişir)
│   │   └── gemini.ts                       # estimateFood() vision impl (değişir)
│   └── app/(app)/
│       ├── yemek/
│       │   ├── page.tsx                    # server sayfa (auth guard) (yeni)
│       │   ├── uploader.tsx                # client: çek/yükle, küçült, tahmin göster (yeni)
│       │   └── actions.ts                  # estimateFood server action (yeni)
│       └── _components/BottomNav.tsx        # "Yemek" sekmesi eklenir (değişir)
└── src/proxy.ts                            # PROTECTED_PREFIXES += "/yemek" (değişir)
```

**Not:** Bu ilk vision dilimi yalnız **tahmin + gösterim**. Tahmini günlük loga ekleme (daily_logs) ayrı bir küçük takip işidir (sonraki dilim). Yeni DB tablosu YOK.

---

### Task 1: `lib/ai` — `estimateFood` (vision) ekle

**Files:** Modify `src/lib/ai/types.ts`, Modify `src/lib/ai/gemini.ts`

- [ ] **Step 1: types.ts'e tip + metot ekle**

`src/lib/ai/types.ts` SONUNA ekle:
```ts
export type FoodEstimate = {
  name: string;
  calories: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  note: string;
};

export type FoodImageInput = {
  imageBase64: string; // data: öneki OLMADAN saf base64
  mimeType: string; // "image/jpeg" | "image/png" | "image/webp"
};
```
Ve `AiProvider` arayüzüne ekle (arayüz şu hale gelir):
```ts
export interface AiProvider {
  generatePlanContent(inputs: PlanInputs): Promise<PlanContent | null>;
  generateDailyFeedback(inputs: DailyFeedbackInputs): Promise<DailyFeedback | null>;
  estimateFood(input: FoodImageInput): Promise<FoodEstimate | null>;
}
```

- [ ] **Step 2: gemini.ts'e implementasyon ekle**

`src/lib/ai/gemini.ts`:
(a) import'u genişlet — mevcut `import type { ... } from "./types";` listesine `FoodEstimate, FoodImageInput` ekle.
(b) Modül düzeyinde (sınıf dışına) şema + prompt ekle:
```ts
const FOOD_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    calories: { type: "number" },
    proteinG: { type: "number" },
    fatG: { type: "number" },
    carbsG: { type: "number" },
    note: { type: "string" },
  },
  required: ["name", "calories", "proteinG", "fatG", "carbsG", "note"],
};

const FOOD_PROMPT = [
  "Bu yemek fotoğrafını analiz et. Gördüğün porsiyon için makul bir tahmin yap.",
  "name: yemeğin Türkçe adı. calories: toplam tahmini kalori (kcal). proteinG/fatG/carbsG: gram cinsinden makrolar.",
  "note: 1 cümle kısa açıklama; bunun bir TAHMİN olduğunu ve porsiyona göre değişebileceğini belirt.",
  "Yemek göremiyorsan name='Yemek algılanamadı' ve değerleri 0 ver.",
].join("\n");
```
(c) `GeminiProvider` sınıfının İÇİNE metodu ekle:
```ts
  async estimateFood(input: FoodImageInput): Promise<FoodEstimate | null> {
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
                { text: FOOD_PROMPT },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: FOOD_SCHEMA,
          },
        }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) return null;
      return JSON.parse(text) as FoodEstimate;
    } catch {
      return null;
    }
  }
```

- [ ] **Step 3: Derleme + (opsiyonel) canlı smoke**

Run `npm run build` → hatasız (GeminiProvider 3 arayüz metodunu da karşılar). `npm test` → 32 PASS (değişmez).
Opsiyonel smoke: `.env.local`'de GEMINI_API_KEY var; küçük bir tek-kullanımlık script ile gerçek bir yemek görüntüsünü (örn. küçük bir JPEG'i base64'e çevirip) `estimateFood`'a verip non-null döndüğünü doğrulayabilirsin. Script'i SİL, COMMIT ETME. Rate-limit/null kabul edilebilir. Ne gözlediğini raporla.

- [ ] **Step 4: Commit**
```bash
git add src/lib/ai
git commit -m "feat: add estimateFood (Gemini vision) to AI provider"
```

---

### Task 2: `estimateFood` server action

**Files:** Create `src/app/(app)/yemek/actions.ts`

- [ ] **Step 1: Action'ı oluştur**

Create `src/app/(app)/yemek/actions.ts`:
```ts
"use server";

import { createClient } from "@/lib/supabase/server";
import { GeminiProvider } from "@/lib/ai/gemini";
import type { FoodEstimate } from "@/lib/ai/types";

export type EstimateResult =
  | { ok: true; estimate: FoodEstimate }
  | { ok: false; error: string };

const MAX_BYTES = 6 * 1024 * 1024; // 6MB güvenlik üst sınırı
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

export async function estimateFood(formData: FormData): Promise<EstimateResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Oturum bulunamadı, tekrar giriş yap." };

  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Fotoğraf bulunamadı." };
  }
  if (!ALLOWED.includes(file.type)) {
    return { ok: false, error: "Desteklenmeyen görüntü türü." };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: "Fotoğraf çok büyük (en fazla 6MB)." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const imageBase64 = buffer.toString("base64");

  const estimate = await new GeminiProvider().estimateFood({
    imageBase64,
    mimeType: file.type,
  });
  if (!estimate) {
    return { ok: false, error: "Tahmin yapılamadı, tekrar dene." };
  }
  return { ok: true, estimate };
}
```

- [ ] **Step 2: Derleme** — `npm run build` → hatasız.

- [ ] **Step 3: Commit**
```bash
git add "src/app/(app)/yemek/actions.ts"
git commit -m "feat: add estimateFood server action (image validation + Gemini)"
```

---

### Task 3: `/yemek` sayfası + client yükleyici

**Files:** Create `src/app/(app)/yemek/page.tsx`, Create `src/app/(app)/yemek/uploader.tsx`

- [ ] **Step 1: Client yükleyiciyi oluştur**

Create `src/app/(app)/yemek/uploader.tsx`:
```tsx
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
```

- [ ] **Step 2: Server sayfayı oluştur**

Create `src/app/(app)/yemek/page.tsx`:
```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import FoodUploader from "./uploader";

export default async function YemekPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 p-6">
      <h1 className="text-2xl font-bold">Yemek kalori tahmini</h1>
      <p className="text-sm text-muted">
        Yemeğinin fotoğrafını çek; tahmini kalori ve makroları görelim.
      </p>
      <FoodUploader />
      <p className="text-xs text-faint">
        Değerler yapay zekâ tahminidir; porsiyona göre değişir, kesin değildir.
      </p>
    </main>
  );
}
```

- [ ] **Step 3: Derleme + (anahtar varsa) dev denemesi** — `npm run build` → hatasız; route tablosunda `/yemek`. (`.env.local` varsa `npm run dev` ile /yemek'te bir yemek fotoğrafı seçip tahmin görebilirsin.)

- [ ] **Step 4: Commit**
```bash
git add "src/app/(app)/yemek/page.tsx" "src/app/(app)/yemek/uploader.tsx"
git commit -m "feat: add food photo page with client downscale + estimate display"
```

---

### Task 4: Alt menüye "Yemek" sekmesi + rota koruması + README/doğrulama

**Files:** Modify `src/app/(app)/_components/BottomNav.tsx`, Modify `src/proxy.ts`, Modify `README.md`

- [ ] **Step 1: BottomNav'a "Yemek" sekmesi ekle**

`src/app/(app)/_components/BottomNav.tsx` içindeki `TABS` dizisine, `Günlük`'ten sonra ekle:
```tsx
  { href: "/yemek", label: "Yemek", icon: "🍽️" },
```
(TABS artık 4 sekme: Panel, Program, Günlük, Yemek.)

- [ ] **Step 2: Proxy korumasına /yemek ekle**

`src/proxy.ts`: `const PROTECTED_PREFIXES = ["/dashboard", "/onboarding", "/program", "/gunluk"];` → sona `, "/yemek"` ekle.

- [ ] **Step 3: README yol haritasını güncelle**

`README.md` "Yol Haritası" bölümüne (Plan 4 satırının altına) ekle:
```markdown
- [x] v2-E — Yemek fotoğrafı → kalori (vision)
```
(Eğer "## Yol Haritası" yoksa, mevcut roadmap listesinin sonuna ekle.)

- [ ] **Step 4: Tam doğrulama** — `npm test && npm run build && npm run e2e` → 32 birim PASS, build temiz (`/yemek` route), e2e 2/2 PASS.

- [ ] **Step 5: Commit**
```bash
git add "src/app/(app)/_components/BottomNav.tsx" src/proxy.ts README.md
git commit -m "feat: add Yemek nav tab, route guard, roadmap update"
```

---

## Self-Review Notu (yazar tarafından dolduruldu)

- **Spec kapsamı:** Spec'teki v2 parçası **E (yemek fotoğrafı → kalori)**. Multimodal Gemini ile, ücretsiz katmanda (aynı anahtar). İlk dilim: tahmin + gösterim. Loglama (daily_logs'a ekleme) ve B (vücut/belge foto) bilinçli olarak sonraki dilimlere bırakıldı (YAGNI).
- **Görüntü/limit:** Server action gövde limitine (Next varsayılan ~1MB) takılmamak için fotoğraf tarayıcıda canvas ile küçültülür (max 1024px, JPEG 0.7 → genelde <300KB). Action ayrıca tür+boyut doğrular (≤6MB, jpeg/png/webp).
- **Zarif düşüş:** `estimateFood` anahtar yoksa/hata/parse'ta `null` → action `{ok:false}` döndürür → UI hata mesajı gösterir, çökmez. AI metin sağlayıcılarıyla aynı desen.
- **Tip tutarlılığı:** `FoodEstimate{name,calories,proteinG,fatG,carbsG,note}` ↔ Gemini `FOOD_SCHEMA` ↔ uploader gösterimi aynı alanlar. `estimateFood(FormData) → EstimateResult` client'ta `await` ile değer olarak alınır (redirect değil), `result.ok` ile daraltılır.
- **Güvenlik:** GEMINI_API_KEY yalnız sunucuda. `/yemek` proxy + sayfa-içi guard ile korumalı. Görüntü kullanıcının kendi oturumuyla işlenir; saklanmaz (yalnız tahmin için Gemini'ye gönderilir). e2e metin/role'e dayalı; yeni route eklemek mevcut testleri bozmaz.
