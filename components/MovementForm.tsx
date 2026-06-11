/**
 * Shared scan-then-qty form. Receive inward and Move to floor are the
 * same pattern (just a different `kind`). Caller passes label + colour
 * + the MovementKind to send, plus an optional onComplete callback so
 * the parent screen can decide what to do after a successful commit.
 *
 * Flow:
 * 1. User taps "Scan SKU" → goes to /scan with a return path; on
 *    successful scan they're brought back with the sku param set.
 * 2. Or they type the SKU manually.
 * 3. They enter qty + optional note.
 * 4. Hit save → POST /movements with the kind.
 * 5. On success, show a green confirmation and reset.
 */
import { useState } from "react";
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
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import Svg, { Path } from "react-native-svg";
import { BrandMark } from "./BrandMark";
import { LightBackground } from "./LightBackground";
import { SideMenu } from "./SideMenu";
import { createMovement, getItemBySku, parseQtyHint, type Item } from "../lib/api";
import { loadSession } from "../lib/auth";

export type MovementMode = {
  title: string;
  subtitle: string;
  kind: "INWARD" | "OUTWARD";
  primaryLabel: string;
  /** Accent colour for header + button — green for receive, amber for move. */
  accent: string;
  /** What the operator's stock change represents (used in success copy). */
  verb: string;
};

export function MovementScreen({
  mode,
  preSku,
}: {
  mode: MovementMode;
  preSku?: string;
}) {
  const [sku, setSku] = useState(preSku ?? "");
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");
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
      // Pull the `|Q<qty>` suffix BEFORE we send the code to the
      // backend lookup. Both sides know to strip it, but extracting it
      // here lets us auto-fill the qty field — saves the operator a
      // step on every receive.
      const raw = value.trim();
      const qtyHint = parseQtyHint(raw);
      const it = await getItemBySku(raw);
      setItem(it);
      setSku(it.sku_code);
      // Auto-fill the qty input ONLY when the field is currently empty.
      // If the operator already typed a qty (or edited it after a
      // previous scan), don't blow that away.
      if (qtyHint != null && !qty.trim()) {
        setQty(String(qtyHint));
      }
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
    const q = parseFloat(qty);
    if (!Number.isFinite(q) || q <= 0) {
      setErr("Quantity must be a positive number");
      return;
    }
    if (mode.kind === "OUTWARD" && item.on_hand < q) {
      Alert.alert(
        "Not enough stock",
        `On hand: ${item.on_hand} ${item.stock_unit ?? ""}\nMoving: ${q} ${item.stock_unit ?? ""}\n\nContinue anyway?`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Continue", onPress: () => doSubmit(q) },
        ],
      );
      return;
    }
    doSubmit(q);
  }

  async function doSubmit(q: number) {
    setSubmitting(true);
    try {
      const session = await loadSession();
      const operator = session?.user?.name || session?.user?.email;
      const mov = await createMovement({
        sku_code: item!.sku_code,
        qty: q,
        kind: mode.kind,
        operator,
        note: note.trim() || undefined,
      });
      setOk(
        `${mode.verb} ${q} ${item!.stock_unit ?? ""}. New balance: ${mov.balance_after} ${item!.stock_unit ?? ""}.`,
      );
      // reset
      setSku("");
      setQty("");
      setNote("");
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
        {/* Top bar */}
        <View style={styles.topBar}>
          <Pressable
            onPress={() => setMenuOpen(true)}
            hitSlop={12}
            style={styles.iconBtn}
            accessibilityLabel="Menu"
          >
            <MenuIcon />
          </Pressable>
          <View style={styles.brandRow}>
            <BrandMark size={26} />
            <Text style={styles.brand}>VINTRACT</Text>
          </View>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            style={styles.iconBtn}
            accessibilityLabel="Back"
          >
            <BackIcon />
          </Pressable>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.flex}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.head}>
              <Text style={[styles.eyebrow, { color: mode.accent }]}>Movement</Text>
              <Text style={styles.title}>{mode.title}</Text>
              <Text style={styles.sub}>{mode.subtitle}</Text>
            </View>

            {/* SKU input */}
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
                <Pressable
                  onPress={() => router.push("/scan")}
                  style={({ pressed }) => [styles.scanBtn, pressed && { opacity: 0.85 }]}
                >
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
                  <Text style={styles.resolvedMeta}>
                    {item.category_code}
                    {item.size_label ? ` · ${item.size_label}` : ""}
                  </Text>
                  <Text style={styles.resolvedStock}>
                    On hand: <Text style={styles.resolvedStockVal}>{item.on_hand}</Text>{" "}
                    {item.stock_unit ?? ""}
                  </Text>
                </View>
              )}
            </View>

            {/* Qty + Note */}
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
              <Text style={[styles.label, { marginTop: 14 }]}>Note (optional)</Text>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="e.g. PO #1234, batch X"
                placeholderTextColor="#a3a3a3"
                style={styles.input}
              />
            </View>

            {err && (
              <View style={styles.errBox}>
                <Text style={styles.errText}>{err}</Text>
              </View>
            )}
            {ok && (
              <View style={styles.okBox}>
                <Text style={styles.okText}>✓ {ok}</Text>
              </View>
            )}

            <Pressable
              onPress={submit}
              disabled={submitting}
              style={({ pressed }) => [
                styles.primary,
                { backgroundColor: mode.accent },
                (submitting || pressed) && { opacity: 0.85 },
              ]}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryText}>{mode.primaryLabel}</Text>
              )}
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <SideMenu visible={menuOpen} onClose={() => setMenuOpen(false)} />
    </View>
  );
}

// ---------- icons ---------- //
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
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  brandRow: { flexDirection: "row", alignItems: "center" },
  brand: { color: "#1f1235", fontSize: 14, fontWeight: "900", marginLeft: 8, letterSpacing: 2.2 },

  head: { marginTop: 8, marginBottom: 14, paddingHorizontal: 4 },
  eyebrow: { fontSize: 11, fontWeight: "800", letterSpacing: 1.5, textTransform: "uppercase" },
  title: { color: "#1f1235", fontSize: 26, fontWeight: "900", marginTop: 4, letterSpacing: -0.5 },
  sub: { color: "#64748b", fontSize: 13, marginTop: 4 },

  card: {
    backgroundColor: "#fff",
    borderColor: "#e2e8f0",
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
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
    shadowColor: "#7c3aed",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
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
  resolvedMeta: { color: "#64748b", fontSize: 11, marginTop: 2 },
  resolvedStock: { color: "#475569", fontSize: 13, marginTop: 6, fontWeight: "600" },
  resolvedStockVal: { color: "#7c3aed", fontWeight: "800", fontSize: 14 },

  errBox: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  errText: { color: "#b91c1c", fontSize: 13, fontWeight: "600" },

  okBox: {
    backgroundColor: "#ecfdf5",
    borderColor: "#a7f3d0",
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  okText: { color: "#065f46", fontSize: 13, fontWeight: "700" },

  primary: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 6,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  primaryText: { color: "#fff", fontSize: 16, fontWeight: "800", letterSpacing: 0.3 },
});
