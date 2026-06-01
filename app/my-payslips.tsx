import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { BrandMark } from "../components/BrandMark";
import { LightBackground } from "../components/LightBackground";
import { SideMenu } from "../components/SideMenu";
import { authToken, getMySlipPdfPath, listMySlips, type SalarySlip } from "../lib/api";

export default function MyPayslipsScreen() {
  const [slips, setSlips] = useState<SalarySlip[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    listMySlips()
      .then(setSlips)
      .catch(e => setErr(e?.message ?? "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

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
          <Text style={styles.eyebrow}>HR</Text>
          <Text style={styles.title}>My payslips</Text>
          <Text style={styles.sub}>Generated when your admin finalises a payroll run.</Text>
        </View>
        {loading && <View style={styles.center}><ActivityIndicator color="#7c3aed" /></View>}
        {err && <View style={styles.errBox}><Text style={styles.errText}>{err}</Text></View>}
        {!loading && !err && slips.length === 0 && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No payslips yet</Text>
            <Text style={styles.emptyBody}>Slips will appear here once your first payroll run is computed.</Text>
          </View>
        )}
        <FlatList
          data={slips}
          keyExtractor={s => String(s.id)}
          contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 30 }}
          renderItem={({ item }) => <SlipCard slip={item} />}
        />
      </SafeAreaView>
      <SideMenu visible={menuOpen} onClose={() => setMenuOpen(false)} />
    </View>
  );
}

function SlipCard({ slip }: { slip: SalarySlip }) {
  const month = new Date(slip.generated_at).toLocaleDateString(undefined, { month: "long", year: "numeric" });

  /**
   * Open the PDF version in the system browser. The PDF endpoint
   * accepts the JWT via ?token=… (see auth.get_current_user fallback)
   * because Linking.openURL can't carry an Authorization header.
   * Putting the JWT in the URL is acceptable here because (a) it's
   * short-lived, (b) the request goes straight to api.vintract.com
   * over TLS, and (c) the alternative — bundling expo-file-system /
   * expo-sharing native modules — adds complexity for a single button.
   */
  async function onDownloadPdf() {
    try {
      const [base, tok] = await Promise.all([getMySlipPdfPath(slip.id), authToken()]);
      if (!tok) {
        Alert.alert("Not signed in", "Please log in again.");
        return;
      }
      const url = `${base}?token=${encodeURIComponent(tok)}`;
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert("Can't open", "No app on this device can open the PDF link.");
        return;
      }
      await Linking.openURL(url);
    } catch (e: any) {
      Alert.alert("Failed", e?.message ?? "Could not open the PDF.");
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardHeadRow}>
        <Text style={styles.cardTitle}>{month}</Text>
        <Pressable
          onPress={onDownloadPdf}
          style={({ pressed }) => [styles.pdfBtn, pressed && { opacity: 0.85 }]}
          hitSlop={8}
        >
          <DownloadIcon />
          <Text style={styles.pdfBtnTxt}>PDF</Text>
        </Pressable>
      </View>
      <View style={styles.cardRow}><Text style={styles.label}>Gross</Text><Text style={styles.value}>₹{slip.gross.toLocaleString("en-IN")}</Text></View>
      <View style={styles.cardRow}><Text style={styles.label}>PF</Text><Text style={styles.valueDeduct}>−₹{slip.pf_employee.toLocaleString("en-IN")}</Text></View>
      <View style={styles.cardRow}><Text style={styles.label}>ESI</Text><Text style={styles.valueDeduct}>−₹{slip.esi_employee.toLocaleString("en-IN")}</Text></View>
      <View style={styles.cardRow}><Text style={styles.label}>Professional tax</Text><Text style={styles.valueDeduct}>−₹{slip.professional_tax.toLocaleString("en-IN")}</Text></View>
      <View style={styles.cardRow}><Text style={styles.label}>TDS</Text><Text style={styles.valueDeduct}>−₹{slip.tds.toLocaleString("en-IN")}</Text></View>
      <View style={[styles.cardRow, styles.netRow]}><Text style={styles.netLabel}>Net pay</Text><Text style={styles.netValue}>₹{slip.net.toLocaleString("en-IN")}</Text></View>
      <Text style={styles.meta}>{slip.days_present} days · {slip.hours_worked.toFixed(1)} hrs · slip #{slip.id}</Text>
    </View>
  );
}

function DownloadIcon() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3v12m0 0l-5-5m5 5l5-5M5 21h14" stroke="#7c3aed" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function MenuIcon() { return (<Svg width={20} height={20} viewBox="0 0 24 24" fill="none"><Path d="M4 6h16M4 12h16M4 18h16" stroke="#1f1235" strokeWidth={2.2} strokeLinecap="round" /></Svg>); }
function BackIcon() { return (<Svg width={16} height={16} viewBox="0 0 24 24" fill="none"><Path d="M19 12H5M12 19l-7-7 7-7" stroke="#1f1235" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" /></Svg>); }

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f6f5fb" },
  safe: { flex: 1 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 10 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2e8f0", alignItems: "center", justifyContent: "center" },
  brandRow: { flexDirection: "row", alignItems: "center" },
  brand: { color: "#1f1235", fontSize: 14, fontWeight: "900", marginLeft: 8, letterSpacing: 2.2 },
  head: { paddingHorizontal: 22, marginTop: 4, marginBottom: 14 },
  eyebrow: { color: "#7c3aed", fontSize: 11, fontWeight: "800", letterSpacing: 1.5, textTransform: "uppercase" },
  title: { color: "#1f1235", fontSize: 26, fontWeight: "900", marginTop: 4, letterSpacing: -0.5 },
  sub: { color: "#64748b", fontSize: 13, marginTop: 4 },
  center: { paddingVertical: 40, alignItems: "center" },
  errBox: { marginHorizontal: 18, padding: 12, backgroundColor: "#fef2f2", borderColor: "#fecaca", borderWidth: 1, borderRadius: 10 },
  errText: { color: "#b91c1c", fontSize: 13 },
  emptyCard: { marginHorizontal: 18, padding: 20, backgroundColor: "#fff", borderRadius: 14, borderColor: "#e2e8f0", borderWidth: 1 },
  emptyTitle: { color: "#1f1235", fontSize: 16, fontWeight: "800" },
  emptyBody: { color: "#64748b", fontSize: 13, marginTop: 6 },
  card: { backgroundColor: "#fff", borderRadius: 14, padding: 16, marginBottom: 12, borderColor: "#e2e8f0", borderWidth: 1 },
  cardHeadRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  cardTitle: { color: "#1f1235", fontSize: 16, fontWeight: "800" },
  pdfBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: "#f5f3ff", borderColor: "#ddd6fe", borderWidth: 1,
    borderRadius: 999,
  },
  pdfBtnTxt: { color: "#7c3aed", fontSize: 11, fontWeight: "900", letterSpacing: 0.5 },
  cardRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  label: { color: "#64748b", fontSize: 13 },
  value: { color: "#1f1235", fontSize: 13, fontWeight: "700" },
  valueDeduct: { color: "#94a3b8", fontSize: 13, fontWeight: "600" },
  netRow: { borderTopWidth: 1, borderTopColor: "#e2e8f0", marginTop: 6, paddingTop: 10 },
  netLabel: { color: "#1f1235", fontSize: 14, fontWeight: "900" },
  netValue: { color: "#7c3aed", fontSize: 18, fontWeight: "900" },
  meta: { color: "#94a3b8", fontSize: 11, marginTop: 8 },
});
