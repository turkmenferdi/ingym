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
