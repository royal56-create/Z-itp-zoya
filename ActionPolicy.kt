package com.royalankit.zoya.core

import com.royalankit.zoya.commands.ZoyaCommand

/** Local policy is authoritative; Gemini output is never trusted to bypass it. */
object ActionPolicy {
    const val MAX_TEXT = 4000
    const val MAX_QUERY = 500

    fun isAllowed(c: ZoyaCommand): Boolean = when (c) {
        is ZoyaCommand.Call -> validTarget(c.target)
        is ZoyaCommand.Sms -> validTarget(c.target) && validText(c.body)
        is ZoyaCommand.WhatsApp -> validTarget(c.target) && validText(c.body)
        is ZoyaCommand.OpenApp -> validText(c.name, 100)
        is ZoyaCommand.TypeText -> validText(c.text)
        is ZoyaCommand.ClickText -> validText(c.text, 200)
        is ZoyaCommand.OpenUrl -> validUrl(c.url)
        is ZoyaCommand.Scroll -> c.direction.lowercase() in setOf("up","down","left","right")
        is ZoyaCommand.WebSearch -> validText(c.query, MAX_QUERY)
        is ZoyaCommand.Youtube -> validText(c.query, MAX_QUERY)
        is ZoyaCommand.Spotify -> validText(c.query, MAX_QUERY)
        is ZoyaCommand.Timer -> c.seconds in 1..86_400
        is ZoyaCommand.Alarm -> c.hour in 0..23 && c.minute in 0..59
        ZoyaCommand.ReadMessages, ZoyaCommand.Camera, ZoyaCommand.Location,
        ZoyaCommand.Flashlight -> true
        is ZoyaCommand.ShareText -> validText(c.text)
        is ZoyaCommand.Email -> validText(c.body) && (c.to == null || validText(c.to, 320))
        ZoyaCommand.Unknown -> false
    }

    fun requiresConfirmation(c: ZoyaCommand): Boolean = when (c) {
        is ZoyaCommand.Call, is ZoyaCommand.Sms, is ZoyaCommand.WhatsApp,
        is ZoyaCommand.Email, is ZoyaCommand.ShareText, is ZoyaCommand.TypeText, is ZoyaCommand.ClickText -> true
        else -> false
    }

    private fun validTarget(s: String) = s.trim().length in 1..200
    private fun validUrl(s: String): Boolean {
        return try {
            val u = android.net.Uri.parse(s.trim())
            (u.scheme.equals("https", true) || u.scheme.equals("http", true)) && !u.host.isNullOrBlank() && s.length <= 2000
        } catch (_: Exception) { false }
    }
    private fun validText(s: String, max: Int = MAX_TEXT) = s.length in 1..max && !s.contains('\u0000')
}
