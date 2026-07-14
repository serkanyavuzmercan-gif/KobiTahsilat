import 'server-only'
import { Resend } from 'resend'

export async function sendMail(options: {
  to: string[]
  subject: string
  html: string
  text: string
  attachments?: Array<{ filename: string; content: string; contentType: string }>
}) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.MAIL_FROM
  if (!apiKey || !from) throw new Error('E-posta servisi yapılandırılmadı')

  const resend = new Resend(apiKey)
  const { data, error } = await resend.emails.send({
    from,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text,
    attachments: options.attachments,
  })
  if (error) throw new Error(error.message)
  return data
}
