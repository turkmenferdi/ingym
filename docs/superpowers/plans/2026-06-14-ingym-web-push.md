# ingym — Hatırlatıcı Dilim 2: Web Push Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Gerçek push bildirimleri: kullanıcı "bildirimleri aç" der, abone olur; her akşam (cron) bugünü loglamamış kullanıcılara push gider.

**Architecture:** Service worker (`public/sw.js`) push gösterir. `push_subscriptions` tablosu abonelikleri tutar (RLS). Client `PushButton` SW kaydeder + izin ister + abone olur + `saveSubscription` action'ına yollar. Vercel cron `/api/cron/reminders`'ı çağırır; route service_role ile (RLS bypass) bugünü loglamamış aboneleri bulup `web-push` ile bildirir. CRON_SECRET ile korunur.

**Tech Stack:** Mevcut + **`web-push`** (kuruldu). Env'ler ayarlı: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` (Vercel prod + .env.local).

**iOS notu:** Web push iOS'ta yalnız ana ekrana eklenmiş PWA'da (16.4+) çalışır; PushButton desteklenmeyen durumu zarifçe gösterir.

---

### Task 1: `push_subscriptions` tablosu + web-push bağımlılığı

**Files:** Create `supabase/migrations/0007_push_subscriptions.sql`, commit `package.json`/`package-lock.json` (web-push)

- [ ] **Step 1: Migration**

Create `supabase/migrations/0007_push_subscriptions.sql`:
```sql
-- ingym: web push abonelikleri
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index if not exists push_subs_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "own subs select" on public.push_subscriptions;
create policy "own subs select" on public.push_subscriptions
  for select using (auth.uid() = user_id);

drop policy if exists "own subs insert" on public.push_subscriptions;
create policy "own subs insert" on public.push_subscriptions
  for insert with check (auth.uid() = user_id);

drop policy if exists "own subs delete" on public.push_subscriptions;
create policy "own subs delete" on public.push_subscriptions
  for delete using (auth.uid() = user_id);
```

- [ ] **Step 2: Management API ile uygula** (q.json repo dizinine, /tmp KULLANMA; token `$SUPABASE_ACCESS_TOKEN`)
```bash
node -e "const fs=require('fs');fs.writeFileSync('q.json',JSON.stringify({query:fs.readFileSync('supabase/migrations/0007_push_subscriptions.sql','utf8')}))"
curl -s -X POST "https://api.supabase.com/v1/projects/lxkhmmdfzqzgwuuafmko/database/query" -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" -d @q.json
rm q.json
```
Expected `[]`. Doğrula: tablo + RLS (önceki migration'lardaki gibi).

- [ ] **Step 3: Commit** (migration + web-push dep birlikte)
```bash
git add supabase/migrations/0007_push_subscriptions.sql package.json package-lock.json
git commit -m "feat: add push_subscriptions table + web-push dependency"
```

---

### Task 2: Service worker

**Files:** Create `public/sw.js`

- [ ] **Step 1: SW oluştur**

Create `public/sw.js`:
```js
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = {};
  }
  const title = data.title || "ingym";
  const body = data.body || "Bugünü loglamayı unutma!";
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: data.url || "/gunluk" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/gunluk";
  event.waitUntil(clients.openWindow(url));
});
```

- [ ] **Step 2: Derleme** — `npm run build` → hatasız (public/ statik kopyalanır).

- [ ] **Step 3: Commit**
```bash
git add public/sw.js
git commit -m "feat: add service worker for push notifications"
```

---

### Task 3: Abonelik action'ı + PushButton + dashboard'a ekle

**Files:** Create `src/app/(app)/_components/push-actions.ts`, Create `src/app/(app)/_components/PushButton.tsx`, Modify `src/app/(app)/dashboard/page.tsx`

- [ ] **Step 1: Server action**

Create `src/app/(app)/_components/push-actions.ts`:
```ts
"use server";

import { createClient } from "@/lib/supabase/server";

export async function saveSubscription(sub: {
  endpoint: string;
  p256dh: string;
  auth: string;
}): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { error } = await supabase.from("push_subscriptions").upsert(
    { user_id: user.id, endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
    { onConflict: "endpoint" }
  );
  return { ok: !error };
}
```

- [ ] **Step 2: PushButton client**

Create `src/app/(app)/_components/PushButton.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import { saveSubscription } from "./push-actions";

type Status = "idle" | "on" | "unsupported" | "working" | "denied";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export default function PushButton() {
  const [status, setStatus] = useState<Status>("idle");

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }
    navigator.serviceWorker
      .getRegistration()
      .then((reg) => reg?.pushManager.getSubscription())
      .then((sub) => {
        if (sub) setStatus("on");
      })
      .catch(() => {});
  }, []);

  async function enable() {
    setStatus("working");
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setStatus("denied");
        return;
      }
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) {
        setStatus("idle");
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });
      const json = sub.toJSON();
      const res = await saveSubscription({
        endpoint: sub.endpoint,
        p256dh: json.keys?.p256dh ?? "",
        auth: json.keys?.auth ?? "",
      });
      setStatus(res.ok ? "on" : "idle");
    } catch {
      setStatus("idle");
    }
  }

  if (status === "unsupported")
    return (
      <p className="text-xs text-faint">
        Bu cihaz bildirimleri desteklemiyor. (iPhone'da: Paylaş → Ana Ekrana Ekle, sonra aç.)
      </p>
    );
  if (status === "on")
    return <p className="text-sm text-accent">✓ Hatırlatıcı bildirimleri açık</p>;

  return (
    <button
      type="button"
      onClick={enable}
      disabled={status === "working"}
      className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-fg hover:bg-surface disabled:opacity-40"
    >
      {status === "working"
        ? "Açılıyor…"
        : status === "denied"
          ? "İzin reddedildi — tarayıcı ayarından aç"
          : "🔔 Hatırlatıcı bildirimlerini aç"}
    </button>
  );
}
```

- [ ] **Step 3: Dashboard'a ekle** — `dashboard/page.tsx`'te "Bugün" nudge `<section>`'ının İÇİNE (en sona) `<PushButton />` ekle; üstte import: `import PushButton from "@/app/(app)/_components/PushButton";`.

- [ ] **Step 4: Derleme** — `npm run build` → hatasız.

- [ ] **Step 5: Commit**
```bash
git add "src/app/(app)/_components/push-actions.ts" "src/app/(app)/_components/PushButton.tsx" "src/app/(app)/dashboard/page.tsx"
git commit -m "feat: push subscribe action + enable button on dashboard"
```

---

### Task 4: Cron route + vercel.json + proxy api istisnası

**Files:** Create `src/app/api/cron/reminders/route.ts`, Create `vercel.json`, Modify `src/proxy.ts`

- [ ] **Step 1: Cron route**

Create `src/app/api/cron/reminders/route.ts`:
```ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { todayInTR } from "@/lib/daily/today";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  webpush.setVapidDetails(
    "mailto:ferdi.turkmen@gmail.com",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );

  const today = todayInTR();
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth");
  const { data: logs } = await admin
    .from("daily_logs")
    .select("user_id")
    .eq("log_date", today);
  const loggedUsers = new Set((logs ?? []).map((l) => l.user_id));

  let sent = 0;
  let removed = 0;
  for (const s of subs ?? []) {
    if (loggedUsers.has(s.user_id)) continue;
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify({ title: "ingym", body: "Bugünü loglamayı unutma 💪", url: "/gunluk" })
      );
      sent++;
    } catch (e: unknown) {
      const code = (e as { statusCode?: number })?.statusCode;
      if (code === 404 || code === 410) {
        await admin.from("push_subscriptions").delete().eq("id", s.id);
        removed++;
      }
    }
  }

  return NextResponse.json({ sent, removed });
}
```

- [ ] **Step 2: vercel.json (cron)**

Create `vercel.json`:
```json
{
  "crons": [{ "path": "/api/cron/reminders", "schedule": "0 16 * * *" }]
}
```
(16:00 UTC = 19:00 TR akşam hatırlatması. Vercel cron UTC çalışır.)

- [ ] **Step 3: Proxy'yi API'den muaf tut**

`src/proxy.ts` matcher'ında `_next/static`'ten ÖNCE `api|` ekle:
```ts
matcher: ["/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.png$).*)"],
```

- [ ] **Step 4: Derleme** — `npm run build` → hatasız; route tablosunda `/api/cron/reminders`.

- [ ] **Step 5: Commit**
```bash
git add "src/app/api/cron/reminders/route.ts" vercel.json src/proxy.ts
git commit -m "feat: daily reminder cron route + vercel cron + proxy api exclusion"
```

---

### Task 5: README + doğrulama

**Files:** Modify `README.md`

- [ ] **Step 1: README** — roadmap'e: `- [x] Hatırlatıcı (web push + günlük cron)`. Ayrıca `.env.local.example`'a ekle:
```
# Web push (web-push generate-vapid-keys)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
CRON_SECRET=
# Supabase service role (cron için, RLS bypass) — GİZLİ
SUPABASE_SERVICE_ROLE_KEY=
```

- [ ] **Step 2: Tam doğrulama** — `npm test && npm run build && npm run e2e` → 32 PASS, build temiz, e2e 2/2.

- [ ] **Step 3: Commit**
```bash
git add README.md .env.local.example
git commit -m "docs: web push reminders + env example"
```

---

## Self-Review Notu (yazar tarafından dolduruldu)

- **Kapsam:** Gerçek web push. SW + abonelik + günlük cron. Bugünü loglamamış kullanıcılara akşam hatırlatma. iOS sınırı PushButton'da açıklanıyor.
- **Güvenlik:** Cron `CRON_SECRET` Bearer ile korumalı (Vercel cron env'i otomatik gönderir). `SUPABASE_SERVICE_ROLE_KEY` yalnız sunucuda (cron route), RLS bypass yalnız burada — abonelik okuma/silme + log kontrolü için. `VAPID_PRIVATE_KEY` sunucu-only; `NEXT_PUBLIC_VAPID_PUBLIC_KEY` zaten public olmalı. Abonelik tablosu RLS (kullanıcı kendi aboneliğini). Proxy artık `/api`'ye dokunmuyor.
- **Tip/dayanıklılık:** `saveSubscription` upsert `onConflict: endpoint`. Cron expired (404/410) abonelikleri siler. `runtime="nodejs"` (web-push Node API'leri). `todayInTR()` ile bugün.
- **Not:** Cron Vercel'de yalnız production'da ve Hobby planda günde 1 çalışır; `0 16 * * *` buna uygun. Test için route'a elle `Authorization: Bearer $CRON_SECRET` ile GET atılabilir.
