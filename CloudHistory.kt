package com.royalankit.zoya.memory

import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore

class CloudHistory {
    private val db by lazy { FirebaseFirestore.getInstance() }

    fun save(uid: String, kind: String, user: String, assistant: String) {
        val current = FirebaseAuth.getInstance().currentUser?.uid ?: return
        if (current != uid || uid.isBlank()) return
        db.collection("users").document(uid).collection("history").add(
            mapOf("kind" to kind.take(40), "ts" to System.currentTimeMillis(), "user" to user.take(8000), "assistant" to assistant.take(8000))
        )
    }

    fun syncRecent(uid: String, local: HistoryStore, done: () -> Unit = {}) {
        val current = FirebaseAuth.getInstance().currentUser?.uid ?: run { done(); return }
        if (current != uid || uid.isBlank()) { done(); return }
        db.collection("users").document(uid).collection("history")
            .orderBy("ts", com.google.firebase.firestore.Query.Direction.DESCENDING).limit(200).get()
            .addOnSuccessListener {
                for (d in it.documents) local.add(uid, d.getString("kind") ?: "chat", d.getString("user") ?: "", d.getString("assistant") ?: "")
                done()
            }.addOnFailureListener { done() }
    }
}
