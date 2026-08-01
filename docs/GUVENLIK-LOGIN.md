# Login Güvenliği (finans.hidroteknik.com.tr)

Finans sistemi, müşterilere giden ödeme/mutabakat linkleri sayesinde **dışarıdan bilinen bir adres**.
Bu yüzden login ekranı özellikle korunur.

## Yapılanlar (canlı)

### 1. Bilgi sızıntısı kaldırıldı
Login footer'ında `"ss ile aynı Supabase Auth ve personel yetkileri kullanılır"` yazıyordu — bu,
saldırgana **hangi altyapının kullanıldığını ve tek bir personel şifresinin yeterli olduğunu**
söylüyordu. Kaldırıldı. Login ekranı artık altyapı/yetki bilgisi vermez.

### 2. Giriş sunucu tarafına alındı + brute-force kilidi
Giriş artık `POST /api/auth/giris` üzerinden yapılır (`lib/giris-limit.ts`):

| Kural | Limit |
|---|---|
| Aynı **kullanıcı** için başarısız deneme | 15 dk'da **5** → 15 dk kilit |
| Aynı **IP** için başarısız deneme | 15 dk'da **15** → 15 dk kilit |

- Denemeler `giris_denemeleri` tablosunda **sunucuda** tutulur (tarayıcıdan temizlenemez).
- Tablo RLS'li; `anon`/`authenticated` erişemez (yalnız `service_role`).
- Başarılı girişte kullanıcının başarısız sayacı sıfırlanır.
- **Neden sunucuda?** Giriş client'ta yapılıp sonuç bildirilseydi, saldırgan sahte "başarısız"
  bildirimiyle **başkasının hesabını kilitleyebilirdi** (lockout-DoS). Şifre doğrulaması da,
  deneme kaydı da sunucuda yapılır.
- Yanıtlar az bilgi verir: kullanıcı var/yok ayrımı sızdırılmaz.

### 3. CAPTCHA altyapısı (anahtar bekliyor)
Cloudflare Turnstile entegre edildi (`lib/captcha.ts` + login formu). **Anahtar yoksa devre dışıdır**
— giriş normal çalışır, kademeli devreye alınabilir.

Devreye almak için Vercel'e (production) eklenecek:
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` — widget anahtarı
- `TURNSTILE_SECRET_KEY` — sunucu doğrulama anahtarı

Anahtarlar: https://dash.cloudflare.com → Turnstile → Add site (ücretsiz, sınırsız).

## ⚠️ KRİTİK — bunu bilmeden güvende sayılmayın

Supabase **anon anahtarı herkese açıktır** (tarayıcıdaki JS içinde). Yani saldırgan login
sayfamızı hiç kullanmadan doğrudan şunu çağırabilir:

```
POST https://<proje>.supabase.co/auth/v1/token?grant_type=password
```

Bu durumda **bizim kilidimiz ve CAPTCHA'mız devreye girmez** — çünkü istek bizim sunucumuza hiç
uğramaz. Yukarıdaki katman, login formunu kullanan saldırganı durdurur ve görünürlük sağlar;
**API seviyesinde zorlayıcı koruma Supabase tarafında açılmalıdır.**

### Supabase Dashboard'da yapılacaklar (ZORUNLU)

`Authentication → Attack Protection` (proje: `ujmtoruicnmgoarwzhwp`):

1. **CAPTCHA protection: ON** — Turnstile/hCaptcha site key + secret girilir.
   Açıldığında Supabase, captcha token'ı olmayan **her** şifre girişini reddeder — doğrudan API
   çağrıları dahil. Asıl brute-force koruması budur.
   > Not: Supabase seviyesinde CAPTCHA açılırsa token **Supabase tarafından** tüketilir; bu durumda
   > `app/api/auth/giris` içinde kendi doğrulamamız yerine token'ın `signInWithPassword`'a
   > geçirilmesi gerekir (tek kullanımlık token iki kez doğrulanamaz). Açmadan önce haber verin.
2. **Leaked password protection: ON** — Supabase Security Advisor bunun kapalı olduğunu bildiriyor.
   Sızmış (HaveIBeenPwned) şifrelerin kullanılmasını engeller.
3. **Auth rate limits** — `Sign in / Sign up` saatlik limitini düşürün.
4. **MFA (2FA)** — finans erişimi olan personel için en güçlü koruma. Şifre çalınsa bile giriş olmaz.

### Ek öneriler
- `erisim_servis` yetkisini gerçekten ihtiyacı olan personelle sınırlayın (yüzey daralt).
- Şifre politikası: minimum uzunluk + karmaşıklık (Supabase Auth ayarlarından).
