/**
 * Approvals — the production manager's pending queue on the phone.
 *
 * List: every order sitting in `pending` (submitted by someone without
 * production.manage). Tap one → detail with the readiness report:
 * traffic-light checks, per-ingredient material position AFTER other
 * orders' reservations (short rows amber), and competing orders.
 *
 * Approve (with optional qty/priority/date adjustments, applied
 * atomically with the approval) or Reject (reason required). Shortages
 * present → an explicit "Approve With Shortages?" confirm first.
 */
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { BrandMark } from "../../components/BrandMark";
import { LightBackground } from "../../components/LightBackground";
import { Screen } from "../../components/Screen";
import { SideMenu } from "../../components/SideMenu";
import {
  approveProductionOrder,
  getOrderReadiness,
  getProductionOrders,
  rejectProductionOrder,
  type OrderReadiness,
  type ProductionOrder,
  type ReadinessCheck,
  type ReadinessIngredient,
} from "../../lib/api";
import { hasPermission, loadSession, type AuthUser } from "../../lib/auth";

const PRIORITIES = [
  { key: "low", label: "Low" },
  { key: "normal", label: "Normal" },
  { key: "high", label: "High" },
  { key: "urgent", label: "Urgent" },
] as const;
type Priority = (typeof PRIORITIES)[number]["key"];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default function ApprovalsScreen() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  // Detail state — selecting an order swaps the body to its readiness view.
  const [selected, setSelected] = useState<ProductionOrder | null>(null);
  const [readiness, setReadiness] = useState<OrderReadiness | null>(null);
  const [readinessErr, setReadinessErr] = useState<string | null>(null);

  // Manager adjustments (optional — prefilled from the request).
  const [adjQty, setAdjQty] = useState("");
  const [adjPriority, setAdjPriority] = useState<Priority>("normal");
  const [adjStart, setAdjStart] = useState("");
  const [adjTarget, setAdjTarget] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const [s, list] = await Promise.all([loadSession(), getProductionOrders("pending")]);
      setUser(s?.user ?? null);
      setOrders(list);
    } catch (e: any) {
      setErr(e?.message ?? "Failed To Load");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  function openOrder(o: ProductionOrder) {
    setSelected(o);
    setReadiness(null);
    setReadinessErr(null);
    setAdjQty(String(o.qty_planned));
    setAdjPriority((PRIORITIES.some((p) => p.key === o.priority) ? o.priority : "normal") as Priority);
    setAdjStart(o.planned_start ?? "");
    setAdjTarget(o.target_completion ?? "");
    getOrderReadiness(o.id)
      .then(setReadiness)
      .catch((e: any) => setReadinessErr(e?.message ?? "Readiness Check Failed"));
  }

  function backToList() {
    setSelected(null);
    setReadiness(null);
    setReadinessErr(null);
    refresh();
  }

  /** Only the fields the manager actually changed travel with the
   *  approval — an untouched form approves the order as requested. */
  function buildAdjustments(o: ProductionOrder) {
    const adj: Parameters<typeof approveProductionOrder>[1] = {};
    const q = parseFloat(adjQty);
    if (Number.isFinite(q) && q > 0 && q !== o.qty_planned) adj.qty_planned = q;
    if (adjPriority !== o.priority) adj.priority = adjPriority;
    if (adjStart.trim() && adjStart.trim() !== (o.planned_start ?? "")) adj.planned_start = adjStart.trim();
    if (adjTarget.trim() && adjTarget.trim() !== (o.target_completion ?? "")) adj.target_completion = adjTarget.trim();
    return adj;
  }

  function onApprove() {
    if (!selected) return;
    const q = parseFloat(adjQty);
    if (!Number.isFinite(q) || q <= 0) {
      Alert.alert("Invalid Quantity", "Planned quantity must be a positive number.");
      return;
    }
    for (const [label, v] of [["Planned Start", adjStart], ["Target Completion", adjTarget]] as const) {
      if (v.trim() && !DATE_RE.test(v.trim())) {
        Alert.alert("Invalid Date", `${label} must be YYYY-MM-DD.`);
        return;
      }
    }
    const shortages = (readiness?.ingredients ?? []).filter((i) => i.short > 0);
    if (shortages.length > 0) {
      const lines = shortages
        .map((i) => `• ${i.name}: Short ${i.short}${i.vendor ? ` (${i.vendor})` : ""}`)
        .join("\n");
      Alert.alert(
        "Approve With Shortages?",
        `${shortages.length} ingredient${shortages.length === 1 ? " is" : "s are"} short after other orders' reservations:\n\n${lines}`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Approve Anyway", style: "destructive", onPress: () => doApprove() },
        ],
      );
      return;
    }
    doApprove();
  }

  async function doApprove() {
    if (!selected) return;
    setSubmitting(true);
    try {
      const o = await approveProductionOrder(selected.id, buildAdjustments(selected));
      Alert.alert("Order Approved", `${o.code} is now on the plan.`);
      backToList();
    } catch (e: any) {
      Alert.alert("Approve Failed", e?.message ?? "Try again");
    } finally {
      setSubmitting(false);
    }
  }

  async function doReject(reason: string) {
    if (!selected) return;
    setSubmitting(true);
    try {
      const o = await rejectProductionOrder(selected.id, reason);
      setRejectOpen(false);
      Alert.alert("Order Rejected", `${o.code} was cancelled. The reason was added to its notes.`);
      backToList();
    } catch (e: any) {
      Alert.alert("Reject Failed", e?.message ?? "Try again");
    } finally {
      setSubmitting(false);
    }
  }

  const canManage = user == null || hasPermission(user, "production.manage");
  const shortCount = (readiness?.ingredients ?? []).filter((i) => i.short > 0).length;

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
          <Pressable
            onPress={() => (selected ? backToList() : router.back())}
            hitSlop={12}
            style={styles.iconBtn}
          >
            <BackIcon />
          </Pressable>
        </View>

        <Screen
          scroll
          contentContainerStyle={styles.scroll}
          refreshControl={
            selected ? undefined : (
              <RefreshControl refreshing={loading} onRefresh={refresh} tintColor="#7c3aed" />
            )
          }
        >
          {!canManage && (
            <View style={styles.errBox}>
              <Text style={styles.errText}>
                You need the Production Manage permission to review approvals.
              </Text>
            </View>
          )}

          {canManage && !selected && (
            <>
              <View style={styles.head}>
                <Text style={styles.eyebrow}>Operations</Text>
                <Text style={styles.title}>Approvals</Text>
                <Text style={styles.sub}>
                  {orders.length === 0
                    ? "No orders waiting."
                    : `${orders.length} order${orders.length === 1 ? "" : "s"} awaiting your decision.`}
                </Text>
              </View>

              {err && (
                <View style={styles.errBox}><Text style={styles.errText}>{err}</Text></View>
              )}

              {loading && orders.length === 0 && (
                <View style={styles.center}><ActivityIndicator color="#7c3aed" /></View>
              )}

              {!loading && !err && orders.length === 0 && (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyTitle}>All Clear</Text>
                  <Text style={styles.emptyBody}>
                    Orders submitted by the floor will queue here for your approval.
                  </Text>
                </View>
              )}

              {orders.map((o) => (
                <Pressable
                  key={o.id}
                  onPress={() => openOrder(o)}
                  style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}
                >
                  <View style={styles.cardHead}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardCode}>{o.code}</Text>
                      <Text style={styles.cardName} numberOfLines={1}>{o.product_name}</Text>
                    </View>
                    <View style={styles.pendingPill}>
                      <Text style={styles.pendingPillTxt}>Pending</Text>
                    </View>
                  </View>
                  <View style={styles.cardMetaRow}>
                    <Text style={styles.cardQty}>{o.qty_planned} Planned</Text>
                    <Text style={styles.cardDue}>
                      {o.target_completion ? `Due ${formatDate(o.target_completion)}` : "No Target Date"}
                      {" · "}{titleCase(o.priority)}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </>
          )}

          {canManage && selected && (
            <>
              <View style={styles.head}>
                <Text style={styles.eyebrow}>Pending Approval</Text>
                <Text style={styles.title}>{selected.code}</Text>
                <Text style={styles.sub} numberOfLines={2}>{selected.product_name}</Text>
              </View>

              {/* Order header */}
              <View style={styles.metaCard}>
                <MetaRow label="Requested Qty" value={String(selected.qty_planned)} />
                <MetaRow label="Priority" value={titleCase(selected.priority)} />
                <MetaRow label="Customer" value={selected.customer ?? "—"} />
                <MetaRow label="Target" value={selected.target_completion ?? "—"} />
                <MetaRow label="Requested On" value={formatDate(selected.created_at)} last={!selected.notes} />
                {selected.notes ? <MetaRow label="Notes" value={selected.notes} last /> : null}
              </View>

              {/* Readiness */}
              {!readiness && !readinessErr && (
                <View style={styles.center}><ActivityIndicator color="#7c3aed" /></View>
              )}
              {readinessErr && (
                <View style={styles.errBox}><Text style={styles.errText}>{readinessErr}</Text></View>
              )}

              {readiness && (
                <>
                  <View style={styles.blockCard}>
                    <Text style={styles.blockTitle}>Checks</Text>
                    {readiness.checks.map((c, i) => (
                      <CheckRow key={c.key} check={c} last={i === readiness.checks.length - 1} />
                    ))}
                    {readiness.earliest_start && (
                      <Text style={styles.earliestTxt}>
                        Earliest Feasible Start: {formatDate(readiness.earliest_start)}
                      </Text>
                    )}
                  </View>

                  {readiness.ingredients.length > 0 && (
                    <View style={styles.blockCard}>
                      <Text style={styles.blockTitle}>Ingredients</Text>
                      <View style={styles.ingHeadRow}>
                        <Text style={[styles.ingHeadTxt, { flex: 1 }]}>Item</Text>
                        <Text style={[styles.ingHeadTxt, styles.ingNum]}>Required</Text>
                        <Text style={[styles.ingHeadTxt, styles.ingNum]}>Available</Text>
                        <Text style={[styles.ingHeadTxt, styles.ingNum]}>Short</Text>
                      </View>
                      {readiness.ingredients.map((ing, i) => (
                        <IngredientRow
                          key={`${ing.sku_code ?? ing.name}-${i}`}
                          ing={ing}
                          last={i === readiness.ingredients.length - 1}
                        />
                      ))}
                    </View>
                  )}

                  {readiness.conflicts.length > 0 && (
                    <View style={styles.blockCard}>
                      <Text style={styles.blockTitle}>Competing Orders</Text>
                      {readiness.conflicts.map((c, i) => (
                        <View
                          key={c.order_code}
                          style={[styles.conflictRow, i === readiness.conflicts.length - 1 && { borderBottomWidth: 0 }]}
                        >
                          <View style={styles.conflictHead}>
                            <Text style={styles.conflictCode}>{c.order_code}</Text>
                            <Text style={styles.conflictDue}>
                              {c.target_completion ? `Due ${formatDate(c.target_completion)}` : "No Target Date"}
                            </Text>
                          </View>
                          <Text style={styles.conflictName} numberOfLines={1}>
                            {c.product_name} · {titleCase(c.status)}
                          </Text>
                          <Text style={styles.conflictSkus} numberOfLines={2}>
                            Claims {c.skus.map((s) => `${s.sku_code ?? "?"} × ${s.qty_reserved}`).join(", ")}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </>
              )}

              {/* Adjustments — optional, applied with the approval */}
              <View style={styles.blockCard}>
                <Text style={styles.blockTitle}>Adjustments (Optional)</Text>
                <Text style={styles.label}>Planned Qty</Text>
                <TextInput
                  value={adjQty}
                  onChangeText={setAdjQty}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor="#a3a3a3"
                  style={[styles.input, styles.qtyInput]}
                />
                <Text style={[styles.label, styles.gapTop]}>Priority</Text>
                <View style={styles.chipRow}>
                  {PRIORITIES.map((p) => {
                    const on = adjPriority === p.key;
                    return (
                      <Pressable
                        key={p.key}
                        onPress={() => setAdjPriority(p.key)}
                        style={[styles.chip, on && styles.chipOn]}
                      >
                        <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{p.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={[styles.label, styles.gapTop]}>Planned Start (YYYY-MM-DD)</Text>
                <TextInput
                  value={adjStart}
                  onChangeText={setAdjStart}
                  placeholder="Optional"
                  placeholderTextColor="#a3a3a3"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.input}
                />
                <Text style={[styles.label, styles.gapTop]}>Target Completion (YYYY-MM-DD)</Text>
                <TextInput
                  value={adjTarget}
                  onChangeText={setAdjTarget}
                  placeholder="Optional"
                  placeholderTextColor="#a3a3a3"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.input}
                />
              </View>

              <Pressable
                onPress={onApprove}
                disabled={submitting}
                style={({ pressed }) => [styles.approveBtn, (submitting || pressed) && { opacity: 0.85 }]}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.approveBtnTxt}>
                    {shortCount > 0 ? "Approve With Shortages…" : "Approve Order"}
                  </Text>
                )}
              </Pressable>
              <Pressable
                onPress={() => setRejectOpen(true)}
                disabled={submitting}
                style={({ pressed }) => [styles.rejectBtn, (submitting || pressed) && { opacity: 0.85 }]}
              >
                <Text style={styles.rejectBtnTxt}>Reject Order</Text>
              </Pressable>
            </>
          )}
        </Screen>
      </SafeAreaView>

      <SideMenu visible={menuOpen} onClose={() => setMenuOpen(false)} />

      <RejectModal
        visible={rejectOpen}
        submitting={submitting}
        onClose={() => setRejectOpen(false)}
        onReject={doReject}
      />
    </View>
  );
}

/** Reason is mandatory — a rejection without one teaches the requester
 *  nothing (the backend enforces min 3 chars too). */
function RejectModal({
  visible, submitting, onClose, onReject,
}: {
  visible: boolean;
  submitting: boolean;
  onClose: () => void;
  onReject: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalScrim}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>Reject Order</Text>
              <Pressable onPress={onClose} hitSlop={12}>
                <Text style={styles.modalClose}>Close</Text>
              </Pressable>
            </View>
            <Text style={styles.label}>Reason (Required)</Text>
            <TextInput
              value={reason}
              onChangeText={setReason}
              placeholder="Why is this order being rejected?"
              placeholderTextColor="#a3a3a3"
              multiline
              style={[styles.input, styles.reasonInput]}
            />
            <Pressable
              onPress={() => {
                if (reason.trim().length < 3) {
                  Alert.alert("Reason Required", "Give the requester at least a short reason.");
                  return;
                }
                onReject(reason.trim());
              }}
              disabled={submitting}
              style={({ pressed }) => [styles.modalReject, (submitting || pressed) && { opacity: 0.85 }]}
            >
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalRejectTxt}>Reject Order</Text>}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function CheckRow({ check, last }: { check: ReadinessCheck; last?: boolean }) {
  const tone = {
    ok: { glyph: "✓", fg: "#065f46", bg: "#ecfdf5", border: "#a7f3d0" },
    warn: { glyph: "!", fg: "#92400e", bg: "#fffbeb", border: "#fde68a" },
    error: { glyph: "✕", fg: "#b91c1c", bg: "#fef2f2", border: "#fecaca" },
  }[check.level];
  return (
    <View style={[styles.checkRow, last && { borderBottomWidth: 0 }]}>
      <View style={[styles.checkDot, { backgroundColor: tone.bg, borderColor: tone.border }]}>
        <Text style={[styles.checkGlyph, { color: tone.fg }]}>{tone.glyph}</Text>
      </View>
      <Text style={styles.checkMsg}>{check.message}</Text>
    </View>
  );
}

/** One BOM line of the readiness table. Short rows tint amber and show
 *  the sourcing hint (vendor + earliest date) underneath. */
function IngredientRow({ ing, last }: { ing: ReadinessIngredient; last?: boolean }) {
  const short = ing.short > 0;
  return (
    <View style={[styles.ingRow, short && styles.ingRowShort, last && !short && { borderBottomWidth: 0 }]}>
      <View style={styles.ingTopRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.ingName} numberOfLines={1}>{ing.name}</Text>
          {ing.sku_code && <Text style={styles.ingSku} numberOfLines={1}>{ing.sku_code}</Text>}
        </View>
        <Text style={[styles.ingVal, styles.ingNum]}>{ing.required}</Text>
        <Text style={[styles.ingVal, styles.ingNum, short && { color: "#b45309" }]}>{ing.available}</Text>
        <Text style={[styles.ingVal, styles.ingNum, short ? styles.ingShortVal : styles.ingZeroVal]}>
          {short ? ing.short : "—"}
        </Text>
      </View>
      <Text style={styles.ingMeta} numberOfLines={2}>
        On Hand {ing.on_hand} · Reserved Elsewhere {ing.reserved_elsewhere}
        {short
          ? ` · ${ing.vendor ?? "No Vendor (Unknown)"} · Earliest ${formatDate(ing.earliest)}`
          : ""}
      </Text>
    </View>
  );
}

function MetaRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.metaRow, last && { borderBottomWidth: 0 }]}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue} numberOfLines={3}>{value}</Text>
    </View>
  );
}

function titleCase(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
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

  head: { marginTop: 8, marginBottom: 14 },
  eyebrow: { color: "#c2410c", fontSize: 11, fontWeight: "800", letterSpacing: 1.5, textTransform: "uppercase" },
  title: { color: "#18181b", fontSize: 26, fontWeight: "900", marginTop: 4, letterSpacing: -0.5 },
  sub: { color: "#64748b", fontSize: 13, marginTop: 4 },

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
  cardMetaRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginTop: 10 },
  cardQty: { color: "#18181b", fontSize: 14, fontWeight: "800" },
  cardDue: { color: "#64748b", fontSize: 11 },

  pendingPill: {
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999,
    backgroundColor: "#fff7ed", borderWidth: 1, borderColor: "#fed7aa",
  },
  pendingPillTxt: { color: "#c2410c", fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.6 },

  metaCard: {
    backgroundColor: "#fff", borderColor: "#e2e8f0", borderWidth: 1,
    borderRadius: 14, paddingHorizontal: 14, marginBottom: 12,
  },
  metaRow: {
    flexDirection: "row", justifyContent: "space-between", gap: 12,
    paddingVertical: 10, borderBottomColor: "#f1f5f9", borderBottomWidth: 1,
  },
  metaLabel: { color: "#64748b", fontSize: 13 },
  metaValue: { color: "#18181b", fontSize: 13, fontWeight: "700", maxWidth: "62%", textAlign: "right" },

  blockCard: {
    backgroundColor: "#fff", borderColor: "#e2e8f0", borderWidth: 1,
    borderRadius: 14, padding: 14, marginBottom: 12,
  },
  blockTitle: {
    color: "#475569", fontSize: 11, fontWeight: "800",
    textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6,
  },

  checkRow: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    paddingVertical: 9, borderBottomColor: "#f1f5f9", borderBottomWidth: 1,
  },
  checkDot: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 1,
    alignItems: "center", justifyContent: "center", marginTop: 1,
  },
  checkGlyph: { fontSize: 12, fontWeight: "900" },
  checkMsg: { flex: 1, color: "#18181b", fontSize: 13, lineHeight: 18 },
  earliestTxt: { color: "#64748b", fontSize: 12, fontWeight: "700", marginTop: 8 },

  ingHeadRow: { flexDirection: "row", alignItems: "center", paddingBottom: 6 },
  ingHeadTxt: { color: "#94a3b8", fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
  ingNum: { width: 64, textAlign: "right" },
  ingRow: { paddingVertical: 9, borderBottomColor: "#f1f5f9", borderBottomWidth: 1 },
  ingRowShort: {
    backgroundColor: "#fffbeb", borderColor: "#fde68a", borderWidth: 1,
    borderRadius: 10, paddingHorizontal: 10, marginVertical: 4, borderBottomWidth: 1,
  },
  ingTopRow: { flexDirection: "row", alignItems: "center" },
  ingName: { color: "#18181b", fontSize: 13, fontWeight: "800" },
  ingSku: { color: "#94a3b8", fontSize: 10, fontWeight: "600", marginTop: 1 },
  ingVal: { color: "#18181b", fontSize: 13, fontWeight: "800" },
  ingShortVal: { color: "#b45309", fontWeight: "900" },
  ingZeroVal: { color: "#cbd5e1" },
  ingMeta: { color: "#94a3b8", fontSize: 11, marginTop: 4 },

  conflictRow: { paddingVertical: 10, borderBottomColor: "#f1f5f9", borderBottomWidth: 1 },
  conflictHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  conflictCode: { color: "#7c3aed", fontSize: 12, fontWeight: "800" },
  conflictDue: { color: "#b45309", fontSize: 11, fontWeight: "700" },
  conflictName: { color: "#18181b", fontSize: 13, fontWeight: "700", marginTop: 2 },
  conflictSkus: { color: "#64748b", fontSize: 11, marginTop: 3 },

  label: {
    color: "#475569", fontSize: 11, fontWeight: "800",
    textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8,
  },
  gapTop: { marginTop: 14 },
  input: {
    backgroundColor: "#f8fafc", color: "#18181b", borderColor: "#e2e8f0", borderWidth: 1,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15,
  },
  qtyInput: { fontSize: 22, fontWeight: "800", paddingVertical: 12 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12,
    backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2e8f0",
  },
  chipOn: { backgroundColor: "#7c3aed", borderColor: "#6d28d9" },
  chipTxt: { color: "#334155", fontSize: 13, fontWeight: "800" },
  chipTxtOn: { color: "#fff" },

  approveBtn: {
    backgroundColor: "#059669", paddingVertical: 14, borderRadius: 12, alignItems: "center", marginTop: 2,
    shadowColor: "#059669", shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 4,
  },
  approveBtnTxt: { color: "#fff", fontSize: 16, fontWeight: "800" },
  rejectBtn: {
    backgroundColor: "#fff", borderColor: "#fecaca", borderWidth: 1,
    paddingVertical: 13, borderRadius: 12, alignItems: "center", marginTop: 10,
  },
  rejectBtnTxt: { color: "#b91c1c", fontSize: 14, fontWeight: "800" },

  modalScrim: { flex: 1, backgroundColor: "rgba(15, 23, 42, 0.45)", justifyContent: "flex-end" },
  modalWrap: { width: "100%" },
  modalCard: {
    backgroundColor: "#fafafa", borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingHorizontal: 18, paddingTop: 16, paddingBottom: 28,
  },
  modalHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  modalTitle: { color: "#18181b", fontSize: 19, fontWeight: "900", letterSpacing: -0.3 },
  modalClose: { color: "#7c3aed", fontSize: 13, fontWeight: "800" },
  reasonInput: { minHeight: 72, textAlignVertical: "top", backgroundColor: "#fff" },
  modalReject: {
    backgroundColor: "#dc2626", paddingVertical: 14, borderRadius: 12, alignItems: "center", marginTop: 14,
    shadowColor: "#dc2626", shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 4,
  },
  modalRejectTxt: { color: "#fff", fontSize: 16, fontWeight: "800" },

  center: { padding: 40, alignItems: "center" },
  emptyCard: { padding: 20, backgroundColor: "#fff", borderRadius: 14, borderColor: "#e2e8f0", borderWidth: 1 },
  emptyTitle: { color: "#18181b", fontSize: 15, fontWeight: "800" },
  emptyBody: { color: "#64748b", fontSize: 13, marginTop: 4 },

  errBox: { backgroundColor: "#fef2f2", borderColor: "#fecaca", borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 10 },
  errText: { color: "#b91c1c", fontSize: 13, fontWeight: "600" },
});
