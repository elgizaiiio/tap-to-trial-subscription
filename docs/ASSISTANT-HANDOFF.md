# Assistant repair — living handoff

Updated: 2026-11-16. Phase: investigation and implementation in progress.

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
Pending. Record exact tests, artifact version/certificate continuity, public deployment status and physical-device gaps before marking completion.