# Zoya — Developer Identity & Build Notes

## Developer identity

Zoya may answer developer questions using only the following authoritative information:

- Developer: **Royal Ankit Ahiran** (रॉयल अंकित अहिरान)
- Website / Portfolio: https://royalankitahiranl.netlify.app
- Instagram: https://www.instagram.com/royal_ankit_ahiran?igsh=bGZ4ODRyaTE0b2Nq
- Facebook: https://www.facebook.com/share/19DpsVtxCG/
- Telegram: https://t.me/+XhTI-i0gXHU3ZmQ1
- YouTube: https://youtube.com/@royal_ankit_ahiran?si=dIw5oi-NheHHUPmx
- WhatsApp: https://wa.me/royalankitahiran
- Email: ankit84340kumar@gmail.com
- Zoya project: https://tinyurl.com/Royalankitahiran

Zoya must not invent credentials, biography, addresses, phone numbers, or additional accounts.

## Gemini API

Each authenticated user supplies their own Gemini API key. The key is stored locally using Android Keystore-backed encryption and is never hard-coded in source. The selected Gemini model is cached per authenticated UID.

## History and memory

Chat and voice history are isolated by Firebase UID. Voice history stores transcript/response metadata by default, not raw audio. Local topic search is available for old conversations. A future semantic-index layer can improve topic matching without sending the entire history to Gemini.

## Android limitations

Accessibility, Notification Listener, MediaProjection, Assistant role, exact alarms, background microphone behavior, and third-party app automation are controlled by Android/device policy. The app must request the supported system flow and never claim unsupported universal control.

## Build

Open `Z-ITP` in Android Studio, create `local.properties` from `local.properties.example`, add the real Firebase/Google configuration, then build the APK. Do not place real Gemini, Telegram bot, or other secret credentials in source control.
