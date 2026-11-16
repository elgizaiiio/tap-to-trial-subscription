/** Hostinger's documented TLS endpoint is public configuration, never a credential. */
export function hostingerConfig(env: Record<string, string | undefined>) {
  const user = env.HOSTINGER_SMTP_USER;
  const pass = env.HOSTINGER_SMTP_PASSWORD;
  if (!user || !pass) return null;
  return {
    host: "smtp.hostinger.com", port: 465, user, pass,
    from: env.HOSTINGER_SMTP_FROM || user,
    name: env.HOSTINGER_SMTP_SENDER_NAME || "Ceyo",
  };
}