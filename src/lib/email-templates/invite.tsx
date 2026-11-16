import * as React from 'react'
import { CeyoAuthEmail } from './ceyo-auth'

export interface InviteEmailProps { siteName?: string; siteUrl?: string; confirmationUrl?: string; token?: string | null }

export const InviteEmail = ({ confirmationUrl, token }: InviteEmailProps) => (
  <CeyoAuthEmail
    preview="You've been invited to Ceyo"
    eyebrow="Invitation"
    title="You're invited to Ceyo"
    lead="Someone invited you to build with a team of bots. Accept the invite to create your account."
    token={token}
    url={confirmationUrl}
    action="Accept invite"
    note="If you weren't expecting this invitation, you can ignore this email."
  />
)

export default InviteEmail
