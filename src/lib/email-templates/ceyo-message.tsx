import * as React from 'react'
import { Section } from '@react-email/components'
import { APP_URL, CeyoShell, Eyebrow, Lead, Note, Pill, Title } from './ceyo-shell'

/** Short account notice (task ready, account update) in the landing-page look. */
export function CeyoMessage({ name = '', eyebrow = 'Ceyo', title = 'Your workspace is ready', message = 'Open Ceyo to continue with your bots.', actionUrl = APP_URL, actionLabel = 'Open Ceyo' }: { name?: string; eyebrow?: string; title?: string; message?: string; actionUrl?: string; actionLabel?: string }) {
  const safeUrl = /^https:\/\/(web\.ceyo\.si|ceyo\.si|app\.ceyo\.si)(\/|$)/.test(actionUrl) ? actionUrl : APP_URL
  return (
    <CeyoShell preview={title}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <Title>{title}</Title>
      {name ? <Lead>Hi {name},</Lead> : null}
      <Lead>{message}</Lead>
      <Section style={{ margin: '24px 0 0' }}><Pill href={safeUrl}>{actionLabel}</Pill></Section>
      <Note>This is an account notification about your Ceyo workspace.</Note>
    </CeyoShell>
  )
}
