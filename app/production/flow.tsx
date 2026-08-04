/**
 * Flow Board — the live kanban from GET /flow/board.
 *
 * Redesign (founder feedback: "tiles are lengthy"): instead of full-height
 * kanban columns panned horizontally, the stages sit in one compact
 * horizontal strip (segmented control — dot, name, qty per chip) and the
 * selected stage's orders render as a full-width vertical list, one row
 * per order (code + product + qty + days tint on a single line). On a
 * phone this wins: every stage's load is visible at a glance without
 * panning, and a 7-stage route never needs endless column scrolling —
 * you flick the strip, not the board.
 *
 * Tap an order row → the production order screen (stage balances,
 * materials and Record Progress live there).
 *
 * Also drains the offline record queue on focus — this is the screen a
 * floor manager returns to when the Wi-Fi comes back.
 */
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
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
import { useListBottomPadding } from "../../components/Screen";
import { SideMenu } from "../../components/SideMenu";
import { getFlowBoard, type FlowBoard, type FlowBoardOrder, type FlowBoardStage } from "../../lib/api";
import { pendingCount, replay } from "../../lib/flowQueue";

export default function FlowBoardScreen() {
  const [board, setBoard] = useState<FlowBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pending, setPending] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const listBottomPad = useListBottomPadding();

  const refresh = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      // Replay any offline-queued records first, so the board reflects them.
      const out = await replay();
      if (out.rejected.length) {
        Alert.alert("Some Queued Records Were Rejected", out.rejected.join("\n"));
      }
      setPending(await pendingCount());
      const b = await getFlowBoard("in_progress");
      setBoard(b);
      // Keep the current selection if that stage still exists; otherwise
      // land on the first stage that actually has orders, else the first.
      setSelectedId((prev) => {
        const visible = b.stages.filter((s) => s.is_active || s.total_qty > 0);
        if (prev != null && visible.some((s) => s.stage_id === prev)) return prev;
        const busy = visible.find((s) => s.orders.length > 0);
        return (busy ?? visible[0])?.stage_id ?? null;
      });
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load");
      setPending(await pendingCount().catch(() => 0));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const stages = (board?.stages ?? []).filter((s) => s.is_active || s.total_qty > 0);
  const selected = stages.find((s) => s.stage_id === selectedId) ?? null;

  return (
    <View style={styles.root}>
      <LightBackground />
      <SafeAreaView style={styles.safe}>
        <View style={styles.topBar}>
          <Pressable onPress={() => setMenuOpen(true)} hitSlop={12} style={styles.iconBtn}><MenuIcon /></Pressable>
          <View style={styles.brandRow}><BrandMark size={26} /><Text style={styles.brand}>VINTRACT</Text></View>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.iconBtn}><BackIcon /></Pressable>
        </View>

        <View style={styles.head}>
          <Text style={styles.eyebrow}>Operations</Text>
          <Text style={styles.title}>Flow Board</Text>
          <Text style={styles.sub}>
            {board ? `${board.order_count} order(s) · ${board.total_wip} unit(s) on the floor.` : " "}
          </Text>
        </View>

        {pending > 0 && (
          <View style={styles.pendingBar}>
            <Text style={styles.pendingTxt}>
              {pending} Record(s) Queued Offline — will sync when the network returns.
            </Text>
          </View>
        )}

        {err && <View style={styles.errBox}><Text style={styles.errText}>{err}</Text></View>}
        {loading && !board && <View style={styles.center}><ActivityIndicator color="#7c3aed" /></View>}

        {board && (
          <>
            {/* Stage strip — every stage's load at a glance; tap to focus. */}
            <View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.strip}
              >
                {stages.map((s) => (
                  <StageChip
                    key={s.stage_id}
                    stage={s}
                    selected={s.stage_id === selectedId}
                    onPress={() => setSelectedId(s.stage_id)}
                  />
                ))}
              </ScrollView>
            </View>

            {/* Selected stage's orders — full-width vertical list. */}
            {selected && (
              <View style={styles.stageHead}>
                <View style={[styles.stageDot, { backgroundColor: selected.colour || "#7c3aed" }]} />
                <Text style={styles.stageHeadName} numberOfLines={1}>{selected.name}</Text>
                {selected.over_wip_limit && (
                  <View style={styles.overBadge}><Text style={styles.overBadgeTxt}>Over Limit</Text></View>
                )}
                <Text style={styles.stageHeadQty}>
                  {selected.total_qty}
                  <Text style={styles.stageHeadQtyLabel}>
                    {selected.wip_limit != null ? ` / ${selected.wip_limit}` : ""}
                  </Text>
                </Text>
              </View>
            )}

            <ScrollView
              style={{ flex: 1 }}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[styles.orderList, { paddingBottom: listBottomPad }]}
            >
              {selected && selected.orders.length === 0 && (
                <Text style={styles.stageEmpty}>Nothing At This Stage</Text>
              )}
              {selected?.orders.map((o) => <OrderRow key={o.order_id} order={o} />)}

              {!loading && stages.every((s) => s.orders.length === 0) && (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyTitle}>Nothing On The Floor</Text>
                  <Text style={styles.emptyBody}>
                    Orders appear here once they are started on Flow from the web app.
                  </Text>
                </View>
              )}
            </ScrollView>
          </>
        )}
      </SafeAreaView>
      <SideMenu visible={menuOpen} onClose={() => setMenuOpen(false)} />
    </View>
  );
}

function StageChip({
  stage,
  selected,
  onPress,
}: {
  stage: FlowBoardStage;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        stage.over_wip_limit && styles.chipOver,
        selected && styles.chipOn,
      ]}
    >
      <View style={[styles.chipDot, { backgroundColor: stage.colour || "#7c3aed" }]} />
      <Text style={[styles.chipName, selected && styles.chipTxtOn]} numberOfLines={1}>
        {stage.name}
      </Text>
      <Text style={[styles.chipQty, selected && styles.chipTxtOn]}>{stage.total_qty}</Text>
    </Pressable>
  );
}

function OrderRow({ order }: { order: FlowBoardOrder }) {
  // Ageing tint: fresh → white, 2+ days → amber, 5+ days → red.
  const aged = order.days_waiting >= 5 ? styles.rowRed : order.days_waiting >= 2 ? styles.rowAmber : null;
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/production/[id]", params: { id: String(order.order_id) } })}
      style={({ pressed }) => [styles.row, aged, pressed && { opacity: 0.9 }]}
    >
      <View style={styles.rowMain}>
        <Text style={styles.rowCode}>{order.order_code}</Text>
        <Text style={styles.rowName} numberOfLines={1}>{order.product_name}</Text>
      </View>
      <Text style={styles.rowDays}>
        {order.days_waiting > 0 ? `${order.days_waiting}d` : "fresh"}
      </Text>
      <Text style={styles.rowQty}>{order.qty}</Text>
    </Pressable>
  );
}

function MenuIcon() { return (<Svg width={20} height={20} viewBox="0 0 24 24" fill="none"><Path d="M4 6h16M4 12h16M4 18h16" stroke="#18181b" strokeWidth={2.2} strokeLinecap="round" /></Svg>); }
function BackIcon() { return (<Svg width={16} height={16} viewBox="0 0 24 24" fill="none"><Path d="M19 12H5M12 19l-7-7 7-7" stroke="#18181b" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" /></Svg>); }

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fafafa" },
  safe: { flex: 1 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 10 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2e8f0", alignItems: "center", justifyContent: "center" },
  brandRow: { flexDirection: "row", alignItems: "center" },
  brand: { color: "#18181b", fontSize: 14, fontWeight: "900", marginLeft: 8, letterSpacing: 2.2 },
  head: { paddingHorizontal: 22, marginTop: 4, marginBottom: 10 },
  eyebrow: { color: "#7c3aed", fontSize: 11, fontWeight: "800", letterSpacing: 1.5, textTransform: "uppercase" },
  title: { color: "#18181b", fontSize: 26, fontWeight: "900", marginTop: 4, letterSpacing: -0.5 },
  sub: { color: "#64748b", fontSize: 13, marginTop: 4 },

  pendingBar: {
    marginHorizontal: 18, marginBottom: 10, padding: 10,
    backgroundColor: "#fffbeb", borderColor: "#fde68a", borderWidth: 1, borderRadius: 10,
  },
  pendingTxt: { color: "#92400e", fontSize: 12, fontWeight: "700" },

  // Stage strip
  strip: { paddingHorizontal: 16, paddingBottom: 10, gap: 8 },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 7,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
    backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2e8f0",
  },
  chipOver: { borderColor: "#fecaca", backgroundColor: "#fffafa" },
  chipOn: { backgroundColor: "#7c3aed", borderColor: "#6d28d9" },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  chipName: { color: "#334155", fontSize: 13, fontWeight: "800", maxWidth: 130 },
  chipQty: { color: "#7c3aed", fontSize: 13, fontWeight: "900" },
  chipTxtOn: { color: "#fff" },

  // Selected stage header
  stageHead: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 22, paddingBottom: 8,
  },
  stageDot: { width: 10, height: 10, borderRadius: 5 },
  stageHeadName: { flex: 1, color: "#18181b", fontSize: 15, fontWeight: "800" },
  stageHeadQty: { color: "#7c3aed", fontSize: 18, fontWeight: "900", letterSpacing: -0.3 },
  stageHeadQtyLabel: { color: "#94a3b8", fontSize: 12, fontWeight: "700" },
  overBadge: {
    backgroundColor: "#fef2f2", borderColor: "#fecaca", borderWidth: 1,
    borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3,
  },
  overBadgeTxt: { color: "#b91c1c", fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },

  // Order list
  orderList: { paddingHorizontal: 18, gap: 8 },
  stageEmpty: { color: "#cbd5e1", fontSize: 13, fontStyle: "italic", paddingVertical: 10, textAlign: "center" },
  row: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#fff", borderColor: "#e2e8f0", borderWidth: 1,
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
  },
  rowAmber: { backgroundColor: "#fffbeb", borderColor: "#fde68a" },
  rowRed: { backgroundColor: "#fef2f2", borderColor: "#fecaca" },
  rowMain: { flex: 1 },
  rowCode: { color: "#7c3aed", fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  rowName: { color: "#18181b", fontSize: 13, fontWeight: "700", marginTop: 1 },
  rowDays: { color: "#94a3b8", fontSize: 11, fontWeight: "700" },
  rowQty: { color: "#18181b", fontSize: 16, fontWeight: "900", minWidth: 34, textAlign: "right" },

  center: { padding: 40, alignItems: "center" },
  emptyCard: { padding: 20, backgroundColor: "#fff", borderRadius: 14, borderColor: "#e2e8f0", borderWidth: 1 },
  emptyTitle: { color: "#18181b", fontSize: 15, fontWeight: "800" },
  emptyBody: { color: "#64748b", fontSize: 13, marginTop: 4 },
  errBox: { marginHorizontal: 18, backgroundColor: "#fef2f2", borderColor: "#fecaca", borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 10 },
  errText: { color: "#b91c1c", fontSize: 13, fontWeight: "600" },
});
