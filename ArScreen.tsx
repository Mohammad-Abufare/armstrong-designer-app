/**
 * Native AR screen (ARCore / ARKit) via @reactvision/react-viro.
 *
 * DIAGNOSTIC build: the model is placed at a fixed spot in front of the camera (no tap-to-place)
 * and an on-screen panel reports the GLB size + load state (loading / loaded / error), so we can
 * see exactly what Viro does with the exported building. Pinch = resize, twist = rotate, drag = move.
 */
import React, {useRef, useState} from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {
  Viro3DObject,
  ViroAmbientLight,
  ViroARScene,
  ViroARSceneNavigator,
  ViroDirectionalLight,
  ViroNode,
} from '@reactvision/react-viro';

const START = 0.15; // initial scale of the real-size (metre) model so the whole building is visible

function ARScene(props: any): React.JSX.Element {
  const appProps = props?.sceneNavigator?.viroAppProps || {};
  const modelUri: string | undefined = appProps.modelUri;
  const onStatus: ((s: string) => void) | undefined = appProps.onStatus;

  const [scale, setScale] = useState<[number, number, number]>([START, START, START]);
  const [rotY, setRotY] = useState(0);
  const baseScale = useRef(START);
  const baseRot = useRef(0);

  const onPinch = (state: number, factor: number) => {
    const s = baseScale.current * factor;
    if (state === 3) {
      baseScale.current = s;
      return;
    }
    setScale([s, s, s]);
  };
  const onRotate = (state: number, factor: number) => {
    const r = baseRot.current + factor;
    if (state === 3) {
      baseRot.current = r;
      return;
    }
    setRotY(r);
  };

  return (
    <ViroARScene>
      <ViroAmbientLight color="#ffffff" intensity={700} />
      <ViroDirectionalLight color="#ffffff" direction={[0, -1, -0.4]} intensity={1000} />
      <ViroDirectionalLight color="#ffffff" direction={[0.4, -0.6, 0.6]} intensity={600} />
      {/* fixed placement ~3 m ahead and a bit below eye level — no plane tap needed */}
      <ViroNode position={[0, -1, -3]}>
        {modelUri ? (
          <Viro3DObject
            source={{uri: modelUri}}
            type="GLB"
            scale={scale}
            rotation={[0, rotY, 0]}
            dragType="FixedToWorld"
            onDrag={() => {}}
            onPinch={onPinch}
            onRotate={onRotate}
            onLoadStart={() => onStatus && onStatus('loading model…')}
            onLoadEnd={() => onStatus && onStatus('loaded ✓ (if blank, it may be off-screen — pinch/rotate)')}
            onError={(e: any) =>
              onStatus &&
              onStatus('ERROR: ' + (e?.nativeEvent?.error || 'model failed to load'))
            }
          />
        ) : null}
      </ViroNode>
    </ViroARScene>
  );
}

export default function ArScreen({
  modelUri,
  modelKb,
  onExit,
}: {
  modelUri: string;
  modelKb: number;
  onExit: () => void;
}): React.JSX.Element {
  const [status, setStatus] = useState('starting…');
  const tail = modelUri ? modelUri.slice(-34) : '(none)';

  return (
    <View style={styles.fill}>
      <ViroARSceneNavigator
        autofocus
        initialScene={{scene: ARScene as any}}
        viroAppProps={{modelUri, onStatus: setStatus}}
        style={styles.fill}
      />
      <SafeAreaView style={styles.overlay} pointerEvents="box-none" edges={['top']}>
        <View style={styles.bar} pointerEvents="box-none">
          <View style={styles.hint}>
            <Text style={styles.hintText}>pinch = resize · twist = rotate · drag = move</Text>
          </View>
          <TouchableOpacity style={styles.exit} onPress={onExit} activeOpacity={0.85}>
            <Text style={styles.exitText}>✕</Text>
          </TouchableOpacity>
        </View>
        {/* diagnostic panel — tells us what Viro actually did with the model */}
        <View style={styles.diag} pointerEvents="none">
          <Text style={styles.diagText}>model: {modelKb} KB · …{tail}</Text>
          <Text style={styles.diagText}>status: {status}</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {flex: 1, backgroundColor: '#000'},
  overlay: {position: 'absolute', top: 0, left: 0, right: 0},
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: 14,
    gap: 12,
  },
  hint: {
    flex: 1,
    backgroundColor: 'rgba(12,19,38,0.62)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  hintText: {color: '#fff', fontSize: 13, fontWeight: '600', lineHeight: 18},
  exit: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(12,19,38,0.62)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exitText: {color: '#fff', fontSize: 22, lineHeight: 24},
  diag: {
    marginTop: 8,
    marginHorizontal: 14,
    backgroundColor: 'rgba(12,19,38,0.7)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  diagText: {color: '#ffd479', fontSize: 12, fontWeight: '600'},
});
