/**
 * Light background — same dot-grid feel as the login screen, used by
 * every authenticated screen so the app reads as one continuous space.
 */
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Defs, Pattern, Rect } from "react-native-svg";

export function LightBackground() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: "#fafafa" }]} />
      <Svg width="100%" height="100%" opacity={0.5}>
        <Defs>
          <Pattern id="lightdots" x="0" y="0" width="28" height="28" patternUnits="userSpaceOnUse">
            <Circle cx="2" cy="2" r="1" fill="rgba(113, 113, 122, 0.22)" />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#lightdots)" />
      </Svg>
    </View>
  );
}
