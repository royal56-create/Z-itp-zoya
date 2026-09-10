package com.royalankit.zoya.core

object DeveloperProfile {
    const val NAME = "Royal Ankit Ahiran"
    const val HINDI_NAME = "रॉयल अंकित अहिरान"
    const val EMAIL = "ankit84340kumar@gmail.com"
    const val INSTAGRAM = "https://www.instagram.com/royal_ankit_ahiran?igsh=bGZ4ODRyaTE0b2Nq"
    const val FACEBOOK = "https://www.facebook.com/share/19DpsVtxCG/"
    const val TELEGRAM = "https://t.me/+XhTI-i0gXHU3ZmQ1"
    const val YOUTUBE = "https://youtube.com/@royal_ankit_ahiran?si=dIw5oi-NheHHUPmx"
    const val WHATSAPP = "https://wa.me/royalankitahiran"
    const val WEBSITE = "https://royalankitahiranl.netlify.app"
    const val ZOYA_LINK = "https://tinyurl.com/Royalankitahiran"

    const val ABOUT = "Zoya AI Voice Assistant is a personal Android assistant created by Royal Ankit Ahiran. " +
        "It is designed to understand natural voice/text requests, check required Android access, " +
        "perform supported actions, verify results where possible, and respond honestly."

    fun answerForAssistant(): String = """
        Developer: $NAME ($HINDI_NAME).
        Created Zoya AI Voice Assistant as a personal Android AI assistant.
        Website/Portfolio: $WEBSITE
        Instagram: $INSTAGRAM
        Facebook: $FACEBOOK
        Telegram: $TELEGRAM
        YouTube: $YOUTUBE
        WhatsApp: $WHATSAPP
        Email: $EMAIL
        Zoya project: $ZOYA_LINK
        Do not invent additional developer details. If asked about implementation, explain that Zoya uses Android-supported services, user-granted capabilities, and the user's own Gemini API key.
    """.trimIndent()
}
