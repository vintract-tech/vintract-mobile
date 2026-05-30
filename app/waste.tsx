/**
 * Waste log — scan an SKU, pick a reason, enter qty + optional notes,
 * save. Backend decrements stock via an ADJUST movement so the ledger
 * stays the source of truth.
 */
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { BrandMark } from "../components/BrandMark";
import { LightBackground } from "../components/LightBackground";
import { SideMenu } from "../components/SideMenu";
import { getItemBySku, logWaste, type Item, type WasteReason } from "../lib/api";
import { loadSession } from "../lib/auth";

const REASONS: { key: WasteReason; label: string; sub: string }[] = [
  { key: "damaged",     label: "Damaged",     sub: "Physical damage in handling" },
  { key: "qc_reject",   label: "QC reject",   sub: "Failed quality check" },
  { key: "rework_scrap",label: "Rework scrap",sub: "Trimmed off during rework" },
  { key: "expired",     label: "Expired",     sub: "Past use-by date" },
  { key: "spoilage",    label: "Spoilage",    sub: "Environmental degradation" },
  { key: "other",       label: "Other",       sub: "Use note to explain" },
];

export default function WasteScreen() {
  const [sku, setSku] = useState("");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState<WasteReason | null>(null);
  const [notes, setNotes] = useState("");
  const [item, setItem] = useState<Item | null>(null);
  const [resolving, setResolving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

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

  async function submit() {
    setErr(null);
    setOk(null);
    if (!item) {
      setErr("Scan or type a valid SKU first");
      return;
    }
    if (!reason) {
      setErr("Pick a reason");
      return;
    }
    const q = parseFloat(qty);
    if (!Number.isFinite(q) || q <= 0) {
      setErr("Quantity must be a positive number");
      return;
    }
    setSubmitting(true);
    try {
      const session = await loadSession();
      const operator = session?.user?.name || session?.user?.email;
      const w = await logWaste({
        sku_code: item.sku_code,
        qty: q,
        reason,
        notes: notes.trim() || undefined,
        operator,
      });
      setOk(`Logged ${q} ${item.stock_unit ?? ""} as ${reason.replace("_", " ")}.`);
      setSku("");
      setQty("");
      setReason(null);
      setNotes("");
      setItem(null);
    } catch (e: any) {
      setErr(e?.message ?? "Save failed");
    } finally {
      setSubmitting(false);
    }
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
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <View style={styles.head}>
              <Text style={styles.eyebrow}>Operations</Text>
              <Text style={styles.title}>Log waste</Text>
              <Text style={styles.sub}>Record damage, QC rejects, scrap. Stock is decremented automatically.</Text>
            </View>

            {/* SKU */}
            <View style={styles.card}>
              <Text style={styles.label}>SKU</Text>
              <View style={styles.row}>
                <TextInput
                  value={sku}
                  onChangeText={setSku}
                  onBlur={() => resolveSku(sku)}
                  placeholder="Type or scan…"
                  placeholderTextColor="#a3a3a3"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  style={styles.input}
                  returnKeyType="search"
                  onSubmitEditing={() => resolveSku(sku)}
                />
                <Pressable onPress={() => router.push("/scan")} style={styles.scanBtn}>
                  <ScanGlyph />
                  <Text style={styles.scanBtnText}>Scan</Text>
                </Pressable>
              </View>
              {resolving && (
                <View style={styles.resolveRow}>
                  <ActivityIndicator color="#7c3aed" size="small" />
                  <Text style={styles.resolveTxt}>Looking up…</Text>
                </View>
              )}
              {item && (
                <View style={styles.resolvedCard}>
                  <Text style={styles.resolvedName}>{item.sub_category ?? item.category}</Text>
                  <Text style={styles.resolvedStock}>
                    On hand: <Text style={styles.resolvedStockVal}>{item.on_hand}</Text>{" "}
                    {item.stock_unit ?? ""}
                  </Text>
                </View>
              )}
            </View>

            {/* Reason */}
            <View style={styles.card}>
              <Text style={styles.label}>Reason</Text>
              <View style={styles.reasonGrid}>
                {REASONS.map((r) => {
                  const selected = reason === r.key;
                  return (
                    <Pressable
                      key={r.key}
                      onPress={() => setReason(r.key)}
                      style={[styles.reasonBtn, selected && styles.reasonBtnSelected]}
                    >
                      <Text style={[styles.reasonLabel, selected && styles.reasonLabelSel]}>{r.label}</Text>
                      <Text style={[styles.reasonSub, selected && styles.reasonSubSel]}>{r.sub}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Qty + notes */}
            <View style={styles.card}>
              <Text style={styles.label}>Quantity{item?.stock_unit ? ` (${item.stock_unit})` : ""}</Text>
              <TextInput
                value={qty}
                onChangeText={setQty}
                placeholder="0"
                placeholderTextColor="#a3a3a3"
                keyboardType="decimal-pad"
                style={[styles.input, styles.qtyInput]}
              />
              <Text style={[styles.label, { marginTop: 14 }]}>Notes</Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="What happened?"
                placeholderTextColor="#a3a3a3"
                style={styles.input}
              />
            </View>

            {err && <View style={styles.errBox}><Text style={styles.errText}>{err}</Text></View>}
            {ok && <View style={styles.okBox}><Text style={styles.okText}>✓ {ok}</Text></View>}

            <Pressable
              onPress={submit}
              disabled={submitting}
              style={({ pressed }) => [styles.primary, (submitting || pressed) && { opacity: 0.85 }]}
            >
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Save waste entry</Text>}
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <SideMenu visible={menuOpen} onClose={() => setMenuOpen(false)} />
    </View>
  );
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
function ScanGlyph() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M3 12h18" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" />
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

  head: { marginTop: 8, marginBottom: 14 },
  eyebrow: { color: "#dc2626", fontSize: 11, fontWeight: "800", letterSpacing: 1.5, textTransform: "uppercase" },
  title: { color: "#1f1235", fontSize: 26, fontWeight: "900", marginTop: 4, letterSpacing: -0.5 },
  sub: { color: "#64748b", fontSize: 13, marginTop: 4 },

  card: {
    backgroundColor: "#fff",
    borderColor: "#e2e8f0",
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  label: {
    color: "#475569",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  row: { flexDirection: "row", gap: 8 },
  input: {
    flex: 1,
    backgroundColor: "#f8fafc",
    color: "#1f1235",
    borderColor: "#e2e8f0",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  qtyInput: { fontSize: 22, fontWeight: "800", paddingVertical: 12 },
  scanBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    backgroundColor: "#7c3aed",
    borderRadius: 10,
  },
  scanBtnText: { color: "#fff", fontWeight: "800", fontSize: 13 },
  resolveRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  resolveTxt: { color: "#64748b", fontSize: 12 },
  resolvedCard: {
    marginTop: 10,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#f5f3ff",
    borderColor: "#ddd6fe",
    borderWidth: 1,
  },
  resolvedName: { color: "#1f1235", fontSize: 14, fontWeight: "800" },
  resolvedStock: { color: "#475569", fontSize: 13, marginTop: 6, fontWeight: "600" },
  resolvedStockVal: { color: "#7c3aed", fontWeight: "800", fontSize: 14 },

  reasonGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  reasonBtn: {
    width: "48%",
    backgroundColor: "#f8fafc",
    borderColor: "#e2e8f0",
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
  },
  reasonBtnSelected: { backgroundColor: "#fef2f2", borderColor: "#fca5a5", borderWidth: 2 },
  reasonLabel: { color: "#1f1235", fontSize: 13, fontWeight: "800" },
  reasonLabelSel: { color: "#b91c1c" },
  reasonSub: { color: "#94a3b8", fontSize: 11, marginTop: 2, lineHeight: 14 },
  reasonSubSel: { color: "#dc2626" },

  errBox: { backgroundColor: "#fef2f2", borderColor: "#fecaca", borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 10 },
  errText: { color: "#b91c1c", fontSize: 13, fontWeight: "600" },
  okBox: { backgroundColor: "#ecfdf5", borderColor: "#a7f3d0", borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 10 },
  okText: { color: "#065f46", fontSize: 13, fontWeight: "700" },

  primary: {
    backgroundColor: "#dc2626",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 6,
    shadowColor: "#dc2626",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  primaryText: { color: "#fff", fontSize: 16, fontWeight: "800", letterSpacing: 0.3 },
});
