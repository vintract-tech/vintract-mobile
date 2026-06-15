/**
 * The Vintract brand mark — the finalised tri-colour V (white/pink/orange
 * on a deep-purple rounded square), matching the app icon, vintract.com
 * and the web app. Rendered from the bundled PNG (transparent corners,
 * so it sits cleanly on any background).
 */
import { Image } from "react-native";

export function BrandMark({ size = 36 }: { size?: number }) {
  return (
    <Image
      source={require("../assets/brandmark.png")}
      style={{ width: size, height: size }}
      resizeMode="contain"
      accessibilityLabel="Vintract"
    />
  );
}
