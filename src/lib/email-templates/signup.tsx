import * as React from 'react'
import { CeyoAuthEmail } from './ceyo-auth'

export interface SignupEmailProps { siteName?: string; siteUrl?: string; recipient?: string; confirmationUrl?: string; token?: string | null }

export const SignupEmail = ({ recipient, confirmationUrl, token }: SignupEmailProps) => (
  <CeyoAuthEmail
    preview="Confirm your email to start with Ceyo"
    eyebrow="Welcome to Ceyo"
    title="Confirm your email"
    lead={`You're one step away from your first team of bots. Enter this code in Ceyo${recipient ? ` to confirm ${recipient}` : ''}, or tap the button.`}
    token={token}
    url={confirmationUrl}
    action="Confirm email"
  />
)

export default SignupEmail
