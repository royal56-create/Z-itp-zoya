package com.royalankit.zoya.service

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.os.Bundle
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo

class ZoyaAccessibilityService : AccessibilityService() {
    companion object {
        @Volatile private var instance: ZoyaAccessibilityService? = null
        fun isEnabled() = instance != null
        fun typeText(text: String, done: (Boolean) -> Unit) {
            instance?.runOnService { done(instance!!.typeFocused(text)) } ?: done(false)
        }
        fun clickText(text: String, done: (Boolean) -> Unit) {
            instance?.runOnService { done(instance!!.clickText(text)) } ?: done(false)
        }
        fun scroll(direction: String, done: (Boolean) -> Unit) {
            instance?.runOnService { done(instance!!.scroll(direction)) } ?: done(false)
        }
        fun back(done: (Boolean) -> Unit) {
            instance?.runOnService { done(instance!!.rootInActiveWindow?.performAction(AccessibilityNodeInfo.ACTION_BACK) == true) } ?: done(false)
        }
    }

    private fun runOnService(block: () -> Unit) = android.os.Handler(mainLooper).post(block)

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
        serviceInfo = serviceInfo.apply {
            eventTypes = AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED or
                AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED or
                AccessibilityEvent.TYPE_VIEW_FOCUSED
            feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC
            notificationTimeout = 100
            flags = flags or AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS
        }
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) = Unit
    override fun onInterrupt() = Unit

    private fun typeFocused(text: String): Boolean {
        val root = rootInActiveWindow ?: return false
        val target = findEditable(root) ?: return false
        val args = Bundle().apply {
            putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, text.take(4000))
        }
        return target.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args)
    }


    private fun clickText(text: String): Boolean {
        val root = rootInActiveWindow ?: return false
        val needle = text.trim().lowercase()
        if (needle.isBlank()) return false
        val queue = ArrayDeque<AccessibilityNodeInfo>()
        queue.add(root)
        while (queue.isNotEmpty()) {
            val n = queue.removeFirst()
            val label = listOfNotNull(n.text?.toString(), n.contentDescription?.toString())
                .joinToString(" ").lowercase()
            if (n.isVisibleToUser && n.isEnabled && label == needle) {
                if (n.isClickable && n.performAction(AccessibilityNodeInfo.ACTION_CLICK)) return true
                var parent = n.parent
                repeat(4) {
                    if (parent != null && parent.isVisibleToUser && parent.isEnabled && parent.isClickable && parent.performAction(AccessibilityNodeInfo.ACTION_CLICK)) return true
                    parent = parent?.parent
                }
            }
            for (i in 0 until n.childCount) n.getChild(i)?.let(queue::addLast)
        }
        return false
    }

    private fun scroll(direction: String): Boolean {
        val root = rootInActiveWindow ?: return false
        val action = when (direction.lowercase()) {
            "up" -> AccessibilityNodeInfo.ACTION_SCROLL_FORWARD
            "down" -> AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD
            "left" -> AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD
            "right" -> AccessibilityNodeInfo.ACTION_SCROLL_FORWARD
            else -> return false
        }
        val nodes = ArrayDeque<AccessibilityNodeInfo>()
        nodes.add(root)
        while (nodes.isNotEmpty()) {
            val n = nodes.removeFirst()
            if (n.isVisibleToUser && n.isScrollable && n.performAction(action)) return true
            for (i in 0 until n.childCount) n.getChild(i)?.let(nodes::addLast)
        }
        return false
    }

    /** Never type into password/credential fields. */
    private fun findEditable(n: AccessibilityNodeInfo): AccessibilityNodeInfo? {
        if (n.isEditable && n.isEnabled && n.isVisibleToUser && !n.isPassword) return n
        for (i in 0 until n.childCount) {
            val child = n.getChild(i) ?: continue
            findEditable(child)?.let { return it }
        }
        return null
    }

    override fun onDestroy() {
        if (instance === this) instance = null
        super.onDestroy()
    }
}
