/**
 * Item detail — LIGHT theme.
 *
 * Top bar with brand + back + menu; the scanned SKU under it; a glossy
 * white hero card showing the item name + a huge stock number in
 * purple; an orange-tinted variant when low-stock; a clean meta card
 * with the other fields; a "Scan another" primary CTA at the bottom.
 */
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { BrandMark } from "../../components/BrandMark";
import { LightBackground } from "../../components/LightBackground";
import { SideMenu } from "../../components/SideMenu";
import { getItemBySku, type Item } from "../../lib/api";

export default function ItemDetailScreen() {
  const { sku } = useLocalSearchParams<{ sku: string }>();
  const [item, setItem] = useState<Item | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!sku) return;
    setLoading(true);
    setErr(null);
    getItemBySku(sku)
      .then(setItem)
      .catch((e) => setErr(e?.message ?? "Lookup failed"))
      .finally(() => setLoading(false));
  }, [sku]);

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

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.scannedLabel}>Scanned</Text>
          <Text style={styles.skuText}>{sku}</Text>

          {loading && (
            <View style={styles.center}>
              <ActivityIndicator color="#7c3aed" />
            </View>
          )}

          {err && !loading && (
            <View style={styles.errBox}>
              <Text style={styles.errTitle}>Not found</Text>
              <Text style={styles.errBody}>{err}</Text>
            </View>
          )}

          {item && !loading && (
            <>
              {/* Hero card */}
              <View style={[styles.heroCard, item.is_low && styles.heroCardLow]}>
                <Text style={styles.itemName}>{item.sub_category ?? item.category}</Text>
                <Text style={styles.itemCode}>
                  {item.sub_category_code ?? item.category_code}
                  {item.size_label ? `  ·  ${item.size_label}` : ""}
                </Text>

                <View style={styles.stockRow}>
                  <Text style={[styles.stockValue, item.is_low && styles.stockValueLow]}>
                    {formatQty(item.on_hand)}
                  </Text>
                  <Text style={styles.stockUnit}>{item.stock_unit ?? "pcs"}</Text>
                </View>
                <Text style={styles.stockLabel}>ON HAND</Text>

                {item.is_low && (
                  <View style={styles.lowBadge}>
                    <View style={styles.lowDot} />
                    <Text style={styles.lowText}>Low stock — below threshold</Text>
                  </View>
                )}
              </View>

              {/* Meta card */}
              <View style={styles.metaCard}>
                <MetaRow label="Category" value={item.category} />
                <MetaRow label="Sub-category" value={item.sub_category ?? "—"} />
                <MetaRow label="Brand" value={item.brand ?? "—"} />
                <MetaRow label="Supplier" value={item.supplier ?? "—"} />
                <MetaRow
                  label="Opening"
                  value={`${formatQty(item.opening_stock)}${item.stock_unit ? " " + item.stock_unit : ""}`}
                />
                <MetaRow
                  label="Threshold"
                  value={
                    item.low_stock_threshold != null
                      ? `${formatQty(item.low_stock_threshold)}${item.stock_unit ? " " + item.stock_unit : ""}`
                      : "—"
                  }
                />
                <MetaRow label="Qty / label" value={String(item.qty_per_label)} />
                <MetaRow label="Model" value={item.model ?? "—"} />
                <MetaRow label="Source" value={item.source_label ?? "—"} last />
              </View>

              <Pressable
                onPress={() => router.back()}
                style={({ pressed }) => [styles.scanAgain, pressed && { opacity: 0.9 }]}
              >
                <ScanGlyph />
                <Text style={styles.scanAgainText}>Scan another</Text>
              </Pressable>
            </>
          )}
        </ScrollView>
      </SafeAreaView>

      <SideMenu visible={menuOpen} onClose={() => setMenuOpen(false)} />
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
function ScanGlyph() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M3 12h18" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}

function formatQty(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(3).replace(/\.?0+$/, "");
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
  brand: {
    color: "#18181b",
    fontSize: 14,
    fontWeight: "900",
    marginLeft: 8,
    letterSpacing: 2.2,
  },

  scannedLabel: {
    color: "#64748b",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginTop: 6,
  },
  skuText: {
    color: "#7c3aed",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 4,
    marginBottom: 18,
    fontFamily: Platform.OS === "web" ? "monospace" : undefined,
  },

  center: { padding: 40, alignItems: "center" },

  errBox: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
  },
  errTitle: { color: "#b91c1c", fontSize: 16, fontWeight: "800", marginBottom: 6 },
  errBody: { color: "#7f1d1d", fontSize: 13, lineHeight: 18 },

  heroCard: {
    backgroundColor: "#fff",
    borderColor: "#e4e4e7",
    borderWidth: 1,
    borderRadius: 18,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  heroCardLow: { borderColor: "#fcd34d", backgroundColor: "#fffbeb" },
  itemName: { color: "#18181b", fontSize: 22, fontWeight: "900", letterSpacing: -0.4 },
  itemCode: { color: "#64748b", fontSize: 12, marginTop: 4, fontWeight: "700" },
  stockRow: { marginTop: 18, flexDirection: "row", alignItems: "baseline", gap: 8 },
  stockValue: { color: "#7c3aed", fontSize: 46, fontWeight: "900", letterSpacing: -1.5 },
  stockValueLow: { color: "#b45309" },
  stockUnit: { color: "#475569", fontSize: 18, fontWeight: "800" },
  stockLabel: { color: "#94a3b8", fontSize: 10, letterSpacing: 1.5, marginTop: 2, fontWeight: "800" },
  lowBadge: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#fef3c7",
    borderColor: "#fcd34d",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  lowDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#d97706", marginRight: 6 },
  lowText: { color: "#92400e", fontSize: 11, fontWeight: "800" },

  metaCard: {
    backgroundColor: "#fff",
    borderColor: "#e2e8f0",
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    marginBottom: 18,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomColor: "#f1f5f9",
    borderBottomWidth: 1,
  },
  metaLabel: { color: "#64748b", fontSize: 13 },
  metaValue: { color: "#18181b", fontSize: 13, fontWeight: "700", maxWidth: "60%" },

  scanAgain: {
    backgroundColor: "#7c3aed",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: "#7c3aed",
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  scanAgainText: { color: "#fff", fontSize: 15, fontWeight: "800", letterSpacing: 0.3 },
});
