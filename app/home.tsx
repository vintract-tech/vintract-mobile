/**
 * Home / dashboard — LIGHT theme.
 *
 * Top bar: kebab (left) opens the side menu, brand (centre), profile
 * avatar (right). Greeting, workspace pill, primary "Scan SKU" tile,
 * then a grid of upcoming features (SOON badges).
 */
import { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { BrandMark } from "../components/BrandMark";
import { LightBackground } from "../components/LightBackground";
import { SideMenu } from "../components/SideMenu";
import { loadSession, type AuthUser } from "../lib/auth";
import { loadWorkspace, type Workspace } from "../lib/workspace";

export default function HomeScreen() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ws, setWs] = useState<Workspace | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const [w, s] = await Promise.all([loadWorkspace(), loadSession()]);
      setWs(w);
      setUser(s?.user ?? null);
    })();
  }, []);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  const firstName = (user?.name || user?.email || "").split(/[@.\s]/)[0];
  const initial = (user?.name || user?.email || "?")[0]?.toUpperCase();

  return (
    <View style={styles.root}>
      <LightBackground />
      <SafeAreaView style={styles.safe}>
        {/* Top bar — kebab + brand + avatar */}
        <View style={styles.topBar}>
          <Pressable
            onPress={() => setMenuOpen(true)}
            hitSlop={12}
            style={styles.iconBtn}
            accessibilityLabel="Menu"
          >
            <KebabIcon />
          </Pressable>

          <View style={styles.brandRow}>
            <BrandMark size={26} />
            <Text style={styles.brand}>VINTRACT</Text>
          </View>

          <Pressable
            onPress={() => setMenuOpen(true)}
            hitSlop={12}
            style={styles.avatarBtn}
            accessibilityLabel="Profile"
          >
            <Text style={styles.avatarInitial}>{initial}</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Greeting */}
          <View style={styles.greetWrap}>
            <Text style={styles.greet}>{greeting},</Text>
            <Text style={styles.name}>{firstName || "operator"}.</Text>
            {ws && (
              <View style={styles.wsPill}>
                <View style={styles.wsDot} />
                <Text style={styles.wsPillText}>{ws.name}</Text>
              </View>
            )}
          </View>

          {/* Primary tile — Scan SKU */}
          <Pressable
            onPress={() => router.push("/scan")}
            style={({ pressed }) => [styles.heroTile, pressed && { opacity: 0.94 }]}
          >
            <View style={styles.heroIconWrap}>
              <ScanIcon />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroTitle}>Scan SKU</Text>
              <Text style={styles.heroSub}>
                Point at any item barcode or QR — see stock, vendor and alerts.
              </Text>
            </View>
            <ArrowIcon />
          </Pressable>

          <Text style={styles.sectionLabel}>Floor actions</Text>

          <View style={styles.grid}>
            <ActionTile title="Receive inward" sub="Scan + qty → ledger." accent="#10b981" onPress={() => router.push("/receive")} />
            <ActionTile title="Move to floor" sub="Issue stock to production." accent="#f59e0b" onPress={() => router.push("/move")} />
            <ActionTile title="Production orders" sub="View & mark complete." accent="#7c3aed" onPress={() => router.push("/production" as any)} />
            <ActionTile title="Waste log" sub="Scrap, QC reject, damage." accent="#dc2626" onPress={() => router.push("/waste")} />
          </View>

          <Text style={styles.footnote}>
            Tap the menu (top-left) for more — Categories, BOM, Vendors and Reports open in the web app.
          </Text>
        </ScrollView>
      </SafeAreaView>

      <SideMenu visible={menuOpen} onClose={() => setMenuOpen(false)} />
    </View>
  );
}

function ActionTile({
  title,
  sub,
  accent,
  onPress,
}: {
  title: string;
  sub: string;
  accent: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.tile, pressed && { opacity: 0.92 }]}
    >
      <View style={[styles.tileBar, { backgroundColor: accent }]} />
      <Text style={styles.tileTitle}>{title}</Text>
      <Text style={styles.tileSub}>{sub}</Text>
    </Pressable>
  );
}

// ---------- icons ---------- //
function KebabIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M4 6h16M4 12h16M4 18h16" stroke="#1f1235" strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}

function ScanIcon() {
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
      <Path d="M3 7V5a2 2 0 0 1 2-2h2" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" />
      <Path d="M17 3h2a2 2 0 0 1 2 2v2" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" />
      <Path d="M21 17v2a2 2 0 0 1-2 2h-2" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" />
      <Path d="M7 21H5a2 2 0 0 1-2-2v-2" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" />
      <Path d="M3 12h18" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}

function ArrowIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M5 12h14M13 5l7 7-7 7" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f6f5fb" },
  safe: { flex: 1 },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  brandRow: { flexDirection: "row", alignItems: "center" },
  brand: {
    color: "#1f1235",
    fontSize: 14,
    fontWeight: "900",
    marginLeft: 8,
    letterSpacing: 2.2,
  },
  avatarBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#7c3aed",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#7c3aed",
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  avatarInitial: { color: "#fff", fontWeight: "800", fontSize: 14 },

  scroll: { paddingHorizontal: 18, paddingBottom: 40 },

  greetWrap: { marginTop: 14, marginBottom: 22 },
  greet: { color: "#64748b", fontSize: 15, fontWeight: "500" },
  name: {
    color: "#1f1235",
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: -1,
    textTransform: "capitalize",
  },
  wsPill: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "#f5f3ff",
    borderWidth: 1,
    borderColor: "#ddd6fe",
    alignSelf: "flex-start",
  },
  wsDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#10b981", marginRight: 8 },
  wsPillText: { color: "#5b21b6", fontSize: 12, fontWeight: "700" },

  heroTile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 18,
    borderRadius: 18,
    backgroundColor: "#7c3aed",
    borderWidth: 1,
    borderColor: "#6d28d9",
    shadowColor: "#7c3aed",
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
    marginBottom: 26,
  },
  heroIconWrap: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: { color: "#fff", fontSize: 18, fontWeight: "800" },
  heroSub: { color: "rgba(237, 233, 254, 0.95)", fontSize: 12, marginTop: 3, lineHeight: 16 },

  sectionLabel: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.4,
    marginBottom: 10,
  },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  tile: {
    width: "47.5%",
    minHeight: 100,
    padding: 14,
    borderRadius: 14,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  tileBar: {
    position: "absolute",
    left: 0, top: 0, bottom: 0,
    width: 4,
  },
  tileTitle: { color: "#1f1235", fontSize: 14, fontWeight: "800", marginTop: 2 },
  tileSub: { color: "#64748b", fontSize: 11, marginTop: 4, lineHeight: 14 },

  footnote: { color: "#94a3b8", fontSize: 11, textAlign: "center", marginTop: 24 },
});
