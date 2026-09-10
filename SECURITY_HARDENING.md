# Zoya Security Hardening — v3

This project is hardened for a personal Android assistant, but no client application can honestly guarantee that an attacker will have “no attack surface”. The goal is to minimize, isolate, authenticate, encrypt, rate-limit, and fail closed.

## Enforced controls

- Firestore rules are owner-only; unauthenticated and cross-user access is denied.
- Firebase App Check with Play Integrity is initialized by the Android client. Play Integrity/App Check must also be enabled and configured in Firebase Console before production.
- Release R8 shrinking/minification is enabled.
- `local.properties` and keystore files are gitignored.
- Gemini user keys are encrypted with Android Keystore and bound to the Firebase UID as additional authenticated data.
- Gemini API keys are sent using `x-goog-api-key` rather than a URL query parameter.
- Gemini requests are rate-limited and bounded in size.
- Gemini output is treated as untrusted data. Only a strict local command allowlist can create an Android action.
- Sensitive actions require an explicit local voice confirmation.
- WhatsApp is never auto-sent by Accessibility; it opens a prefilled composer and the user presses Send.
- Accessibility typing refuses password/credential fields.
- SMS/notification text masks common six-digit OTP patterns before returning content.
- History is encrypted at rest with AES-GCM and an Android Keystore key. Legacy plaintext SQLite history is migrated once and then deleted after a successful migration.
- Network cleartext is disabled.
- Unused dangerous permissions were removed from the manifest to reduce attack surface.
- Master Safety Switch remains a local fail-closed control for actions.

## Firebase deployment requirement

Publishing `reference-original-zoya/firestore.rules` is mandatory. Client-side rules are not a substitute for Firebase Console deployment.

Enable App Check / Play Integrity for the Android Firebase app and register the correct release signing certificate fingerprints. Do not use a debug App Check provider in a production build.

## Secrets

Never put Gemini, Telegram, ElevenLabs, Firebase private credentials, service-account JSON, signing keys, or passwords into the APK or Git repository. User Gemini keys belong in the user's encrypted local store. Server-only credentials belong on a server-side secret manager.

## Important limitation

Android permissions, Accessibility, notification access, screen capture, and microphone access are powerful by design. They cannot be made risk-free. The safe design is explicit permission, local allowlists, confirmation for high-impact actions, short-lived state, encryption, authentication, App Check, and fail-closed behavior.
