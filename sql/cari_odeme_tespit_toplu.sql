-- ÖDEME TESPİTİ (evrak bazında) — orantılı hatırlatma kuralının veri kaynağı.
-- Uygulandı: 2026-08-19 (Supabase projesi ujmtoruicnmgoarwzhwp).
--
-- NEDEN EVRAK BAZINDA? Toplam bakiye farkı ödemeyi GİZLER: müşteri 50.000 ₺ öderken aynı hafta
-- 30.000 ₺'lik yeni fatura kesilirse net düşüş 20.000 ₺ görünür ve ödeme küçük sanılır.
-- Burada her evrakın (evrak_no/belge_no) kendi azalışı ayrı toplanır; yeni evraklar toplamı
-- kirletmez (greatest(...,0) sayesinde artışlar ödemeden düşülmez).
--
-- Karşılaştırma iki snapshot arasıdır: en güncel snapshot ile p_gun gün öncesinin snapshot'ı.
-- Yalnız BUGÜN hâlâ borcu olan cariler döner (borcu kapanan cariye zaten hatırlatma gitmez).
--
-- Kullanım: lib/odeme-tespit.ts → sonOdemeler() / cariSonOdeme()

create or replace function public.cari_odeme_tespit_toplu(p_gun integer default 7)
returns table(cari_kod text, odenen numeric, guncel_acik numeric, guncel_gecikmis numeric)
language sql
stable
as $function$
  with son as (
    select max(snapshot_tarihi) as t from vade_takip_tahsilat
  ),
  onceki as (
    select max(snapshot_tarihi) as t from vade_takip_tahsilat
    where snapshot_tarihi <= (select t from son) - p_gun
  ),
  eski as (
    select v.cari_kod,
           coalesce(nullif(v.evrak_no,''), v.belge_no, '') as anahtar,
           sum(v.tutar) as tutar
    from vade_takip_tahsilat v
    where v.snapshot_tarihi = (select t from onceki)
    group by 1,2
  ),
  yeni as (
    select v.cari_kod,
           coalesce(nullif(v.evrak_no,''), v.belge_no, '') as anahtar,
           sum(v.tutar) as tutar
    from vade_takip_tahsilat v
    where v.snapshot_tarihi = (select t from son)
    group by 1,2
  ),
  odeme as (
    select e.cari_kod,
           sum(greatest(e.tutar - coalesce(y.tutar, 0), 0)) as odenen
    from eski e
    left join yeni y on y.cari_kod = e.cari_kod and y.anahtar = e.anahtar
    group by e.cari_kod
  ),
  bugun as (
    select v.cari_kod,
           sum(v.tutar) as acik,
           sum(v.tutar) filter (where v.vade_tarihi < (select t from son)) as gecikmis
    from vade_takip_tahsilat v
    where v.snapshot_tarihi = (select t from son)
    group by v.cari_kod
  )
  select b.cari_kod,
         round(coalesce(o.odenen, 0)::numeric, 2),
         round(coalesce(b.acik, 0)::numeric, 2),
         round(coalesce(b.gecikmis, 0)::numeric, 2)
  from bugun b
  left join odeme o on o.cari_kod = b.cari_kod;
$function$;

-- Yalnız sunucu (service_role) çağırır. `from public` TEK BAŞINA YETMEZ — Supabase yeni
-- fonksiyonları anon/authenticated'a DOĞRUDAN grant eder, ikisi de açıkça alınmalıdır.
revoke all on function public.cari_odeme_tespit_toplu(integer) from public, anon, authenticated;

-- Doğrulama (ikisi de false dönmeli):
-- select has_function_privilege('anon', 'public.cari_odeme_tespit_toplu(integer)', 'EXECUTE'),
--        has_function_privilege('authenticated', 'public.cari_odeme_tespit_toplu(integer)', 'EXECUTE');
