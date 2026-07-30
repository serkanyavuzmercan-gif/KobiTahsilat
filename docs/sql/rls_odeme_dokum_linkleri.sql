-- Supabase Security Advisor bulgusu: odeme_linkleri ve dokum_linkleri RLS'siz, anon+authenticated
-- tam CRUD yetkisine sahipti (SELECT/INSERT/UPDATE/DELETE/TRUNCATE). Doğrulandı: bu iki tabloya
-- erişen TÜM kod (lib/odeme-link.ts, lib/dokum-link.ts ve tüm çağıranları — app/o/[token],
-- app/d/[code], webhook route'ları) yalnız sunucu tarafında createAdminClient() (service_role,
-- 'server-only') kullanıyor. Tarayıcıdan anon anahtarla erişim YOK → RLS açmak + yetkileri geri
-- almak güvenli (service_role RLS'i bypass eder). Politika gerekmez.
--
-- Uygulandı: mcp__Supabase__apply_migration (2026-07-30). Doğrulama: anon REST çağrısı
-- "permission denied for table" (401) döndü; /o/<token> ve /d/<code> canlıda sorunsuz çalışmaya
-- devam ediyor (service_role bypass).

alter table public.odeme_linkleri enable row level security;
alter table public.dokum_linkleri enable row level security;

revoke all on public.odeme_linkleri from anon, authenticated;
revoke all on public.dokum_linkleri from anon, authenticated;
