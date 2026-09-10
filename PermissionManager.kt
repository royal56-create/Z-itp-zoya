package com.royalankit.zoya.permissions

import android.accessibilityservice.AccessibilityService
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.provider.Settings
import androidx.core.content.ContextCompat
import com.royalankit.zoya.service.ZoyaAccessibilityService
import com.royalankit.zoya.service.ZoyaNotificationListener

object PermissionManager {
    fun has(context: Context, p: String) = ContextCompat.checkSelfPermission(context, p) == PackageManager.PERMISSION_GRANTED
    fun accessibility(context: Context): Boolean { val s = Settings.Secure.getString(context.contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES) ?: return false; val n = ComponentName(context, ZoyaAccessibilityService::class.java).flattenToString(); return s.split(':').any { it.equals(n, true) } }
    fun notifications(context: Context): Boolean { val s = Settings.Secure.getString(context.contentResolver, "enabled_notification_listeners") ?: return false; val n = ComponentName(context, ZoyaNotificationListener::class.java).flattenToString(); return s.split(':').any { it.equals(n, true) } }
    fun accessibilitySettings() = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
    fun notificationSettings() = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
    fun assistantRole(context: Context): Intent? = if (android.os.Build.VERSION.SDK_INT >= 29) Intent("android.app.action.ASSISTANT") else null
}
