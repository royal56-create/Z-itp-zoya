package com.royalankit.zoya.core

import java.util.concurrent.ConcurrentHashMap

/** Small client-side guard against accidental loops and API abuse. */
class RateLimiter(private val minIntervalMs: Long, private val maxEvents: Int, private val windowMs: Long) {
    private data class State(var last: Long = 0L, val events: ArrayDeque<Long> = ArrayDeque())
    private val states = ConcurrentHashMap<String, State>()

    @Synchronized
    fun allow(key: String): Boolean {
        val now = System.currentTimeMillis()
        val state = states.getOrPut(key) { State() }
        if (state.last != 0L && now - state.last < minIntervalMs) return false
        while (state.events.isNotEmpty() && now - state.events.first() > windowMs) state.events.removeFirst()
        if (state.events.size >= maxEvents) return false
        state.last = now
        state.events.addLast(now)
        return true
    }
}
