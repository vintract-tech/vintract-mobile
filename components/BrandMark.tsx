/**
 * The Vintract brand mark — same SVG shape as the marketing site
 * (vintract.com favicon). Purple→green gradient tile with the
 * activity-line glyph in white.
 */
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";

export function BrandMark({ size = 36 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Defs>
        <LinearGradient id="brand-grad" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#8b5cf6" />
          <Stop offset="100%" stopColor="#10b981" />
        </LinearGradient>
      </Defs>
      <Rect width="32" height="32" rx="7" fill="url(#brand-grad)" />
      <Path
        d="M5 17 H10 L13 7 L17 24 L20 14 H27"
        stroke="white"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}
