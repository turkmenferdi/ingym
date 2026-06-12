# ingym — Plan 1: Temel Altyapı (Foundation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kurulabilir, giriş/çıkış yapılabilen, test altyapısı kurulu, Vercel'e deploy edilebilen boş bir Next.js PWA iskeleti üretmek.

**Architecture:** Next.js (App Router, TypeScript) tek repo. Supabase Auth + Postgres. Saf mantık `lib/` altında test edilir. PWA manifest ile mobil-öncelikli, telefona kurulabilir. AI ve özellik kodu sonraki planlarda gelir; bu plan yalnızca sağlam zemini kurar.

**Tech Stack:** Next.js 15 (App Router) · TypeScript · Tailwind CSS · Vitest + Testing Library · Playwright (e2e) · @supabase/supabase-js + @supabase/ssr · Vercel

---

## Dosya Yapısı (bu planın sonunda var olacak)

```
ingym/
├── src/
│   ├── app/
│   │   ├── layout.tsx            # Kök layout, PWA meta, viewport
│   │   ├── page.tsx              # Açılış (landing) sayfası
│   │   ├── manifest.ts           # PWA manifest (Next metadata route)
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx     # Giriş/kayıt formu
│   │   │   └── actions.ts         # signIn / signUp / signOut server actions
│   │   └── (app)/
│   │       └── dashboard/page.tsx # Korumalı boş gösterge paneli
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts          # Tarayıcı Supabase istemcisi
│   │   │   └── server.ts          # Sunucu Supabase istemcisi (cookies)
│   │   └── env.ts                 # Ortam değişkeni doğrulama (saf, test edilir)
│   └── middleware.ts              # Oturum yenileme + korumalı rota yönlendirme
├── tests/
│   └── unit/
│       └── env.test.ts            # env doğrulama birim testi
├── e2e/
│   └── smoke.spec.ts              # Açılış sayfası e2e smoke testi
├── public/
│   ├── icon-192.png               # PWA ikon (placeholder, sonra değişir)
│   └── icon-512.png
├── .env.local.example
├── vitest.config.ts
├── playwright.config.ts
└── ... (next.config, tsconfig, vb. create-next-app'ten)
```

---

### Task 1: Next.js projesini scaffold et

**Files:**
- Create: tüm `create-next-app` çıktısı (`src/app/*`, `next.config.ts`, `tsconfig.json`, `package.json`, `tailwind` config)

> Not: Proje kökünde zaten `docs/` ve `.git` var. `create-next-app`'i mevcut dizine kuracağız.

- [ ] **Step 1: Projeyi mevcut dizine kur**

Run:
```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --no-turbopack
```
Sorarsa: mevcut dosyaları (docs/) koru → "Yes" / devam. Git başlatmayı atla (zaten repo var).

- [ ] **Step 2: Dev sunucusunun ayağa kalktığını doğrula**

Run:
```bash
npm run dev
```
Expected: `http://localhost:3000` üzerinde Next.js başlangıç sayfası açılır. Doğruladıktan sonra `Ctrl+C` ile durdur.

- [ ] **Step 3: Build'in geçtiğini doğrula**

Run:
```bash
npm run build
```
Expected: Build hatasız tamamlanır (`✓ Compiled successfully`).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app (TS, Tailwind, App Router)"
```

---

### Task 2: Vitest birim test altyapısı + ilk saf modül (env doğrulama)

**Files:**
- Create: `vitest.config.ts`
- Create: `src/lib/env.ts`
- Test: `tests/unit/env.test.ts`
- Modify: `package.json` (test script)

- [ ] **Step 1: Vitest bağımlılıklarını kur**

Run:
```bash
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom
```
Expected: Paketler `devDependencies`'e eklenir.

- [ ] **Step 2: Vitest config oluştur**

Create `vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    include: ["tests/unit/**/*.test.ts", "tests/unit/**/*.test.tsx"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
```

- [ ] **Step 3: Test script'ini ekle**

`package.json` içindeki `"scripts"` bloğuna ekle:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Failing test yaz**

Create `tests/unit/env.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { readEnv } from "@/lib/env";

describe("readEnv", () => {
  it("geçerli env'de değerleri döndürür", () => {
    const env = readEnv({
      NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
    });
    expect(env.supabaseUrl).toBe("https://x.supabase.co");
    expect(env.supabaseAnonKey).toBe("anon-key");
  });

  it("eksik değişkende anlamlı hata fırlatır", () => {
    expect(() => readEnv({})).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });
});
```

- [ ] **Step 5: Testin başarısız olduğunu doğrula**

Run:
```bash
npm test
```
Expected: FAIL — `Cannot find module '@/lib/env'` veya `readEnv is not a function`.

- [ ] **Step 6: Minimal implementasyon yaz**

Create `src/lib/env.ts`:
```ts
export type AppEnv = {
  supabaseUrl: string;
  supabaseAnonKey: string;
};

export function readEnv(source: Record<string, string | undefined>): AppEnv {
  const supabaseUrl = source.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = source.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) throw new Error("Eksik ortam değişkeni: NEXT_PUBLIC_SUPABASE_URL");
  if (!supabaseAnonKey) throw new Error("Eksik ortam değişkeni: NEXT_PUBLIC_SUPABASE_ANON_KEY");

  return { supabaseUrl, supabaseAnonKey };
}
```

- [ ] **Step 7: Testin geçtiğini doğrula**

Run:
```bash
npm test
```
Expected: PASS — 2 test geçer.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "test: add Vitest infra and env validation module"
```

---

### Task 3: Ortam değişkenleri ve Supabase istemcileri

**Files:**
- Create: `.env.local.example`
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`

> Not: Gerçek Supabase projesi (URL + anon key) kullanıcı tarafından oluşturulup `.env.local`'a girilir. Bu görev sadece kod iskeletini kurar; testler bağlantı gerektirmez.

- [ ] **Step 1: Supabase paketlerini kur**

Run:
```bash
npm install @supabase/supabase-js @supabase/ssr
```
Expected: Paketler `dependencies`'e eklenir.

- [ ] **Step 2: Örnek env dosyası oluştur**

Create `.env.local.example`:
```bash
# Supabase proje ayarlarından kopyala (Settings → API)
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR-ANON-KEY
```

- [ ] **Step 3: Tarayıcı istemcisini oluştur**

Create `src/lib/supabase/client.ts`:
```ts
import { createBrowserClient } from "@supabase/ssr";
import { readEnv } from "@/lib/env";

export function createClient() {
  const { supabaseUrl, supabaseAnonKey } = readEnv(process.env);
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
```

- [ ] **Step 4: Sunucu istemcisini oluştur**

Create `src/lib/supabase/server.ts`:
```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { readEnv } from "@/lib/env";

export async function createClient() {
  const cookieStore = await cookies();
  const { supabaseUrl, supabaseAnonKey } = readEnv(process.env);

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Server Component'ten çağrıldığında set engellenebilir; middleware yeniler.
        }
      },
    },
  });
}
```

- [ ] **Step 5: Build'in geçtiğini doğrula**

Run:
```bash
npm run build
```
Expected: TypeScript/derleme hatası yok.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add Supabase browser/server clients and env example"
```

---

### Task 4: Middleware ile oturum yenileme + rota koruması

**Files:**
- Create: `src/middleware.ts`

- [ ] **Step 1: Middleware oluştur**

Create `src/middleware.ts`:
```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { readEnv } from "@/lib/env";

const PROTECTED_PREFIXES = ["/dashboard"];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { supabaseUrl, supabaseAnonKey } = readEnv(process.env);

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isProtected = PROTECTED_PREFIXES.some((p) =>
    request.nextUrl.pathname.startsWith(p)
  );

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.png$).*)"],
};
```

- [ ] **Step 2: Build'in geçtiğini doğrula**

Run:
```bash
npm run build
```
Expected: Derleme hatası yok.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add auth middleware with session refresh and route guard"
```

---

### Task 5: Auth server actions (signUp / signIn / signOut)

**Files:**
- Create: `src/app/(auth)/actions.ts`

- [ ] **Step 1: Auth actions oluştur**

Create `src/app/(auth)/actions.ts`:
```ts
"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signUp(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const supabase = await createClient();

  const { error } = await supabase.auth.signUp({ email, password });
  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`);
  redirect("/dashboard");
}

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`);
  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
```

- [ ] **Step 2: Build'in geçtiğini doğrula**

Run:
```bash
npm run build
```
Expected: Derleme hatası yok.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add signUp/signIn/signOut server actions"
```

---

### Task 6: Login sayfası, korumalı dashboard, landing

**Files:**
- Create: `src/app/(auth)/login/page.tsx`
- Create: `src/app/(app)/dashboard/page.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Login sayfasını oluştur**

Create `src/app/(auth)/login/page.tsx`:
```tsx
import { signIn, signUp } from "../actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-bold">ingym</h1>
      {error && <p className="rounded bg-red-100 p-2 text-sm text-red-700">{error}</p>}
      <form className="flex flex-col gap-3">
        <input
          name="email"
          type="email"
          required
          placeholder="E-posta"
          className="rounded border p-3"
        />
        <input
          name="password"
          type="password"
          required
          placeholder="Şifre"
          className="rounded border p-3"
        />
        <button
          formAction={signIn}
          className="rounded bg-black p-3 font-medium text-white"
        >
          Giriş yap
        </button>
        <button
          formAction={signUp}
          className="rounded border p-3 font-medium"
        >
          Kayıt ol
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 2: Korumalı dashboard oluştur**

Create `src/app/(app)/dashboard/page.tsx`:
```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "../../(auth)/actions";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 p-6">
      <h1 className="text-2xl font-bold">Merhaba 👋</h1>
      <p className="text-gray-600">{user.email}</p>
      <p className="text-sm text-gray-500">
        Burası boş gösterge paneli. Onboarding ve program özellikleri sonraki planlarda gelecek.
      </p>
      <form action={signOut}>
        <button className="rounded border p-3 font-medium">Çıkış yap</button>
      </form>
    </main>
  );
}
```

- [ ] **Step 3: Landing sayfasını sadeleştir**

Replace `src/app/page.tsx` içeriğini tamamen şununla:
```tsx
import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 p-6 text-center">
      <h1 className="text-4xl font-bold">ingym</h1>
      <p className="text-gray-600">Kişisel AI spor koçun ve diyetisyenin.</p>
      <Link href="/login" className="rounded bg-black px-6 py-3 font-medium text-white">
        Başla
      </Link>
    </main>
  );
}
```

- [ ] **Step 4: Build + manuel doğrulama**

Run:
```bash
npm run build && npm run dev
```
Expected: Build geçer. `http://localhost:3000` açılış sayfasını gösterir; "Başla" → `/login`. (Gerçek giriş için `.env.local` + Supabase projesi gerekir.) Doğruladıktan sonra `Ctrl+C`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add landing, login page, and protected dashboard"
```

---

### Task 7: PWA manifest + mobil-öncelikli layout

**Files:**
- Create: `src/app/manifest.ts`
- Create: `public/icon-192.png`, `public/icon-512.png`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Placeholder ikonları oluştur**

Run (1x1 PNG placeholder; sonra gerçek ikonlarla değiştirilir):
```bash
node -e "const fs=require('fs');const b=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','base64');fs.writeFileSync('public/icon-192.png',b);fs.writeFileSync('public/icon-512.png',b);"
```
Expected: İki PNG dosyası `public/` altında oluşur.

- [ ] **Step 2: Manifest route oluştur**

Create `src/app/manifest.ts`:
```ts
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ingym — AI Spor Koçu",
    short_name: "ingym",
    description: "Kişisel AI spor koçu ve diyetisyen.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#000000",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
```

- [ ] **Step 3: Layout'a viewport + tema ekle**

Replace `src/app/layout.tsx` içeriğini tamamen şununla:
```tsx
import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ingym",
  description: "Kişisel AI spor koçu ve diyetisyen.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "ingym", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr">
      <body className="antialiased">{children}</body>
    </html>
  );
}
```

- [ ] **Step 4: Manifest'in sunulduğunu doğrula**

Run:
```bash
npm run dev
```
Expected: `http://localhost:3000/manifest.webmanifest` JSON manifest döndürür. DevTools → Application → Manifest "installable" gösterir. Doğruladıktan sonra `Ctrl+C`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add PWA manifest, icons, and mobile-first layout"
```

---

### Task 8: Playwright e2e smoke testi

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/smoke.spec.ts`
- Modify: `package.json` (e2e script)

- [ ] **Step 1: Playwright kur**

Run:
```bash
npm install -D @playwright/test && npx playwright install chromium
```
Expected: Playwright + Chromium kurulur.

- [ ] **Step 2: Playwright config oluştur**

Create `playwright.config.ts`:
```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  use: { baseURL: "http://localhost:3000" },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

- [ ] **Step 3: e2e script ekle**

`package.json` `"scripts"` bloğuna ekle:
```json
"e2e": "playwright test"
```

- [ ] **Step 4: Failing smoke testi yaz**

Create `e2e/smoke.spec.ts`:
```ts
import { test, expect } from "@playwright/test";

test("açılış sayfası yüklenir ve login'e yönlendirir", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "ingym" })).toBeVisible();
  await page.getByRole("link", { name: "Başla" }).click();
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByPlaceholder("E-posta")).toBeVisible();
});
```

- [ ] **Step 5: Testi çalıştır**

Run:
```bash
npm run e2e
```
Expected: PASS — smoke testi geçer (Playwright dev sunucusunu kendi başlatır).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "test: add Playwright e2e smoke test"
```

---

### Task 9: README + Vercel deploy notları

**Files:**
- Create/Modify: `README.md`
- Modify: `.gitignore` (zaten `.env*` içeriyor olmalı — doğrula)

- [ ] **Step 1: .env.local'ın ignore edildiğini doğrula**

Run:
```bash
git check-ignore .env.local
```
Expected: `.env.local` yazdırılır (ignore ediliyor). Edilmiyorsa `.gitignore`'a `.env*.local` satırını ekle.

- [ ] **Step 2: README yaz**

Replace `README.md` içeriğini tamamen şununla:
```markdown
# ingym

Kişisel AI spor koçu ve diyetisyen (PWA). Next.js + Supabase + Gemini.

## Kurulum

1. `cp .env.local.example .env.local` ve Supabase değerlerini gir
   (Supabase → proje oluştur → Settings → API → URL + anon key).
2. `npm install`
3. `npm run dev` → http://localhost:3000

## Komutlar

- `npm run dev` — geliştirme sunucusu
- `npm run build` — production build
- `npm test` — birim testler (Vitest)
- `npm run e2e` — uçtan uca testler (Playwright)

## Deploy (Vercel)

1. Repoyu GitHub'a push et.
2. Vercel'de "Import Project" ile repoyu bağla.
3. Environment Variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Her `git push` otomatik deploy; her PR preview URL alır.

## Yol Haritası

- [x] Plan 1 — Temel altyapı (auth, PWA, test)
- [ ] Plan 2 — Onboarding anketi (A)
- [ ] Plan 3 — Program üretimi (C)
- [ ] Plan 4 — Günlük takip + feedback (D)
```

- [ ] **Step 3: Tüm testlerin ve build'in geçtiğini doğrula**

Run:
```bash
npm test && npm run build
```
Expected: Birim testler PASS, build başarılı.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "docs: add README and Vercel deploy notes"
```

---

## Self-Review Notu (yazar tarafından dolduruldu)

- **Spec kapsamı:** Bu plan spec'teki "F — Çapraz platform kabuk" + auth temelini ve test/CI altyapısını karşılar. A/C/D özellikleri bilinçli olarak sonraki planlara bırakıldı.
- **Placeholder taraması:** Kod adımları tam; tek "placeholder" PNG ikonları kasıtlı (gerçek tasarım sonra), açıkça belirtildi.
- **Tip tutarlılığı:** `readEnv` → `{ supabaseUrl, supabaseAnonKey }` tüm dosyalarda aynı; Supabase `createClient` sunucu tarafında `await`'li, tarayıcıda senkron — kullanım yerleriyle tutarlı.
