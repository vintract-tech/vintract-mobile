/**
 * Flow Board — the live kanban from GET /flow/board. Horizontally
 * scrollable stage columns; each shows its WIP total and the orders
 * sitting in it (code, qty, days-waiting tint). Tap an order → the
 * production order screen (stage balances + Record Progress live there).
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
import { SideMenu } from "../../components/SideMenu";
import { getFlowBoard, type FlowBoard, type FlowBoardOrder, type FlowBoardStage } from "../../lib/api";
import { pendingCount, replay } from "../../lib/flowQueue";

export default function FlowBoardScreen() {
  const [board, setBoard] = useState<FlowBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pending, setPending] = useState(0);

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
      setBoard(await getFlowBoard("in_progress"));
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load");
      setPending(await pendingCount().catch(() => 0));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const stages = (board?.stages ?? []).filter((s) => s.is_active || s.total_qty > 0);

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
          <ScrollView
            horizontal
            style={{ flex: 1 }}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.columns}
          >
            {stages.map((s) => <StageColumn key={s.stage_id} stage={s} />)}
          </ScrollView>
        )}

        {board && !loading && stages.every((s) => s.orders.length === 0) && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Nothing On The Floor</Text>
            <Text style={styles.emptyBody}>
              Orders appear here once they are started on Flow from the web app.
            </Text>
          </View>
        )}
      </SafeAreaView>
      <SideMenu visible={menuOpen} onClose={() => setMenuOpen(false)} />
    </View>
  );
}

function StageColumn({ stage }: { stage: FlowBoardStage }) {
  return (
    <View style={[styles.column, stage.over_wip_limit && styles.columnOver]}>
      <View style={styles.columnHead}>
        <View style={[styles.stageDot, { backgroundColor: stage.colour || "#7c3aed" }]} />
        <Text style={styles.stageName} numberOfLines={1}>{stage.name}</Text>
      </View>
      <View style={styles.columnStats}>
        <Text style={styles.stageQty}>{stage.total_qty}</Text>
        <Text style={styles.stageQtyLabel}>
          {stage.wip_limit != null ? `of ${stage.wip_limit} WIP limit` : "units"}
        </Text>
      </View>
      {stage.over_wip_limit && (
        <View style={styles.overBadge}><Text style={styles.overBadgeTxt}>Over Limit</Text></View>
      )}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
        {stage.orders.length === 0 ? (
          <Text style={styles.columnEmpty}>Empty</Text>
        ) : (
          stage.orders.map((o) => <OrderChip key={o.order_id} order={o} />)
        )}
      </ScrollView>
    </View>
  );
}

function OrderChip({ order }: { order: FlowBoardOrder }) {
  // Ageing tint: fresh → white, 2+ days → amber, 5+ days → red.
  const aged = order.days_waiting >= 5 ? styles.chipRed : order.days_waiting >= 2 ? styles.chipAmber : null;
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/production/[id]", params: { id: String(order.order_id) } })}
      style={({ pressed }) => [styles.chip, aged, pressed && { opacity: 0.9 }]}
    >
      <Text style={styles.chipCode}>{order.order_code}</Text>
      <Text style={styles.chipName} numberOfLines={1}>{order.product_name}</Text>
      <View style={styles.chipFoot}>
        <Text style={styles.chipQty}>{order.qty}</Text>
        <Text style={styles.chipDays}>
          {order.days_waiting > 0 ? `${order.days_waiting}d waiting` : "fresh"}
        </Text>
      </View>
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

  columns: { paddingHorizontal: 14, paddingBottom: 20, gap: 12 },
  column: {
    width: 240, backgroundColor: "#fff", borderColor: "#e2e8f0", borderWidth: 1,
    borderRadius: 16, padding: 12, maxHeight: "100%",
  },
  columnOver: { borderColor: "#fecaca", backgroundColor: "#fffafa" },
  columnHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  stageDot: { width: 10, height: 10, borderRadius: 5 },
  stageName: { flex: 1, color: "#18181b", fontSize: 14, fontWeight: "800" },
  columnStats: { flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 8, marginBottom: 8 },
  stageQty: { color: "#7c3aed", fontSize: 24, fontWeight: "900", letterSpacing: -0.5 },
  stageQtyLabel: { color: "#94a3b8", fontSize: 11, fontWeight: "600" },
  overBadge: {
    alignSelf: "flex-start", backgroundColor: "#fef2f2", borderColor: "#fecaca", borderWidth: 1,
    borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 8,
  },
  overBadgeTxt: { color: "#b91c1c", fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
  columnEmpty: { color: "#cbd5e1", fontSize: 12, fontStyle: "italic", paddingVertical: 8 },

  chip: {
    backgroundColor: "#f8fafc", borderColor: "#e2e8f0", borderWidth: 1,
    borderRadius: 12, padding: 10, marginBottom: 8,
  },
  chipAmber: { backgroundColor: "#fffbeb", borderColor: "#fde68a" },
  chipRed: { backgroundColor: "#fef2f2", borderColor: "#fecaca" },
  chipCode: { color: "#7c3aed", fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  chipName: { color: "#18181b", fontSize: 13, fontWeight: "700", marginTop: 2 },
  chipFoot: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginTop: 6 },
  chipQty: { color: "#18181b", fontSize: 15, fontWeight: "900" },
  chipDays: { color: "#94a3b8", fontSize: 10, fontWeight: "700" },

  center: { padding: 40, alignItems: "center" },
  emptyCard: { marginHorizontal: 18, padding: 20, backgroundColor: "#fff", borderRadius: 14, borderColor: "#e2e8f0", borderWidth: 1 },
  emptyTitle: { color: "#18181b", fontSize: 15, fontWeight: "800" },
  emptyBody: { color: "#64748b", fontSize: 13, marginTop: 4 },
  errBox: { marginHorizontal: 18, backgroundColor: "#fef2f2", borderColor: "#fecaca", borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 10 },
  errText: { color: "#b91c1c", fontSize: 13, fontWeight: "600" },
});
