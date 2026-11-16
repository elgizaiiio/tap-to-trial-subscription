import * as React from 'react'
import { CeyoAuthEmail } from './ceyo-auth'

export interface RecoveryEmailProps { siteName?: string; confirmationUrl?: string; token?: string | null }

export const RecoveryEmail = ({ confirmationUrl, token }: RecoveryEmailProps) => (
  <CeyoAuthEmail
    preview="Reset your Ceyo password"
    eyebrow="Password"
    title="Reset your password"
    lead="Use this code in Ceyo to choose a new password. Your bots and chats stay exactly as they are."
    token={token}
    url={confirmationUrl}
    action="Reset password"
    note="If you didn't ask to reset your password, ignore this email — your current password keeps working."
  />
)

export default RecoveryEmail
