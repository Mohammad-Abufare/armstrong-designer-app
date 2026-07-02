/**
 * Armstrong 3D Designer — standalone test app (React Native + TypeScript / Expo).
 *
 * Purpose: install on a phone to test every function of the designer, then hand this
 * source to the app team to integrate into the main React Native app (RN 0.81 bare CLI).
 *
 * How it works: the full designer engine runs inside a native WebView screen. Everything
 * (3D, sizes, openings, colors, additions, space planner, Price My Building) works here.
 * AR (WebXR / Quick Look) can't run inside a WebView, so the "AR" button below opens the
 * same designer in the phone's Chrome/Safari, where AR works.
 */
import React, {useCallback, useRef, useState} from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Linking,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {WebView, WebViewMessageEvent} from 'react-native-webview';

// ── The hosted designer. Re-upload the MOBILE folder to Netlify so this shows the latest build. ──
const DESIGNER_URL = 'https://luxury-khapse-f893cc.netlify.app/';

const NAVY = '#16275f';
const GOLD = '#f5a623';

export default function App(): React.JSX.Element {
  const webRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [canGoBack, setCanGoBack] = useState(false);

  // Android hardware back → navigate the WebView history instead of closing the app.
  React.useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBack && webRef.current) {
        webRef.current.goBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [canGoBack]);

  // Open the designer in the system browser so AR (WebXR / Quick Look) works.
  const openInBrowser = useCallback(() => {
    Linking.openURL(DESIGNER_URL).catch(() => {});
  }, []);

  // Bridge hook for the future: the web page can postMessage (e.g. Price My Building payloads).
  const onMessage = useCallback((e: WebViewMessageEvent) => {
    // eslint-disable-next-line no-console
    console.log('web → app message:', e.nativeEvent.data);
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />
      <WebView
        ref={webRef}
        source={{uri: DESIGNER_URL}}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        onNavigationStateChange={s => setCanGoBack(s.canGoBack)}
        onMessage={onMessage}
        // let the 3D engine own touch + allow camera/media for any in-page use
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        originWhitelist={['*']}
        setSupportMultipleWindows={false}
        style={styles.web}
      />

      {loading && (
        <View style={styles.loader} pointerEvents="none">
          <ActivityIndicator size="large" color={GOLD} />
          <Text style={styles.loaderText}>Loading designer…</Text>
        </View>
      )}

      {/* AR helper: WebXR can't run in a WebView, so jump to the browser where it works. */}
      <TouchableOpacity style={styles.arBtn} onPress={openInBrowser} activeOpacity={0.85}>
        <Text style={styles.arBtnText}>AR ↗</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: NAVY},
  web: {flex: 1, backgroundColor: '#eef1f6'},
  loader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: NAVY,
  },
  loaderText: {marginTop: 14, color: '#c7cfe4', fontSize: 15, fontWeight: '600'},
  arBtn: {
    position: 'absolute',
    right: 16,
    bottom: 26,
    backgroundColor: NAVY,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: {width: 0, height: 6},
    elevation: 6,
  },
  arBtnText: {color: '#fff', fontSize: 14, fontWeight: '700', letterSpacing: 0.4},
});
