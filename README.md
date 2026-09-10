# Zoya AI Voice Assistant — Z-ITP Hardened

Personal Android AI assistant by Royal Ankit Ahiran.

## Security-first architecture

- Per-user Google/Firebase authentication.
- Per-user Gemini API key encrypted with Android Keystore.
- Automatic compatible Gemini model detection.
- Encrypted local chat/voice history with topic search.
- Firestore owner-only cloud history rules.
- Firebase App Check / Play Integrity integration.
- Strict local action allowlist; Gemini cannot invent Android capabilities.
- Confirmation for high-impact actions.
- WhatsApp composer only; no silent auto-send.
- Accessibility refuses password fields.
- OTP masking in message output.
- Request rate limiting and bounded input/output.
- R8 release shrinking/minification.
- Cleartext HTTP disabled.
- Minimal Android permission declarations.

## Build

Create `local.properties` from `local.properties.example` and supply the Firebase values for your own Firebase Android app and Google OAuth web client. Never commit `local.properties`.

Then open the project in Android Studio and build the release APK. Before release, configure Firebase App Check with Play Integrity, register the release SHA-256 certificate, and publish `firestore.rules`.

## Firebase rules

The canonical rules file is `firestore.rules`. The same hardened rules are copied into `reference-original-zoya/firestore.rules` for the bundled reference.

## Security caveat

No software can be made literally “unhackable” or guaranteed to have zero attack surface. This project is designed to minimize and contain attack paths and to fail closed when authentication, permissions, confirmation, integrity, or policy checks fail.
