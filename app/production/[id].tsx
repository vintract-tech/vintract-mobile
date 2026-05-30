/**
 * Production order detail. Lets the operator:
 *   - see who, what, how many, when
 *   - tap Start to flip planned → in_progress
 *   - enter qty produced and Mark complete
 *   - log waste against this order (shortcut)
 */
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { BrandMark } from "../../components/BrandMark";
import { LightBackground } from "../../components/LightBackground";
import { SideMenu } from "../../components/SideMenu";
import {
  getProductionOrder,
  updateProductionOrder,
  type ProductionOrder,
} from "../../lib/api";

export default function ProductionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const orderId = Number(id);

  const [order, setOrder] = useState<ProductionOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [qtyInput, setQtyInput] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const o = await getProductionOrder(orderId);
      setOrder(o);
      setQtyInput(String(o.qty_produced || ""));
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => { if (orderId) refresh(); }, [orderId, refresh]);

  async function patch(p: Parameters<typeof updateProductionOrder>[1]) {
    setSubmitting(true);
    try {
      const o = await updateProductionOrder(orderId, p);
      setOrder(o);
    } catch (e: any) {
      Alert.alert("Update failed", e?.message ?? "Try again");
    } finally {
      setSubmitting(false);
    }
  }

  async function onStart() {
    if (!order) return;
    await patch({ status: "in_progress" });
  }

  async function onComplete() {
    if (!order) return;
    const q = parseFloat(qtyInput);
    if (!Number.isFinite(q) || q < 0) {
      Alert.alert("Invalid qty", "Enter a non-negative produced quantity.");
      return;
    }
    Alert.alert(
      "Mark complete?",
      `Produced: ${q}\nPlanned: ${order.qty_planned}\n\nThis closes the order.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Complete", onPress: () => patch({ status: "completed", qty_produced: q }) },
      ],
    );
  }

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

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.flex}
        >
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            {loading && (
              <View style={styles.center}><ActivityIndicator color="#7c3aed" /></View>
            )}

            {err && !loading && (
              <View style={styles.errBox}>
                <Text style={styles.errText}>{err}</Text>
              </View>
            )}

            {order && !loading && (
              <>
                <Text style={styles.eyebrow}>Order</Text>
                <Text style={styles.title}>{order.code}</Text>
                <Text style={styles.subtitle} numberOfLines={2}>{order.product_name}</Text>

                {/* Progress hero */}
                <View style={styles.heroCard}>
                  <View style={styles.heroRow}>
                    <Text style={styles.heroValue}>{order.qty_produced}</Text>
                    <Text style={styles.heroDivider}>/</Text>
                    <Text style={styles.heroPlanned}>{order.qty_planned}</Text>
                  </View>
                  <Text style={styles.heroLabel}>PRODUCED</Text>
                  <ProgressBar value={order.qty_produced} max={order.qty_planned} />
                  <View style={styles.statusRow}>
                    <Text style={styles.statusLabel}>Status</Text>
                    <Text style={styles.statusValue}>{prettyStatus(order.status)}</Text>
                  </View>
                </View>

                <View style={styles.metaCard}>
                  <MetaRow label="Customer" value={order.customer ?? "—"} />
                  <MetaRow label="Priority" value={order.priority} />
                  <MetaRow label="Planned start" value={order.planned_start ?? "—"} />
                  <MetaRow label="Target" value={order.target_completion ?? "—"} />
                  <MetaRow label="Waste" value={String(order.qty_wasted)} last />
                </View>

                {order.notes && (
                  <View style={styles.notesCard}>
                    <Text style={styles.notesLabel}>Notes</Text>
                    <Text style={styles.notesText}>{order.notes}</Text>
                  </View>
                )}

                {/* Actions */}
                {order.status === "planned" && (
                  <Pressable
                    onPress={onStart}
                    disabled={submitting}
                    style={({ pressed }) => [styles.startBtn, (submitting || pressed) && { opacity: 0.85 }]}
                  >
                    {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.startBtnText}>Start production</Text>}
                  </Pressable>
                )}

                {order.status === "in_progress" && (
                  <>
                    <View style={styles.card}>
                      <Text style={styles.label}>Qty produced so far</Text>
                      <TextInput
                        value={qtyInput}
                        onChangeText={setQtyInput}
                        keyboardType="decimal-pad"
                        placeholder="0"
                        placeholderTextColor="#a3a3a3"
                        style={styles.qtyInput}
                      />
                      <Pressable
                        onPress={() => patch({ qty_produced: parseFloat(qtyInput) || 0 })}
                        style={({ pressed }) => [styles.savePartial, pressed && { opacity: 0.85 }]}
                      >
                        <Text style={styles.savePartialText}>Save progress</Text>
                      </Pressable>
                    </View>
                    <Pressable
                      onPress={onComplete}
                      disabled={submitting}
                      style={({ pressed }) => [styles.completeBtn, (submitting || pressed) && { opacity: 0.85 }]}
                    >
                      {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.completeBtnText}>Mark complete</Text>}
                    </Pressable>
                  </>
                )}

                {(order.status === "completed" || order.status === "cancelled") && (
                  <View style={styles.closedBox}>
                    <Text style={styles.closedText}>
                      Order is {order.status}. Reopen via the web app if needed.
                    </Text>
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <SideMenu visible={menuOpen} onClose={() => setMenuOpen(false)} />
    </View>
  );
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <View style={styles.bar}>
      <View style={[styles.fill, { width: `${pct}%` }]} />
    </View>
  );
}

function MetaRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.metaRow, last && { borderBottomWidth: 0 }]}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function prettyStatus(s: ProductionOrder["status"]): string {
  return ({ planned: "Planned", in_progress: "Running", completed: "Completed", cancelled: "Cancelled" })[s];
}

function MenuIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M4 6h16M4 12h16M4 18h16" stroke="#1f1235" strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}
function BackIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path d="M19 12H5M12 19l-7-7 7-7" stroke="#1f1235" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f6f5fb" },
  safe: { flex: 1 },
  flex: { flex: 1 },
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
  brand: { color: "#1f1235", fontSize: 14, fontWeight: "900", marginLeft: 8, letterSpacing: 2.2 },

  eyebrow: { color: "#7c3aed", fontSize: 11, fontWeight: "800", letterSpacing: 1.5, textTransform: "uppercase", marginTop: 8 },
  title: { color: "#1f1235", fontSize: 26, fontWeight: "900", marginTop: 4, letterSpacing: -0.5 },
  subtitle: { color: "#475569", fontSize: 14, marginTop: 4 },

  heroCard: {
    backgroundColor: "#fff",
    borderColor: "#ddd6fe",
    borderWidth: 1,
    borderRadius: 18,
    padding: 18,
    marginTop: 16,
    marginBottom: 12,
    shadowColor: "#7c3aed",
    shadowOpacity: 0.15,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  heroRow: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  heroValue: { color: "#7c3aed", fontSize: 40, fontWeight: "900", letterSpacing: -1 },
  heroDivider: { color: "#cbd5e1", fontSize: 28, fontWeight: "800" },
  heroPlanned: { color: "#475569", fontSize: 24, fontWeight: "800" },
  heroLabel: { color: "#94a3b8", fontSize: 10, letterSpacing: 1.5, fontWeight: "800", marginTop: 2 },

  bar: { height: 8, borderRadius: 4, backgroundColor: "#f1f5f9", marginTop: 14, overflow: "hidden" },
  fill: { height: 8, backgroundColor: "#7c3aed", borderRadius: 4 },

  statusRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 14 },
  statusLabel: { color: "#64748b", fontSize: 12 },
  statusValue: { color: "#1f1235", fontSize: 13, fontWeight: "800" },

  metaCard: {
    backgroundColor: "#fff",
    borderColor: "#e2e8f0",
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomColor: "#f1f5f9",
    borderBottomWidth: 1,
  },
  metaLabel: { color: "#64748b", fontSize: 13 },
  metaValue: { color: "#1f1235", fontSize: 13, fontWeight: "700", maxWidth: "60%" },

  notesCard: {
    backgroundColor: "#f8fafc",
    borderColor: "#e2e8f0",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  notesLabel: { color: "#64748b", fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.8 },
  notesText: { color: "#1f1235", fontSize: 13, marginTop: 4, lineHeight: 18 },

  card: {
    backgroundColor: "#fff",
    borderColor: "#e2e8f0",
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  label: { color: "#475569", fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 },
  qtyInput: {
    backgroundColor: "#f8fafc",
    color: "#1f1235",
    borderColor: "#e2e8f0",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 22,
    fontWeight: "800",
  },

  startBtn: {
    backgroundColor: "#10b981",
    paddingVertical: 14, borderRadius: 12, alignItems: "center", marginTop: 6,
    shadowColor: "#10b981", shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 4,
  },
  startBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  savePartial: {
    backgroundColor: "#7c3aed",
    paddingVertical: 10, borderRadius: 10, alignItems: "center", marginTop: 10,
  },
  savePartialText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  completeBtn: {
    backgroundColor: "#7c3aed",
    paddingVertical: 14, borderRadius: 12, alignItems: "center", marginTop: 4,
    shadowColor: "#7c3aed", shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 4,
  },
  completeBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },

  closedBox: {
    backgroundColor: "#f8fafc", borderColor: "#e2e8f0", borderWidth: 1, borderRadius: 10,
    padding: 14, marginTop: 4,
  },
  closedText: { color: "#64748b", fontSize: 13, textAlign: "center" },

  center: { padding: 40, alignItems: "center" },
  errBox: { backgroundColor: "#fef2f2", borderColor: "#fecaca", borderWidth: 1, borderRadius: 10, padding: 12 },
  errText: { color: "#b91c1c", fontSize: 13, fontWeight: "600" },
});
