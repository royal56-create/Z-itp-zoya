plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val local = java.util.Properties().apply {
    val f = rootProject.file("local.properties")
    if (f.exists()) f.inputStream().use { load(it) }
}
fun cfg(name: String): String = (local.getProperty(name) ?: project.findProperty(name)?.toString() ?: "").replace("\\", "\\\\").replace("\"", "\\\"")

android {
    namespace = "com.royalankit.zoya"
    compileSdk = 35
    buildFeatures { buildConfig = true }
    defaultConfig {
        applicationId = "com.royalankit.zoya"
        minSdk = 26
        targetSdk = 35
        versionCode = 2
        versionName = "2.0.0"
        buildConfigField("String", "FIREBASE_API_KEY", "\"${cfg("FIREBASE_API_KEY")}\"")
        buildConfigField("String", "FIREBASE_APP_ID", "\"${cfg("FIREBASE_APP_ID")}\"")
        buildConfigField("String", "FIREBASE_PROJECT_ID", "\"${cfg("FIREBASE_PROJECT_ID")}\"")
        buildConfigField("String", "FIREBASE_STORAGE_BUCKET", "\"${cfg("FIREBASE_STORAGE_BUCKET")}\"")
        buildConfigField("String", "FIREBASE_GCM_SENDER_ID", "\"${cfg("FIREBASE_GCM_SENDER_ID")}\"")
        buildConfigField("String", "GOOGLE_WEB_CLIENT_ID", "\"${cfg("GOOGLE_WEB_CLIENT_ID")}\"")
    }
    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget = "17" }
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.activity:activity-ktx:1.10.1")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("com.google.android.material:material:1.12.0")
    implementation(platform("com.google.firebase:firebase-bom:33.15.0"))
    implementation("com.google.firebase:firebase-auth")
    implementation("com.google.firebase:firebase-appcheck-playintegrity")
    implementation("com.google.firebase:firebase-firestore")
    implementation("com.google.android.gms:play-services-auth:21.3.0")
}
