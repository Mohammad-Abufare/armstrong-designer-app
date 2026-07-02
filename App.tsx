/**
 * Armstrong 3D Designer — standalone test app (React Native + TypeScript / Expo).
 *
 * The designer runs inside a native WebView. The "View on my lot" button no longer tries WebXR
 * (which can't run in a WebView). Instead it exports the current building to a GLB, hands it to the
 * native side, and opens a real ARCore/ARKit screen (ArScreen) that places it in your space.
 */
import React, {useCallback, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Linking,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {WebView, WebViewMessageEvent} from 'react-native-webview';
import Svg, {Path, Rect} from 'react-native-svg';
import * as FileSystem from 'expo-file-system';
import {Asset} from 'expo-asset';
import ArScreen from './ArScreen';

// The designer ships INSIDE the app (assets/designer.html, with Three.js embedded) and loads
// locally — no Netlify, no CDN, works offline.
const DESIGNER_HTML = require('./assets/designer.html');

const NAVY = '#16275f';
const GOLD = '#f5a623';

// App-only tweaks + route the in-page "View on my lot" button to NATIVE AR.
const INJECT = `
(function(){
  try{
    var s = document.createElement('style');
    s.innerHTML = 'body.mode-client #asbHeader{border-radius:0 !important;}';
    document.head.appendChild(s);
  }catch(e){}

  // Export ONLY the building for AR — hide the scenic ground/background first, otherwise the huge
  // ground plane (part of buildGroup) gets exported and fills the AR camera as a flat surface.
  window.__armExportGLBBase64 = function(onOk, onErr){
    onErr = onErr || function(){};
    try{
      if(!(window.THREE && window.THREE.GLTFExporter)){ onErr('3D exporter not loaded'); return; }
      var src = window.buildGroup; if(!src){ onErr('no building yet'); return; }
      var hidden = [];
      [window.GROUND_MESH, window.SCENE_BG_GROUND, window.__groundGroup].forEach(function(m){
        if(m && m.visible){ m.visible = false; hidden.push(m); }
      });
      var clone = src.clone(true);
      hidden.forEach(function(m){ m.visible = true; });   // restore the live view immediately
      clone.scale.multiplyScalar(0.3048); clone.updateMatrixWorld(true);   // feet -> metres
      new window.THREE.GLTFExporter().parse(clone, function(glb){
        try{
          var bytes = new Uint8Array(glb), CH = 0x8000, bin = '';
          for(var i=0;i<bytes.length;i+=CH){ bin += String.fromCharCode.apply(null, bytes.subarray(i, i+CH)); }
          onOk(btoa(bin));
        }catch(e){ onErr(''+e); }
      }, {binary:true, onlyVisible:true});
    }catch(e){ onErr(''+e); }
  };

  document.addEventListener('click', function(e){
    var f = e.target && e.target.closest ? e.target.closest('#arFab') : null;
    if(!f) return;
    e.preventDefault(); e.stopPropagation();
    try{ window.ReactNativeWebView.postMessage(JSON.stringify({type:'AR_PREPARING'})); }catch(_){}
    if(window.__armExportGLBBase64){
      window.__armExportGLBBase64(function(b64){
        window.ReactNativeWebView.postMessage(JSON.stringify({type:'AR_MODEL', data:b64}));
      }, function(err){
        window.ReactNativeWebView.postMessage(JSON.stringify({type:'AR_ERROR', error:''+err}));
      });
    } else {
      window.ReactNativeWebView.postMessage(JSON.stringify({type:'AR_ERROR', error:'Re-upload the designer to Netlify (AR export hook missing)'}));
    }
  }, true);
})();
true;
`;

// Armstrong wordmark — white, from the site's logo (viewBox 0 0 601.22 86.68).
function ArmstrongLogo(): React.JSX.Element {
  return (
    <Svg width={264} height={38} viewBox="0 0 601.22 86.68">
      <Path
        fill="#ffffff"
        d="M45.55.36l27.63,50.33h-17.91L27.65.36h17.89ZM586.25,51.05h-32.78c-5.78,0-9.71-.88-11.81-2.63-2.09-1.76-3.14-5.23-3.14-10.43V13.43c0-5.2,1.05-8.68,3.14-10.43,2.09-1.76,6.03-2.64,11.81-2.64h45.78v11.99h-42.1c-.92,0-1.37.41-1.37,1.23v23.76c0,.48.1.81.29.97.19.17.55.25,1.08.25h26c.58,0,.96-.08,1.16-.25.19-.17.29-.49.29-.97v-5.99h-10.83v-11.27h27.37v17.91c0,5.2-1.04,8.68-3.11,10.43-2.07,1.76-5.99,2.63-11.77,2.63ZM533.42,50.69h-13.14l-19.44-16.9-15.14-13.15h-.23c.34,4.96.5,10.25.5,15.9v14.15h-16.61V.36h13.47l21.64,18.81c1.06.84,5.37,4.58,12.91,11.22h.07c-.43-9.05-.65-14.37-.65-15.95V.36h16.61v50.33ZM446.67,36.83V13.65c0-.43-.1-.73-.29-.9-.19-.17-.55-.25-1.08-.25h-27.66c-.58,0-.98.08-1.19.25-.22.17-.33.47-.33.9v23.18c0,.48.1.81.29.97.19.17.6.25,1.23.25h27.66c.53,0,.89-.08,1.08-.25.19-.17.29-.49.29-.97ZM449.12,51.05h-35.38c-5.78,0-9.7-.88-11.77-2.63-2.07-1.76-3.1-5.23-3.1-10.43V13.07c0-5.2,1.04-8.68,3.1-10.43,2.07-1.76,5.99-2.64,11.77-2.64h35.38c5.78,0,9.69.88,11.73,2.64,2.05,1.76,3.07,5.23,3.07,10.43v24.91c0,5.2-1.02,8.68-3.07,10.43-2.05,1.76-5.96,2.63-11.73,2.63ZM377.71,20.65v-7c0-.53-.08-.88-.25-1.05-.17-.17-.52-.25-1.05-.25h-22.6v9.6h22.6c.53,0,.88-.08,1.05-.25.17-.17.25-.52.25-1.05ZM397.64,50.69h-20.22l-13.58-16.68h-10.04v16.68h-16.97V.36h42.75c5.68,0,9.54.78,11.59,2.35,2.04,1.56,3.07,4.54,3.07,8.92v11.41c0,4.14-.93,6.94-2.78,8.41-1.85,1.47-4.66,2.32-8.41,2.56l14.58,16.68ZM312.18,50.69h-17.26V12.35h-20.58V.36h58.42v11.99h-20.56v.5h-.01v37.84ZM257.72,50.69h-43.25v-12.49h39.64c.53,0,.89-.08,1.08-.25.19-.17.29-.49.29-.97v-4.98c0-.43-.1-.73-.29-.9-.19-.17-.55-.25-1.08-.25h-24.7c-5.97,0-9.95-.81-11.95-2.42s-3-4.8-3-9.57v-6.64c0-4.67,1.05-7.81,3.14-9.42,2.09-1.61,6.03-2.42,11.81-2.42h40.94v11.99h-37.55c-.53,0-.89.1-1.08.29-.19.19-.29.53-.29,1.01v4.26c0,.48.1.81.29.97.19.17.55.25,1.08.25h24.91c5.87,0,9.84.78,11.91,2.35,2.07,1.57,3.11,4.71,3.11,9.42v7.58c0,5.06-1.02,8.35-3.07,9.89-2.05,1.54-6.03,2.31-11.95,2.31ZM209.87,50.69h-16.61c0-10.38.02-20,.02-30.39l-17.64,25.04h-3.03l-17.53-25.04c0,10.35.05,20.04.05,30.39h-16.61V.36h18.85l9.89,14.88,7.08,10.76c1.68-2.84,4.02-6.43,7-10.76L191.31.36h18.56v50.33ZM116.31,20.65v-7c0-.53-.08-.88-.25-1.05-.17-.17-.52-.25-1.05-.25h-22.6v9.6h22.6c.53,0,.88-.08,1.05-.25s.25-.52.25-1.05ZM136.24,50.69h-20.22l-13.58-16.68h-10.04v16.68h-16.97V.36h42.75c5.68,0,9.54.78,11.59,2.35,2.05,1.56,3.07,4.54,3.07,8.92v11.41c0,4.14-.93,6.94-2.78,8.41-1.85,1.47-4.66,2.32-8.41,2.56l14.59,16.68ZM.03,50.69h38.33s6.35-11.57,6.35-11.57h-20.43l9.17-16.71H15.52L0,50.69h.03Z"
      />
      <Path
        fill="#ffffff"
        d="M472.57,71.9l-2.15,3.14c-.07-.03-.16-.06-.28-.11s-.37-.12-.76-.24c-.39-.12-.79-.22-1.2-.3-.41-.09-.93-.17-1.56-.24-.62-.07-1.24-.11-1.86-.11-1.1,0-1.92.08-2.47.26-.56.17-.83.45-.83.85s.26.69.77.87c.51.17,1.49.34,2.93.5,2.99.33,5.09.87,6.31,1.62,1.22.75,1.83,1.89,1.83,3.43,0,.91-.21,1.7-.65,2.37-.44.67-1.05,1.2-1.85,1.59-.8.4-1.73.69-2.79.87-1.06.19-2.25.28-3.59.28-1.06,0-2.06-.06-3.01-.19-.95-.12-1.72-.27-2.32-.46-.59-.18-1.11-.36-1.56-.54-.44-.18-.76-.33-.95-.45l-.28-.19,2.15-3.15c.06.03.16.07.27.12.11.05.37.14.76.27.39.13.79.25,1.21.35.42.1.95.19,1.59.28.64.08,1.28.12,1.92.12,1.51,0,2.62-.09,3.35-.28.72-.19,1.09-.52,1.09-1,0-.37-.26-.63-.78-.78-.52-.15-1.73-.33-3.61-.54-1.18-.12-2.21-.3-3.09-.54-.88-.24-1.59-.5-2.14-.81-.55-.3-1-.65-1.33-1.06-.33-.41-.57-.82-.69-1.25-.13-.43-.19-.91-.19-1.44,0-.71.14-1.35.43-1.93.29-.58.73-1.1,1.33-1.56.59-.46,1.4-.81,2.42-1.07,1.01-.26,2.2-.39,3.56-.39,1.01,0,1.97.06,2.89.17.92.12,1.68.26,2.27.42.59.17,1.12.33,1.57.49.45.16.78.3.98.42l.3.17ZM433.7,76.81c-.19.49-.29,1.04-.29,1.63s.1,1.14.29,1.63c.19.49.51.95.95,1.39.44.43,1.07.77,1.89,1.02.82.25,1.8.37,2.95.37,1.7,0,2.86-.16,3.48-.47v-2.21h-3.92v-3.41h8.11v7.75c-1.67,1.45-4.23,2.17-7.68,2.17-1.79,0-3.38-.21-4.77-.64-1.39-.43-2.51-1.02-3.36-1.77-.86-.75-1.5-1.62-1.94-2.61-.43-.98-.65-2.05-.65-3.22s.22-2.23.65-3.21c.43-.98,1.08-1.85,1.94-2.61.85-.75,1.98-1.34,3.36-1.78,1.39-.43,2.98-.64,4.77-.64,1.01,0,1.96.06,2.86.19.89.13,1.62.29,2.18.48.55.19,1.04.38,1.45.56.41.19.7.34.88.47l.25.19-2.14,3.12c-.06-.03-.14-.07-.25-.13-.11-.05-.34-.15-.71-.29-.36-.14-.74-.26-1.14-.36-.4-.11-.9-.2-1.51-.29-.61-.09-1.23-.13-1.86-.13-1.15,0-2.13.12-2.95.37-.82.25-1.46.59-1.89,1.02-.44.43-.75.9-.95,1.39ZM401.42,86.25v-15.6h5.38l7.78,9.65v-9.65h4.6v15.6h-5.38l-7.78-9.65v9.65h-4.6ZM386.69,86.25v-15.6h4.6v15.6h-4.6ZM363.27,74.47v7.94h5.56c1.22,0,2.11-.33,2.69-.98.57-.66.86-1.65.86-2.99s-.29-2.33-.86-2.99c-.58-.66-1.47-.98-2.69-.98h-5.56ZM377,78.44c0,.91-.09,1.74-.27,2.5-.18.76-.47,1.47-.88,2.14-.41.66-.93,1.22-1.54,1.69-.62.46-1.39.82-2.32,1.08-.93.26-1.98.39-3.16.39h-10.16v-15.6h10.16c1.17,0,2.23.13,3.16.39.93.26,1.7.62,2.32,1.09.62.46,1.14,1.03,1.54,1.69.41.66.7,1.37.88,2.14.18.76.27,1.6.27,2.5ZM338.24,70.65v11.77h10.85v3.83h-15.45v-15.6h4.6ZM318.91,86.25v-15.6h4.6v15.6h-4.6ZM297.86,82.6c.55.17,1.23.26,2.04.26s1.49-.08,2.05-.26c.56-.17,1.01-.42,1.33-.76.32-.34.56-.73.7-1.18.14-.45.21-.98.21-1.6v-8.41h4.6v8.41c0,1.23-.17,2.32-.5,3.25-.33.93-.85,1.72-1.56,2.38-.71.66-1.63,1.16-2.77,1.5-1.14.34-2.49.5-4.06.5-3.04,0-5.26-.65-6.67-1.94-1.41-1.29-2.11-3.19-2.11-5.69v-8.41h4.6v8.41c0,.62.06,1.15.2,1.6.13.45.35.84.66,1.18.31.34.74.59,1.29.76ZM268.85,76.74h6.18c.54,0,.94-.12,1.18-.35.25-.23.37-.53.37-.89s-.12-.65-.37-.88c-.24-.24-.64-.36-1.18-.36h-6.18v2.48ZM268.85,82.64h6.34c1.26,0,1.88-.44,1.88-1.31s-.63-1.32-1.88-1.32h-6.34v2.63ZM275.19,86.25h-10.94v-15.6h10.78c.97,0,1.81.09,2.54.28.73.18,1.31.42,1.74.7.42.29.77.63,1.03,1.04.26.41.44.8.53,1.17.09.38.13.78.13,1.22,0,.73-.21,1.36-.64,1.89-.43.54-1.02.92-1.78,1.14.54.12,1.01.3,1.4.55.39.24.7.53.92.86.22.33.38.68.49,1.03.1.36.15.75.15,1.16,0,.45-.06.88-.17,1.29-.11.41-.32.82-.62,1.22-.3.41-.68.76-1.14,1.05-.46.29-1.07.53-1.82.72-.75.19-1.62.28-2.59.28ZM237.58,70.65v11.77h10.85v3.83h-15.45v-15.6h4.6ZM211.46,76.49h11.08v3.73h-11.08v2.2h11.72v3.83h-16.32v-15.6h16.21v3.83h-11.61v2.01ZM185.34,76.49h11.08v3.73h-11.08v2.2h11.72v3.83h-16.32v-15.6h16.21v3.83h-11.61v2.01ZM153.52,70.65h17.85v3.83h-6.62v11.77h-4.6v-11.77h-6.63v-3.83ZM144.08,71.9l-2.15,3.14c-.07-.03-.16-.06-.28-.11-.12-.04-.37-.12-.76-.24-.39-.12-.79-.22-1.2-.3-.41-.09-.93-.17-1.56-.24-.62-.07-1.24-.11-1.86-.11-1.1,0-1.92.08-2.47.26-.56.17-.83.45-.83.85s.26.69.77.87c.51.17,1.49.34,2.93.5,2.99.33,5.09.87,6.31,1.62,1.22.75,1.84,1.89,1.84,3.43,0,.91-.22,1.7-.65,2.37-.43.67-1.05,1.2-1.85,1.59-.8.4-1.73.69-2.79.87-1.06.19-2.25.28-3.59.28-1.06,0-2.06-.06-3.01-.19-.95-.12-1.72-.27-2.32-.46-.59-.18-1.11-.36-1.56-.54-.44-.18-.76-.33-.95-.45l-.28-.19,2.15-3.15c.06.03.16.07.27.12.12.05.37.14.76.27.39.13.79.25,1.21.35.42.1.95.19,1.59.28.64.08,1.28.12,1.92.12,1.51,0,2.63-.09,3.35-.28.72-.19,1.09-.52,1.09-1,0-.37-.26-.63-.78-.78-.52-.15-1.73-.33-3.61-.54-1.18-.12-2.21-.3-3.09-.54-.88-.24-1.59-.5-2.14-.81-.55-.3-1-.65-1.33-1.06-.33-.41-.57-.82-.69-1.25-.13-.43-.19-.91-.19-1.44,0-.71.14-1.35.43-1.93.29-.58.73-1.1,1.33-1.56.59-.46,1.4-.81,2.42-1.07,1.01-.26,2.2-.39,3.56-.39,1.01,0,1.97.06,2.89.17.92.12,1.68.26,2.27.42.59.17,1.12.33,1.58.49.45.16.78.3.98.42l.3.17Z"
      />
      <Rect fill="#ffffff" x={-0.18} y={76.58} width={114.06} height={3.73} />
      <Rect fill="#ffffff" x={487.25} y={76.58} width={114.06} height={3.73} />
    </Svg>
  );
}

export default function App(): React.JSX.Element {
  const webRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [canGoBack, setCanGoBack] = useState(false);
  const [arBusy, setArBusy] = useState(false);
  const [arModelUri, setArModelUri] = useState<string | null>(null);
  const [arKb, setArKb] = useState(0);
  const [mode, setMode] = useState<'web' | 'ar'>('web');
  const [webUri, setWebUri] = useState<string | null>(null);

  React.useEffect(() => {
    (async () => {
      try {
        const a = Asset.fromModule(DESIGNER_HTML);
        await a.downloadAsync();
        setWebUri(a.localUri || a.uri);
      } catch {
        Alert.alert('Designer', 'Could not load the designer.');
      }
    })();
  }, []);

  React.useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (mode === 'ar') {
        setMode('web');
        return true;
      }
      if (canGoBack && webRef.current) {
        webRef.current.goBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [canGoBack, mode]);

  const onLoadEnd = useCallback(() => setLoading(false), []);

  const onShouldStart = useCallback((req: {url: string}): boolean => {
    const url = req.url || '';
    if (/^(https?|about|data|blob|file):/i.test(url)) return true;
    Linking.openURL(url).catch(() => {});
    return false;
  }, []);

  const saveAndOpenAR = useCallback(async (b64: string) => {
    try {
      const path = FileSystem.cacheDirectory + 'armstrong-building.glb';
      await FileSystem.writeAsStringAsync(path, b64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      setArKb(Math.round((b64.length * 3) / 4 / 1024));
      setArModelUri(path);
      setMode('ar');
    } catch (e) {
      Alert.alert('AR', 'Could not prepare the 3D model.');
    } finally {
      setArBusy(false);
    }
  }, []);

  const onMessage = useCallback(
    (e: WebViewMessageEvent) => {
      let msg: any;
      try {
        msg = JSON.parse(e.nativeEvent.data);
      } catch {
        return;
      }
      if (!msg || !msg.type) return;
      if (msg.type === 'AR_PREPARING') setArBusy(true);
      else if (msg.type === 'AR_MODEL') saveAndOpenAR(msg.data);
      else if (msg.type === 'AR_ERROR') {
        setArBusy(false);
        Alert.alert('AR', msg.error || 'Could not prepare AR.');
      }
    },
    [saveAndOpenAR],
  );

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor={NAVY} />
        {webUri && (
          <WebView
            ref={webRef}
            source={{uri: webUri}}
            onLoadEnd={onLoadEnd}
            onNavigationStateChange={s => setCanGoBack(s.canGoBack)}
            onShouldStartLoadWithRequest={onShouldStart}
            onMessage={onMessage}
            injectedJavaScript={INJECT}
            javaScriptEnabled
            domStorageEnabled
            allowFileAccess
            allowFileAccessFromFileURLs
            allowUniversalAccessFromFileURLs
            androidLayerType="hardware"
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            originWhitelist={['*']}
            setSupportMultipleWindows={false}
            style={styles.web}
          />
        )}

        {(loading || !webUri) && (
          <View style={styles.loader} pointerEvents="none">
            <ArmstrongLogo />
            <ActivityIndicator style={styles.spin} size="large" color={GOLD} />
            <Text style={styles.loaderText}>Loading your designer…</Text>
          </View>
        )}

        {arBusy && (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color={GOLD} />
            <Text style={styles.loaderText}>Preparing AR…</Text>
          </View>
        )}
      </SafeAreaView>

      {mode === 'ar' && arModelUri && (
        <View style={StyleSheet.absoluteFill}>
          <ArScreen modelUri={arModelUri} modelKb={arKb} onExit={() => setMode('web')} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: NAVY},
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
  spin: {marginTop: 30},
  loaderText: {marginTop: 16, color: '#c7cfe4', fontSize: 15, fontWeight: '600'},
});
