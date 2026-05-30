/**
 * Top app bar — used on every authenticated screen. Brand left, optional
 * right-hand slot (e.g. profile button, help). Sits ON TOP of the
 * AuroraBackground so the gradient shows through.
 */
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BrandMark } from "./BrandMark";

export function TopBar({
  right,
}: {
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.bar}>
      <View style={styles.brandRow}>
        <BrandMark size={28} />
        <Text style={styles.brand}>VINTRACT</Text>
      </View>
      <View style={styles.rightSlot}>{right}</View>
    </View>
  );
}

export function CircleIconButton({
  onPress,
  label,
  children,
}: {
  onPress: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityLabel={label}
      style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  brandRow: { flexDirection: "row", alignItems: "center" },
  brand: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "900",
    marginLeft: 10,
    letterSpacing: 2.5,
  },
  rightSlot: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "rgba(255,255,255,0.04)",
    alignItems: "center",
    justifyContent: "center",
  },
});
