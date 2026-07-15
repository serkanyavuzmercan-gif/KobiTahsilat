# WhatsApp gönderimi — ortak Baileys kuyruğu (gayri-resmi)

Tahsilat WhatsApp hatırlatmaları **Meta Cloud API ile DEĞİL**, ss'nin satın-alma prosedüründe
kullandığı **Baileys ofis botu** ile gönderilir. KobiTahsilat ile ss **aynı Supabase projesini**
(`hidroteknik-crm`) paylaştığı için ek bot/endpoint kurulmaz — KobiTahsilat sadece ortak kuyruğa yazar.

## Akış

```
KobiTahsilat (Vercel)                    Supabase (ortak)                 Ofis PC (Baileys bot)
────────────────────                     ────────────────                 ─────────────────────
/hatirlatma → "gönder"                                                    ss/tools/whatsapp-bot
  enqueueWhatsAppDM()  ───insert──▶  whatsapp_kuyruk (durum=bekliyor)
                                          ▲   │
                                          │   └──── ss GET /api/satin-alma/wa-kuyruk ◀──poll(10sn)──┘
  UI durum yoklar ◀──select durum──┐      │            (durum=bekliyor→gonderiliyor, atomik claim)
  /api/hatirlatma/whatsapp-durum   │      │                         │
                                   │      │        sock.sendMessage(grup_jid, {text})  ← DM veya grup
                                   └──────┴──── ss POST ack ────────┘  (durum=gonderildi/hata)
```

- **Üretici:** `lib/whatsapp-kuyruk.ts` → `enqueueWhatsAppDM()`. `grup_jid` alanına bireysel
  DM JID'i yazılır: `905XXXXXXXXX@s.whatsapp.net` (`phoneToWhatsAppJid`). `siparis_id/siparis_ids`
  boş bırakılır → ss ack'i `satin_alma_siparis`'e dokunmaz (çapraz etki yok).
- **Tüketici:** Ofis botu ss uç noktasını poll'ler ve `durum='bekliyor'` olan **tüm** satırları
  (kaynak ayırmadan) çeker. Bot `grup_jid`'i doğrudan Baileys `sendMessage`'a verir; Baileys grup
  (`@g.us`) ve birey (`@s.whatsapp.net`) JID'ini aynı şekilde işler → **DM için bot değişikliği gerekmez.**
- **Durum takibi:** UI, enqueue dönüşündeki `kuyrukId` ile `/api/hatirlatma/whatsapp-durum`'u
  yoklayıp `bekliyor → gonderildi/hata` geçişini gösterir. Bot heartbeat'i (`whatsapp_bot_state.son_poll_at`)
  panelde "bot çevrimiçi mi" olarak görünür (`loadBotDurum`).

## Neden gayri-resmi?

Meta Cloud API pahalı + 24 saat penceresi/onaylı şablon zorunluluğu getirir (soğuk mesaj
gönderemezsin). Baileys (WhatsApp Web protokolü) ile ofis hattından istediğin numaraya serbest
metin gönderilir. Ban riskini azaltmak için bot mesaj arası gecikme + saatlik tavan uygular
(bkz. `ss/tools/whatsapp-bot`).

## Sınırlar / notlar

- **Ortak kota:** Tahsilat DM'leri, botun satın-alma mesajlarıyla aynı hattı ve saatlik tavanı
  paylaşır. Yoğun günlerde kuyruk birikebilir (mesajlar kaybolmaz, sırayla gider).
- **Bot çevrimdışıysa** mesaj kuyrukta bekler; bot PC'si açılınca otomatik gider.
- **Gelen yanıtlar:** Bu sürümde müşterinin WhatsApp yanıtları KobiTahsilat'a otomatik düşmez
  (Meta webhook kaldırıldı; Baileys→app raporlaması ayrı bir iş). Yanıtlar botun bağlı olduğu
  telefonda görülür.
- **Env:** KobiTahsilat tarafında yalnız `WHATSAPP_SEND_ENABLED` (enqueue aç/kapa) + zaten var olan
  `SUPABASE_SERVICE_ROLE_KEY`. `WHATSAPP_BOT_SECRET` botun poll ettiği **ss** uç noktasındadır.
