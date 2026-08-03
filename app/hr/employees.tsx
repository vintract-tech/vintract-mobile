/**
 * Employees — managerial roster. Searchable list from GET /employees:
 * name, employee code, department, designation chip, active/terminated
 * badge. Tap a row → employee detail (profile + attendance + documents).
 */
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View,
} from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { BrandMark } from "../../components/BrandMark";
import { LightBackground } from "../../components/LightBackground";
import { SideMenu } from "../../components/SideMenu";
import { listEmployees, type Employee } from "../../lib/api";

export default function EmployeesScreen() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const load = useCallback((query: string) => {
    setLoading(true); setErr(null);
    listEmployees(query || undefined)
      .then(setRows)
      .catch((e) => setErr(e instanceof Error ? e.message : "Failed to load employees."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { const t = setTimeout(() => load(q), 350); return () => clearTimeout(t); }, [q, load]);

  const active = rows.filter((e) => e.status === "active").length;

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
          <Text style={styles.title}>Employees</Text>
          <Text style={styles.sub}>{rows.length} on record, {active} active.</Text>
        </View>

        <View style={styles.searchWrap}>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search Name, Code Or Department…"
            placeholderTextColor="#9ca3af"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.search}
          />
        </View>

        {loading && <View style={styles.center}><ActivityIndicator color="#0d9488" /></View>}
        {err && !loading && <View style={styles.errBox}><Text style={styles.errText}>{err}</Text></View>}

        {!loading && !err && (
          <FlatList
            data={rows}
            keyExtractor={(e) => String(e.id)}
            contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 30 }}
            ListEmptyComponent={<Text style={styles.empty}>No Employees Found</Text>}
            renderItem={({ item }) => <EmployeeRow emp={item} />}
          />
        )}
      </SafeAreaView>
      <SideMenu visible={menuOpen} onClose={() => setMenuOpen(false)} />
    </View>
  );
}

function EmployeeRow({ emp }: { emp: Employee }) {
  const terminated = emp.status === "terminated";
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/hr/employee/[id]", params: { id: String(emp.id) } })}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}
    >
      <View style={styles.cardHead}>
        <View style={{ flex: 1, minWidth: 0, paddingRight: 10 }}>
          <Text style={styles.name} numberOfLines={1}>{emp.full_name}</Text>
          <Text style={styles.code}>{emp.employee_code}{emp.department ? ` · ${emp.department}` : ""}</Text>
        </View>
        <View style={[styles.statusPill, terminated ? styles.statusPillOff : styles.statusPillOn]}>
          <Text style={[styles.statusPillTxt, terminated ? styles.statusPillTxtOff : styles.statusPillTxtOn]}>
            {terminated ? "Terminated" : "Active"}
          </Text>
        </View>
      </View>
      {emp.designation && (
        <View style={styles.roleChip}>
          <Text style={styles.roleChipTxt}>{emp.designation}</Text>
        </View>
      )}
    </Pressable>
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
  head: { paddingHorizontal: 22, marginTop: 4, marginBottom: 10 },
  eyebrow: { color: "#0d9488", fontSize: 11, fontWeight: "800", letterSpacing: 1.5, textTransform: "uppercase" },
  title: { color: "#18181b", fontSize: 26, fontWeight: "900", marginTop: 4, letterSpacing: -0.5 },
  sub: { color: "#64748b", fontSize: 13, marginTop: 4 },
  searchWrap: { paddingHorizontal: 18, paddingBottom: 10 },
  search: {
    backgroundColor: "#fff", borderWidth: 1, borderColor: "#e4e4e7", borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: "#18181b",
  },
  center: { paddingVertical: 40, alignItems: "center" },
  errBox: { marginHorizontal: 18, padding: 12, backgroundColor: "#fef2f2", borderColor: "#fecaca", borderWidth: 1, borderRadius: 10 },
  errText: { color: "#b91c1c", fontSize: 13 },
  empty: { color: "#64748b", textAlign: "center", marginTop: 32 },

  card: { backgroundColor: "#fff", borderRadius: 14, padding: 14, marginBottom: 10, borderColor: "#e2e8f0", borderWidth: 1 },
  cardHead: { flexDirection: "row", alignItems: "flex-start" },
  name: { color: "#18181b", fontSize: 15, fontWeight: "800" },
  code: { color: "#64748b", fontSize: 12, marginTop: 2 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  statusPillOn: { backgroundColor: "#ecfdf5", borderColor: "#a7f3d0" },
  statusPillOff: { backgroundColor: "#fef2f2", borderColor: "#fecaca" },
  statusPillTxt: { fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.6 },
  statusPillTxtOn: { color: "#065f46" },
  statusPillTxtOff: { color: "#b91c1c" },
  roleChip: {
    alignSelf: "flex-start", marginTop: 8, paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 999, backgroundColor: "#eef2ff", borderWidth: 1, borderColor: "#c7d2fe",
  },
  roleChipTxt: { color: "#3730a3", fontSize: 11, fontWeight: "700" },
});
