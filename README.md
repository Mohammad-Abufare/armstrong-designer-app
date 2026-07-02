# Armstrong 3D Designer — standalone test app (React Native + TypeScript)

A React Native / TypeScript app that runs the full Armstrong 3D Designer so you can test
**every function on your phone**, then hand this source to the app team to integrate into
the main app (React Native 0.81, bare CLI).

- **Language / stack:** React Native + TypeScript (same family as the main app).
- **How it works:** the designer engine runs inside a native `WebView` screen. All functions
  work (3D, size, style, openings, colors, additions, space planner, Price My Building).
- **AR:** WebXR can't run inside a WebView. The floating **AR ↗** button opens the same
  designer in the phone's browser, where AR works.

> ⚠️ Before testing: re-upload the `armstrong-3d-designer-MOBILE` folder to Netlify so the
> hosted URL shows the latest build (Colors scroll fix, 2nd-level popups, etc.). The URL the
> app loads is set in `App.tsx` → `DESIGNER_URL`.

---

## Getting a real APK on your phone — no tools to install

### Option 1 — Build the APK in the cloud with GitHub ⭐ recommended
Everything runs on GitHub's servers. You just upload the files and download the finished `.apk`.

1. Make a free account at **github.com** and click **New repository** → name it `armstrong-designer-app` → **Create**.
2. On the repo page: **Add file → Upload files**. Drag in **all files from this folder**, including the
   hidden **`.github`** folder (it holds the build recipe). Commit.
   - *Tip:* if drag-and-drop skips `.github`, use **Add file → Create new file**, type
     `.github/workflows/build-apk.yml` as the name, and paste that file's contents.
3. Go to the **Actions** tab. A run called **"Build Android APK"** starts automatically (~10–15 min).
4. When it finishes (green check), open the run → scroll to **Artifacts** → download
   **`armstrong-designer-apk`**. Unzip it to get **`app-release.apk`**.
5. Copy the `.apk` to your phone (email/Drive/USB), tap it, allow **"install unknown apps"**, install.

Send that same `app-release.apk` to the devs.

### Option 2 — EAS Build (cloud, needs a free Expo account + Node on some computer)
```bash
npm install
npm install -g eas-cli
eas login
eas build -p android --profile preview   # returns an APK download link
```

### Option 3 — Local build (a dev with Android Studio + Node)
```bash
npm install
npx expo run:android
```

---

## For the app team (integration notes)

- This test app is **Expo-managed** for easy phone testing. Your main app is **bare RN 0.81**.
  To integrate, you don't need Expo — just the pattern:
  - Add `react-native-webview` to the main app.
  - Add a screen (React Navigation) that renders `<WebView source={{ uri: DESIGNER_URL }} />`
    — the body of `App.tsx` here is the reference.
- **Bridge for Price My Building:** the web page can call
  `window.ReactNativeWebView.postMessage(JSON.stringify(payload))`; the RN side receives it in
  `onMessage` (stubbed here). The app can also push data to the page with
  `webRef.current.injectJavaScript(...)`.
- **Progressive nativization (optional, later):** the Three.js scene-building code is portable to
  `@react-three/fiber` + a GL backend; the DOM UI would be rebuilt in RN + NativeWind. Large effort —
  the WebView gets 100% of functionality working immediately while that's decided.
- **AR:** for a native experience, replace the browser hand-off with ARCore/ARKit (e.g. ViroReact).
  The current button opens the hosted designer in Chrome/Safari, where WebXR/Quick Look run.

## Files
- `App.tsx` — the app (WebView screen + AR-to-browser + Android back handling + message bridge stub).
- `app.json` — Expo config (name, `com.armstrongsteel.designer`, camera permission).
- `eas.json` — cloud APK build profile.
- `package.json`, `tsconfig.json`, `babel.config.js` — standard RN/Expo/TypeScript setup.
