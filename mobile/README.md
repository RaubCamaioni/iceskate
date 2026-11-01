# Mobile apps

Two thin wrappers that show the published site (https://raubcamaioni.github.io/iceskate/) full
screen in a web view. There is no app logic beyond that: the site itself is the app, so every
change deployed to GitHub Pages shows up in the apps without an update.

Both apps:

- load the site over HTTPS and keep the site's own storage, so filters and your starting point
  are remembered between launches;
- pass "Use my location" through to the phone's location permission (the usage text is in the
  manifest / Info.plist);
- open links that leave the site (rink websites, Google Maps directions, phone numbers) in the
  phone's own apps;
- show a "Try again" screen if the site cannot be loaded.

## Getting the builds

The GitHub Actions workflow `.github/workflows/mobile.yml` builds both apps on every push that
touches `mobile/` (and on demand from the Actions tab). Pushing a version tag publishes the
builds to the repo's [Releases page](https://github.com/RaubCamaioni/iceskate/releases), where the
links need no GitHub login and the `latest` ones always point at the newest release:

| File | What it is | How to install |
|---|---|---|
| [NoVAIce-android-debug.apk](https://github.com/RaubCamaioni/iceskate/releases/latest/download/NoVAIce-android-debug.apk) | debug-signed APK | Open the link on the phone and install it (allow installs from this source), or `adb install NoVAIce-android-debug.apk` |
| [NoVAIce-ios-unsigned.ipa](https://github.com/RaubCamaioni/iceskate/releases/latest/download/NoVAIce-ios-unsigned.ipa) | built without a signing identity | Sign with your own Apple ID: open `mobile/ios` in Xcode (see below) and run on your phone, or sign the .ipa with a sideloading tool such as AltStore or Sideloadly |

To cut a release, bump `versionName` in `android/app/build.gradle.kts` and `MARKETING_VERSION` /
`CFBundleShortVersionString` in `ios/project.yml`, then tag and push:

    git tag v0.2.0 && git push origin v0.2.0

The same files are also attached to each run as artifacts (`NoVAIce-android-debug-apk`,
`NoVAIce-ios-unsigned-ipa`), which expire after 90 days.

Apple does not allow installing an unsigned app directly; signing needs an Apple ID (free for
7-day installs on your own devices, or a paid developer account for TestFlight / App Store).

## Android (`mobile/android`)

Plain Java, no AndroidX or third-party libraries. `MainActivity` is a full-screen `WebView` with
JavaScript, DOM storage and geolocation enabled; the Android back button walks the web history.
Package `com.raubcamaioni.iceskate`, min SDK 26 (Android 8.0), target SDK 35.

Build locally with Android Studio (open the `mobile/android` folder; Studio offers to add the
Gradle wrapper) or with a JDK 17 and Gradle 8.9 on the path:

    cd mobile/android
    gradle assembleDebug
    # -> app/build/outputs/apk/debug/app-debug.apk

For a Play Store build, add a signing config to `app/build.gradle.kts` and run
`gradle bundleRelease`.

## iOS (`mobile/ios`)

SwiftUI app whose only view wraps a `WKWebView` (`ContentView.swift`): pull down to refresh,
swipe from the edge to go back, external links handed to the system. iOS 16 and later, iPhone
and iPad. Bundle id `com.raubcamaioni.iceskate`.

The Xcode project is not committed; it is generated from `project.yml` with
[XcodeGen](https://github.com/yonaskolb/XcodeGen):

    brew install xcodegen
    cd mobile/ios
    xcodegen generate
    open NoVAIce.xcodeproj

In Xcode pick your team under Signing & Capabilities, choose your phone and press Run.

## Icons

Both icons are the site's favicon mark (two crossed blades on blue). Android uses an adaptive
icon (`res/mipmap-anydpi-v26` + `res/drawable/ic_launcher_foreground.xml`); iOS uses the
1024-pixel PNG in `Assets.xcassets`, which Xcode scales for every size.
