# Official messaging channels — 2026-11-15

## Implemented
- Dedicated `CEYO_TELEGRAM_CHANNEL_TOKEN` and X Chat credentials saved in the connected **external Supabase Vault**, not Lovable Cloud. Values are neither in migrations nor source. Existing operator Telegram token was not replaced.
- Telegram `getMe` verified `@Cayoagent`; X `GET /2/users/me` verified `@Ceyobot` and the supplied bot ID. No private messages sent in these probes.
- `my_telegram_link` in app chat creates a 10-minute, one-use link for the current user and bot. Pressing Start consumes the hashed pairing in one transaction. Different-owner identity replacement is rejected.
- `/api/public/channels/telegram` checks its dedicated derived header secret, validates input and ignores groups and bot senders. Verified private senders resolve to one user/bot; messages persist in an owner-scoped Telegram conversation.
- Conversations use the existing CoArena routing/Cerebras fallback and owner-bound usage charging. User memories are loaded only for the verified identity. Built-in browser/computer execution is available; caller-session-dependent workspace integrations and approval cards remain in the app. This is **not** full integration parity.
- Persisted receipts prevent repeat model execution on delivery retries. A processing collision returns 503. Interrupted runs/ambiguous sends become `needs_review`, not automatic side-effect retries. A hard runtime crash still requires operator receipt review; this is not a durable background queue.

## Deployment / Telegram registration
The handler must first be deployed to an HTTPS public host. Register `/api/public/channels/telegram` with `setWebhook`, passing the matching `webhookSecret(token)` as `secret_token` and `allowed_updates: ["message"]`. Do not log credentials or request URLs. Verify `getWebhookInfo`, then open a real signed-in app pairing link and test receipt → saved user message → agent reply → Telegram delivery → app history readback. Registration and this full round trip were **not performed in this pass**.

## X Chat: security endpoint ready; encrypted transport not active
All supplied app credentials (consumer key/secret and OAuth client ID/secret) are now saved in external Supabase Vault with service-only read/store permissions. Live X identity and registered-public-key requests returned 200; an existing secure-backup configuration is available. Recovery was not attempted, and existing keys were not replaced.

`/api/public/channels/xchat` implements CRC and raw-body HMAC verification with Worker-compatible Web Crypto. Actual local GET challenge returned 200; unsigned POST returned 401. Five new regressions and four existing channel tests passed. A valid encrypted event deliberately returns 503 until durable crypto processing exists: never acknowledge and discard it. The webhook has **not been registered** and replies are **not active**.

The official XChat Agent Skeleton uses a persistent Python process and native Chat XDK. Its PIN recovery path is supported, so an extra private-key export is not established as necessary. JavaScript/WASM requires secure-backup unlock and does not export raw keys; Worker packaging/execution remains unverified. A persistent authorized transport service (or verified compatible Worker adapter) and a real encrypted message/reply round trip are still needed. App-only stream authorization for request-folder discovery also remains unverified. Do not use legacy `/2/dm_conversations/...` plaintext sends for X Chat.

Storage audit: removed the unused Lovable `TELEGRAM_BOT_TOKEN` copy after confirming the active transport reads external Supabase Vault and its Vault credential exists. Only the platform-managed `LOVABLE_API_KEY` and undeletable `LOVABLE_CRON_SECRET` remain in the Lovable secret listing. The latter is used by existing scheduling; moving it requires coordinated scheduler reconfiguration, and was not claimed complete.

References:
- https://github.com/xdevplatform/chat-xdk
- https://github.com/xdevplatform/xchat-agent-skeleton
- https://chat-sdk.dev/adapters/official/xchat
- https://docs.x.com/xchat/real-time-events
- https://docs.x.com/xchat/xchat-xdk

## Instagram / Facebook / WhatsApp
Not connected yet. Instagram requires the owned professional account and the matching Meta messaging authorization; Messenger requires the owned Facebook Page. WhatsApp requires the owned number's business setup and verification; it is not automatically free in every messaging scenario. None of these credentials/accounts were supplied in this pass. No automatic account creation, browser-login workaround or access to unrelated accounts is implemented.

## Security / verification
New tables have explicit grants and RLS; pairings/deliveries have service-role-only policies. Credential read/store and pairing consumption RPCs are service-role-only. New migration warnings resolved; pre-existing backend warnings remain outside this change. Keys supplied in chat should be rotated by their issuers, then securely replaced in Vault.