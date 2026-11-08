# Existing KaiLab voice-to-chart integration — 2026-11-08

## Reused implementation
Source: HyoSang-Ryu/Team_Medipencil, branch `poc/remote-validation`, commit `666da43a4d53d07c41d7ffbb3cead54360d90a4d`.
The main branch is documentation. The implemented branch contains `RoundLoopVoice.tsx`, `roundloop-recorder.worklet.js`, `roundloopDirect.ts`, `kideCommand.ts`, `kideResultGuard.ts`, `kide_v4.py`, and `roundloop.py`.

Ported: 16kHz mono PCM16 / 100ms frames, ready/transcript/done protocol, terminal KIDE command from final segments only (never partial), explicit finish button, v4/legacy note adapters, prose guard, review-before-publication, explicit distinction between direct input and actual engine execution.

## Current application
- `voice.html`: approved staff/admin only; current patient selector; maximum three-minute microphone session; finish → stored transcript → existing `/v1/record` → editable chart draft → human confirmation.
- Existing endpoint/key are retained as private Sites runtime environment values `KIDE_BASE_URL` / `KIDE_API_KEY`. A short-lived, single-use socket ticket binds user, login session and encounter. A native Worker upgrade route keeps the provider key out of browser/Pages bundles. Active staff sessions are rechecked during streaming. Untrusted provider messages are bounded and sanitized.
- Only the transcript is supplied to chart generation. Patient DB data, identifiers, and family identity are not automatically attached to the external engine. No cloud/model fallback and no new engine installation.
- D1 stores source transcript, chart, revision, reviewer and approval; source is immutable after capture. Direct text editing creates a new source. Raw audio files are not retained by this application. This is not a claim about the external provider's retention policy.
- Complete chart/source is staff-only and never included in family `/api/state`. Optional family notice is separately reviewed; its evidence must be an exact nonempty source quotation. Only current linked families receive the notice, through the existing message channel. Repeated confirmation cannot create duplicate messages. Sharing may be withdrawn.
- No real EMR writes, diagnosis automation, or speech-quality claims.

## Verification
- `node tests/voice-contract.mjs`: passed. Terminal commands, plans not promoted to completion, legacy/v4 parsing, readable prose, bounded provider frames.
- `tests/voice-api.mjs`: passed local server/DB checks for role restrictions, source identity, revision conflict, review gate, evidence matching, no raw source in family payload, duplicate confirmation, withdrawal, ticket metadata and unavailable-engine transcript preservation. Local write fixtures only.
- Browser: synthetic direct text → draft → review → confirmed chart + notice; separate family session sees the notice; failed real generation request preserves source and explicitly shows an engine connection failure. Mobile 390px and desktop 1280px geometry checked without horizontal overflow.
- TypeScript and Pages artifact checks passed.

## External limitation explicitly accepted by the user
The saved existing engine endpoint currently fails DNS lookup (`ENOTFOUND`). The user said it has not opened yet and explicitly instructed retaining the exact configuration. Real physical-microphone → live STT → successful chart generation is therefore NOT VERIFIED in this release. No simulated output is presented as a real engine result. Once the same endpoint opens, staff can retry using the saved transcript/settings. Hardware permissions and language/clinical quality still require live validation.
