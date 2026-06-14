# ingym — v2-E2: Yemek Tahminini Günlüğe Ekle (Meals) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Yemek fotoğrafı tahminini "Bugüne ekle" ile günlüğe kaydetmek; `/gunluk`'ta o günün öğünlerini ve **toplam kaloriyi hedefe karşı** göstermek; yanlış öğünü silebilmek. Vision döngüsü kapanır: fotoğraf → tahmin → kayıt → günlük toplam.

**Architecture:** Yeni `meals` tablosu (kullanıcı başına gün başına çok satır, RLS). `addMeal` (değer döndüren) action `/yemek`'te tahmini kaydeder; `deleteMeal` (redirect) action `/gunluk`'ta öğün siler. Tarih `todayInTR()` (mevcut TR-saati helper) ile. `/gunluk` sayfası öğün listesi + toplam kcal (+ aktif plan hedefi varsa kıyas) gösterir.

**Tech Stack:** Mevcut. Yeni paket YOK. `todayInTR` (src/lib/daily/today.ts) yeniden kullanılır.

---

## Dosya Yapısı

```
ingym/
├── supabase/migrations/0005_meals.sql          # meals tablosu + RLS (yeni)
├── src/app/(app)/
│   ├── yemek/
│   │   ├── actions.ts                           # addMeal eklenir (değişir)
│   │   └── uploader.tsx                          # "Bugüne ekle" butonu (değişir)
│   └── gunluk/
│       ├── actions.ts                           # deleteMeal eklenir (değişir)
│       └── page.tsx                              # öğün listesi + toplam (değişir)
```

---

### Task 1: `meals` tablosu migration'ı

**Files:** Create `supabase/migrations/0005_meals.sql`

- [ ] **Step 1: Migration dosyasını oluştur**

Create `supabase/migrations/0005_meals.sql`:
```sql
-- ingym: günlük öğün kayıtları (yemek foto tahmininden)
create table if not exists public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null default current_date,
  name text not null,
  calories numeric not null default 0,
  protein_g numeric not null default 0,
  fat_g numeric not null default 0,
  carbs_g numeric not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists meals_user_date_idx on public.meals (user_id, log_date desc);

alter table public.meals enable row level security;

drop policy if exists "own meals select" on public.meals;
create policy "own meals select" on public.meals
  for select using (auth.uid() = user_id);

drop policy if exists "own meals insert" on public.meals;
create policy "own meals insert" on public.meals
  for insert with check (auth.uid() = user_id);

drop policy if exists "own meals delete" on public.meals;
create policy "own meals delete" on public.meals
  for delete using (auth.uid() = user_id);
```

- [ ] **Step 2: Management API ile uygula** (q.json'u repo dizinine yaz, `/tmp` KULLANMA, sonra sil; token: `$SUPABASE_ACCESS_TOKEN`)
```bash
node -e "const fs=require('fs');fs.writeFileSync('q.json',JSON.stringify({query:fs.readFileSync('supabase/migrations/0005_meals.sql','utf8')}))"
curl -s -X POST "https://api.supabase.com/v1/projects/lxkhmmdfzqzgwuuafmko/database/query" -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" -d @q.json
rm q.json
```
Expected: `[]`. 401 → DONE_WITH_CONCERNS, SQL'i kullanıcıya ver.

- [ ] **Step 3: Doğrula** — tablo + RLS:
```bash
node -e "require('fs').writeFileSync('q.json',JSON.stringify({query:\"select tablename from pg_tables where schemaname='public' and tablename='meals'\"}))"
curl -s -X POST "https://api.supabase.com/v1/projects/lxkhmmdfzqzgwuuafmko/database/query" -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" -d @q.json
rm q.json
```
Expected: `[{"tablename":"meals"}]`. Ayrıca `select relrowsecurity from pg_class where relname='meals'` → `[{"relrowsecurity":true}]`.

- [ ] **Step 4: Commit**
```bash
git add supabase/migrations/0005_meals.sql && git commit -m "feat: add meals table migration with RLS"
```

---

### Task 2: `addMeal` server action

**Files:** Modify `src/app/(app)/yemek/actions.ts`

- [ ] **Step 1: addMeal'i mevcut dosyaya ekle**

`src/app/(app)/yemek/actions.ts` dosyasının SONUNA ekle (mevcut `estimateFood` korunur). Üstteki import'lara `import { todayInTR } from "@/lib/daily/today";` ekle:
```ts
export type AddMealResult = { ok: true } | { ok: false; error: string };

export async function addMeal(formData: FormData): Promise<AddMealResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Oturum bulunamadı, tekrar giriş yap." };

  const name = String(formData.get("name") ?? "").trim().slice(0, 120);
  if (!name) return { ok: false, error: "Yemek adı yok." };

  const num = (k: string) => {
    const n = Number(formData.get(k));
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };

  const { error } = await supabase.from("meals").insert({
    user_id: user.id,
    log_date: todayInTR(),
    name,
    calories: num("calories"),
    protein_g: num("proteinG"),
    fat_g: num("fatG"),
    carbs_g: num("carbsG"),
  });
  if (error) return { ok: false, error: "Eklenemedi: " + error.message };
  return { ok: true };
}
```

- [ ] **Step 2: Derleme** — `npm run build` → hatasız.

- [ ] **Step 3: Commit**
```bash
git add "src/app/(app)/yemek/actions.ts"
git commit -m "feat: add addMeal action (save food estimate to today)"
```

---

### Task 3: `/yemek` — "Bugüne ekle" butonu

**Files:** Modify `src/app/(app)/yemek/uploader.tsx`

- [ ] **Step 1: Uploader'a ekleme akışı koy**

`src/app/(app)/yemek/uploader.tsx`:
(a) import'a `addMeal`'i ekle: `import { estimateFood, addMeal, type EstimateResult } from "./actions";`
(b) component içine ekleme durumu ekle (mevcut state'lerin yanına):
```tsx
  const [added, setAdded] = useState(false);
  const [adding, setAdding] = useState(false);
```
(c) `onPick` içinde, yeni fotoğraf seçilince `setAdded(false)` ekle (mevcut `setResult(null)` satırının yanına).
(d) ekleme fonksiyonu ekle (component içinde):
```tsx
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
```
(e) Başarılı tahmin kartının (`result.ok` bloğu) İÇİNE, makro satırının altına ekle:
```tsx
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
```

- [ ] **Step 2: Derleme** — `npm run build` → hatasız.

- [ ] **Step 3: Commit**
```bash
git add "src/app/(app)/yemek/uploader.tsx"
git commit -m "feat: add 'add to today' button on food estimate"
```

---

### Task 4: `deleteMeal` action + `/gunluk`'ta öğün listesi & toplam

**Files:** Modify `src/app/(app)/gunluk/actions.ts`, Modify `src/app/(app)/gunluk/page.tsx`

- [ ] **Step 1: deleteMeal action'ı ekle**

`src/app/(app)/gunluk/actions.ts` SONUNA ekle (mevcut `saveDailyLog` korunur; dosyada zaten `redirect`, `createClient` import'lu):
```ts
export async function deleteMeal(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return redirect("/login");

  const id = String(formData.get("id") ?? "");
  if (id) {
    await supabase.from("meals").delete().eq("id", id).eq("user_id", user.id);
  }
  return redirect("/gunluk");
}
```

- [ ] **Step 2: `/gunluk` sayfasına öğünleri ekle**

`src/app/(app)/gunluk/page.tsx`:
(a) import'a ekle: `import { deleteMeal } from "./actions";` (mevcut import'ların yanına; `todayInTR` zaten import'lu).
(b) `LogRow` tipinden sonra ekle:
```tsx
type MealRow = {
  id: string;
  name: string;
  calories: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
};
```
(c) `today` hesaplandıktan sonra, mevcut `logs` sorgusunun yanına bugünün öğünlerini + aktif plan hedefini çek:
```tsx
  const { data: mealsData } = await supabase
    .from("meals")
    .select("id, name, calories, protein_g, fat_g, carbs_g")
    .eq("user_id", user.id)
    .eq("log_date", today)
    .order("created_at", { ascending: true });
  const meals = (mealsData ?? []) as MealRow[];
  const totalKcal = meals.reduce((s, m) => s + Number(m.calories), 0);

  const { data: planRow } = await supabase
    .from("plans")
    .select("targets")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const targetKcal = (planRow?.targets as { calories?: number } | undefined)?.calories;
```
(d) JSX'te, `<DailyForm ... />`'dan SONRA (feedback bölümünden önce) bugünün öğünleri bölümünü ekle:
```tsx
      <section className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold">Bugünün öğünleri</h2>
          <span className="text-sm text-muted">
            {totalKcal} kcal{targetKcal ? ` / ${targetKcal}` : ""}
          </span>
        </div>
        {meals.length === 0 ? (
          <p className="text-sm text-faint">
            Henüz öğün yok. Yemek sekmesinden fotoğrafla ekleyebilirsin.
          </p>
        ) : (
          meals.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between gap-2 rounded-xl border border-border bg-surface p-3 text-sm"
            >
              <div>
                <strong className="text-fg">{m.name}</strong>
                <p className="text-faint">
                  ~{Number(m.calories)} kcal · P {Number(m.protein_g)}g · Y{" "}
                  {Number(m.fat_g)}g · K {Number(m.carbs_g)}g
                </p>
              </div>
              <form action={deleteMeal}>
                <input type="hidden" name="id" value={m.id} />
                <button className="text-faint hover:text-red-400" aria-label="Sil">
                  ✕
                </button>
              </form>
            </div>
          ))
        )}
      </section>
```

- [ ] **Step 3: Derleme** — `npm run build` → hatasız.

- [ ] **Step 4: Commit**
```bash
git add "src/app/(app)/gunluk/actions.ts" "src/app/(app)/gunluk/page.tsx"
git commit -m "feat: show today's meals + total kcal vs target on daily page, with delete"
```

---

### Task 5: Tam doğrulama + README

**Files:** Modify `README.md`

- [ ] **Step 1: README yol haritasına ekle**

`README.md` roadmap listesine ekle:
```markdown
- [x] v2-E2 — Yemek tahminini günlüğe ekle (öğünler + toplam kalori)
```

- [ ] **Step 2: Tam doğrulama** — `npm test && npm run build && npm run e2e`
Expected: 32 birim PASS, build temiz (`/yemek` ve `/gunluk` route'ları), e2e 2/2.

- [ ] **Step 3: Commit**
```bash
git add README.md
git commit -m "docs: mark v2-E2 (meals log) complete in roadmap"
```

---

## Self-Review Notu (yazar tarafından dolduruldu)

- **Kapsam:** Vision döngüsünü kapatır: tahmin → "Bugüne ekle" → `meals` kaydı → `/gunluk`'ta öğün listesi + toplam kcal (aktif plan hedefiyle kıyas) + silme. B (vücut/belge foto) ve daha zengin öğün düzenleme sonraki dilimlerde (YAGNI).
- **Tip tutarlılığı:** `FoodEstimate` alanları (name/calories/proteinG/fatG/carbsG) → uploader FormData → `addMeal` → `meals` kolonları (snake_case: protein_g/fat_g/carbs_g). `/gunluk` okurken `Number()` ile sarılır (numeric → string gelebilir; Plan 2/3 reviewer notu). `todayInTR()` hem addMeal hem /gunluk sorgusunda → aynı gün eşleşir.
- **Güvenlik:** `meals` RLS select/insert/delete hepsi `auth.uid() = user_id` (insert with check). deleteMeal ayrıca `.eq("user_id", user.id)` ile savunma derinliği. addMeal değer döndürür (UI onayı); deleteMeal redirect (sayfa tazelenir). name 120 karakterle sınırlı; sayısal alanlar negatif/NaN → 0.
- **Placeholder/regresyon:** e2e metin/role'e dayalı; yeni bölüm eklemek mevcut testleri bozmaz. estimateFood/saveDailyLog değişmez, yalnız aynı dosyalara yeni export/section eklenir.
