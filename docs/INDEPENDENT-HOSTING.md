# Independent Ceyo deployment — 2026-11-15

## What is actually independent
- Existing user-owned Supabase contains accounts, bot/group data, messages, memory, documents and private Storage. Provider keys remain in the existing service-only provider pool; this pool is access-controlled, not application-encrypted.
- Telegram/X official credentials are in external Supabase Vault.
- The original scheduler signing value was copied unchanged from its old runtime binding into `CEYO_CRON_SECRET` in external Supabase Vault and read back privately. Runtime callbacks now read only Vault. Existing signature values and GitHub Actions secret do not need rotation just because the source changed.
- Legacy composer transcription now calls the existing Deepgram account directly; active voice recording transcription already did so.
- Coding-agent GitHub persistence now accepts only a direct owner-held GitHub token (Vault `CEYO_GITHUB_TOKEN`, or independent hosting's `GITHUB_TOKEN`); it never falls back to Lovable's connector. A direct token was not available to migrate, so this feature needs authorization before use.
- Newly generated hosted-bot/routine callback addresses use `APP_URL`/`PUBLIC_APP_URL`, defaulting to `https://web.ceyo.si`, and reject Lovable addresses. Old already-registered callbacks must be re-registered after deploying the updated handlers.

## What Supabase does not replace
Supabase is the data/auth/storage service, not a host for the entire TanStack Start app. The UI and app server routes still need independent hosting, e.g. the existing Vercel setup. The host needs its own server-only Supabase connection binding; it cannot retrieve its own service-role credential from Vault without first having authorized access.

The npm Vite configuration package is a build dependency, not an account credential. Preserve the existing conditional Vercel adapter rather than rewriting the working framework bootstrap.

## Deletion blockers
1. Deploy this committed source to the owned independent host. Current `web.ceyo.si` and `app.ceyo.si` return 200, but their GET job endpoint returns HTML, not evidence of these current server handlers. Fresh signed-in chat, voice, file/history readback and provider callbacks are unverified.
2. Update the private scheduler `CEYO_APP_URL` variable to the independent host and verify a completed scheduled run. The setup script now uses direct GitHub authorization; that token was unavailable in this pass. Do not enable a second scheduler or rotate the signing value unnecessarily.
3. Re-register existing Telegram hosted bots, official channels and external routine URLs pointing at Lovable. Registration requires original authorized bot credentials and verified destination handlers.
4. The unused `sendTemplateEmail` helper and Lovable-only template preview route still use managed email. Native Supabase Auth SMTP is separate and was previously configured; no fresh hosted SMTP read-back was possible in this pass. Independent transactional SMTP credentials were not available to migrate. Do not claim mail portability verified or destroy the templates.
5. Preserve the code in an owned repository before deleting the Lovable account; repository sync status and external deployment access are not established by local Git commits.
6. X encrypted reply transport remains unimplemented; moving credentials does not activate it.

## Verification
- 26 focused tests passed after final Vault-only tightening. Actual local authenticated job callback again returned 200/skipped with Vault-only runtime reads; the operator scheduler script's dry run completed without changes.
- Migration grants confirmed: anon/authenticated cannot execute runtime credential reads; service_role can.
- Actual local authenticated job endpoint returned 200/skipped for a nonexistent job using the migrated signing value; no job or external side effect was created. This verifies the credential boundary, not a full user task.
- No private key values or derived values were printed. The migration script reports only configured/missing state and never overwrites a different existing Vault value.
- Pre-existing 15 Supabase lint findings remain separate; this migration introduced no reported finding.

Deleting Lovable is **not verified safe yet**. Do not delete the user's account or any running deployment as part of this migration.