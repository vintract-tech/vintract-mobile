/**
 * Inventory list — browse all SKUs with live stock, searchable. Tap a row
 * to open the item detail (same screen the scanner lands on).
 */
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View,
} from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { LightBackground } from "../components/LightBackground";
import { listItems, type Item } from "../lib/api";

export default function InventoryScreen() {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback((query: string) => {
    setLoading(true); setError(null);
    listItems(query)
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load inventory."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { const t = setTimeout(() => load(q), 350); return () => clearTimeout(t); }, [q, load]);

  return (
    <View style={styles.root}>
      <LightBackground />
      <SafeAreaView style={styles.safe}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn} accessibilityLabel="Back">
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path d="M15 18l-6-6 6-6" stroke="#18181b" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Pressable>
          <Text style={styles.title}>Inventory</Text>
          <View style={{ width: 36 }} />
        </View>

        <View style={styles.searchWrap}>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search SKU or name…"
            placeholderTextColor="#9ca3af"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.search}
          />
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 28 }} color="#0d9488" size="large" />
        ) : error ? (
          <Text style={styles.err}>{error}</Text>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(it) => String(it.id)}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
            ListEmptyComponent={<Text style={styles.empty}>No items found.</Text>}
            renderItem={({ item }) => {
              const desc = [item.category, item.sub_category, item.model].filter(Boolean).join(" · ");
              return (
                <Pressable
                  onPress={() => router.push({ pathname: "/item/[sku]", params: { sku: item.sku_code } })}
                  style={({ pressed }) => [styles.row, pressed && { opacity: 0.9 }]}
                >
                  <View style={{ flex: 1, minWidth: 0, paddingRight: 10 }}>
                    <Text style={styles.sku} numberOfLines={1}>{item.sku_code}</Text>
                    {!!desc && <Text style={styles.desc} numberOfLines={1}>{desc}</Text>}
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={[styles.qty, item.is_low && { color: "#b45309" }]}>
                      {item.on_hand}{item.stock_unit ? ` ${item.stock_unit}` : ""}
                    </Text>
                    {item.is_low && <Text style={styles.low}>low stock</Text>}
                  </View>
                </Pressable>
              );
            }}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fafafa" },
  safe: { flex: 1 },
  topBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: "#fff",
    borderWidth: 1, borderColor: "#e2e8f0", alignItems: "center", justifyContent: "center",
  },
  title: { fontSize: 18, fontWeight: "900", color: "#18181b", letterSpacing: -0.3 },
  searchWrap: { paddingHorizontal: 16, paddingBottom: 8 },
  search: {
    backgroundColor: "#fff", borderWidth: 1, borderColor: "#e4e4e7", borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: "#18181b",
  },
  row: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#fff",
    borderWidth: 1, borderColor: "#e4e4e7", borderRadius: 12, padding: 14, marginTop: 10,
  },
  sku: { fontSize: 15, fontWeight: "800", color: "#18181b", fontFamily: "monospace" },
  desc: { fontSize: 12, color: "#64748b", marginTop: 2 },
  qty: { fontSize: 16, fontWeight: "800", color: "#0f766e" },
  low: { fontSize: 10, fontWeight: "800", color: "#b45309", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 1 },
  err: { color: "#b91c1c", textAlign: "center", marginTop: 24, paddingHorizontal: 24 },
  empty: { color: "#64748b", textAlign: "center", marginTop: 32 },
});
