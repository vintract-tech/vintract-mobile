/**
 * My onboarding — read-only checklist for the signed-in employee.
 * Shows the 15-item default template that gets instantiated when HR
 * creates an employee record (see onboarding_template_item seed in
 * migration 0026). Grouped by category so it's scannable. The user
 * can't toggle items here — that's an admin action in the web app.
 */
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { BrandMark } from "../components/BrandMark";
import { LightBackground } from "../components/LightBackground";
import { SideMenu } from "../components/SideMenu";
import { getMyOnboarding, type OnboardingItem, type OnboardingProgress } from "../lib/api";

const CATEGORY_LABELS: Record<string, string> = {
  documents: "Documents",
  verification: "Verification",
  assets: "Assets",
  access: "System access",
  training: "Training",
};

export default function MyOnboardingScreen() {
  const [data, setData] = useState<OnboardingProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      setLoading(true);
      setErr(null);
      getMyOnboarding()
        .then((d) => { if (alive) setData(d); })
        .catch((e) => { if (alive) setErr(e?.message ?? "Failed to load"); })
        .finally(() => { if (alive) setLoading(false); });
      return () => { alive = false; };
    }, []),
  );

  const pct = data && data.total > 0 ? Math.round((data.done / data.total) * 100) : 0;
  const grouped = data ? groupByCategory(data.items) : new Map<string, OnboardingItem[]>();

  return (
    <View style={styles.root}>
      <LightBackground />
      <SafeAreaView style={styles.safe}>
        <View style={styles.topBar}>
          <Pressable onPress={() => setMenuOpen(true)} hitSlop={12} style={styles.iconBtn}><MenuIcon /></Pressable>
          <View style={styles.brandRow}><BrandMark size={26} /><Text style={styles.brand}>VINTRACT</Text></View>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.iconBtn}><BackIcon /></Pressable>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
          <View style={styles.head}>
            <Text style={styles.eyebrow}>HR</Text>
            <Text style={styles.title}>My onboarding</Text>
          </View>

          {loading && <View style={styles.center}><ActivityIndicator color="#0d9488" /></View>}
          {err && <View style={styles.errBox}><Text style={styles.errText}>{err}</Text></View>}

          {data && (
            <>
              <View style={styles.summaryCard}>
                <View style={styles.summaryRow}>
                  <Text style={styles.pctValue}>{pct}%</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.summaryLabel}>Complete</Text>
                    <Text style={styles.summaryMeta}>
                      {data.done} done · {data.pending} pending · {data.skipped} skipped
                    </Text>
                  </View>
                </View>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${pct}%` }]} />
                </View>
              </View>

              {data.total === 0 && (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyTitle}>No checklist yet</Text>
                </View>
              )}

              {Array.from(grouped.entries()).map(([cat, items]) => (
                <View key={cat} style={styles.groupCard}>
                  <Text style={styles.groupTitle}>{CATEGORY_LABELS[cat] || cat || "Other"}</Text>
                  {items.map((it) => <ItemRow key={it.id} item={it} />)}
                </View>
              ))}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
      <SideMenu visible={menuOpen} onClose={() => setMenuOpen(false)} />
    </View>
  );
}

function ItemRow({ item }: { item: OnboardingItem }) {
  const isDone = item.status === "done";
  const isSkipped = item.status === "skipped";
  return (
    <View style={styles.itemRow}>
      <View style={[styles.tick, isDone && styles.tickDone, isSkipped && styles.tickSkipped]}>
        {isDone && <CheckIcon />}
        {isSkipped && <DashIcon />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.itemLabel, isDone && styles.itemDoneLabel, isSkipped && styles.itemSkippedLabel]} numberOfLines={2}>
          {item.label}
        </Text>
        {item.completed_at && (
          <Text style={styles.itemMeta}>
            Done {new Date(item.completed_at).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
          </Text>
        )}
        {item.notes && <Text style={styles.itemNotes} numberOfLines={3}>{item.notes}</Text>}
      </View>
    </View>
  );
}

function groupByCategory(items: OnboardingItem[]): Map<string, OnboardingItem[]> {
  const m = new Map<string, OnboardingItem[]>();
  const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order);
  for (const it of sorted) {
    const k = it.category || "other";
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(it);
  }
  return m;
}

function MenuIcon() { return (<Svg width={20} height={20} viewBox="0 0 24 24" fill="none"><Path d="M4 6h16M4 12h16M4 18h16" stroke="#18181b" strokeWidth={2.2} strokeLinecap="round" /></Svg>); }
function BackIcon() { return (<Svg width={16} height={16} viewBox="0 0 24 24" fill="none"><Path d="M19 12H5M12 19l-7-7 7-7" stroke="#18181b" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" /></Svg>); }
function CheckIcon() { return (<Svg width={12} height={12} viewBox="0 0 24 24" fill="none"><Path d="M5 12l5 5L20 7" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" /></Svg>); }
function DashIcon() { return (<Svg width={12} height={12} viewBox="0 0 24 24" fill="none"><Path d="M5 12h14" stroke="#fff" strokeWidth={3} strokeLinecap="round" /></Svg>); }

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fafafa" },
  safe: { flex: 1 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 10 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2e8f0", alignItems: "center", justifyContent: "center" },
  brandRow: { flexDirection: "row", alignItems: "center" },
  brand: { color: "#18181b", fontSize: 14, fontWeight: "900", marginLeft: 8, letterSpacing: 2.2 },
  head: { paddingHorizontal: 22, marginTop: 4, marginBottom: 14 },
  eyebrow: { color: "#0d9488", fontSize: 11, fontWeight: "800", letterSpacing: 1.5, textTransform: "uppercase" },
  title: { color: "#18181b", fontSize: 26, fontWeight: "900", marginTop: 4, letterSpacing: -0.5 },
  sub: { color: "#64748b", fontSize: 13, marginTop: 4 },
  center: { paddingVertical: 40, alignItems: "center" },
  errBox: { marginHorizontal: 18, padding: 12, backgroundColor: "#fef2f2", borderColor: "#fecaca", borderWidth: 1, borderRadius: 10 },
  errText: { color: "#b91c1c", fontSize: 13 },

  summaryCard: { marginHorizontal: 18, padding: 16, backgroundColor: "#fff", borderRadius: 14, borderColor: "#e4e4e7", borderWidth: 1, marginBottom: 12 },
  summaryRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  pctValue: { color: "#0d9488", fontSize: 36, fontWeight: "900" },
  summaryLabel: { color: "#18181b", fontSize: 14, fontWeight: "800" },
  summaryMeta: { color: "#64748b", fontSize: 11, marginTop: 4 },
  progressBar: { height: 8, backgroundColor: "#f1f5f9", borderRadius: 4, marginTop: 12, overflow: "hidden" },
  progressFill: { height: 8, backgroundColor: "#0d9488", borderRadius: 4 },

  emptyCard: { marginHorizontal: 18, padding: 20, backgroundColor: "#fff", borderRadius: 14, borderColor: "#e2e8f0", borderWidth: 1 },
  emptyTitle: { color: "#18181b", fontSize: 16, fontWeight: "800" },
  emptyBody: { color: "#64748b", fontSize: 13, marginTop: 6 },

  groupCard: { marginHorizontal: 18, padding: 14, backgroundColor: "#fff", borderRadius: 14, borderColor: "#e2e8f0", borderWidth: 1, marginBottom: 10 },
  groupTitle: { color: "#64748b", fontSize: 10, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 10 },
  itemRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  tick: { width: 20, height: 20, borderRadius: 10, backgroundColor: "#f1f5f9", alignItems: "center", justifyContent: "center", marginTop: 2 },
  tickDone: { backgroundColor: "#10b981" },
  tickSkipped: { backgroundColor: "#94a3b8" },
  itemLabel: { color: "#18181b", fontSize: 13, fontWeight: "700", lineHeight: 18 },
  itemDoneLabel: { color: "#475569", textDecorationLine: "line-through" },
  itemSkippedLabel: { color: "#94a3b8" },
  itemMeta: { color: "#10b981", fontSize: 10, fontWeight: "700", marginTop: 2 },
  itemNotes: { color: "#64748b", fontSize: 11, marginTop: 4, fontStyle: "italic" },
});
