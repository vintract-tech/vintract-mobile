/**
 * Categories — native browse of the two-level taxonomy.
 *
 * Without a `code` param: the main categories with item counts. Tap one →
 * the same route pushed again with `code`, listing that category's items
 * with In Store / On Floor / Total. Tap an item → the existing item
 * detail screen (/item/[sku]) for movements and full stock context.
 */
import { useCallback, useState } from "react";
import {
  ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View,
} from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { BrandMark } from "../components/BrandMark";
import { LightBackground } from "../components/LightBackground";
import { SideMenu } from "../components/SideMenu";
import { getCategory, listCategories, type CategoryNode } from "../lib/api";

export default function CategoriesScreen() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const [mains, setMains] = useState<CategoryNode[]>([]);
  const [detail, setDetail] = useState<CategoryNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const refresh = useCallback(() => {
    setLoading(true);
    setErr(null);
    const p = code
      ? getCategory(code).then((c) => setDetail(c))
      : listCategories().then((rows) => setMains(rows));
    p.catch((e) => setErr(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [code]);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const items = detail?.children ?? [];

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
          <Text style={styles.eyebrow}>Inventory</Text>
          <Text style={styles.title}>{code ? (detail?.name ?? "Category") : "Categories"}</Text>
          <Text style={styles.sub}>
            {code
              ? `${items.length} item(s) in this category.`
              : `${mains.length} main categor${mains.length === 1 ? "y" : "ies"}.`}
          </Text>
        </View>

        {loading && <View style={styles.center}><ActivityIndicator color="#0d9488" /></View>}
        {err && !loading && <View style={styles.errBox}><Text style={styles.errText}>{err}</Text></View>}

        {!loading && !err && !code && (
          <FlatList
            data={mains}
            keyExtractor={(c) => String(c.id)}
            contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 30 }}
            ListEmptyComponent={<Text style={styles.empty}>No Categories Yet</Text>}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => router.push({ pathname: "/categories", params: { code: item.code } })}
                style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}
              >
                <View style={{ flex: 1, minWidth: 0, paddingRight: 10 }}>
                  <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.cardMeta}>{item.code} · {item.children.length} item(s)</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            )}
          />
        )}

        {!loading && !err && !!code && (
          <FlatList
            data={items}
            keyExtractor={(c) => String(c.id)}
            contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 30 }}
            ListEmptyComponent={<Text style={styles.empty}>No Items In This Category</Text>}
            renderItem={({ item }) => <ItemRow item={item} />}
          />
        )}
      </SafeAreaView>
      <SideMenu visible={menuOpen} onClose={() => setMenuOpen(false)} />
    </View>
  );
}

function ItemRow({ item }: { item: CategoryNode }) {
  const openDetail = () => {
    if (item.sku_code) {
      router.push({ pathname: "/item/[sku]", params: { sku: item.sku_code } });
    }
  };
  return (
    <Pressable
      onPress={openDetail}
      disabled={!item.sku_code}
      style={({ pressed }) => [styles.card, pressed && item.sku_code ? { opacity: 0.92 } : null]}
    >
      <View style={{ flex: 1 }}>
        <View style={styles.itemHead}>
          <View style={{ flex: 1, minWidth: 0, paddingRight: 10 }}>
            <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
            {item.sku_code && <Text style={styles.cardMeta}>{item.sku_code}</Text>}
          </View>
          {item.sku_code && <Text style={styles.chevron}>›</Text>}
        </View>
        <View style={styles.stockRow}>
          <StockCell label="In Store" value={item.on_hand} unit={item.stock_unit} />
          <StockCell label="On Floor" value={item.on_floor} unit={item.stock_unit} />
          <StockCell label="Total" value={item.total_qty} unit={item.stock_unit} strong />
        </View>
      </View>
    </Pressable>
  );
}

function StockCell({ label, value, unit, strong = false }: {
  label: string; value: number; unit: string | null; strong?: boolean;
}) {
  return (
    <View style={styles.stockCell}>
      <Text style={styles.stockLabel}>{label}</Text>
      <Text style={[styles.stockValue, strong && { color: "#0f766e" }]}>
        {value}{unit ? ` ${unit}` : ""}
      </Text>
    </View>
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
  head: { paddingHorizontal: 22, marginTop: 4, marginBottom: 12 },
  eyebrow: { color: "#0d9488", fontSize: 11, fontWeight: "800", letterSpacing: 1.5, textTransform: "uppercase" },
  title: { color: "#18181b", fontSize: 26, fontWeight: "900", marginTop: 4, letterSpacing: -0.5 },
  sub: { color: "#64748b", fontSize: 13, marginTop: 4 },
  center: { paddingVertical: 40, alignItems: "center" },
  errBox: { marginHorizontal: 18, padding: 12, backgroundColor: "#fef2f2", borderColor: "#fecaca", borderWidth: 1, borderRadius: 10 },
  errText: { color: "#b91c1c", fontSize: 13 },
  empty: { color: "#64748b", textAlign: "center", marginTop: 32 },

  card: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#fff",
    borderColor: "#e2e8f0", borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 10,
  },
  cardName: { color: "#18181b", fontSize: 15, fontWeight: "800" },
  cardMeta: { color: "#64748b", fontSize: 12, marginTop: 2 },
  chevron: { color: "#cbd5e1", fontSize: 22, fontWeight: "700" },
  itemHead: { flexDirection: "row", alignItems: "center" },
  stockRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  stockCell: { flex: 1, backgroundColor: "#f8fafc", borderRadius: 10, padding: 8 },
  stockLabel: { color: "#64748b", fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
  stockValue: { color: "#18181b", fontSize: 14, fontWeight: "800", marginTop: 2 },
});
