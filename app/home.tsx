/**
 * Home / dashboard — LIGHT theme.
 *
 * Top bar: kebab (left) opens the side menu, brand (centre), profile
 * avatar (right). Greeting, workspace pill, primary "Scan SKU" tile,
 * then a grid of upcoming features (SOON badges).
 */
import { useEffect, useState } from "react";
import {
  Linking,
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
import {
  getInventorySummary, getInventoryStats,
  type InventorySummary, type InventoryStats,
} from "../lib/api";

export default function HomeScreen() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ws, setWs] = useState<Workspace | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [stats, setStats] = useState<InventoryStats | null>(null);

  useEffect(() => {
    (async () => {
      const [w, s] = await Promise.all([loadWorkspace(), loadSession()]);
      setWs(w);
      setUser(s?.user ?? null);
    })();
    // Inventory dashboard figures (same source as the web dashboard).
    getInventorySummary().then(setSummary).catch(() => {});
    getInventoryStats().then(setStats).catch(() => {});
  }, []);

  const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
  // Open the matching page in the full web app (mobile is summary-only).
  const openWeb = (path: string) => {
    if (ws?.web_base) void Linking.openURL(`${ws.web_base}${path}`);
  };

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

          {/* Inventory at a glance — same figures as the web dashboard */}
          <Text style={styles.sectionLabel}>Inventory at a glance</Text>
          <View style={styles.statGrid}>
            <StatCard label="SKUs" value={stats ? String(stats.total_items) : (summary ? String(summary.sku_count) : "—")} onPress={() => openWeb("/dashboard")} />
            <StatCard label="Stock value" value={summary ? inr(summary.inventory_value) : "—"} onPress={() => openWeb("/dashboard")} />
            <StatCard label="Low stock" value={stats ? String(stats.low_stock) : "—"} accent="#b45309" tint="#fffbeb" border="#fde68a" onPress={() => openWeb("/dashboard")} />
            <StatCard label="Out of stock" value={stats ? String(stats.out_of_stock) : "—"} accent="#b91c1c" tint="#fef2f2" border="#fecaca" onPress={() => openWeb("/dashboard")} />
            <StatCard label="Active vendors" value={summary ? String(summary.vendor_count_active) : "—"} onPress={() => openWeb("/dashboard")} />
            <StatCard label="Waste (MTD)" value={summary ? inr(summary.waste_cost_mtd) : "—"} onPress={() => openWeb("/dashboard")} />
          </View>

          <Text style={styles.sectionLabel}>Quick actions</Text>

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
            </View>
            <ArrowIcon />
          </Pressable>

          <Text style={styles.sectionLabel}>Floor actions</Text>

          <View style={styles.grid}>
            <ActionTile title="Receive inward" onPress={() => router.push("/receive")} />
            <ActionTile title="Move to floor" onPress={() => router.push("/move")} />
            <ActionTile title="Production orders" onPress={() => router.push("/production" as any)} />
            <ActionTile title="Waste log" onPress={() => router.push("/waste")} />
          </View>
        </ScrollView>
      </SafeAreaView>

      <SideMenu visible={menuOpen} onClose={() => setMenuOpen(false)} />
    </View>
  );
}

function StatCard({
  label, value, accent = "#0f766e", tint = "#ffffff", border = "#e4e4e7", onPress,
}: {
  label: string; value: string; accent?: string; tint?: string; border?: string; onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.statCard, { backgroundColor: tint, borderColor: border }, pressed && onPress ? { opacity: 0.9 } : null]}
    >
      <View style={styles.statTopRow}>
        <Text style={styles.statLabel}>{label}</Text>
        {onPress && <Text style={styles.statArrow}>↗</Text>}
      </View>
      <Text style={[styles.statValue, { color: accent }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    </Pressable>
  );
}

function ActionTile({
  title,
  onPress,
}: {
  title: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.tile, pressed && { opacity: 0.92 }]}
    >
      <Text style={styles.tileTitle}>{title}</Text>
    </Pressable>
  );
}

// ---------- icons ---------- //
function KebabIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M4 6h16M4 12h16M4 18h16" stroke="#18181b" strokeWidth={2.2} strokeLinecap="round" />
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
  root: { flex: 1, backgroundColor: "#fafafa" },
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
    color: "#18181b",
    fontSize: 14,
    fontWeight: "900",
    marginLeft: 8,
    letterSpacing: 2.2,
  },
  avatarBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#4f46e5",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#4f46e5",
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
    color: "#18181b",
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
    backgroundColor: "#eef2ff",
    borderWidth: 1,
    borderColor: "#c7d2fe",
    alignSelf: "flex-start",
  },
  wsDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#10b981", marginRight: 8 },
  wsPillText: { color: "#3730a3", fontSize: 12, fontWeight: "700" },

  heroTile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 18,
    borderRadius: 18,
    backgroundColor: "#4f46e5",
    borderWidth: 1,
    borderColor: "#4338ca",
    shadowColor: "#4f46e5",
    shadowOpacity: 0.25,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
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

  sectionLabel: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.4,
    marginBottom: 10,
  },

  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 26 },
  statCard: {
    width: "47.5%",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: "#fff",
    borderColor: "#e4e4e7",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  statTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  statValue: { fontSize: 22, fontWeight: "900", color: "#0f766e", letterSpacing: -0.5, marginTop: 4 },
  statLabel: { fontSize: 12, fontWeight: "600", color: "#64748b" },
  statArrow: { fontSize: 13, color: "#94a3b8", fontWeight: "700" },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  tile: {
    width: "47.5%",
    minHeight: 72,
    padding: 14,
    borderRadius: 14,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e4e4e7",
    overflow: "hidden",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  tileTitle: { color: "#18181b", fontSize: 14, fontWeight: "700" },
});
