/**
 * Production orders list. Active orders (planned + in_progress) at the
 * top, then completed/cancelled below. Tap one → detail view where the
 * operator can mark start / completed.
 */
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { BrandMark } from "../../components/BrandMark";
import { LightBackground } from "../../components/LightBackground";
import { SideMenu } from "../../components/SideMenu";
import { getProductionOrders, type ProductionOrder } from "../../lib/api";

export default function ProductionListScreen() {
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const list = await getProductionOrders();
      setOrders(list);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const active = orders.filter((o) => o.status === "planned" || o.status === "in_progress");
  const done = orders.filter((o) => o.status === "completed" || o.status === "cancelled");

  return (
    <View style={styles.root}>
      <LightBackground />
      <SafeAreaView style={styles.safe}>
        <View style={styles.topBar}>
          <Pressable onPress={() => setMenuOpen(true)} hitSlop={12} style={styles.iconBtn}>
            <MenuIcon />
          </Pressable>
          <View style={styles.brandRow}>
            <BrandMark size={26} />
            <Text style={styles.brand}>VINTRACT</Text>
          </View>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.iconBtn}>
            <BackIcon />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor="#7c3aed" />}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.head}>
            <Text style={styles.eyebrow}>Operations</Text>
            <Text style={styles.title}>Production orders</Text>
            <Text style={styles.sub}>{active.length} active, {done.length} closed.</Text>
          </View>

          {err && (
            <View style={styles.errBox}>
              <Text style={styles.errText}>{err}</Text>
            </View>
          )}

          {loading && orders.length === 0 && (
            <View style={styles.center}>
              <ActivityIndicator color="#7c3aed" />
            </View>
          )}

          {!loading && active.length === 0 && done.length === 0 && !err && (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No orders yet</Text>
              <Text style={styles.emptyBody}>
                Production orders created on the web will show up here.
              </Text>
            </View>
          )}

          {active.length > 0 && (
            <>
              <Text style={styles.section}>Active</Text>
              {active.map((o) => <OrderCard key={o.id} o={o} />)}
            </>
          )}

          {done.length > 0 && (
            <>
              <Text style={styles.section}>Closed</Text>
              {done.map((o) => <OrderCard key={o.id} o={o} />)}
            </>
          )}
        </ScrollView>
      </SafeAreaView>

      <SideMenu visible={menuOpen} onClose={() => setMenuOpen(false)} />
    </View>
  );
}

function OrderCard({ o }: { o: ProductionOrder }) {
  const pct = o.qty_planned > 0 ? Math.min(100, (o.qty_produced / o.qty_planned) * 100) : 0;
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/production/[id]", params: { id: String(o.id) } })}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}
    >
      <View style={styles.cardHead}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardCode}>{o.code}</Text>
          <Text style={styles.cardName} numberOfLines={1}>{o.product_name}</Text>
        </View>
        <StatusPill status={o.status} />
      </View>
      <View style={styles.progressRow}>
        <Text style={styles.progressTxt}>
          {o.qty_produced} / {o.qty_planned}
        </Text>
        {o.target_completion && (
          <Text style={styles.dueTxt}>Due {formatDate(o.target_completion)}</Text>
        )}
      </View>
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${pct}%` }]} />
      </View>
    </Pressable>
  );
}

function StatusPill({ status }: { status: ProductionOrder["status"] }) {
  const map: Record<ProductionOrder["status"], { bg: string; fg: string; border: string; label: string }> = {
    planned:     { bg: "#eff6ff", fg: "#1d4ed8", border: "#bfdbfe", label: "Planned" },
    in_progress: { bg: "#fef3c7", fg: "#92400e", border: "#fcd34d", label: "Running" },
    completed:   { bg: "#ecfdf5", fg: "#065f46", border: "#a7f3d0", label: "Done" },
    cancelled:   { bg: "#f1f5f9", fg: "#475569", border: "#cbd5e1", label: "Cancelled" },
  };
  const s = map[status];
  return (
    <View style={[styles.pill, { backgroundColor: s.bg, borderColor: s.border }]}>
      <Text style={[styles.pillTxt, { color: s.fg }]}>{s.label}</Text>
    </View>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function MenuIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M4 6h16M4 12h16M4 18h16" stroke="#18181b" strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}
function BackIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path d="M19 12H5M12 19l-7-7 7-7" stroke="#18181b" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fafafa" },
  safe: { flex: 1 },
  scroll: { paddingHorizontal: 18, paddingBottom: 40 },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2e8f0",
    alignItems: "center", justifyContent: "center",
  },
  brandRow: { flexDirection: "row", alignItems: "center" },
  brand: { color: "#18181b", fontSize: 14, fontWeight: "900", marginLeft: 8, letterSpacing: 2.2 },

  head: { marginTop: 8, marginBottom: 14 },
  eyebrow: { color: "#7c3aed", fontSize: 11, fontWeight: "800", letterSpacing: 1.5, textTransform: "uppercase" },
  title: { color: "#18181b", fontSize: 26, fontWeight: "900", marginTop: 4, letterSpacing: -0.5 },
  sub: { color: "#64748b", fontSize: 13, marginTop: 4 },

  section: {
    color: "#64748b", fontSize: 11, fontWeight: "800",
    textTransform: "uppercase", letterSpacing: 1.2,
    marginTop: 18, marginBottom: 8,
  },

  card: {
    backgroundColor: "#fff",
    borderColor: "#e2e8f0",
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardHead: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  cardCode: { color: "#7c3aed", fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  cardName: { color: "#18181b", fontSize: 15, fontWeight: "700", marginTop: 2 },

  pill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  pillTxt: { fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.6 },

  progressRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginTop: 12 },
  progressTxt: { color: "#18181b", fontSize: 14, fontWeight: "800" },
  dueTxt: { color: "#64748b", fontSize: 11 },
  progressBar: { height: 6, borderRadius: 3, backgroundColor: "#f1f5f9", marginTop: 6, overflow: "hidden" },
  progressFill: { height: 6, backgroundColor: "#7c3aed", borderRadius: 3 },

  center: { padding: 40, alignItems: "center" },
  emptyCard: { padding: 20, backgroundColor: "#fff", borderRadius: 14, borderColor: "#e2e8f0", borderWidth: 1 },
  emptyTitle: { color: "#18181b", fontSize: 15, fontWeight: "800" },
  emptyBody: { color: "#64748b", fontSize: 13, marginTop: 4 },

  errBox: { backgroundColor: "#fef2f2", borderColor: "#fecaca", borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 10 },
  errText: { color: "#b91c1c", fontSize: 13, fontWeight: "600" },
});
