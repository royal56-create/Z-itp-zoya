# Firebase Security Deployment

1. Open the Firebase project used by this build.
2. In Firestore Rules, publish the exact rules in `firestore.rules`.
3. Enable App Check enforcement for the Android Firebase app and select Play Integrity.
4. Register the release SHA-256 certificate fingerprint used to sign the APK.
5. Test unauthenticated reads/writes and cross-user reads/writes in Rules Playground; all must be denied.
6. Test an authenticated user against another user's `/users/{otherUid}/...`; it must be denied.
7. Do not deploy the bundled web reference as a production backend. It is reference material and contains client-side architecture that should be migrated behind a server/proxy before public deployment.

Firestore client configuration identifiers are not secrets. Service-account JSON, private keys, signing keys, Gemini keys and bot tokens are secrets and must remain server-side/local secure storage only.
