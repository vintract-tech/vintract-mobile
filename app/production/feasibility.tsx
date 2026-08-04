/**
 * Quick Feasibility Check — "can we make N of product X by date D?"
 *
 * Pick a product from the catalog, enter a quantity (and optionally a
 * target date), and the backend explodes the BOM against the store —
 * reservation-aware, so material promised to other open orders does not
 * count. Verdict banner on top, short ingredients listed amber below.
 *
 * "Send For Production" turns the checked plan into a production order
 * submitted as `pending` — it lands in the managers' Approvals queue.
 */
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
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
  checkFeasibility,
  createProductionOrder,
  listProducts,
  type FeasibilityLine,
  type FeasibilityResult,
  type Product,
} from "../../lib/api";
import { hasPermission, loadSession, type AuthUser } from "../../lib/auth";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default function FeasibilityScreen() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const [query, setQuery] = useState("");
  const [product, setProduct] = useState<Product | null>(null);
  const [qty, setQty] = useState("");
  const [target, setTarget] = useState("");

  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<FeasibilityResult | null>(null);
  const [sending, setSending] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const [s, list] = await Promise.all([loadSession(), listProducts(undefined, true)]);
      setUser(s?.user ?? null);
      setProducts(list);
    } catch (e: any) {
      setErr(e?.message ?? "Failed To Load Products");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q),
    );
  }, [products, query]);

  function pickProduct(p: Product) {
    setProduct(p);
    setResult(null);
    if (p.bom_line_count === 0) {
      Alert.alert(
        "No BOM Configured",
        `${p.name} has no bill of materials — feasibility cannot be computed. Add ingredients on the web first.`,
      );
    }
  }

  async function onCheck() {
    if (!product) {
      Alert.alert("Pick A Product", "Choose which product to check first.");
      return;
    }
    const q = parseFloat(qty);
    if (!Number.isFinite(q) || q <= 0) {
      Alert.alert("Invalid Quantity", "Quantity must be a positive number.");
      return;
    }
    if (target.trim() && !DATE_RE.test(target.trim())) {
      Alert.alert("Invalid Date", "Target date must be YYYY-MM-DD.");
      return;
    }
    setChecking(true);
    setResult(null);
    try {
      const r = await checkFeasibility(product.code, q, target.trim() || undefined);
      setResult(r);
    } catch (e: any) {
      Alert.alert("Check Failed", e?.message ?? "Try again");
    } finally {
      setChecking(false);
    }
  }

  async function onSend() {
    if (!product || !result) return;
    setSending(true);
    try {
      const o = await createProductionOrder({
        product_name: product.name,
        product_id: product.id,
        qty_planned: result.qty,
        target_completion: target.trim() || undefined,
        status: "pending",
      });
      const isManager = hasPermission(user, "production.manage");
      Alert.alert(
        "Sent For Production",
        `${o.code} submitted${o.status === "pending" ? " for approval" : ""}.`,
        isManager
          ? [
              { text: "Done", style: "cancel" },
              { text: "Open Approvals", onPress: () => router.push("/production/approvals" as any) },
            ]
          : [{ text: "OK" }],
      );
      setResult(null);
      setQty("");
    } catch (e: any) {
      Alert.alert("Send Failed", e?.message ?? "Try again");
    } finally {
      setSending(false);
    }
  }

  const summary = result?.summary;

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
          <View style={styles.head}>
            <Text style={styles.eyebrow}>Operations</Text>
            <Text style={styles.title}>Feasibility Check</Text>
            <Text style={styles.sub}>Can we make it, and by when?</Text>
          </View>

          {err && (
            <View style={styles.errBox}><Text style={styles.errText}>{err}</Text></View>
          )}

          {/* Product picker */}
          <View style={styles.card}>
            <Text style={styles.label}>Product</Text>
            {product ? (
              <View style={styles.pickedRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.pickedName} numberOfLines={1}>{product.name}</Text>
                  <Text style={styles.pickedMeta}>
                    {product.code}
                    {product.size_label ? ` · ${product.size_label}` : ""}
                    {` · ${product.bom_line_count} BOM Line${product.bom_line_count === 1 ? "" : "s"}`}
                  </Text>
                </View>
                <Pressable
                  onPress={() => { setProduct(null); setResult(null); }}
                  hitSlop={10}
                  style={styles.changeBtn}
                >
                  <Text style={styles.changeBtnTxt}>Change</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search By Name Or Code…"
                  placeholderTextColor="#a3a3a3"
                  autoCorrect={false}
                  style={styles.input}
                />
                {loading && (
                  <View style={styles.center}><ActivityIndicator color="#7c3aed" /></View>
                )}
                {!loading && filtered.length === 0 && (
                  <Text style={styles.emptyTxt}>No Products Match.</Text>
                )}
                {filtered.slice(0, 30).map((p, i) => (
                  <Pressable
                    key={p.id}
                    onPress={() => pickProduct(p)}
                    style={({ pressed }) => [
                      styles.productRow,
                      i === Math.min(filtered.length, 30) - 1 && { borderBottomWidth: 0 },
                      pressed && { backgroundColor: "#f8fafc" },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.productName} numberOfLines={1}>{p.name}</Text>
                      <Text style={styles.productMeta}>
                        {p.code}{p.size_label ? ` · ${p.size_label}` : ""}
                      </Text>
                    </View>
                    <Text style={styles.productArrow}>›</Text>
                  </Pressable>
                ))}
              </>
            )}
          </View>

          {/* Qty + target date */}
          <View style={styles.card}>
            <Text style={styles.label}>
              Quantity{product?.unit_label ? ` (${product.unit_label})` : ""}
            </Text>
            <TextInput
              value={qty}
              onChangeText={(v) => { setQty(v); setResult(null); }}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor="#a3a3a3"
              style={[styles.input, styles.qtyInput]}
            />
            <Text style={[styles.label, { marginTop: 14 }]}>Target Date (Optional, YYYY-MM-DD)</Text>
            <TextInput
              value={target}
              onChangeText={(v) => { setTarget(v); setResult(null); }}
              placeholder="e.g. 2026-08-20"
              placeholderTextColor="#a3a3a3"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />
          </View>

          <Pressable
            onPress={onCheck}
            disabled={checking}
            style={({ pressed }) => [styles.checkBtn, (checking || pressed) && { opacity: 0.85 }]}
          >
            {checking ? <ActivityIndicator color="#fff" /> : <Text style={styles.checkBtnTxt}>Check Feasibility</Text>}
          </Pressable>

          {/* Verdict */}
          {result && summary && (
            <>
              <View
                style={[
                  styles.verdict,
                  summary.feasible ? styles.verdictOk : styles.verdictShort,
                ]}
              >
                <Text style={[styles.verdictTitle, { color: summary.feasible ? "#065f46" : "#92400e" }]}>
                  {summary.feasible
                    ? "Feasible — All Materials Available"
                    : `Short ${summary.short_count} Ingredient${summary.short_count === 1 ? "" : "s"}`}
                </Text>
                <Text style={[styles.verdictBody, { color: summary.feasible ? "#047857" : "#b45309" }]}>
                  Earliest Start: {formatDate(summary.earliest_start_date)}
                  {summary.on_time_for_target != null &&
                    ` · ${summary.on_time_for_target ? "On Time For Target" : "Misses Target Date"}`}
                  {summary.no_vendor_count > 0 &&
                    ` · ${summary.no_vendor_count} With No Vendor (Unknown)`}
                  {summary.total_cost != null &&
                    ` · Est. Cost ₹${Math.round(summary.total_cost).toLocaleString("en-IN")}`}
                </Text>
              </View>

              {/* Short lines first — they are the decision. */}
              <View style={styles.linesCard}>
                <Text style={styles.linesTitle}>Ingredients</Text>
                {[...result.lines]
                  .sort((a, b) => Number(b.shortage_qty > 0) - Number(a.shortage_qty > 0))
                  .map((l, i, arr) => (
                    <LineRow key={l.category_id} line={l} last={i === arr.length - 1} />
                  ))}
              </View>

              {hasPermission(user, "floor.operate", "production.manage") && (
                <Pressable
                  onPress={onSend}
                  disabled={sending}
                  style={({ pressed }) => [styles.sendBtn, (sending || pressed) && { opacity: 0.85 }]}
                >
                  {sending ? <ActivityIndicator color="#fff" /> : <Text style={styles.sendBtnTxt}>Send For Production</Text>}
                </Pressable>
              )}
            </>
          )}
        </Screen>
      </SafeAreaView>

      <SideMenu visible={menuOpen} onClose={() => setMenuOpen(false)} />
    </View>
  );
}

/** One exploded BOM line. Short rows tint amber and lead with the gap;
 *  the meta line shows the reservation-aware arithmetic. */
function LineRow({ line, last }: { line: FeasibilityLine; last?: boolean }) {
  const short = line.shortage_qty > 0;
  const unit = line.stock_unit ? ` ${line.stock_unit}` : "";
  return (
    <View style={[styles.lineRow, short && styles.lineRowShort, last && !short && { borderBottomWidth: 0 }]}>
      <View style={styles.lineTop}>
        <Text style={styles.lineName} numberOfLines={1}>
          {line.category_name ?? line.category_code ?? "Unknown Item"}
        </Text>
        {short ? (
          <Text style={styles.lineShortBadge}>Short {line.shortage_qty}{unit}</Text>
        ) : (
          <Text style={styles.lineOkBadge}>OK</Text>
        )}
      </View>
      <Text style={styles.lineMeta} numberOfLines={2}>
        Required {line.required_qty} · Available {line.available} (On Hand {line.on_hand} − Reserved Elsewhere {line.reserved_elsewhere})
      </Text>
      {short && (
        <Text style={styles.lineVendor} numberOfLines={1}>
          {line.primary_vendor ?? "No Vendor (Unknown)"}
          {line.lead_time_days != null ? ` · ${line.lead_time_days}d Lead` : ""}
          {` · Earliest ${formatDate(line.earliest_available_date)}`}
        </Text>
      )}
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
  eyebrow: { color: "#7c3aed", fontSize: 11, fontWeight: "800", letterSpacing: 1.5, textTransform: "uppercase" },
  title: { color: "#18181b", fontSize: 26, fontWeight: "900", marginTop: 4, letterSpacing: -0.5 },
  sub: { color: "#64748b", fontSize: 13, marginTop: 4 },

  card: {
    backgroundColor: "#fff", borderColor: "#e2e8f0", borderWidth: 1,
    borderRadius: 16, padding: 16, marginBottom: 12,
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  label: {
    color: "#475569", fontSize: 11, fontWeight: "800",
    textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8,
  },
  input: {
    backgroundColor: "#f8fafc", color: "#18181b", borderColor: "#e2e8f0", borderWidth: 1,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15,
  },
  qtyInput: { fontSize: 22, fontWeight: "800", paddingVertical: 12 },

  productRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 10, borderBottomColor: "#f1f5f9", borderBottomWidth: 1,
  },
  productName: { color: "#18181b", fontSize: 14, fontWeight: "700" },
  productMeta: { color: "#94a3b8", fontSize: 11, marginTop: 1 },
  productArrow: { color: "#cbd5e1", fontSize: 20, fontWeight: "700" },
  emptyTxt: { color: "#94a3b8", fontSize: 13, paddingVertical: 12 },

  pickedRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  pickedName: { color: "#18181b", fontSize: 15, fontWeight: "800" },
  pickedMeta: { color: "#64748b", fontSize: 11, marginTop: 2 },
  changeBtn: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10,
    backgroundColor: "#f5f3ff", borderWidth: 1, borderColor: "#ddd6fe",
  },
  changeBtnTxt: { color: "#5b21b6", fontSize: 12, fontWeight: "800" },

  checkBtn: {
    backgroundColor: "#7c3aed", paddingVertical: 14, borderRadius: 12, alignItems: "center", marginTop: 2, marginBottom: 12,
    shadowColor: "#7c3aed", shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 4,
  },
  checkBtnTxt: { color: "#fff", fontSize: 16, fontWeight: "800", letterSpacing: 0.3 },

  verdict: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 12 },
  verdictOk: { backgroundColor: "#ecfdf5", borderColor: "#a7f3d0" },
  verdictShort: { backgroundColor: "#fffbeb", borderColor: "#fde68a" },
  verdictTitle: { fontSize: 15, fontWeight: "900" },
  verdictBody: { fontSize: 12, fontWeight: "600", marginTop: 4, lineHeight: 17 },

  linesCard: {
    backgroundColor: "#fff", borderColor: "#e2e8f0", borderWidth: 1,
    borderRadius: 14, padding: 14, marginBottom: 12,
  },
  linesTitle: {
    color: "#475569", fontSize: 11, fontWeight: "800",
    textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4,
  },
  lineRow: { paddingVertical: 10, borderBottomColor: "#f1f5f9", borderBottomWidth: 1 },
  lineRowShort: {
    backgroundColor: "#fffbeb", borderColor: "#fde68a", borderWidth: 1,
    borderRadius: 10, paddingHorizontal: 10, marginVertical: 4, borderBottomWidth: 1,
  },
  lineTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  lineName: { flex: 1, color: "#18181b", fontSize: 13, fontWeight: "800" },
  lineShortBadge: { color: "#b45309", fontSize: 11, fontWeight: "800" },
  lineOkBadge: { color: "#059669", fontSize: 11, fontWeight: "800" },
  lineMeta: { color: "#64748b", fontSize: 11, marginTop: 3 },
  lineVendor: { color: "#b45309", fontSize: 11, fontWeight: "600", marginTop: 2 },

  sendBtn: {
    backgroundColor: "#059669", paddingVertical: 14, borderRadius: 12, alignItems: "center", marginTop: 2,
    shadowColor: "#059669", shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 4,
  },
  sendBtnTxt: { color: "#fff", fontSize: 16, fontWeight: "800", letterSpacing: 0.3 },

  center: { padding: 24, alignItems: "center" },
  errBox: { backgroundColor: "#fef2f2", borderColor: "#fecaca", borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 10 },
  errText: { color: "#b91c1c", fontSize: 13, fontWeight: "600" },
});
