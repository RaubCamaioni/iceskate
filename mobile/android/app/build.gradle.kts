plugins {
    id("com.android.application")
}

android {
    namespace = "com.raubcamaioni.iceskate"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.raubcamaioni.iceskate"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

// Plain Android framework classes only: no AndroidX, Kotlin or third-party libraries to fetch.
dependencies {}
