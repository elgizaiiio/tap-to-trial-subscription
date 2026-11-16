import * as React from 'react'
import { CeyoAuthEmail } from './ceyo-auth'

export interface ReauthenticationEmailProps { token?: string | null }

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <CeyoAuthEmail
    preview="Your Ceyo verification code"
    eyebrow="Security check"
    title="Confirm it's you"
    lead="Enter this code in Ceyo to continue. It works once and expires soon."
    token={token || '••••••'}
  />
)

export default ReauthenticationEmail
