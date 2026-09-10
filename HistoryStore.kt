package com.royalankit.zoya.memory

import android.content.Context
import android.util.Base64
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.nio.charset.StandardCharsets
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import java.util.Locale

/** Encrypted, per-device history store. The cloud copy is protected by Firestore rules. */
class HistoryStore(private val context: Context) {
    data class Item(val ts: Long, val kind: String, val user: String, val assistant: String)
    private val lock = Any()
    private val file = File(context.filesDir, "zoya_history.enc")
    private val alias = "zoya_history_key_v1"
    private val prefs = context.getSharedPreferences("zoya_history_meta", Context.MODE_PRIVATE)

    init { migrateLegacySqlite() }

    fun add(uid: String, kind: String, user: String, assistant: String) = synchronized(lock) {
        if (uid.isBlank()) return@synchronized
        val list = readAll().toMutableList()
        list.add(Item(System.currentTimeMillis(), kind.take(40), user.take(8000), assistant.take(8000)))
        while (list.size > 5000) list.removeAt(0)
        writeAll(list)
    }

    fun recent(uid: String, limit: Int = 40): List<Item> = query(uid, null, limit)

    fun search(uid: String, topic: String, limit: Int = 20): List<Item> = query(uid, topic, limit)

    private fun query(uid: String, topic: String?, limit: Int): List<Item> = synchronized(lock) {
        val safeLimit = limit.coerceIn(1, 100)
        val needle = topic?.trim()?.lowercase(Locale.ROOT).orEmpty()
        readAll().asSequence().filter { it.uidMatches(uid) }.filter {
            needle.isBlank() || it.user.lowercase(Locale.ROOT).contains(needle) || it.assistant.lowercase(Locale.ROOT).contains(needle)
        }.sortedByDescending { it.ts }.take(safeLimit).map { it.item }.toList()
    }

    fun memoryContext(uid: String, query: String): String = search(uid, query, 8).joinToString("\n") {
        "${java.text.SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.US).format(java.util.Date(it.ts))} [${it.kind}] USER: ${it.user} | ZOYA: ${it.assistant}"
    }

    fun deleteUser(uid: String) = synchronized(lock) { writeAll(readAll().filterNot { it.uidMatches(uid) }) }

    private data class Stored(val uid: String, val item: Item)
    private fun Stored.uidMatches(uid: String) = this.uid == uid

    private fun readAll(): List<Stored> {
        if (!file.exists()) return emptyList()
        return try {
            val raw = decrypt(file.readBytes())
            val arr = JSONArray(String(raw, StandardCharsets.UTF_8))
            buildList {
                for (i in 0 until arr.length()) {
                    val o = arr.optJSONObject(i) ?: continue
                    val uid = o.optString("uid")
                    if (uid.isBlank()) continue
                    add(Stored(uid, Item(o.optLong("ts"), o.optString("kind"), o.optString("user"), o.optString("assistant"))))
                }
            }
        } catch (_: Exception) { emptyList() }
    }

    private fun writeAll(list: List<Stored>) {
        val arr = JSONArray()
        list.forEach { s -> arr.put(JSONObject().put("uid", s.uid).put("ts", s.item.ts).put("kind", s.item.kind).put("user", s.item.user).put("assistant", s.item.assistant)) }
        val encrypted = encrypt(arr.toString().toByteArray(StandardCharsets.UTF_8))
        val tmp = File(context.filesDir, "zoya_history.enc.tmp")
        tmp.writeBytes(encrypted)
        if (!tmp.renameTo(file)) { file.writeBytes(encrypted); tmp.delete() }
    }

    private fun key(): SecretKey {
        val ks = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (ks.getKey(alias, null) as? SecretKey)?.let { return it }
        return KeyGenerator.getInstance("AES", "AndroidKeyStore").apply {
            init(android.security.keystore.KeyGenParameterSpec.Builder(alias, android.security.keystore.KeyProperties.PURPOSE_ENCRYPT or android.security.keystore.KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(android.security.keystore.KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(android.security.keystore.KeyProperties.ENCRYPTION_PADDING_NONE).build())
        }.generateKey()
    }

    private fun encrypt(bytes: ByteArray): ByteArray {
        val c = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.ENCRYPT_MODE, key()) }
        return c.iv + c.doFinal(bytes)
    }
    private fun decrypt(bytes: ByteArray): ByteArray {
        require(bytes.size > 12)
        val iv = bytes.copyOfRange(0, 12)
        val body = bytes.copyOfRange(12, bytes.size)
        val c = Cipher.getInstance("AES/GCM/NoPadding")
        c.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, iv))
        return c.doFinal(body)
    }

    /** One-time migration from the old plaintext SQLite DB, then removes it. */
    private fun migrateLegacySqlite() = synchronized(lock) {
        val legacy = context.getDatabasePath("zoya_history.db")
        if (!legacy.exists() || prefs.getBoolean("migrated", false)) return@synchronized
        try {
            val db = android.database.sqlite.SQLiteDatabase.openDatabase(legacy.path, null, android.database.sqlite.SQLiteDatabase.OPEN_READONLY)
            val migrated = readAll().toMutableList()
            db.rawQuery("SELECT uid,ts,kind,user_text,assistant_text FROM history ORDER BY ts ASC", null).use { c ->
                while (c.moveToNext()) migrated.add(Stored(c.getString(0), Item(c.getLong(1), c.getString(2), c.getString(3), c.getString(4))))
            }
            db.close()
            while (migrated.size > 5000) migrated.removeAt(0)
            writeAll(migrated)
            legacy.delete()
            File(legacy.path + "-journal").delete()
            prefs.edit().putBoolean("migrated", true).apply()
        } catch (_: Exception) { /* Keep legacy file until a successful migration. */ }
    }
}
