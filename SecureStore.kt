package com.royalankit.zoya.core

import android.content.Context
import android.util.Base64
import java.nio.charset.StandardCharsets
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

class SecureStore(private val context: Context) {
    private val prefs = context.getSharedPreferences("zoya_secure", Context.MODE_PRIVATE)
    private val alias = "zoya_api_key_v2"

    private fun key(): SecretKey {
        val ks = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (ks.getKey(alias, null) as? SecretKey)?.let { return it }
        return KeyGenerator.getInstance("AES", "AndroidKeyStore").apply {
            init(android.security.keystore.KeyGenParameterSpec.Builder(
                alias,
                android.security.keystore.KeyProperties.PURPOSE_ENCRYPT or android.security.keystore.KeyProperties.PURPOSE_DECRYPT
            ).setBlockModes(android.security.keystore.KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(android.security.keystore.KeyProperties.ENCRYPTION_PADDING_NONE)
                .build())
        }.generateKey()
    }

    fun putApiKey(uid: String, value: String): Boolean {
        val cleanUid = uid.trim()
        val clean = value.trim()
        if (cleanUid.isBlank() || clean.length !in 20..512) return false
        return try {
            val cipher = Cipher.getInstance("AES/GCM/NoPadding").apply {
                init(Cipher.ENCRYPT_MODE, key())
                updateAAD(cleanUid.toByteArray(StandardCharsets.UTF_8))
            }
            val encrypted = Base64.encodeToString(cipher.doFinal(clean.toByteArray(StandardCharsets.UTF_8)), Base64.NO_WRAP)
            val iv = Base64.encodeToString(cipher.iv, Base64.NO_WRAP)
            prefs.edit().putString("$cleanUid.key", encrypted).putString("$cleanUid.iv", iv).apply()
            true
        } catch (_: Exception) { false }
    }

    fun getApiKey(uid: String): String? = try {
        val cleanUid = uid.trim()
        if (cleanUid.isBlank()) return null
        val enc = prefs.getString("$cleanUid.key", null) ?: return null
        val iv = prefs.getString("$cleanUid.iv", null) ?: return null
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, Base64.decode(iv, Base64.NO_WRAP)))
        cipher.updateAAD(cleanUid.toByteArray(StandardCharsets.UTF_8))
        String(cipher.doFinal(Base64.decode(enc, Base64.NO_WRAP)), StandardCharsets.UTF_8)
    } catch (_: Exception) { null }

    fun removeApiKey(uid: String) { prefs.edit().remove("${uid.trim()}.key").remove("${uid.trim()}.iv").remove("${uid.trim()}.model").apply() }
    fun putModel(uid: String, model: String) { if (model.matches(Regex("models/[A-Za-z0-9._-]{1,120}"))) prefs.edit().putString("${uid.trim()}.model", model).apply() }
    fun getModel(uid: String): String? = prefs.getString("${uid.trim()}.model", null)
    fun removeModel(uid: String) { prefs.edit().remove("${uid.trim()}.model").apply() }
}
