import * as React from 'react'
import { Column, Heading, Row, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { APP_URL, CeyoShell, Eyebrow, Lead, Pill, SITE_URL, Stage, Title, ink, line, muted, soft } from './ceyo-shell'

interface WelcomeProps { name?: string; trialEndsAt?: string }

const cols = [
  { n: '01', small: 'Your main bot', title: 'One bot that knows you', body: 'It remembers what matters and talks with you by voice.' },
  { n: '02', small: 'Groups', title: 'Bots in groups', body: 'Every bot replies on its own, no mention needed.' },
  { n: '03', small: 'Routines', title: 'Works on its own', body: 'Bots repeat tasks and bring you the result.' },
]

function trialDate(iso?: string): string | null {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' })
}

/** Welcome email that mirrors the public landing page section by section. */
export const WelcomeEmail = ({ name, trialEndsAt }: WelcomeProps) => {
  const until = trialDate(trialEndsAt)
  return (
    <CeyoShell preview={name ? `Welcome to Ceyo, ${name}. Your bots are ready.` : 'Welcome to Ceyo. Your bots are ready.'}>
      <Eyebrow center>Much more than an AI agent</Eyebrow>
      <Title center size={72}>Ceyo</Title>
      <Lead center>
        {name ? `Welcome, ${name}. ` : 'Welcome. '}Build a whole team of bots. Each one has its own computer and works on its own job, from marketing and coding to making and editing images and videos, so complete projects get done while you get on with your day.
      </Lead>
      <Section style={{ textAlign: 'center', margin: '28px 0 0' }}>
        <Pill href={APP_URL}>Start with Ceyo</Pill>
        <Pill href={`${SITE_URL}/#bots`} ghost>Meet the bots</Pill>
      </Section>
      <Stage />

      <Section style={{ margin: '56px 0 0', borderTop: `1px solid ${line}` }}>
        <Row>
          {[
            ['Free trial', until ? `3 days · until ${until}` : '3 days · eligible subscriptions'],
            ['Every bot', 'Its own computer'],
            ['Connects to', '1,000+ apps'],
          ].map(([k, v]) => (
            <Column key={k} style={{ paddingTop: 18, verticalAlign: 'top', width: '33%' }}>
              <Text style={{ fontSize: 12, color: muted, margin: '0 0 6px' }}>{k}</Text>
              <Text style={{ fontSize: 16, fontWeight: 500, color: ink, margin: 0 }}>{v}</Text>
            </Column>
          ))}
        </Row>
      </Section>

      <Text style={{ fontSize: 14, color: muted, margin: '64px 0 4px' }}>What Ceyo bots do</Text>
      {cols.map((c) => (
        <Section key={c.n} style={{ borderTop: `1px solid ${ink}`, padding: '18px 0 6px', marginTop: 18 }}>
          <Text style={{ fontSize: 12, color: muted, margin: 0 }}>{c.n} · {c.small}</Text>
          <Heading as="h3" style={{ fontSize: 22, fontWeight: 500, margin: '14px 0 6px', color: ink }}>{c.title}</Heading>
          <Text style={{ fontSize: 15, lineHeight: '1.65', color: muted, margin: 0 }}>{c.body}</Text>
        </Section>
      ))}

      <Section style={{ backgroundColor: soft, borderRadius: 24, padding: '44px 24px', margin: '56px 0 0', textAlign: 'center' }}>
        <Heading as="h2" style={{ fontSize: 34, fontWeight: 500, lineHeight: '1.1', margin: '0 0 14px', color: ink }}>Your bots are waiting</Heading>
        <Text style={{ fontSize: 16, lineHeight: '1.7', color: muted, margin: '0 0 22px' }}>
          {until ? `Your free trial is on until ${until}. Build your first team of bots in a minute.` : 'Eligible new Google Play subscribers can start a 3-day trial after confirming a payment method. The subscription renews at the displayed price unless cancelled.'}
        </Text>
        <Pill href={APP_URL}>Open Ceyo</Pill>
      </Section>
    </CeyoShell>
  )
}

export const template = {
  component: WelcomeEmail,
  subject: (d: Record<string, any>) => (d?.name ? `Welcome to Ceyo, ${String(d.name).slice(0, 40)}` : 'Welcome to Ceyo'),
  displayName: 'Welcome',
  previewData: { name: 'Alex' },
} satisfies TemplateEntry
