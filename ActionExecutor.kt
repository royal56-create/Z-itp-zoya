package com.royalankit.zoya.commands

import android.Manifest
import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraManager
import android.net.Uri
import android.provider.ContactsContract
import android.provider.Telephony
import android.telephony.SmsManager
import androidx.core.content.ContextCompat
import com.royalankit.zoya.core.ActionPolicy
import com.royalankit.zoya.service.ZoyaAccessibilityService
import com.royalankit.zoya.service.ZoyaNotificationListener
import java.util.Calendar

class ActionExecutor(private val context: Context) {
    data class Result(val ok: Boolean, val message: String, val needsConfirmation: Boolean = false)

    fun execute(c: ZoyaCommand, confirmed: Boolean = false, directUserCommand: Boolean = false, done: (Result) -> Unit) {
        if (!ActionPolicy.isAllowed(c)) { done(Result(false, "यह action local security policy के अनुसार सुरक्षित नहीं है।")); return }
        if (!safetyEnabled()) { done(Result(false, "Master Safety Switch बंद है; action रोक दिया गया।")); return }
        if (ActionPolicy.requiresConfirmation(c) && !confirmed && !directUserCommand) {
            done(Result(false, confirmationText(c), needsConfirmation = true)); return
        }
        when (c) {
            is ZoyaCommand.Call -> done(call(c.target))
            is ZoyaCommand.Sms -> done(sms(c.target, c.body))
            is ZoyaCommand.WhatsApp -> done(whatsapp(c.target, c.body, directUserCommand))
            is ZoyaCommand.OpenApp -> done(openApp(c.name))
            is ZoyaCommand.TypeText -> type(c.text, done)
            is ZoyaCommand.ClickText -> click(c.text, done)
            is ZoyaCommand.OpenUrl -> done(openUrl(c.url))
            is ZoyaCommand.Scroll -> scroll(c.direction, done)
            is ZoyaCommand.WebSearch -> done(web("https://www.google.com/search?q=${Uri.encode(c.query)}", "Search opened."))
            is ZoyaCommand.Youtube -> done(web("https://www.youtube.com/results?search_query=${Uri.encode(c.query)}", "YouTube search opened."))
            is ZoyaCommand.Spotify -> done(web("https://open.spotify.com/search/${Uri.encode(c.query)}", "Spotify search opened."))
            is ZoyaCommand.Timer -> done(timer(c.seconds))
            is ZoyaCommand.Alarm -> done(alarm(c.hour, c.minute))
            ZoyaCommand.ReadMessages -> done(readMessages())
            ZoyaCommand.Camera -> done(camera())
            ZoyaCommand.Location -> done(location())
            ZoyaCommand.Flashlight -> done(torch())
            is ZoyaCommand.ShareText -> done(share(c.text))
            is ZoyaCommand.Email -> done(email(c.to, c.subject, c.body))
            ZoyaCommand.Unknown -> done(Result(false, "मैं इस command को सुरक्षित रूप से action में नहीं बदल पाई।"))
        }
    }

    private fun confirmationText(c: ZoyaCommand) = when (c) {
        is ZoyaCommand.Call -> "${c.target} को call लगाऊँ? बोलिए: हाँ या नहीं।"
        is ZoyaCommand.Sms -> "${c.target} को SMS भेजूँ? Message: ${c.body.take(240)}. बोलिए: हाँ या नहीं।"
        is ZoyaCommand.WhatsApp -> "WhatsApp में ${c.target} को यह message भेजने के लिए तैयार करूँ? ${c.body.take(240)}. बोलिए: हाँ या नहीं।"
        is ZoyaCommand.Email -> "Email तैयार करूँ? बोलिए: हाँ या नहीं।"
        is ZoyaCommand.ShareText -> "यह text share करूँ? बोलिए: हाँ या नहीं।"
        is ZoyaCommand.TypeText -> "यह text current field में लिखूँ? बोलिए: हाँ या नहीं।"
        else -> "इस action की पुष्टि करें: हाँ या नहीं।"
    }

    private fun call(target: String): Result {
        val n = resolvePhone(target) ?: normalize(target)
        if (n.isBlank()) return Result(false, "Contact या number नहीं मिला।")
        if (!has(Manifest.permission.CALL_PHONE)) return Result(false, "Phone Call permission नहीं मिली। Permission Center में इसे enable करें।")
        return try {
            context.startActivity(Intent(Intent.ACTION_CALL, Uri.parse("tel:${Uri.encode(n)}")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            Result(true, "$target को call शुरू कर दिया।")
        } catch (_: Exception) { Result(false, "Call शुरू नहीं हो पाई।") }
    }

    private fun sms(target: String, body: String): Result {
        val n = resolvePhone(target) ?: normalize(target)
        if (n.isBlank()) return Result(false, "Contact या number नहीं मिला।")
        if (!has(Manifest.permission.SEND_SMS)) return Result(false, "SMS permission नहीं मिली।")
        return try {
            SmsManager.getDefault().sendTextMessage(n, null, body.take(ActionPolicy.MAX_TEXT), null, null)
            Result(true, "SMS भेज दिया।")
        } catch (_: Exception) { Result(false, "SMS नहीं भेज पाया।") }
    }

    /** Direct user commands may complete the UI action; AI-generated actions still require confirmation. */
    private fun whatsapp(target: String, body: String, autoSend: Boolean): Result {
        val n = resolvePhone(target) ?: normalize(target)
        if (n.isBlank()) return Result(false, "WhatsApp contact नहीं मिला।")
        val clean = n.filter { it.isDigit() }.take(20)
        if (clean.isBlank()) return Result(false, "WhatsApp number invalid है।")
        val i = Intent(Intent.ACTION_VIEW, Uri.parse("https://wa.me/$clean?text=${Uri.encode(body)}")).apply {
            setPackage("com.whatsapp"); addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        return try {
            if (context.packageManager.resolveActivity(i, PackageManager.MATCH_DEFAULT_ONLY) == null) return Result(false, "WhatsApp installed नहीं है।")
            context.startActivity(i)
            if (autoSend && ZoyaAccessibilityService.isEnabled()) {
                android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                    ZoyaAccessibilityService.clickText("Send") {}
                }, 1200)
            }
            Result(true, if (autoSend) "WhatsApp message भेजने की कोशिश की गई।" else "WhatsApp खुल गया और message तैयार है।")
        } catch (_: Exception) { Result(false, "WhatsApp action failed।") }
    }

    private fun type(text: String, done: (Result) -> Unit) {
        if (!ZoyaAccessibilityService.isEnabled()) { done(Result(false, "Auto-type के लिए Accessibility Access चाहिए।")); return }
        ZoyaAccessibilityService.typeText(text.take(ActionPolicy.MAX_TEXT)) { done(if (it) Result(true, "Text लिख दिया।") else Result(false, "Safe editable field नहीं मिली।")) }
    }

    private fun click(text: String, done: (Result) -> Unit) {
        if (!ZoyaAccessibilityService.isEnabled()) { done(Result(false, "Auto-click के लिए Accessibility Access चाहिए।")); return }
        ZoyaAccessibilityService.clickText(text.take(200)) { ok -> done(if (ok) Result(true, "‘${text.take(80)}’ पर click कर दिया।") else Result(false, "‘${text.take(80)}’ वाला visible button नहीं मिला।")) }
    }

    private fun scroll(direction: String, done: (Result) -> Unit) {
        if (!ZoyaAccessibilityService.isEnabled()) { done(Result(false, "Auto-scroll के लिए Accessibility Access चाहिए।")); return }
        ZoyaAccessibilityService.scroll(direction) { ok -> done(if (ok) Result(true, "Screen ${direction.lowercase()} scroll कर दी।") else Result(false, "इस screen पर ${direction.lowercase()} scroll नहीं हो सका।")) }
    }

    private fun openUrl(url: String): Result = web(url, "Website खोल दी।")

    private fun openApp(name: String): Result {
        val n = name.lowercase().replace(" app", "").trim().take(100)
        val aliases = mapOf("whatsapp" to "com.whatsapp", "instagram" to "com.instagram.android", "telegram" to "org.telegram.messenger", "youtube" to "com.google.android.youtube", "spotify" to "com.spotify.music", "facebook" to "com.facebook.katana", "gmail" to "com.google.android.gm", "maps" to "com.google.android.apps.maps", "chatgpt" to "com.openai.chatgpt", "linkedin" to "com.linkedin.android", "discord" to "com.discord", "netflix" to "com.netflix.mediaclient", "amazon" to "in.amazon.mShop.android.shopping", "flipkart" to "com.flipkart.android", "phonepe" to "com.phonepe.app", "paytm" to "net.one97.paytm", "messages" to "com.google.android.apps.messaging", "contacts" to "com.google.android.contacts", "settings" to "com.android.settings")
        return try {
            val launch = aliases[n]?.let { context.packageManager.getLaunchIntentForPackage(it) }
            if (launch != null) { context.startActivity(launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); Result(true, "$name खोल दिया।") }
            else Result(false, "$name installed नहीं मिली।")
        } catch (_: Exception) { Result(false, "$name नहीं खुल पाया।") }
    }

    private fun web(url: String, msg: String): Result = try {
        context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); Result(true, msg)
    } catch (_: Exception) { Result(false, "Link नहीं खुला।") }

    private fun timer(seconds: Long): Result {
        if (seconds !in 1..86_400) return Result(false, "Timer समय गलत है।")
        val am = context.getSystemService(AlarmManager::class.java)
        val pi = PendingIntent.getBroadcast(context, (System.currentTimeMillis() and 0x7fffffff).toInt(), Intent("com.royalankit.zoya.TIMER").setPackage(context.packageName), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        return try { am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, System.currentTimeMillis() + seconds * 1000, pi); Result(true, "Timer लगा दिया।") } catch (_: SecurityException) { Result(false, "Exact alarm access उपलब्ध नहीं है।") }
    }

    private fun alarm(hour: Int, minute: Int): Result {
        if (hour !in 0..23 || minute !in 0..59) return Result(false, "Alarm time गलत है।")
        val cal = Calendar.getInstance().apply { set(Calendar.HOUR_OF_DAY, hour); set(Calendar.MINUTE, minute); set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0); if (timeInMillis <= System.currentTimeMillis()) add(Calendar.DAY_OF_YEAR, 1) }
        val am = context.getSystemService(AlarmManager::class.java)
        val pi = PendingIntent.getBroadcast(context, 2001, Intent("com.royalankit.zoya.ALARM").setPackage(context.packageName), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        return try { am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, cal.timeInMillis, pi); Result(true, "${String.format("%02d:%02d", hour, minute)} का alarm लगा दिया।") } catch (_: SecurityException) { Result(false, "Exact alarm access नहीं मिला।") }
    }

    private fun readMessages(): Result {
        val notes = ZoyaNotificationListener.recent(10).joinToString(". ") { "${it.title.ifBlank { it.app }}: ${redact(it.text)}" }
        val sms = if (has(Manifest.permission.READ_SMS)) readSms() else ""
        val all = listOf(notes, sms).filter { it.isNotBlank() }.joinToString(". ")
        return if (all.isBlank()) Result(false, "Readable messages नहीं मिले।") else Result(true, all.take(6000))
    }

    private fun readSms(): String {
        val out = mutableListOf<String>()
        val p = arrayOf(Telephony.Sms.ADDRESS, Telephony.Sms.BODY)
        context.contentResolver.query(Telephony.Sms.Inbox.CONTENT_URI, p, null, null, "${Telephony.Sms.DATE} DESC")?.use { c ->
            var k = 0
            while (c.moveToNext() && k < 8) { out += "SMS ${c.getString(0).orEmpty()}: ${redact(c.getString(1).orEmpty())}"; k++ }
        }
        return out.joinToString(". ")
    }

    private fun redact(s: String): String = s.replace(Regex("(?<!\\d)\\d{6}(?!\\d)"), "[OTP REDACTED]").take(1200)
    private fun camera(): Result = if (!has(Manifest.permission.CAMERA)) Result(false, "Camera permission नहीं मिली.") else try { context.startActivity(Intent(android.provider.MediaStore.ACTION_IMAGE_CAPTURE).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); Result(true, "Camera खोल दिया।") } catch (_: Exception) { Result(false, "Camera नहीं खुला।") }
    private fun location(): Result = if (!has(Manifest.permission.ACCESS_FINE_LOCATION) && !has(Manifest.permission.ACCESS_COARSE_LOCATION)) Result(false, "Location permission नहीं मिली।") else web("https://maps.google.com/?q=My+Location", "Maps खोल दिया।")
    private fun torch(): Result = if (!has(Manifest.permission.CAMERA)) Result(false, "Torch control के लिए Camera permission नहीं मिली।") else try { val cm = context.getSystemService(CameraManager::class.java); val id = cm.cameraIdList.firstOrNull { cm.getCameraCharacteristics(it).get(CameraCharacteristics.FLASH_INFO_AVAILABLE) == true } ?: return Result(false, "Flashlight उपलब्ध नहीं है।"); cm.setTorchMode(id, true); Result(true, "Flashlight on कर दिया।") } catch (_: Exception) { Result(false, "Flashlight control failed।") }
    private fun share(text: String): Result = try { context.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).apply { type = "text/plain"; putExtra(Intent.EXTRA_TEXT, text.take(ActionPolicy.MAX_TEXT)); addFlags(Intent.FLAG_ACTIVITY_NEW_TASK) }, "Share with…")); Result(true, "Share sheet खोल दिया।") } catch (_: Exception) { Result(false, "Share नहीं खुला।") }
    private fun email(to: String?, subject: String?, body: String): Result = try { val uri = Uri.parse("mailto:${to.orEmpty()}?subject=${Uri.encode(subject.orEmpty())}&body=${Uri.encode(body.take(ActionPolicy.MAX_TEXT))}"); context.startActivity(Intent(Intent.ACTION_SENDTO, uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); Result(true, "Email composer खोल दिया; Send आप खुद दबाएँ।") } catch (_: Exception) { Result(false, "Email app नहीं मिली।") }
    private fun resolvePhone(target: String): String? { if (!has(Manifest.permission.READ_CONTACTS)) return null; val p = arrayOf(ContactsContract.CommonDataKinds.Phone.NUMBER); context.contentResolver.query(ContactsContract.CommonDataKinds.Phone.CONTENT_URI, p, "${ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME} LIKE ?", arrayOf("%${target.take(100)}%"), null)?.use { if (it.moveToFirst()) return it.getString(0) }; return null }
    private fun normalize(v: String) = v.trim().replace(Regex("[^0-9+]"), "").take(20)
    private fun safetyEnabled() = context.getSharedPreferences("zoya_safety", Context.MODE_PRIVATE).getBoolean("enabled", true)
    private fun has(p: String) = ContextCompat.checkSelfPermission(context, p) == PackageManager.PERMISSION_GRANTED
}
