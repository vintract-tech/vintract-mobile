/**
 * Record Progress — the floor's write path onto Flow (POST /flow/record).
 *
 * Pick a stage on the order's route (last-used stage is remembered per
 * device — one station usually records one stage all shift), enter
 * Completed and Damaged quantities, optionally send damaged units back
 * to an earlier stage for rework, and submit.
 *
 * Every submission carries a fresh client_event_id UUID; if the network
 * is down the payload is queued in AsyncStorage and replayed on the next
 * focus of this screen or the Flow Board (see lib/flowQueue.ts). The
 * server dedupes on the UUID, so a replay can never double-count.
 */
import { useCallback, useState } from "react";
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
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BrandMark } from "../../components/BrandMark";
import { LightBackground } from "../../components/LightBackground";
import { SideMenu } from "../../components/SideMenu";
import { hasPermission, loadSession, type AuthUser } from "../../lib/auth";
import { getOrderFlow, type OrderFlow, type OrderFlowStage } from "../../lib/api";
import { newClientEventId, pendingCount, replay, submitOrQueue } from "../../lib/flowQueue";

const LAST_STAGE_KEY = "vintract.ops.stage.v1";

export default function RecordProgressScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const orderId = Number(id);

  const [user, setUser] = useState<AuthUser | null>(null);
  const [flow, setFlow] = useState<OrderFlow | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pending, setPending] = useState(0);

  const [stageId, setStageId] = useState<number | null>(null);
  const [completed, setCompleted] = useState("");
  const [damaged, setDamaged] = useState("");
  const [reworkTo, setReworkTo] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const [s, f] = await Promise.all([loadSession(), getOrderFlow(orderId)]);
      setUser(s?.user ?? null);
      setFlow(f);
      // Default the stage: last-used (if on this route), else the order's
      // current stage, else the first route stage.
      const last = await AsyncStorage.getItem(LAST_STAGE_KEY);
      const lastId = last ? Number(last) : null;
      const onRoute = (sid: number | null) => sid != null && f.route.some((r) => r.stage_id === sid);
      setStageId((prev) => {
        if (onRoute(prev)) return prev;
        if (onRoute(lastId)) return lastId;
        if (onRoute(f.current_stage_id)) return f.current_stage_id;
        return f.route[0]?.stage_id ?? null;
      });
      const out = await replay();
      if (out.rejected.length) {
        Alert.alert("Some Queued Records Were Rejected", out.rejected.join("\n"));
      }
      setPending(await pendingCount());
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useFocusEffect(useCallback(() => { if (orderId) refresh(); }, [orderId, refresh]));

  const canRecord = hasPermission(user, "floor.operate");
  const route = flow?.route ?? [];
  const selected = route.find((r) => r.stage_id === stageId) ?? null;
  const selectedIdx = route.findIndex((r) => r.stage_id === stageId);
  const earlierStages = selectedIdx > 0 ? route.slice(0, selectedIdx) : [];
  const dmg = parseFloat(damaged) || 0;

  async function pickStage(sid: number) {
    setStageId(sid);
    setReworkTo(null);
    await AsyncStorage.setItem(LAST_STAGE_KEY, String(sid));
  }

  async function submit() {
    if (!flow || stageId == null) return;
    const comp = parseFloat(completed) || 0;
    if (comp <= 0 && dmg <= 0) {
      Alert.alert("Nothing To Record", "Enter a completed or damaged quantity.");
      return;
    }
    setSubmitting(true);
    try {
      const outcome = await submitOrQueue({
        production_order_id: flow.production_order_id,
        stage_id: stageId,
        completed_qty: comp,
        rejected_qty: dmg,
        ...(dmg > 0 && reworkTo != null ? { rework_to_stage_id: reworkTo } : {}),
        source: "mobile",
        client_event_id: newClientEventId(),
        occurred_at: new Date().toISOString(),
      });
      if (outcome.kind === "sent") {
        const r = outcome.result;
        Alert.alert(
          "Recorded",
          r.applied
            ? `${flow.order_code}: ${r.qty_produced} / ${r.qty_planned} produced.`
            : "This entry was already recorded (idempotent replay).",
        );
        setCompleted("");
        setDamaged("");
        setReworkTo(null);
        await refresh();
      } else if (outcome.kind === "queued") {
        setPending(outcome.pending);
        Alert.alert(
          "Saved Offline",
          `No network — the record is queued (${outcome.pending} pending) and will sync automatically.`,
        );
        setCompleted("");
        setDamaged("");
        setReworkTo(null);
      } else {
        Alert.alert("Rejected", outcome.message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.root}>
      <LightBackground />
      <SafeAreaView style={styles.safe}>
        <View style={styles.topBar}>
          <Pressable onPress={() => setMenuOpen(true)} hitSlop={12} style={styles.iconBtn}><MenuIcon /></Pressable>
          <View style={styles.brandRow}><BrandMark size={26} /><Text style={styles.brand}>VINTRACT</Text></View>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.iconBtn}><BackIcon /></Pressable>
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            {loading && !flow && <View style={styles.center}><ActivityIndicator color="#7c3aed" /></View>}
            {err && !loading && <View style={styles.errBox}><Text style={styles.errText}>{err}</Text></View>}

            {flow && (
              <>
                <Text style={styles.eyebrow}>Record Progress</Text>
                <Text style={styles.title}>{flow.order_code}</Text>
                <Text style={styles.subtitle} numberOfLines={2}>{flow.product_name}</Text>

                {pending > 0 && (
                  <View style={styles.pendingBar}>
                    <Text style={styles.pendingTxt}>{pending} Record(s) Queued Offline</Text>
                  </View>
                )}

                {!flow.has_route ? (
                  <View style={styles.emptyCard}>
                    <Text style={styles.emptyTitle}>Not On Flow Yet</Text>
                    <Text style={styles.emptyBody}>
                      This order has not been started on Flow. Start it from the web app first.
                    </Text>
                  </View>
                ) : (
                  <>
                    {/* Stage picker */}
                    <Text style={styles.label}>Stage</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                      {route.map((r) => (
                        <Pressable
                          key={r.stage_id}
                          onPress={() => pickStage(r.stage_id)}
                          style={[styles.stageChip, stageId === r.stage_id && styles.stageChipOn]}
                        >
                          <Text style={[styles.stageChipTxt, stageId === r.stage_id && styles.stageChipTxtOn]}>
                            {r.name}
                          </Text>
                          <Text style={[styles.stageChipQty, stageId === r.stage_id && styles.stageChipTxtOn]}>
                            {r.qty}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                    {selected && (
                      <Text style={styles.availTxt}>
                        {selected.qty} unit(s) currently at {selected.name}.
                      </Text>
                    )}

                    {/* Quantities */}
                    <View style={styles.qtyRow}>
                      <View style={styles.qtyCol}>
                        <Text style={styles.label}>Completed</Text>
                        <TextInput
                          value={completed}
                          onChangeText={setCompleted}
                          keyboardType="decimal-pad"
                          placeholder="0"
                          placeholderTextColor="#a3a3a3"
                          style={styles.qtyInput}
                        />
                      </View>
                      <View style={styles.qtyCol}>
                        <Text style={styles.label}>Damaged</Text>
                        <TextInput
                          value={damaged}
                          onChangeText={setDamaged}
                          keyboardType="decimal-pad"
                          placeholder="0"
                          placeholderTextColor="#a3a3a3"
                          style={styles.qtyInput}
                        />
                      </View>
                    </View>

                    {/* Rework target — only when damaged > 0 and there are earlier stages */}
                    {dmg > 0 && earlierStages.length > 0 && (
                      <>
                        <Text style={styles.label}>Send Back To</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                          <Pressable
                            onPress={() => setReworkTo(null)}
                            style={[styles.stageChip, reworkTo === null && styles.stageChipScrap]}
                          >
                            <Text style={[styles.stageChipTxt, reworkTo === null && { color: "#b91c1c" }]}>Scrap</Text>
                          </Pressable>
                          {earlierStages.map((r) => (
                            <Pressable
                              key={r.stage_id}
                              onPress={() => setReworkTo(r.stage_id)}
                              style={[styles.stageChip, reworkTo === r.stage_id && styles.stageChipOn]}
                            >
                              <Text style={[styles.stageChipTxt, reworkTo === r.stage_id && styles.stageChipTxtOn]}>
                                {r.name}
                              </Text>
                            </Pressable>
                          ))}
                        </ScrollView>
                        <Text style={styles.availTxt}>
                          {reworkTo === null
                            ? "Damaged units will be scrapped and counted as waste."
                            : "Damaged units go back for rework — not counted as waste."}
                        </Text>
                      </>
                    )}

                    {canRecord ? (
                      <Pressable
                        onPress={submit}
                        disabled={submitting}
                        style={({ pressed }) => [styles.submitBtn, (submitting || pressed) && { opacity: 0.85 }]}
                      >
                        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnTxt}>Record Progress</Text>}
                      </Pressable>
                    ) : (
                      <View style={styles.emptyCard}>
                        <Text style={styles.emptyBody}>
                          You need the Floor Operate permission to record progress.
                        </Text>
                      </View>
                    )}
                  </>
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

function MenuIcon() { return (<Svg width={20} height={20} viewBox="0 0 24 24" fill="none"><Path d="M4 6h16M4 12h16M4 18h16" stroke="#18181b" strokeWidth={2.2} strokeLinecap="round" /></Svg>); }
function BackIcon() { return (<Svg width={16} height={16} viewBox="0 0 24 24" fill="none"><Path d="M19 12H5M12 19l-7-7 7-7" stroke="#18181b" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" /></Svg>); }

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fafafa" },
  safe: { flex: 1 },
  scroll: { paddingHorizontal: 18, paddingBottom: 40 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 10 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2e8f0", alignItems: "center", justifyContent: "center" },
  brandRow: { flexDirection: "row", alignItems: "center" },
  brand: { color: "#18181b", fontSize: 14, fontWeight: "900", marginLeft: 8, letterSpacing: 2.2 },

  eyebrow: { color: "#7c3aed", fontSize: 11, fontWeight: "800", letterSpacing: 1.5, textTransform: "uppercase", marginTop: 8 },
  title: { color: "#18181b", fontSize: 26, fontWeight: "900", marginTop: 4, letterSpacing: -0.5 },
  subtitle: { color: "#475569", fontSize: 14, marginTop: 4, marginBottom: 12 },

  pendingBar: { padding: 10, backgroundColor: "#fffbeb", borderColor: "#fde68a", borderWidth: 1, borderRadius: 10, marginBottom: 12 },
  pendingTxt: { color: "#92400e", fontSize: 12, fontWeight: "700" },

  label: { color: "#475569", fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8, marginTop: 8 },
  chipRow: { gap: 8, paddingBottom: 4 },
  stageChip: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, alignItems: "center",
    backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2e8f0",
  },
  stageChipOn: { backgroundColor: "#7c3aed", borderColor: "#6d28d9" },
  stageChipScrap: { backgroundColor: "#fef2f2", borderColor: "#fecaca" },
  stageChipTxt: { color: "#334155", fontSize: 13, fontWeight: "800" },
  stageChipTxtOn: { color: "#fff" },
  stageChipQty: { color: "#94a3b8", fontSize: 11, fontWeight: "800", marginTop: 2 },
  availTxt: { color: "#64748b", fontSize: 12, marginTop: 8, marginBottom: 4 },

  qtyRow: { flexDirection: "row", gap: 12, marginTop: 8 },
  qtyCol: { flex: 1 },
  qtyInput: {
    backgroundColor: "#fff", color: "#18181b", borderColor: "#e2e8f0", borderWidth: 1,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 24, fontWeight: "800",
  },

  submitBtn: {
    backgroundColor: "#7c3aed", paddingVertical: 14, borderRadius: 12, alignItems: "center", marginTop: 20,
    shadowColor: "#7c3aed", shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 4,
  },
  submitBtnTxt: { color: "#fff", fontSize: 16, fontWeight: "800" },

  center: { padding: 40, alignItems: "center" },
  emptyCard: { padding: 16, backgroundColor: "#fff", borderRadius: 12, borderColor: "#e2e8f0", borderWidth: 1, marginTop: 12 },
  emptyTitle: { color: "#18181b", fontSize: 15, fontWeight: "800" },
  emptyBody: { color: "#64748b", fontSize: 13, marginTop: 4 },
  errBox: { backgroundColor: "#fef2f2", borderColor: "#fecaca", borderWidth: 1, borderRadius: 10, padding: 12 },
  errText: { color: "#b91c1c", fontSize: 13, fontWeight: "600" },
});
