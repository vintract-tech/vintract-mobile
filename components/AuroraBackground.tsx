/**
 * Vintract aurora background — matches the marketing site mood (dark
 * ink with soft purple+green radial blobs + a faint dot grid). Used
 * as a fixed backdrop for full-screen views like Login. No animation
 * yet — kept static so it lays cheap and doesn't fight Reanimated.
 *
 * Implementation: a stack of LinearGradients (RN has no radial gradient
 * primitive, so we fake it with a soft-edged linear), with an SVG
 * dot-grid overlaid at low opacity.
 */
import { Dimensions, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Defs, Pattern, Rect } from "react-native-svg";

const { width, height } = Dimensions.get("window");
const SIZE = Math.max(width, height);

export function AuroraBackground() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {/* Base ink */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: "#070912" }]} />

      {/* Purple blob — top-left */}
      <LinearGradient
        colors={["rgba(139, 92, 246, 0.55)", "rgba(139, 92, 246, 0)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.blob,
          { top: -SIZE * 0.25, left: -SIZE * 0.25, width: SIZE * 0.9, height: SIZE * 0.9 },
        ]}
      />

      {/* Green blob — bottom-right */}
      <LinearGradient
        colors={["rgba(16, 185, 129, 0.35)", "rgba(16, 185, 129, 0)"]}
        start={{ x: 1, y: 1 }}
        end={{ x: 0, y: 0 }}
        style={[
          styles.blob,
          { bottom: -SIZE * 0.3, right: -SIZE * 0.3, width: SIZE * 0.95, height: SIZE * 0.95 },
        ]}
      />

      {/* Deeper accent — bottom-left */}
      <LinearGradient
        colors={["rgba(124, 58, 237, 0.30)", "rgba(124, 58, 237, 0)"]}
        start={{ x: 0, y: 1 }}
        end={{ x: 1, y: 0 }}
        style={[
          styles.blob,
          { bottom: -SIZE * 0.35, left: -SIZE * 0.2, width: SIZE * 0.7, height: SIZE * 0.7 },
        ]}
      />

      {/* Dot grid */}
      <Svg
        width="100%"
        height="100%"
        style={StyleSheet.absoluteFill}
        opacity={0.35}
      >
        <Defs>
          <Pattern id="dots" x="0" y="0" width="28" height="28" patternUnits="userSpaceOnUse">
            <Circle cx="2" cy="2" r="1" fill="rgba(167, 139, 250, 0.6)" />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#dots)" />
      </Svg>

      {/* Subtle top-fade to make brand readable */}
      <LinearGradient
        colors={["rgba(7,9,18,0.7)", "rgba(7,9,18,0)"]}
        style={[StyleSheet.absoluteFill, { height: 220 }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  blob: {
    position: "absolute",
    borderRadius: 9999,
    opacity: 0.9,
  },
});
