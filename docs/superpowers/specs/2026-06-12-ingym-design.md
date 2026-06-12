# ingym — v1 Tasarım Dokümanı

**Tarih:** 2026-06-12
**Durum:** Onaylandı (brainstorming çıktısı)
**Sonraki adım:** Uygulama planı (writing-plans)

---

## 1. Amaç & Kapsam

AI destekli kişisel spor koçu + diyetisyen PWA. Kullanıcı kaydolur, sağlık/yaşam
anketini doldurur; sistem kişiye özel **haftalık antrenman + beslenme planı** üretir;
kullanıcı **günlük log** tutar, AI **günlük feedback** verir.

### v1 kapsamı (bu spec)
- **A — Hesap + Onboarding anketi:** kayıt, profil, sağlık/yaşam soruları, kırmızı bayrak taraması
- **C — Program üretimi:** kurallı sayısal çekirdek + Gemini içerik kişiselleştirme (hibrit)
- **D — Günlük takip + AI feedback**

### v2'ye ertelendi (ayrı spec'ler)
- **B — Vücut/belge fotoğrafı okuma** (AI vision)
- **E — Yemek fotoğrafı → kalori/makro tahmini** (AI vision)
- **F — Gerçek native app store sürümü** (Capacitor sarmalama)

---

## 2. Teknoloji Kararları

| Alan | Karar | Gerekçe |
|------|-------|---------|
| Frontend + Backend | **Next.js (App Router)** tek repo | API route'lar içeride; tek kod tabanı |
| Platform | **PWA** (mobil-öncelikli responsive) | "Hem mobil hem web"; telefona kurulabilir; Vercel ile pürüzsüz |
| DB + Auth | **Supabase** (Postgres + Auth) | Hazır auth, ücretsiz katman, Vercel uyumlu |
| AI | **Google Gemini (ücretsiz katman)** | Cömert ücretsiz katman; **vision ücretsiz katmana dahil** → v2 foto özellikleri aynı API ile |
| Deploy | **Vercel** (otomatik, her PR'a preview) | Hızlı publish + geliştirme takibi |
| Kaynak | **GitHub** | Sürüm kontrolü, Vercel entegrasyonu |

### Program üretimi yaklaşımı: Kurallı + AI hibrit
- Kalori/makro ihtiyacı **kodla** hesaplanır (Mifflin-St Jeor + hedefe göre açık/fazla).
- Antrenman hacmi **kurallı** belirlenir (seviye + haftalık gün sayısı).
- Gemini **içeriği kişiselleştirir ve açıklar** (yemek önerileri, egzersiz seçimi, motivasyon, günlük feedback).
- Gerekçe: sağlık/kalori konusunda saf-AI halüsinasyon riski yüksek. Sayısal çekirdek kodda → güvenli ve tutarlı; AI uzmanlık + dil katmanı.

### Sağlık konumu: Genel sağlıklı yaşam aracı + sorumluluk reddi
- "Bilgilendirme amaçlıdır, tıbbi/teşhis aracı değildir" uyarısı.
- Onboarding'de **kırmızı bayrak taraması** (gebelik, kalp rahatsızlığı, diyabet, yeme bozukluğu geçmişi, aşırı düşük/yüksek BMI vb.).
- Kırmızı bayrak varsa agresif plan üretmeyip **hekime yönlendir**.

---

## 3. Mimari

```
Next.js App Router (Vercel)
├── Frontend (PWA, mobil-öncelikli, RSC + client components)
├── API Routes (/api/*)              ← backend mantığı
│   ├── /auth        → Supabase Auth
│   ├── /onboarding  → anket kaydet + kırmızı bayrak taraması
│   ├── /program     → plan üretimi (kurallı çekirdek + Gemini)
│   └── /daily       → günlük log kaydet + Gemini feedback
├── lib/
│   ├── nutrition/   → Mifflin-St Jeor, makro dağılımı (saf kod, test edilir)
│   ├── training/    → seviye→hacim kuralları (saf kod, test edilir)
│   ├── ai/          → Gemini sağlayıcı soyutlaması (provider-agnostic)
│   └── safety/      → kırmızı bayrak kuralları (saf kod, test edilir)
└── Supabase (Postgres) ← users, profiles, plans, daily_logs
```

**Tasarım ilkesi:** Sayısal ve güvenlik mantığı **saf fonksiyonlar** — AI'dan bağımsız,
kolay test edilir. AI yalnızca `lib/ai/` arkasında; sağlayıcı değişimi tek dosyada.
Bu, ücretsiz Gemini katmanından ileride ücretli/farklı sağlayıcıya geçişi (rate limit
ve veri gizliliği nedenleriyle olası) tek noktaya indirir.

---

## 4. Bileşenler (sorumluluk sınırları)

- **`lib/nutrition`** — Girdi: profil. Çıktı: BMR/TDEE, hedef kalori, protein/yağ/karbonhidrat. Gemini'ye dokunmaz.
- **`lib/training`** — Girdi: seviye + haftalık gün. Çıktı: antrenman iskeleti (split, set/tekrar aralığı). Saf kurallar.
- **`lib/safety`** — Girdi: anket cevapları. Çıktı: kırmızı bayrak listesi + plan üretilsin mi kararı.
- **`lib/ai`** — `generatePlanContent(targets, skeleton, profile)`, `dailyFeedback(log, plan)`. Gemini çağırır, yapılandırılmış JSON döndürür. Arayüz sağlayıcı-bağımsız.
- **API routes** — yukarıdaki modülleri birleştirir, Supabase'e yazar/okur, auth uygular.
- **UI** — Onboarding sihirbazı · Plan görünümü · Günlük log + feedback ekranı.

---

## 5. Veri Modeli (Postgres / Supabase)

- **`users`** — Supabase Auth tarafından yönetilir.
- **`profiles`** — `user_id`, yaş, cinsiyet, boy, kilo, aktivite seviyesi, hedef (ver/al/koru),
  antrenman tecrübesi, haftalık gün sayısı, **sağlık bayrakları** (jsonb).
- **`plans`** — `user_id`, oluşturma tarihi, kalori/makro hedefleri (jsonb),
  antrenman planı (jsonb), beslenme planı (jsonb), durum (aktif/arşiv).
- **`daily_logs`** — `user_id`, tarih, kilo (opsiyonel), tamamlanan antrenman,
  öğünler/notlar (serbest metin), **ai_feedback** (text).

---

## 6. Ana Akışlar

1. **Onboarding:** Kayıt → çok adımlı anket → kırmızı bayrak taraması → profil kaydı.
2. **Plan üretimi:** Profil → `nutrition` + `training` sayısal çekirdek → `safety` kontrolü
   → `ai.generatePlanContent` → `plans` tablosuna yaz → göster.
3. **Günlük döngü:** Kullanıcı günü loglar → `ai.dailyFeedback` → kısa kişisel geri bildirim
   + küçük ayar önerisi → kaydet & göster.

---

## 7. Hata Yönetimi

- **Gemini hatası / rate-limit:** Sayısal plan (kod) yine üretilir; AI içeriği "şu an
  oluşturulamadı, tekrar dene" ile zarifçe düşer — uygulama çökmez.
- **Geçersiz/eksik anket:** İstemci form validasyonu + API'de tekrar doğrulama.
- **Kırmızı bayrak:** Plan yerine hekime yönlendirme ekranı.

---

## 8. Test Stratejisi

- `lib/nutrition`, `lib/training`, `lib/safety` → **birim testleri** (saf fonksiyonlar).
- AI katmanı → sağlayıcı arayüzü üzerinden **mock'lanır**.
- Kritik akış → temel **e2e** (onboarding → plan üretimi).

---

## 9. Sorumluluk Reddi

Uygulama bir tıbbi tavsiye/teşhis aracı değildir; bilgilendirme amaçlıdır. Onboarding'de
kırmızı bayrak taraması yapılır ve riskli durumlarda kullanıcı bir sağlık profesyoneline
yönlendirilir.
