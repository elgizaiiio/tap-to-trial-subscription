import { CeyoMessage } from "./ceyo-message"
import { template as welcomeTemplate } from "./welcome"
import type { ComponentType } from 'react'

export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
}

/**
 * Template registry — maps template names to their React Email components.
 * Import and register new templates here after creating them in this directory.
 *
 * Example:
 *   import { template as welcomeTemplate } from './welcome'
 *   // then add to TEMPLATES: 'welcome': welcomeTemplate
 */
export const TEMPLATES: Record<string, TemplateEntry> = {
  welcome: welcomeTemplate,
  task_completed: { component: CeyoMessage, subject: "Your Ceyo task is ready", displayName: "Task completed", previewData: { eyebrow: "Task finished", title: "Your task is ready", message: "Your bot has delivered its result to your conversation.", actionLabel: "View result" } },
  account_notice: { component: CeyoMessage, subject: "A notice about your Ceyo account", displayName: "Account notice", previewData: { eyebrow: "Account", title: "Your account", message: "There is an update about your account. Open Ceyo to review it." } },
}
