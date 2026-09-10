package com.royalankit.zoya.core

import android.Manifest

enum class Capability(
    val title: String,
    val purpose: String,
    val permission: String? = null,
    val special: Special = Special.NONE
) {
    MICROPHONE("Microphone", "Voice input and wake/command listening", Manifest.permission.RECORD_AUDIO),
    TTS("Audio / Text-to-Speech", "Spoken responses; no user voice tuning"),
    CAMERA("Camera", "Camera capture and visual understanding", Manifest.permission.CAMERA),
    LOCATION("Location", "Current location and navigation", Manifest.permission.ACCESS_FINE_LOCATION),
    CONTACTS("Contacts", "Find contacts by name", Manifest.permission.READ_CONTACTS),
    PHONE("Phone / Call", "Call or open the dialer", Manifest.permission.CALL_PHONE),
    CALL_LOG("Call Log", "Read recent call information where allowed", Manifest.permission.READ_CALL_LOG),
    SMS("SMS", "Read/send SMS where Android allows", Manifest.permission.SEND_SMS),
    ACCESSIBILITY("Accessibility Service", "Click, scroll, type and navigate supported app UIs", special = Special.ACCESSIBILITY),
    NOTIFICATION_LISTENER("Notification Listener", "Read posted notifications when enabled", special = Special.NOTIFICATION_LISTENER),
    SCREEN_CAPTURE("Screen Capture", "User-approved screen analysis/capture", special = Special.MEDIA_PROJECTION),
    APP_LAUNCH("App Launch", "Open installed apps and intents"),
    BLUETOOTH("Bluetooth / Nearby", "Supported nearby-device workflows", Manifest.permission.BLUETOOTH_CONNECT),
    INTERNET("Internet / Network", "Gemini and online services", Manifest.permission.INTERNET),
    DEVICE_INFO("Battery / System Info", "Battery and basic device state"),
    MEDIA("Audio / Media Control", "Supported media session controls"),
    ALARM("Alarm / Timer", "Alarms and timers"),
    CALENDAR("Calendar", "Create/read events where authorized", Manifest.permission.WRITE_CALENDAR),
    FILES("Files / Photos / Media", "User-selected documents and media"),
    OCR("OCR / Vision", "Read text/images from permitted inputs"),
    FLASHLIGHT("Flashlight / Torch", "Toggle the camera torch where supported"),
    VIBRATION("Vibration", "Haptic feedback", Manifest.permission.VIBRATE),
    SETTINGS("System Settings Access", "Open relevant Android settings pages"),
    BIOMETRIC("Biometric Prompt", "Confirm sensitive actions with device biometrics"),
    FOREGROUND_SERVICE("Foreground Service", "Background-ready supported operations", special = Special.FOREGROUND),
    WAKE_WORD("Wake Word / Hey Zoya", "Activation workflow; subject to Android/device limits", special = Special.ASSISTANT),
    SHARE("Android Share", "Share files, photos or text using Android intents"),
    EMAIL("Email / App Integration", "Draft/send email using supported apps"),
    DEVICE_ADMIN("Device Policy / Admin", "Only explicitly authorized device-management features", special = Special.UNSUPPORTED_ADMIN),
    NAVIGATION("System Navigation", "Supported Home/Back/Recent workflows", special = Special.ACCESSIBILITY)
}

enum class Special { NONE, ACCESSIBILITY, NOTIFICATION_LISTENER, MEDIA_PROJECTION, FOREGROUND, ASSISTANT, UNSUPPORTED_ADMIN }
