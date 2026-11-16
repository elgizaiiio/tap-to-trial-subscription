import * as React from 'react'
import { Body, Container, Head, Heading, Hr, Html, Img, Link, Preview, Section, Text } from '@react-email/components'

/** Shared Ceyo email look, matching the public landing page (white paper, ink pills, Geist type). */
export const ink = '#111111'
export const muted = '#666666'
export const soft = '#f3f3f3'
export const line = '#e4e4e4'
export const font = "Geist, 'Helvetica Neue', Helvetica, Arial, 'IBM Plex Sans Arabic', sans-serif"
export const APP_URL = 'https://web.ceyo.si'
export const SITE_URL = 'https://ceyo.si'
export const HERO_IMAGE = 'https://ceyo.si/email/hero-poster.jpg'

/** Keeps buttons pointing at Ceyo or at the auth service link the system generated. */
export function safeLink(url: string | undefined, fallback = APP_URL): string {
  if (!url) return fallback
  try {
    const u = new URL(url)
    return u.protocol === 'https:' ? u.toString() : fallback
  } catch {
    return fallback
  }
}

export function CeyoShell({ preview, children }: { preview: string; children: React.ReactNode }) {
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: '#ffffff', margin: 0, padding: 0, color: ink, fontFamily: font }}>
        <Container style={{ maxWidth: 600, margin: '0 auto', padding: '28px 24px 40px' }}>
          <Link href={SITE_URL} style={{ color: ink, fontSize: 19, fontWeight: 600, textDecoration: 'none' }}>Ceyo</Link>
          {children}
          <Hr style={{ borderColor: line, margin: '48px 0 22px' }} />
          <Text style={{ fontSize: 13, lineHeight: '1.7', color: muted, margin: 0 }}>
            Personal bots and group chats in one calm place.
          </Text>
          <Text style={{ fontSize: 13, lineHeight: '1.7', color: muted, margin: '8px 0 0' }}>
            <Link href={APP_URL} style={footLink}>Open the web app</Link>{'  ·  '}
            <Link href={`${SITE_URL}/privacy`} style={footLink}>Privacy</Link>{'  ·  '}
            <Link href={`${SITE_URL}/contact`} style={footLink}>Contact</Link>
          </Text>
          <Text style={{ fontSize: 12, color: muted, margin: '14px 0 0' }}>© 2026 Ceyo · Megsy LLC</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const Eyebrow = ({ children, center }: { children: React.ReactNode; center?: boolean }) => (
  <Text style={{ fontSize: 14, color: muted, margin: '56px 0 0', textAlign: center ? 'center' : 'left' }}>{children}</Text>
)

export const Title = ({ children, center, size = 44 }: { children: React.ReactNode; center?: boolean; size?: number }) => (
  <Heading as="h1" style={{ fontSize: size, lineHeight: '1.08', fontWeight: 500, letterSpacing: 0, margin: '14px 0 18px', color: ink, textAlign: center ? 'center' : 'left' }}>{children}</Heading>
)

export const Lead = ({ children, center }: { children: React.ReactNode; center?: boolean }) => (
  <Text style={{ fontSize: 17, lineHeight: '1.65', color: muted, margin: '0 0 8px', textAlign: center ? 'center' : 'left' }}>{children}</Text>
)

export const Pill = ({ href, children, ghost }: { href: string; children: React.ReactNode; ghost?: boolean }) => (
  <Link href={href} style={{ display: 'inline-block', padding: '13px 24px', borderRadius: 999, backgroundColor: ghost ? soft : ink, color: ghost ? ink : '#ffffff', fontSize: 15, fontWeight: 500, textDecoration: 'none', margin: '0 4px 8px' }}>{children}</Link>
)

export const Stage = () => (
  <Img src={HERO_IMAGE} alt="Ceyo workspace" width="552" style={{ width: '100%', height: 'auto', borderRadius: 24, margin: '36px 0 0', display: 'block' }} />
)

/** One-time code shown large, like the landing page facts. */
export const CodeBox = ({ code }: { code: string }) => (
  <Section style={{ backgroundColor: soft, borderRadius: 20, padding: '26px 20px', margin: '28px 0 8px', textAlign: 'center' }}>
    <Text style={{ fontSize: 13, color: muted, margin: '0 0 6px' }}>Your code</Text>
    <Text style={{ fontSize: 38, fontWeight: 600, letterSpacing: 8, margin: 0, color: ink, fontFamily: "'SFMono-Regular', Menlo, Consolas, monospace" }}>{code}</Text>
  </Section>
)

export const Note = ({ children }: { children: React.ReactNode }) => (
  <Text style={{ fontSize: 14, lineHeight: '1.7', color: muted, margin: '26px 0 0' }}>{children}</Text>
)

const footLink = { color: muted, textDecoration: 'underline' }
