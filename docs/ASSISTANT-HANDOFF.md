# Assistant repair — living handoff

Updated: 2026-11-16, 12:21 UTC. Phase: implemented and tested within the limits below.

## Read first
Read docs/ARCHITECTURE.md, root AGENTS.md, android/AGENTS.md, README.md and the active section of roadmap.md. Update this document at the start and end of each implementation phase, not with a background timer. Nothing continues after the agent's turn ends.

## Owner requirements
- One continuing conversation per bot: preserve all history; no new-chat button for the same bot.
- Use the primary user's robot across assistant, widgets and notifications. Completed work is an ordinary notification with its actual reply.
- Assistant should show only the robot on a transparent screen with subtle multicolour edge light, not a card or input box.
- Listen automatically after activation; do not require repeated microphone presses. Permission denial and unavailable recognizers must remain honest failures.
- Wake-word and driving toggles currently appear unresponsive on the owner's Honor device; prior APK v9 is not proof of a device fix.
- Test package is Ceyo Try / si.ceyo.app.trial. Keep it installable alongside production.
- During testing use https://tap-to-trial-subscription.lovable.app; return to the normal Android host only when the owner requests it.
- Provide design previews before new visual implementation.

## Known boundaries
- Current wake model is English with phonetic keyword variants, not validated Arabic keyword accuracy.
- Android SpeechRecognizer depends on an installed external recognition service. Silence must rearm without a tap; hard errors need bounded retry, not an infinite hot loop.
- Notification listener currently performs local bill/link checks, not arbitrary model access to all notifications. Never claim a capability solely because it was added to the prompt.
- Trial Firebase configuration is missing; production google-services.json does not authorize a different package. Fully-closed-app push/calls remain blocked.
- OEM background restrictions and power-button mappings need physical-device testing. No universal Dynamic Island support can be promised.
- APK loads a hosted site: native updates and published web updates are separate releases.

## Prior work and recovery
- v9 uses owner-locked open_bot_thread RPC and aggregated app-thread message history; it does not delete or move old messages. Channel conversations stay separate.
- WebView trust must be based on actual navigation events, never a prefilled trusted host or asynchronous UI read followed by immediate comparison.
- Wake process is isolated (:wake), validates assets/BPE tokens, and releases its microphone before assistant recognition. Native fatal signals cannot be caught by Java try/catch.
- Voice dependencies/models are fetched by scripts/fetch-android-voice.sh and must not be committed as oversized binaries.
- Signing keys, passwords, access tokens, private conversations and uploaded service-account files are not handoff material. Store secrets only in operator secret stores.

## Verification for this pass
- Ceyo Try 1.2.4-try / code 10, arm64 APK, 53,499,956 bytes. Certificate matches v9. Android build and 15 JVM tests pass; 29 focused web tests pass. APK is delivered separately, not committed to GitHub.
- Real settings component with a test native bridge: wake/car requests both on=true, both aria-pressed=true, 434×716 no overflow. This is isolated testing, not signed-in Honor verification. Use exact Vite dependency query versions when injecting a test component or Router/QueryClient contexts become duplicated.
- Native assistant is robot-only/translucent with subtle screen-edge colour; silence/no-match rearms automatically, hard failures stop after bounded retries. Spoken requests hand off to the existing continuing chat, and its real completed reply is spoken once. Full conversation within the overlay and post-reply automatic listen are not implemented.
- All bridge wrappers retain their native object receiver. Wake activation passes enabled in an Intent because process-local preferences cache was stale; live JNI guards are not deleted. Denied mic/Bluetooth permissions reset their preference.
- Publish requested for current Lovable host; public root HTTP 200 is verified, not every private flow or deployed-source fingerprint.

## Scheduler incident and fix
- Direct owner authorization confirmed admin access to elgizaiiio/ceyo-private-scheduler. Its active five-minute workflow still targeted hush-and-flow-studio.lovable.app, which rejected the current Vault signing value with 401.
- Destination updated/read back as https://tap-to-trial-subscription.lovable.app. Existing CEYO_CRON_SECRET was copied privately from external Vault to GitHub using sealed-box encryption (not regenerated). First verification dispatch failed before secret synchronization; dispatch created 2026-11-16T12:18:56Z subsequently completed success.
- Real due routine completed, next_run_at advanced, lease cleared, and one matching message persisted per run. No private goals, reply contents or tokens are documented here. Old manually inactive routine remains inactive.
- New runner completion uses existing finish_routine_run RPC atomically and preserves manual pauses. Operator script permits the exact test host only with --test-lovable and verifies the candidate before modifying the destination. Normal production independent-host restrictions remain.
- GitHub five-minute checks run 288 times/day and may be delayed. Multi-routine lease/runtime lifetime and interruption-review resumption still need careful work; never automatically replay unknown external side effects or claim exact-time execution.
- Rotate the token supplied in chat. It was used only in temporary operator scripts, not source or persistent handoff.
## 2026-11-16 — v11 top island
- `CeyoIslandService` draws a TYPE_APPLICATION_OVERLAY pill at the top (FLAG_NOT_FOCUSABLE) and runs SpeechRecognizer; `CeyoAssistantActivity` forwards to it when "display over other apps" is granted.
- `wake_mic` marker = wake engine currently holds AudioRecord (replaces wake_init check that caused false "mic busy").
- `CeyoListeningPolicy.describe(code)` gives the Arabic reason shown in the island.
- Phone options moved to `/settings/android` (PhoneSettings in CeyoSettings.tsx). Not yet verified on a device.
