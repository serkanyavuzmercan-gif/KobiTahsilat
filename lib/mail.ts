import 'server-only'
import { Resend } from 'resend'
import { gmailSendConfigured, sendGmail } from './gmail-send'

export async function sendMail(options: {
  to: string[]
  subject: string
  html: string
  text: string
  from?: string
  replyTo?: string
  attachments?: Array<{ filename: string; content: string; contentType: string }>
}) {
  // Birincil yol: Gmail (Workspace, GOOGLE_SA_KEY_B64 + GMAIL_SENDER). Resend ücretli olduğu
  // için yalnız Gmail yapılandırılmamışsa yedek olarak kullanılır.
  if (gmailSendConfigured()) {
    return sendGmail(options)
  }

  const apiKey = process.env.RESEND_API_KEY
  const from = options.from || process.env.MAIL_FROM
  if (!apiKey || !from) throw new Error('E-posta servisi yapılandırılmadı')

  const resend = new Resend(apiKey)
  const { data, error } = await resend.emails.send({
    from,
    to: options.to,
    replyTo: options.replyTo,
    subject: options.subject,
    html: options.html,
    text: options.text,
    attachments: options.attachments,
  })
  if (error) throw new Error(error.message)
  return data
}
