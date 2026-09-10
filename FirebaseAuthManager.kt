package com.royalankit.zoya.auth

import android.app.Activity
import android.content.Context
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInClient
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.appcheck.FirebaseAppCheck
import com.google.firebase.appcheck.playintegrity.PlayIntegrityAppCheckProviderFactory
import com.google.firebase.auth.GoogleAuthProvider
import com.royalankit.zoya.BuildConfig

class FirebaseAuthManager(private val context: Context) {
    @Volatile private var appCheckInstalled = false

    private fun installAppCheck() {
        if (appCheckInstalled) return
        synchronized(this) {
            if (appCheckInstalled) return
            try {
                FirebaseAppCheck.getInstance().installAppCheckProviderFactory(PlayIntegrityAppCheckProviderFactory.getInstance())
                appCheckInstalled = true
            } catch (_: Exception) {
                // Configuration can be completed in Firebase Console before release.
            }
        }
    }
    private fun authOrNull(): FirebaseAuth? = try {
        if (FirebaseApp.getApps(context).isEmpty()) {
            if (BuildConfig.FIREBASE_API_KEY.isBlank() || BuildConfig.FIREBASE_APP_ID.isBlank() || BuildConfig.FIREBASE_PROJECT_ID.isBlank()) return null
            val b = FirebaseOptions.Builder().setApiKey(BuildConfig.FIREBASE_API_KEY).setApplicationId(BuildConfig.FIREBASE_APP_ID).setProjectId(BuildConfig.FIREBASE_PROJECT_ID)
            if (BuildConfig.FIREBASE_STORAGE_BUCKET.isNotBlank()) b.setStorageBucket(BuildConfig.FIREBASE_STORAGE_BUCKET)
            if (BuildConfig.FIREBASE_GCM_SENDER_ID.isNotBlank()) b.setGcmSenderId(BuildConfig.FIREBASE_GCM_SENDER_ID)
            FirebaseApp.initializeApp(context,b.build())
        }
        installAppCheck()
        FirebaseAuth.getInstance()
    } catch (_: Exception) { null }
    fun googleClient(activity:Activity):GoogleSignInClient? = if(BuildConfig.GOOGLE_WEB_CLIENT_ID.isBlank()||authOrNull()==null)null else GoogleSignIn.getClient(activity,GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN).requestIdToken(BuildConfig.GOOGLE_WEB_CLIENT_ID).requestEmail().build())
    fun signInWithGoogleToken(token:String,done:(Boolean,String?)->Unit){val a=authOrNull()?:run{done(false,"Firebase is not configured.");return};a.signInWithCredential(GoogleAuthProvider.getCredential(token,null)).addOnCompleteListener{done(it.isSuccessful,if(it.isSuccessful)null else it.exception?.message)}}
    fun currentUser()=authOrNull()?.currentUser
    fun signOut(){authOrNull()?.signOut()}
}
