# Zoya Final Security Audit — Hardened Build

## Scope

Audited the complete project tree: Android source/resources, Gradle configuration, Firebase rules/configuration, bundled original Zoya reference, root documentation and scripts.

## Critical fixes applied

- Replaced permissive Firestore rules with authenticated owner-only access.
- Locked history writes to the authenticated user's own UID and known fields.
- Added Firebase App Check / Play Integrity client initialization; production enforcement remains a Firebase Console deployment step.
- Enabled R8 minification and resource shrinking for release builds.
- Added `.gitignore` protection for `local.properties`, environment files and signing keys.
- Replaced plaintext local SQLite history with AES-GCM encrypted history using Android Keystore; added one-time legacy migration/deletion.
- Added password-field protection to Accessibility typing.
- Added local action allowlist, input length limits and malformed-action rejection.
- Added explicit confirmation before call/SMS/WhatsApp/email/share/type actions.
- Disabled WhatsApp auto-send; it only opens a prefilled composer.
- Masked common six-digit OTP values in notification/SMS output.
- Added client-side Gemini request rate limiting and payload limits.
- Gemini API key is transmitted through `x-goog-api-key`, not a URL query string.
- Added strict model-name validation.
- Disabled cleartext network traffic.
- Removed unused dangerous Android permissions to reduce attack surface.
- Hardened the bundled web reference with optional App Check/CSP and TLS verification; it remains reference material, not a production backend.

## Static verification

`./audit.sh` passes:

- 22 Kotlin source files structurally scanned.
- Firestore permissive-rule scan passes.
- Secret-pattern scan passes.
- Release minification guard passes.
- Accessibility password guard passes.
- Sensitive-action confirmation guard passes.
- Encrypted history guard passes.
- Gemini key header guard passes.

## Build limitation

This environment does not contain the Android SDK/Gradle dependency graph required for a real APK build. Therefore this report does **not** claim a 100% compile/runtime guarantee. Build the release APK in Android Studio with the real Firebase configuration and signing key, then run Firebase Rules Playground/App Check tests on the actual Firebase project.

## Security conclusion

The project now follows a fail-closed, least-privilege approach. No Android application can honestly promise zero attack surface: powerful permissions such as Accessibility, notification access, microphone, SMS, calls and screen capture inherently create risk. The hardened design reduces that risk through authentication, App Check, encryption, local policy enforcement, confirmation, rate limiting, minimized permissions and secure secret handling.


## Automation update

Direct user commands now support controlled UI automation (type/click/scroll/open URL) and direct call/SMS execution. The automation path is still local-policy gated. Gemini-generated sensitive actions remain confirmation-gated. WhatsApp direct commands may attempt a visible Send-button click only when Accessibility is enabled. Password/credential fields remain excluded from auto-type.
