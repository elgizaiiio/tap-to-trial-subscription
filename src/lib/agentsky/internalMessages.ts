/** Continuation context remains persisted for the agent, but is never a chat bubble. */
export function isInternalMessage(metadata: unknown): boolean {
  return typeof metadata === "object" && metadata !== null &&
    "internal" in metadata && metadata.internal === true;
}