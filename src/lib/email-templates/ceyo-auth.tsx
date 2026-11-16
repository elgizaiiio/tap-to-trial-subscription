import * as React from 'react'
import { Section } from '@react-email/components'
import { CeyoShell, CodeBox, Eyebrow, Lead, Note, Pill, Title, safeLink } from './ceyo-shell'

/** Shared body for every sign-in, sign-up and account-security email. */
export function CeyoAuthEmail({ preview, eyebrow, title, lead, token, url, action, note }: {
  preview: string; eyebrow: string; title: string; lead: string
  token?: string | null; url?: string | null; action?: string; note?: string
}) {
  return (
    <CeyoShell preview={preview}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <Title>{title}</Title>
      <Lead>{lead}</Lead>
      {token ? <CodeBox code={token} /> : null}
      {url && action ? <Section style={{ margin: '24px 0 0' }}><Pill href={safeLink(url)}>{action}</Pill></Section> : null}
      <Note>{note ?? "Don't share this email with anyone. If you didn't ask for it, you can safely ignore it — nothing will change on your account."}</Note>
    </CeyoShell>
  )
}
