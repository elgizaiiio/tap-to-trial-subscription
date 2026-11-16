import * as React from 'react'
import { CeyoAuthEmail } from './ceyo-auth'

export interface MagicLinkEmailProps { siteName?: string; confirmationUrl?: string; token?: string | null }

export const MagicLinkEmail = ({ confirmationUrl, token }: MagicLinkEmailProps) => (
  <CeyoAuthEmail
    preview="Your Ceyo sign-in code"
    eyebrow="Sign in"
    title="Your sign-in code"
    lead="Enter this code in Ceyo to sign in. It works once and expires soon."
    token={token}
    url={confirmationUrl}
    action="Sign in to Ceyo"
  />
)

export default MagicLinkEmail
