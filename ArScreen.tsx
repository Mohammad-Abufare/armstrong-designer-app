/**
 * Native AR screen (ARCore / ARKit) via @reactvision/react-viro.
 * Loads the building GLB (exported by the designer, piped from the WebView) and places it on a
 * tapped floor plane. Pinch = resize, twist = rotate, drag = move. Exit returns to the designer.
 *
 * The GLB is exported at real-world size (metres). We start it small (~1/10) so the whole building
 * is visible when testing indoors; pinch out to reach full size on a real lot.
 */
import React, {useRef, useState} from 'react';
import {Alert, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {
  Viro3DObject,
  ViroAmbientLight,
  ViroARPlaneSelector,
  ViroARScene,
  ViroARSceneNavigator,
  ViroDirectionalLight,
} from '@reactvision/react-viro';

const START = 0.1; // initial scale of the real-size model so the whole building is visible

function ARScene(props: any): React.JSX.Element {
  const appProps = props?.sceneNavigator?.viroAppProps || {};
  const modelUri: string | undefined = appProps.modelUri;
  const onErr: ((m: string) => void) | undefined = appProps.onErr;

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
      <ViroAmbientLight color="#ffffff" intensity={600} />
      <ViroDirectionalLight color="#ffffff" direction={[0, -1, -0.4]} intensity={1000} />
      <ViroDirectionalLight color="#ffffff" direction={[0.4, -0.6, 0.6]} intensity={500} />
      <ViroARPlaneSelector>
        {modelUri ? (
          <Viro3DObject
            source={{uri: modelUri}}
            type="GLB"
            position={[0, 0, 0]}
            scale={scale}
            rotation={[0, rotY, 0]}
            dragType="FixedToWorld"
            onDrag={() => {}}
            onPinch={onPinch}
            onRotate={onRotate}
            onError={() => onErr && onErr('The building model failed to load.')}
          />
        ) : null}
      </ViroARPlaneSelector>
    </ViroARScene>
  );
}

export default function ArScreen({
  modelUri,
  onExit,
}: {
  modelUri: string;
  onExit: () => void;
}): React.JSX.Element {
  return (
    <View style={styles.fill}>
      <ViroARSceneNavigator
        autofocus
        initialScene={{scene: ARScene as any}}
        viroAppProps={{
          modelUri,
          onErr: (m: string) => Alert.alert('AR', m),
        }}
        style={styles.fill}
      />
      <SafeAreaView style={styles.overlay} pointerEvents="box-none" edges={['top']}>
        <View style={styles.bar} pointerEvents="box-none">
          <View style={styles.hint}>
            <Text style={styles.hintText}>
              Point at the floor and tap to place · pinch out to enlarge · twist to rotate · drag to move
            </Text>
          </View>
          <TouchableOpacity style={styles.exit} onPress={onExit} activeOpacity={0.85}>
            <Text style={styles.exitText}>✕</Text>
          </TouchableOpacity>
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
});
