# ingym — UI/Navigasyon Sprinti (Dark + Neon, merkezi token) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Uygulamaya tutarlı bir görsel kimlik (koyu zemin + neon lime vurgu) ve kalıcı **alt menü (bottom nav)** kazandırmak; "çok basic, geri/navigasyon yok" sorununu çözmek. İşlevsellik değişmez — yalnız sunum + gezinme.

**Architecture:** Palet **tek yerde** tanımlanır: `globals.css` içinde Tailwind v4 `@theme` ile **semantic renk token'ları** (CSS değişkenleri). Bileşenler `bg-surface`, `text-muted`, `bg-accent` gibi anlamlı sınıflar kullanır — neon tonu değişince tek dosya düzenlenir. `(app)` route group'una `layout.tsx` + `BottomNav` (client, aktif sekme; `/onboarding`'de gizli) eklenir. Yeni bağımlılık YOK.

**Tech Stack:** Mevcut (Next.js 16, Tailwind v4, TS).

---

## Semantic Token Sözlüğü (tüm görevlerde bunlar kullanılır)

Task 1 bu token'ları `globals.css` `@theme`'inde tanımlar; Tailwind otomatik olarak `bg-*`/`text-*`/`border-*` utility'lerini üretir.

| Token (CSS var) | Değer | Üretilen sınıflar | Amaç |
|---|---|---|---|
| `--color-base` | `#0a0a0a` | `bg-base` | Sayfa zemini |
| `--color-surface` | `#171717` | `bg-surface` | Kart/panel/input zemini |
| `--color-border` | `#262626` | `border-border` | Kenarlık |
| `--color-fg` | `#fafafa` | `text-fg` | Birincil metin |
| `--color-muted` | `#a3a3a3` | `text-muted` | İkincil metin |
| `--color-faint` | `#737373` | `text-faint` | Soluk/küçük metin |
| `--color-accent` | `#a3e635` | `bg-accent` / `text-accent` / `border-accent` | Neon lime vurgu |
| `--color-accent-hover` | `#bef264` | `bg-accent-hover` | Buton hover |

**Bileşen sınıf reçeteleri (token'lardan türetilmiş — bunları aynen kullan):**

| Amaç | className |
|------|-----------|
| Kart | `rounded-xl border border-border bg-surface p-4` |
| Birincil buton (neon) | `rounded-lg bg-accent px-6 py-3 font-semibold text-black hover:bg-accent-hover disabled:opacity-40` |
| İkincil buton | `rounded-lg border border-border px-6 py-3 font-medium text-fg hover:bg-surface` |
| Input/select/textarea | `rounded-lg border border-border bg-surface p-3 text-fg placeholder:text-faint` |
| Hata kutusu | `rounded-lg border border-red-900 bg-red-950 p-3 text-sm text-red-300` |
| Başarı/feedback kartı | `rounded-xl border border-accent/30 bg-accent/10 p-4` |
| Uyarı (amber) rozeti | `rounded-lg bg-amber-950/40 p-2 text-sm text-amber-300` |
| Alt menü çubuğu | `fixed inset-x-0 bottom-0 z-10 border-t border-border bg-base/95 backdrop-blur` |

**Mapping kuralı (yeniden stillerken):** `bg-black text-white` (birincil) → birincil buton; `border` tek başına (buton) → ikincil buton; `rounded border p-4` (kart) → kart; `rounded border p-3` (input) → input; `text-gray-600/500/400` → `text-muted`; `text-gray-400` (çok soluk) → `text-faint`; `text-gray-700` → `text-fg` ya da `text-muted`; `bg-red-100 text-red-700` → hata kutusu; `bg-green-50` → başarı kartı; `bg-amber-50 text-amber-800` → amber rozet. **Metin/`name`/`role`/placeholder/işlev DEĞİŞMEZ** (e2e testleri metne dayalı).

---

### Task 1: Merkezi tema token'ları (globals.css) + manifest/viewport

**Files:** Modify `src/app/globals.css`, Modify `src/app/manifest.ts`, Modify `src/app/layout.tsx`

- [ ] **Step 1: `globals.css`'i semantic token'larla koyu temaya çevir**

`src/app/globals.css` içeriğini TAMAMEN şununla değiştir:
```css
@import "tailwindcss";

@theme {
  --color-base: #0a0a0a;
  --color-surface: #171717;
  --color-border: #262626;
  --color-fg: #fafafa;
  --color-muted: #a3a3a3;
  --color-faint: #737373;
  --color-accent: #a3e635;
  --color-accent-hover: #bef264;
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}

body {
  background: var(--color-base);
  color: var(--color-fg);
  font-family: Arial, Helvetica, sans-serif;
}
```

- [ ] **Step 2: `manifest.ts` renklerini koyu yap**

`src/app/manifest.ts`: `background_color: "#ffffff"` → `"#0a0a0a"`; `theme_color: "#000000"` → `"#0a0a0a"`.

- [ ] **Step 3: `layout.tsx` viewport temasını koyu yap**

`src/app/layout.tsx`: `viewport` içindeki `themeColor: "#000000"` → `themeColor: "#0a0a0a"`. (body className'i `antialiased` kalır; zemin/renk globals.css'ten gelir.)

- [ ] **Step 4: Derlemeyi doğrula** — `npm run build` → hatasız. (Token'lar tanımlandı; henüz bileşenler eski sınıflarda olsa da derleme geçer.)

- [ ] **Step 5: Commit**
```bash
git add src/app/globals.css src/app/manifest.ts src/app/layout.tsx
git commit -m "feat(ui): central dark+neon design tokens via @theme"
```

---

### Task 2: Alt menü (BottomNav) + (app) layout

**Files:** Create `src/app/(app)/_components/BottomNav.tsx`, Create `src/app/(app)/layout.tsx`

- [ ] **Step 1: BottomNav client component'i oluştur**

Create `src/app/(app)/_components/BottomNav.tsx`:
```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/dashboard", label: "Panel", icon: "🏠" },
  { href: "/program", label: "Program", icon: "📋" },
  { href: "/gunluk", label: "Günlük", icon: "📅" },
];

export default function BottomNav() {
  const pathname = usePathname();

  // Onboarding akışında alt menü gösterme (kullanıcının henüz profili yok).
  if (pathname.startsWith("/onboarding")) return null;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-base/95 backdrop-blur">
      <div className="mx-auto flex max-w-md">
        {TABS.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(tab.href + "/");
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-3 text-xs ${
                active ? "text-accent" : "text-faint"
              }`}
            >
              <span className="text-lg leading-none">{tab.icon}</span>
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
```

- [ ] **Step 2: (app) layout'unu oluştur**

Create `src/app/(app)/layout.tsx`:
```tsx
import BottomNav from "./_components/BottomNav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="pb-20">
      {children}
      <BottomNav />
    </div>
  );
}
```

- [ ] **Step 3: Derleme** — `npm run build` → hatasız; route tablosu bozulmadan derlenir.

- [ ] **Step 4: Commit**
```bash
git add "src/app/(app)/_components/BottomNav.tsx" "src/app/(app)/layout.tsx"
git commit -m "feat(ui): bottom navigation + app shell layout"
```

---

### Task 3: Yükleniyor durumu (loading.tsx)

**Files:** Create `src/app/(app)/loading.tsx`

- [ ] **Step 1: Dark skeleton oluştur**

Create `src/app/(app)/loading.tsx`:
```tsx
export default function Loading() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 p-6">
      <div className="h-7 w-40 animate-pulse rounded bg-surface" />
      <div className="h-24 w-full animate-pulse rounded-xl bg-surface" />
      <div className="h-24 w-full animate-pulse rounded-xl bg-surface" />
    </main>
  );
}
```

- [ ] **Step 2: Derlemeyi doğrula** — `npm run build` → hatasız.

- [ ] **Step 3: Commit**
```bash
git add "src/app/(app)/loading.tsx"
git commit -m "feat(ui): dark loading skeleton for app routes"
```

---

### Task 4: Açılış + login + onboarding'i yeniden stille

**Files:** Modify `src/app/page.tsx`, `src/app/(auth)/login/page.tsx`, `src/app/(app)/onboarding/page.tsx`, `src/app/(app)/onboarding/form.tsx`, `src/app/(app)/onboarding/saglik-uyarisi/page.tsx`

Semantic token reçetelerini + mapping kuralını uygula. Metin/`name`/`role`/placeholder/işlev DEĞİŞMEZ.

- [ ] **Step 1: `src/app/page.tsx` (açılış)** —
  - `<h1 className="text-4xl font-bold">ingym</h1>` → `text-4xl font-bold text-accent`
  - alt açıklama `text-gray-600` → `text-muted`
  - "Başla" linki (`bg-black ... text-white`) → birincil buton reçetesi

- [ ] **Step 2: `login/page.tsx`** —
  - başlık `ingym` → `text-2xl font-bold text-accent`
  - hata kutusu → hata kutusu reçetesi
  - input'lar → input reçetesi
  - "Giriş yap" → birincil buton; "Kayıt ol" → ikincil buton

- [ ] **Step 3: `onboarding/page.tsx`** — açıklama `text-gray-500` → `text-muted`.

- [ ] **Step 4: `onboarding/form.tsx`** —
  - adım göstergesi `text-gray-400` → `text-faint`
  - `error` ve `errors` listesi kutuları → hata kutusu reçetesi
  - `inputCls` sabiti → input reçetesi
  - step 2 açıklama `text-gray-600` → `text-muted`
  - sağlık checkbox kutuları (`rounded border p-3`) → `rounded-lg border border-border p-3`
  - "Geri" → ikincil buton; "Devam"/"Profili oluştur" → birincil buton (mevcut `flex-1` korunur)

- [ ] **Step 5: `onboarding/saglik-uyarisi/page.tsx`** —
  - gövde `text-gray-700` → `text-muted`; not `text-gray-500` → `text-faint`
  - "Panele git" linki → birincil buton

- [ ] **Step 6: Derleme + e2e** — `npm run build` → hatasız; `npm run e2e` → 2/2 PASS.

- [ ] **Step 7: Commit**
```bash
git add src/app/page.tsx "src/app/(auth)/login/page.tsx" "src/app/(app)/onboarding"
git commit -m "feat(ui): restyle landing, login, onboarding to dark+neon"
```

---

### Task 5: Dashboard + program + gunluk'u yeniden stille

**Files:** Modify `src/app/(app)/dashboard/page.tsx`, `src/app/(app)/program/page.tsx`, `src/app/(app)/gunluk/page.tsx`, `src/app/(app)/gunluk/form.tsx`

- [ ] **Step 1: `dashboard/page.tsx`** —
  - `{user.email}` `text-gray-600` → `text-muted`
  - "Profilin" kartı (`rounded border p-4`) → kart reçetesi; içindeki `text-gray-600` → `text-muted`
  - amber uyarı → amber rozet reçetesi
  - "Programıma git" → birincil buton; "Günlük takip" → ikincil buton; "Çıkış yap" → ikincil buton
  - okuma-hatası ekranındaki `text-gray-600` → `text-muted`

- [ ] **Step 2: `program/page.tsx`** —
  - disclaimer `text-gray-400` → `text-faint`
  - özet/açıklama `text-gray-600/700` → `text-muted`
  - hata → hata kutusu reçetesi
  - iki `section` (`rounded border p-4`) → kart reçetesi; içlerindeki `text-gray-600` → `text-muted`, `text-gray-400` → `text-faint`
  - "Programımı oluştur" → birincil buton; "Yeniden oluştur" → ikincil buton

- [ ] **Step 3: `gunluk/page.tsx`** —
  - hata → hata kutusu reçetesi
  - feedback kartı (`rounded border bg-green-50 p-4`) → başarı/feedback kartı reçetesi; içindeki `text-gray-700/600` → `text-muted`
  - geçmiş kartları (`rounded border p-3 text-gray-600`) → `rounded-xl border border-border bg-surface p-3 text-muted`; içteki `text-gray-500` → `text-faint`

- [ ] **Step 4: `gunluk/form.tsx`** —
  - `inputCls` → input reçetesi
  - antrenman checkbox kutusu (`rounded border p-3`) → `rounded-lg border border-border p-3`
  - "Günü kaydet…" butonu → birincil buton

- [ ] **Step 5: Tam doğrulama** — `npm test && npm run build && npm run e2e` → 32 birim PASS, build temiz, e2e 2/2.

- [ ] **Step 6: Commit**
```bash
git add "src/app/(app)/dashboard/page.tsx" "src/app/(app)/program/page.tsx" "src/app/(app)/gunluk"
git commit -m "feat(ui): restyle dashboard, program, daily to dark+neon"
```

---

## Self-Review Notu (yazar tarafından dolduruldu)

- **Kapsam:** Yalnız sunum + gezinme; işlev/veri/RLS/AI dokunulmadı. Kullanıcının iki şikayetini karşılar: (1) navigasyon yok → kalıcı alt menü (Panel/Program/Günlük, aktif sekme neon); (2) çok basic → koyu tema + neon lime, tutarlı kart/buton/input.
- **Skill uygulaması (ui-design-system):** Palet **merkezi semantic token** olarak `@theme`'de tanımlandı (skill'in CSS-değişkeni yaklaşımı). Neon tonunu değiştirmek = `--color-accent`'i düzenlemek; bileşenlere dokunmaya gerek yok. (Skill'in Python üreteci açık-zemin paleti içindi; koyu-öncelikli token'lar elle, amaca uygun tanımlandı.)
- **Placeholder/tip:** Yeni dosyalar tam kod; restyle görevleri token reçetesi + net mapping ile (her satırı tekrar yazmak yerine sınıf eşlemesi).
- **Regresyon riski:** e2e metin/`role`/placeholder'a dayalı; restyle bunları değiştirmiyor → 2/2 geçmeli. Onboarding client-doğrulama fix'i korunur (yalnız className değişir).
- **Erişilebilirlik (WCAG):** `text-accent` (#a3e635) koyu zeminde (#0a0a0a) ~14:1 kontrast (AAA). Birincil buton `bg-accent text-black` yüksek kontrast. `text-muted` (#a3a3a3) zeminde ~9:1 (AA+). Alt menü sekme hedefleri ~48px yükseklik (≥44px dokunma hedefi).
