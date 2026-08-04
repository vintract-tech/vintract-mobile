/**
 * Production order detail. Lets the operator:
 *   - see who, what, how many, when
 *   - see the BOM: Required / Issued / On Floor per material, short lines amber
 *   - tap Start to flip planned → in_progress
 *   - enter qty produced and Mark complete
 *   - log waste against this order, tagged to a route stage
 */
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
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
import { BrandMark } from "../../components/BrandMark";
import { LightBackground } from "../../components/LightBackground";
import { Screen } from "../../components/Screen";
import { SideMenu } from "../../components/SideMenu";
import {
  getItemBySku,
  getOrderFlow,
  getOrderMaterials,
  getProductionOrder,
  logWaste,
  updateProductionOrder,
  type Item,
  type MaterialLine,
  type OrderFlow,
  type ProductionOrder,
  type WasteReason,
} from "../../lib/api";
import { hasPermission, loadSession, type AuthUser } from "../../lib/auth";

/** Same enum + labels as the standalone waste screen (app/waste.tsx). */
const WASTE_REASONS: { key: WasteReason; label: string }[] = [
  { key: "damaged",      label: "Damaged" },
  { key: "qc_reject",    label: "QC Reject" },
  { key: "rework_scrap", label: "Rework Scrap" },
  { key: "expired",      label: "Expired" },
  { key: "spoilage",     label: "Spoilage" },
  { key: "other",        label: "Other" },
];

export default function ProductionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const orderId = Number(id);

  const [order, setOrder] = useState<ProductionOrder | null>(null);
  const [flow, setFlow] = useState<OrderFlow | null>(null);
  const [materials, setMaterials] = useState<MaterialLine[] | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [qtyInput, setQtyInput] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [wasteOpen, setWasteOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const [o, s] = await Promise.all([getProductionOrder(orderId), loadSession()]);
      setOrder(o);
      setUser(s?.user ?? null);
      setQtyInput(String(o.qty_produced || ""));
      // Flow route + balances — absent (has_route=false) until the order
      // is started on Flow, and non-fatal if the endpoint errors.
      getOrderFlow(orderId).then(setFlow).catch(() => setFlow(null));
      // BOM lines — non-fatal too (orders without a BOM just hide the card).
      getOrderMaterials(orderId).then(setMaterials).catch(() => setMaterials(null));
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  // Focus, not mount: returning from Record Progress must show the new
  // stage balances immediately.
  useFocusEffect(useCallback(() => { if (orderId) refresh(); }, [orderId, refresh]));

  async function patch(p: Parameters<typeof updateProductionOrder>[1]) {
    setSubmitting(true);
    try {
      const o = await updateProductionOrder(orderId, p);
      setOrder(o);
    } catch (e: any) {
      Alert.alert("Update Failed", e?.message ?? "Try again");
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
      Alert.alert("Invalid Qty", "Enter a non-negative produced quantity.");
      return;
    }
    Alert.alert(
      "Mark Complete?",
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

        <Screen scroll contentContainerStyle={styles.scroll}>
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
                  <MetaRow label="Planned Start" value={order.planned_start ?? "—"} />
                  <MetaRow label="Target" value={order.target_completion ?? "—"} />
                  <MetaRow label="Waste" value={String(order.qty_wasted)} last />
                </View>

                {/* Flow: where the units are right now */}
                {flow?.has_route && (
                  <View style={styles.flowCard}>
                    <Text style={styles.flowTitle}>Stage Balances</Text>
                    {flow.route.map((r, i) => (
                      <View
                        key={r.stage_id}
                        style={[styles.flowRow, i === flow.route.length - 1 && { borderBottomWidth: 0 }]}
                      >
                        <View style={[styles.flowDot, { backgroundColor: r.colour || "#7c3aed" }]} />
                        <Text style={styles.flowStage} numberOfLines={1}>{r.name}</Text>
                        {r.qty > 0 && r.days_waiting >= 2 && (
                          <Text style={styles.flowDays}>{r.days_waiting}d</Text>
                        )}
                        <Text style={[styles.flowQty, r.qty <= 0 && { color: "#cbd5e1" }]}>{r.qty}</Text>
                      </View>
                    ))}
                    {hasPermission(user, "floor.operate") && order.status !== "completed" && order.status !== "cancelled" && (
                      <Pressable
                        onPress={() => router.push({ pathname: "/production/record", params: { id: String(order.id) } })}
                        style={({ pressed }) => [styles.recordBtn, pressed && { opacity: 0.85 }]}
                      >
                        <Text style={styles.recordBtnTxt}>Record Progress</Text>
                      </Pressable>
                    )}
                  </View>
                )}

                {/* Materials: BOM lines with Required / Issued / On Floor */}
                {materials != null && materials.length > 0 && (
                  <View style={styles.matCard}>
                    <Text style={styles.matTitle}>Materials</Text>
                    {materials.map((m, i) => (
                      <MaterialRow
                        key={m.category_id}
                        line={m}
                        last={i === materials.length - 1}
                      />
                    ))}
                  </View>
                )}

                {order.notes && (
                  <View style={styles.notesCard}>
                    <Text style={styles.notesLabel}>Notes</Text>
                    <Text style={styles.notesText}>{order.notes}</Text>
                  </View>
                )}

                {/* Log waste against this order, tagged to a route stage. */}
                <Pressable
                  onPress={() => setWasteOpen(true)}
                  style={({ pressed }) => [styles.wasteBtn, pressed && { opacity: 0.85 }]}
                >
                  <Text style={styles.wasteBtnTxt}>Log Waste</Text>
                </Pressable>

                {/* Actions */}
                {order.status === "planned" && (
                  <Pressable
                    onPress={onStart}
                    disabled={submitting}
                    style={({ pressed }) => [styles.startBtn, (submitting || pressed) && { opacity: 0.85 }]}
                  >
                    {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.startBtnText}>Start Production</Text>}
                  </Pressable>
                )}

                {order.status === "in_progress" && (
                  <>
                    <View style={styles.card}>
                      <Text style={styles.label}>Qty Produced So Far</Text>
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
                        <Text style={styles.savePartialText}>Save Progress</Text>
                      </Pressable>
                    </View>
                    <Pressable
                      onPress={onComplete}
                      disabled={submitting}
                      style={({ pressed }) => [styles.completeBtn, (submitting || pressed) && { opacity: 0.85 }]}
                    >
                      {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.completeBtnText}>Mark Complete</Text>}
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
        </Screen>
      </SafeAreaView>

      <SideMenu visible={menuOpen} onClose={() => setMenuOpen(false)} />

      {order && (
        <WasteModal
          visible={wasteOpen}
          onClose={() => setWasteOpen(false)}
          orderId={order.id}
          routeStages={flow?.has_route ? flow.route : []}
          defaultStageId={flow?.current_stage_id ?? null}
          onLogged={refresh}
        />
      )}
    </View>
  );
}

/** One BOM line: name + SKU on top, Required / Issued / On Floor below.
 *  Short lines tint amber and show the shortfall. */
function MaterialRow({ line, last }: { line: MaterialLine; last?: boolean }) {
  const unit = line.unit ? ` ${line.unit}` : "";
  return (
    <View style={[styles.matRow, line.short && styles.matRowShort, last && { borderBottomWidth: 0 }]}>
      <View style={styles.matNameRow}>
        <Text style={styles.matName} numberOfLines={1}>{line.name}</Text>
        {line.short && (
          <Text style={styles.matShortBadge}>Short {line.shortfall}{unit}</Text>
        )}
      </View>
      {(line.sku_code || line.consume_stage_name) && (
        <Text style={styles.matSku} numberOfLines={1}>
          {line.sku_code ?? "No SKU"}
          {line.consume_stage_name ? ` · Consumed At ${line.consume_stage_name}` : ""}
        </Text>
      )}
      <View style={styles.matStats}>
        <MatStat label="Required" value={line.qty_required} short={line.short} />
        <MatStat label="Issued" value={line.qty_issued} short={line.short} />
        <MatStat label="On Floor" value={line.qty_on_floor} short={line.short} />
      </View>
    </View>
  );
}

function MatStat({ label, value, short }: { label: string; value: number; short: boolean }) {
  return (
    <View style={styles.matStat}>
      <Text style={[styles.matStatVal, short && { color: "#b45309" }]}>{value}</Text>
      <Text style={styles.matStatLabel}>{label}</Text>
    </View>
  );
}

/** Log Waste — small modal form. Item lookup mirrors app/waste.tsx
 *  (type/scan the SKU, resolve on blur or submit); the entry is tagged
 *  with this production order and, optionally, a stage on its route. */
function WasteModal({
  visible,
  onClose,
  orderId,
  routeStages,
  defaultStageId,
  onLogged,
}: {
  visible: boolean;
  onClose: () => void;
  orderId: number;
  routeStages: OrderFlow["route"];
  defaultStageId: number | null;
  onLogged: () => void;
}) {
  const [sku, setSku] = useState("");
  const [item, setItem] = useState<Item | null>(null);
  const [resolving, setResolving] = useState(false);
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState<WasteReason | null>(null);
  const [stageId, setStageId] = useState<number | null>(null);
  const [stageTouched, setStageTouched] = useState(false);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Default the stage to the order's current stage until the user picks.
  const onRoute = (sid: number | null) => sid != null && routeStages.some((r) => r.stage_id === sid);
  const effectiveStageId = stageTouched ? stageId : onRoute(defaultStageId) ? defaultStageId : null;

  async function resolveSku(value: string) {
    setErr(null);
    setItem(null);
    if (!value.trim()) return;
    setResolving(true);
    try {
      const it = await getItemBySku(value.trim());
      setItem(it);
      setSku(it.sku_code);
    } catch (e: any) {
      setErr(e?.message ?? "SKU not found");
    } finally {
      setResolving(false);
    }
  }

  function reset() {
    setSku(""); setItem(null); setQty(""); setReason(null);
    setStageId(null); setStageTouched(false); setNotes(""); setErr(null);
  }

  async function submit() {
    setErr(null);
    if (!item) { setErr("Type a valid SKU first"); return; }
    if (!reason) { setErr("Pick a reason"); return; }
    const q = parseFloat(qty);
    if (!Number.isFinite(q) || q <= 0) { setErr("Quantity must be a positive number"); return; }
    setSaving(true);
    try {
      const session = await loadSession();
      const operator = session?.user?.name || session?.user?.email;
      await logWaste({
        sku_code: item.sku_code,
        qty: q,
        reason,
        notes: notes.trim() || undefined,
        operator,
        production_order_id: orderId,
        stage_id: effectiveStageId,
      });
      reset();
      onClose();
      Alert.alert("Waste Logged", `${q} ${item.stock_unit ?? ""} recorded against this order.`.trim());
      onLogged();
    } catch (e: any) {
      setErr(e?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalScrim}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalWrap}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>Log Waste</Text>
              <Pressable onPress={onClose} hitSlop={12}>
                <Text style={styles.modalClose}>Close</Text>
              </Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={[styles.label, styles.mLabel]}>SKU</Text>
              <TextInput
                value={sku}
                onChangeText={setSku}
                onBlur={() => resolveSku(sku)}
                onSubmitEditing={() => resolveSku(sku)}
                placeholder="Type or scan…"
                placeholderTextColor="#a3a3a3"
                autoCapitalize="characters"
                autoCorrect={false}
                returnKeyType="search"
                style={styles.modalInput}
              />
              {resolving && (
                <View style={styles.resolveRow}>
                  <ActivityIndicator color="#7c3aed" size="small" />
                  <Text style={styles.resolveTxt}>Looking Up…</Text>
                </View>
              )}
              {item && (
                <View style={styles.resolvedCard}>
                  <Text style={styles.resolvedName}>{item.category}</Text>
                  <Text style={styles.resolvedStock}>
                    On Hand: <Text style={styles.resolvedStockVal}>{item.on_hand}</Text>{" "}
                    {item.stock_unit ?? ""}
                  </Text>
                </View>
              )}

              <Text style={[styles.label, styles.mLabel]}>Reason</Text>
              <View style={styles.reasonGrid}>
                {WASTE_REASONS.map((r) => {
                  const on = reason === r.key;
                  return (
                    <Pressable
                      key={r.key}
                      onPress={() => setReason(r.key)}
                      style={[styles.reasonBtn, on && styles.reasonBtnOn]}
                    >
                      <Text style={[styles.reasonTxt, on && styles.reasonTxtOn]}>{r.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {routeStages.length > 0 && (
                <>
                  <Text style={[styles.label, styles.mLabel]}>Stage</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stageRow}>
                    <Pressable
                      onPress={() => { setStageTouched(true); setStageId(null); }}
                      style={[styles.stagePick, effectiveStageId === null && styles.stagePickOn]}
                    >
                      <Text style={[styles.stagePickTxt, effectiveStageId === null && styles.stagePickTxtOn]}>
                        No Stage
                      </Text>
                    </Pressable>
                    {routeStages.map((r) => (
                      <Pressable
                        key={r.stage_id}
                        onPress={() => { setStageTouched(true); setStageId(r.stage_id); }}
                        style={[styles.stagePick, effectiveStageId === r.stage_id && styles.stagePickOn]}
                      >
                        <Text style={[styles.stagePickTxt, effectiveStageId === r.stage_id && styles.stagePickTxtOn]}>
                          {r.name}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </>
              )}

              <Text style={[styles.label, styles.mLabel]}>Quantity{item?.stock_unit ? ` (${item.stock_unit})` : ""}</Text>
              <TextInput
                value={qty}
                onChangeText={setQty}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor="#a3a3a3"
                style={[styles.modalInput, styles.modalQty]}
              />

              <Text style={[styles.label, styles.mLabel]}>Notes</Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="What happened?"
                placeholderTextColor="#a3a3a3"
                style={styles.modalInput}
              />

              {err && <View style={[styles.errBox, styles.mLabel]}><Text style={styles.errText}>{err}</Text></View>}

              <Pressable
                onPress={submit}
                disabled={saving}
                style={({ pressed }) => [styles.modalSave, (saving || pressed) && { opacity: 0.85 }]}
              >
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalSaveTxt}>Save Waste Entry</Text>}
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
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
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 18 },
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

  eyebrow: { color: "#7c3aed", fontSize: 11, fontWeight: "800", letterSpacing: 1.5, textTransform: "uppercase", marginTop: 8 },
  title: { color: "#18181b", fontSize: 26, fontWeight: "900", marginTop: 4, letterSpacing: -0.5 },
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
  statusValue: { color: "#18181b", fontSize: 13, fontWeight: "800" },

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
  metaValue: { color: "#18181b", fontSize: 13, fontWeight: "700", maxWidth: "60%" },

  flowCard: {
    backgroundColor: "#fff",
    borderColor: "#e2e8f0",
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  flowTitle: { color: "#475569", fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 },
  flowRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 9, borderBottomColor: "#f1f5f9", borderBottomWidth: 1,
  },
  flowDot: { width: 8, height: 8, borderRadius: 4 },
  flowStage: { flex: 1, color: "#18181b", fontSize: 13, fontWeight: "700" },
  flowDays: { color: "#b45309", fontSize: 11, fontWeight: "800" },
  flowQty: { color: "#7c3aed", fontSize: 15, fontWeight: "900", minWidth: 34, textAlign: "right" },
  recordBtn: {
    backgroundColor: "#7c3aed", paddingVertical: 12, borderRadius: 10, alignItems: "center", marginTop: 12,
  },
  recordBtnTxt: { color: "#fff", fontSize: 14, fontWeight: "800" },

  notesCard: {
    backgroundColor: "#f8fafc",
    borderColor: "#e2e8f0",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  notesLabel: { color: "#64748b", fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.8 },
  notesText: { color: "#18181b", fontSize: 13, marginTop: 4, lineHeight: 18 },

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
    color: "#18181b",
    borderColor: "#e2e8f0",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 22,
    fontWeight: "800",
  },

  startBtn: {
    backgroundColor: "#7c3aed",
    paddingVertical: 14, borderRadius: 12, alignItems: "center", marginTop: 6,
    shadowColor: "#7c3aed", shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 4,
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

  // Materials (BOM) card
  matCard: {
    backgroundColor: "#fff",
    borderColor: "#e2e8f0",
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  matTitle: { color: "#475569", fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 },
  matRow: { paddingVertical: 10, borderBottomColor: "#f1f5f9", borderBottomWidth: 1 },
  matRowShort: {
    backgroundColor: "#fffbeb", borderColor: "#fde68a", borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 10, marginVertical: 4, borderBottomWidth: 1,
  },
  matNameRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  matName: { flex: 1, color: "#18181b", fontSize: 13, fontWeight: "800" },
  matShortBadge: { color: "#b45309", fontSize: 11, fontWeight: "800" },
  matSku: { color: "#94a3b8", fontSize: 11, fontWeight: "600", marginTop: 2 },
  matStats: { flexDirection: "row", gap: 18, marginTop: 8 },
  matStat: { minWidth: 64 },
  matStatVal: { color: "#7c3aed", fontSize: 15, fontWeight: "900" },
  matStatLabel: { color: "#94a3b8", fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 1 },

  // Log Waste action
  wasteBtn: {
    backgroundColor: "#fff", borderColor: "#fde68a", borderWidth: 1,
    paddingVertical: 12, borderRadius: 12, alignItems: "center", marginBottom: 12,
  },
  wasteBtnTxt: { color: "#b45309", fontSize: 14, fontWeight: "800" },

  // Log Waste modal
  modalScrim: { flex: 1, backgroundColor: "rgba(15, 23, 42, 0.45)", justifyContent: "flex-end" },
  modalWrap: { width: "100%" },
  modalCard: {
    backgroundColor: "#fafafa", borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingHorizontal: 18, paddingTop: 16, paddingBottom: 28, maxHeight: "88%",
  },
  modalHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  modalTitle: { color: "#18181b", fontSize: 19, fontWeight: "900", letterSpacing: -0.3 },
  modalClose: { color: "#7c3aed", fontSize: 13, fontWeight: "800" },
  modalInput: {
    backgroundColor: "#fff", color: "#18181b", borderColor: "#e2e8f0", borderWidth: 1,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15,
  },
  modalQty: { fontSize: 22, fontWeight: "800", paddingVertical: 12 },
  resolveRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  resolveTxt: { color: "#64748b", fontSize: 12 },
  resolvedCard: {
    marginTop: 10, padding: 12, borderRadius: 10,
    backgroundColor: "#f5f3ff", borderColor: "#ddd6fe", borderWidth: 1,
  },
  resolvedName: { color: "#18181b", fontSize: 14, fontWeight: "800" },
  resolvedStock: { color: "#475569", fontSize: 13, marginTop: 6, fontWeight: "600" },
  resolvedStockVal: { color: "#7c3aed", fontWeight: "800", fontSize: 14 },
  reasonGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  reasonBtn: {
    width: "48%", backgroundColor: "#fff", borderColor: "#e2e8f0", borderWidth: 1,
    borderRadius: 10, padding: 10,
  },
  reasonBtnOn: { backgroundColor: "#f5f3ff", borderColor: "#7c3aed", borderWidth: 2 },
  reasonTxt: { color: "#18181b", fontSize: 13, fontWeight: "700" },
  reasonTxtOn: { color: "#5b21b6" },
  stageRow: { gap: 8, paddingBottom: 4 },
  stagePick: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12,
    backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2e8f0",
  },
  stagePickOn: { backgroundColor: "#7c3aed", borderColor: "#6d28d9" },
  stagePickTxt: { color: "#334155", fontSize: 13, fontWeight: "800" },
  stagePickTxtOn: { color: "#fff" },
  modalSave: {
    backgroundColor: "#7c3aed", paddingVertical: 14, borderRadius: 12, alignItems: "center", marginTop: 14,
    shadowColor: "#7c3aed", shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 4,
  },
  modalSaveTxt: { color: "#fff", fontSize: 16, fontWeight: "800" },
  mLabel: { marginTop: 14 },

  center: { padding: 40, alignItems: "center" },
  errBox: { backgroundColor: "#fef2f2", borderColor: "#fecaca", borderWidth: 1, borderRadius: 10, padding: 12 },
  errText: { color: "#b91c1c", fontSize: 13, fontWeight: "600" },
});
