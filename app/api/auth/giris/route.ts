import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { girisKontrol, girisKaydet, istekIp, normalizeKullanici } from '@/lib/giris-limit'
import { captchaDogrula, captchaZorunlu } from '@/lib/captcha'

export const dynamic = 'force-dynamic'

/**
 * SUNUCU TARAFI GİRİŞ — brute-force kilidi + CAPTCHA burada uygulanır.
 * Girişi client'ta yapıp sonucu bildirmek SAHTE olabilirdi (saldırgan başkasının hesabını
 * kilitleyebilirdi); bu yüzden şifre doğrulaması da, deneme kaydı da sunucuda yapılır.
 *
 * Yanıtlar bilerek AZ BİLGİ verir: kullanıcı var/yok ayrımı sızdırılmaz.
 */
export async function POST(request: Request) {
  const ip = istekIp(request)
  let kullanici = ''
  try {
    const body = (await request.json()) as {
      username?: string
      password?: string
      captchaToken?: string
    }
    kullanici = normalizeKullanici(body.username)
    const password = String(body.password || '')
    if (!kullanici || !password) {
      return NextResponse.json({ success: false, error: 'Kullanıcı adı ve şifre gerekli.' }, { status: 400 })
    }

    // 1) Kilit kontrolü (kullanıcı + IP)
    const kilit = await girisKontrol(kullanici, ip)
    if (kilit.bloke) {
      const dk = Math.max(1, Math.ceil(kilit.kalanSaniye / 60))
      return NextResponse.json(
        {
          success: false,
          bloke: true,
          error: `Çok fazla başarısız deneme. Güvenlik nedeniyle giriş ${dk} dakika süreyle kilitlendi.`,
        },
        { status: 429 }
      )
    }

    // 2) CAPTCHA — KADEMELİ.
    //    Token varsa DAİMA doğrulanır (geçersizse reddedilir).
    //    Token yoksa: yalnızca bu kullanıcı/IP'de yakın zamanda başarısız deneme VARSA reddedilir.
    //    Neden? Turnstile widget'ı (Cloudflare erişilemezse/JS engelliyse) yüklenemezse temiz
    //    girişte personel kilitlenmesin; saldırgan ise ilk hatasından sonra CAPTCHA'ya takılır.
    //    Brute-force kilidi zaten ayrıca çalışıyor (5 hata → 15 dk).
    const token = body.captchaToken || ''
    if (captchaZorunlu() && (token || kilit.basarisizSayisi > 0)) {
      const ok = await captchaDogrula(token, ip)
      if (!ok) {
        await girisKaydet(kullanici, ip, false)
        return NextResponse.json(
          { success: false, error: 'Güvenlik doğrulaması başarısız. Sayfayı yenileyip tekrar deneyin.' },
          { status: 400 }
        )
      }
    }

    // 3) Şifre doğrulama (oturum çerezleri bu route'ta set edilir)
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !anon) throw new Error('Supabase yapılandırılmadı')

    const cookieStore = await cookies()
    const supabase = createServerClient(url, anon, {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(list) {
          list.forEach(({ name, value, options }) => {
            try {
              cookieStore.set(name, value, options)
            } catch {
              /* yoksay */
            }
          })
        },
      },
    })

    const { data, error } = await supabase.auth.signInWithPassword({
      email: kullanici,
      password,
    })

    if (error || !data.user) {
      await girisKaydet(kullanici, ip, false)
      return NextResponse.json(
        { success: false, error: 'Geçersiz kullanıcı adı veya şifre.' },
        { status: 401 }
      )
    }

    // 4) Yetki kontrolü (aktif personel + servis erişimi)
    const { data: personel } = await supabase
      .from('personel')
      .select('aktif, erisim_servis')
      .eq('user_id', data.user.id)
      .single()

    if (!personel || !personel.aktif || !personel.erisim_servis) {
      await supabase.auth.signOut()
      await girisKaydet(kullanici, ip, false)
      return NextResponse.json(
        { success: false, error: 'Bu sisteme erişim yetkiniz yok.' },
        { status: 403 }
      )
    }

    await girisKaydet(kullanici, ip, true)
    return NextResponse.json({ success: true })
  } catch (cause) {
    console.error('[giris]', cause)
    if (kullanici) await girisKaydet(kullanici, ip, false)
    return NextResponse.json({ success: false, error: 'Giriş sırasında hata oluştu.' }, { status: 500 })
  }
}
