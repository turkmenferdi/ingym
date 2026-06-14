# ingym — Öğün Düzenleme (manuel ekleme + porsiyon) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (1) `/yemek`'te AI tahminini "Bugüne ekle"den önce **düzenlenebilir** yapmak + hızlı **porsiyon çarpanı** (½× / 1× / 1½× / 2×). (2) `/gunluk`'ta **elle öğün ekleme** (fotoğrafsız). Böylece kullanıcı porsiyona göre ayarlayabilir ve fotoğrafı olmayan öğünleri de loglayabilir.

**Architecture:** `/yemek` uploader'da tahmin sonucu read-only yerine düzenlenebilir alanlar (state) olur; porsiyon butonları orijinal tahmini çarpanla ölçekler. `addMeal` action zaten name+kalori+makro alıyor (değişmez). `/gunluk`'a `addMealManual` (redirect) action + küçük form eklenir; mevcut `meals` tablosu/`todayInTR` yeniden kullanılır.

**Tech Stack:** Mevcut. Yeni paket/tablo YOK.

---

## Dosya Yapısı

```
src/app/(app)/
├── yemek/uploader.tsx        # düzenlenebilir tahmin + porsiyon çarpanı (değişir)
└── gunluk/
    ├── actions.ts            # addMealManual eklenir (değişir)
    └── page.tsx              # elle öğün ekleme formu (değişir)
```

---

### Task 1: `/yemek` — düzenlenebilir tahmin + porsiyon çarpanı

**Files:** Modify `src/app/(app)/yemek/uploader.tsx`

Mevcut: başarılı tahminde read-only kart (name + "~X kcal · P · Y · K" + note) + "Bugüne ekle" butonu; `onAdd` `result.estimate`'ten FormData kurar.

- [ ] **Step 1: Düzenlenebilir state + porsiyon ekle**

`FoodUploader` component'inde (READ THE FILE FIRST):
(a) Yeni state ekle (mevcut state'lerin yanına):
```tsx
  const [edit, setEdit] = useState({ name: "", calories: 0, proteinG: 0, fatG: 0, carbsG: 0 });
```
(b) `onPick` içinde tahmin geldikten SONRA (yani `setResult(await estimateFood(fd))` çağrısından sonra) edit'i tahminle doldur. `onPick`'i şöyle güncelle — `estimateFood` sonucunu bir değişkene al, edit'i doldur, sonra setResult:
```tsx
      const res = await estimateFood(fd);
      if (res.ok) {
        setEdit({
          name: res.estimate.name,
          calories: res.estimate.calories,
          proteinG: res.estimate.proteinG,
          fatG: res.estimate.fatG,
          carbsG: res.estimate.carbsG,
        });
      }
      setResult(res);
```
(c) Porsiyon çarpanı fonksiyonu ekle (orijinal tahmini ölçekler):
```tsx
  function applyPortion(mult: number) {
    if (!result || !result.ok) return;
    const e = result.estimate;
    setEdit({
      name: e.name,
      calories: Math.round(e.calories * mult),
      proteinG: Math.round(e.proteinG * mult),
      fatG: Math.round(e.fatG * mult),
      carbsG: Math.round(e.carbsG * mult),
    });
  }
```
(d) `onAdd`'i edit değerlerini kullanacak şekilde güncelle (artık `result.estimate` yerine `edit`):
```tsx
  async function onAdd() {
    if (!result || !result.ok) return;
    setAdding(true);
    const fd = new FormData();
    fd.set("name", edit.name);
    fd.set("calories", String(edit.calories));
    fd.set("proteinG", String(edit.proteinG));
    fd.set("fatG", String(edit.fatG));
    fd.set("carbsG", String(edit.carbsG));
    const res = await addMeal(fd);
    setAdding(false);
    if (res.ok) setAdded(true);
  }
```

- [ ] **Step 2: Başarılı tahmin kartını düzenlenebilir yap**

`{result && result.ok && (...)}` bloğundaki kartın İÇİNİ şununla değiştir (mevcut `<h2>{result.estimate.name}</h2>` + makro `<p>` + note + ekle-butonu kısmı yerine). note için `result.estimate.note` kullanılır; girişler `edit`'e bağlanır:
```tsx
          <h2 className="font-semibold">Tahmin (düzenleyebilirsin)</h2>
          <label className="flex flex-col gap-1 text-sm text-muted">
            Yemek
            <input
              value={edit.name}
              onChange={(e) => setEdit({ ...edit, name: e.target.value })}
              className="rounded-lg border border-border bg-surface p-2 text-fg"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            {([
              ["calories", "Kalori"],
              ["proteinG", "Protein (g)"],
              ["fatG", "Yağ (g)"],
              ["carbsG", "Karb (g)"],
            ] as const).map(([key, label]) => (
              <label key={key} className="flex flex-col gap-1 text-xs text-faint">
                {label}
                <input
                  type="number"
                  inputMode="numeric"
                  value={edit[key]}
                  onChange={(e) => setEdit({ ...edit, [key]: Number(e.target.value) || 0 })}
                  className="rounded-lg border border-border bg-surface p-2 text-sm text-fg"
                />
              </label>
            ))}
          </div>
          <div className="flex gap-2">
            {[0.5, 1, 1.5, 2].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => applyPortion(m)}
                className="flex-1 rounded-lg border border-border py-1 text-xs font-medium text-fg hover:bg-surface"
              >
                {m === 0.5 ? "½×" : m === 1.5 ? "1½×" : `${m}×`}
              </button>
            ))}
          </div>
          <p className="text-xs text-faint">{result.estimate.note}</p>
```
(ekle-butonu / "✓ Bugüne eklendi" kısmı AYNEN kalır — bu bloğun sonunda.)

- [ ] **Step 3: Derleme + e2e** — `npm run build` → hatasız; `npm run e2e` → 2/2.

- [ ] **Step 4: Commit**
```bash
git add "src/app/(app)/yemek/uploader.tsx"
git commit -m "feat: editable food estimate + portion multiplier before adding"
```

---

### Task 2: `/gunluk` — elle öğün ekleme

**Files:** Modify `src/app/(app)/gunluk/actions.ts`, Modify `src/app/(app)/gunluk/page.tsx`

- [ ] **Step 1: addMealManual action'ı ekle**

`src/app/(app)/gunluk/actions.ts` SONUNA ekle (dosyada `redirect`, `createClient` zaten import'lu; `todayInTR` da import'lu — değilse ekle: `import { todayInTR } from "@/lib/daily/today";`):
```ts
export async function addMealManual(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return redirect("/login");

  const name = String(formData.get("name") ?? "").trim().slice(0, 120);
  const num = (k: string) => {
    const n = Number(String(formData.get(k) ?? "").replace(",", "."));
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };
  if (!name || num("calories") <= 0) {
    return redirect("/gunluk?error=" + encodeURIComponent("Öğün adı ve kalori gerekli."));
  }

  await supabase.from("meals").insert({
    user_id: user.id,
    log_date: todayInTR(),
    name,
    calories: num("calories"),
    protein_g: num("proteinG"),
    fat_g: num("fatG"),
    carbs_g: num("carbsG"),
  });
  return redirect("/gunluk");
}
```

- [ ] **Step 2: /gunluk sayfasına elle ekleme formu koy**

`src/app/(app)/gunluk/page.tsx`:
(a) import'a `addMealManual` ekle: `import { deleteMeal, addMealManual } from "./actions";` (mevcut `deleteMeal` import'una ekle).
(b) "Bugünün öğünleri" `<section>`'ının İÇİNDE, öğün listesinden SONRA (kapanış `</section>`'dan önce) elle ekleme formunu ekle:
```tsx
        <form action={addMealManual} className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-3">
          <p className="text-sm font-medium text-fg">Elle öğün ekle</p>
          <input
            name="name"
            placeholder="Öğün adı"
            required
            className="rounded-lg border border-border bg-base p-2 text-sm text-fg placeholder:text-faint"
          />
          <div className="grid grid-cols-4 gap-2">
            <input name="calories" type="number" inputMode="numeric" required placeholder="kcal"
              className="rounded-lg border border-border bg-base p-2 text-sm text-fg placeholder:text-faint" />
            <input name="proteinG" type="number" placeholder="P"
              className="rounded-lg border border-border bg-base p-2 text-sm text-fg placeholder:text-faint" />
            <input name="fatG" type="number" placeholder="Y"
              className="rounded-lg border border-border bg-base p-2 text-sm text-fg placeholder:text-faint" />
            <input name="carbsG" type="number" placeholder="K"
              className="rounded-lg border border-border bg-base p-2 text-sm text-fg placeholder:text-faint" />
          </div>
          <button className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-fg hover:bg-base">
            Ekle
          </button>
        </form>
```

- [ ] **Step 3: Derleme** — `npm run build` → hatasız.

- [ ] **Step 4: Commit**
```bash
git add "src/app/(app)/gunluk/actions.ts" "src/app/(app)/gunluk/page.tsx"
git commit -m "feat: manual meal add on daily page"
```

---

### Task 3: README + tam doğrulama

**Files:** Modify `README.md`

- [ ] **Step 1: README roadmap'e ekle** — `- [x] Öğün düzenleme (porsiyon + elle ekleme)`

- [ ] **Step 2: Tam doğrulama** — `npm test && npm run build && npm run e2e` → 32 PASS, build temiz, e2e 2/2.

- [ ] **Step 3: Commit**
```bash
git add README.md
git commit -m "docs: mark meal editing complete in roadmap"
```

---

## Self-Review Notu (yazar tarafından dolduruldu)

- **Kapsam:** İki UX boşluğunu kapatır: (1) AI tahmini düzeltilemiyordu → düzenlenebilir alanlar + porsiyon çarpanı; (2) fotoğrafsız öğün loglanamıyordu → /gunluk elle ekleme. Mevcut `meals` tablosu + `addMeal` deseni yeniden kullanıldı; yeni tablo/migration yok.
- **Tip tutarlılığı:** Porsiyon çarpanı/edit her zaman `result.estimate` (orijinal) üzerinden ölçekler; `onAdd` artık `edit`'i gönderir. `addMealManual` aynı `meals` kolonlarına (snake_case) yazar, `todayInTR()` ile tarih. Sayısal alanlar negatif/NaN → 0; kalori ≤0 ise elle ekleme reddedilir.
- **Güvenlik/regresyon:** `addMealManual` auth + RLS (meals insert with check). `addMeal` değişmedi. e2e metin/role'e dayalı; düzenlenebilir alanlar /yemek'te (auth arkası, e2e dokunmaz). /gunluk formu plain server-action form (redirect ile tazelenir, client component gerekmez).
