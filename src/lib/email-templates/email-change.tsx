import * as React from 'react'
import { CeyoAuthEmail } from './ceyo-auth'

export interface EmailChangeEmailProps { siteName?: string; oldEmail?: string; email?: string; newEmail?: string; confirmationUrl?: string; token?: string | null }

export const EmailChangeEmail = ({ oldEmail, email, newEmail, confirmationUrl, token }: EmailChangeEmailProps) => {
  const from = oldEmail || email
  return (
    <CeyoAuthEmail
      preview="Confirm your new Ceyo email"
      eyebrow="Account email"
      title="Confirm your new email"
      lead={from && newEmail ? `You asked to change your Ceyo email from ${from} to ${newEmail}. Confirm to finish.` : 'You asked to change the email on your Ceyo account. Confirm to finish.'}
      token={token}
      url={confirmationUrl}
      action="Confirm new email"
      note="If you didn't ask for this change, ignore this email and change your password right away."
    />
  )
}

export default EmailChangeEmail
