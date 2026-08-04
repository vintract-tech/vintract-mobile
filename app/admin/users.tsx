/**
 * Users — admin-only account management, kept deliberately minimal:
 * list accounts with role, toggle active, change role. No user creation
 * on mobile (that stays on the web where the temp-password flow lives).
 *
 * Backend guards (users.py) already refuse self-deactivation and
 * removing the last active admin; we just surface their error messages.
 */
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { BrandMark } from "../../components/BrandMark";
import { LightBackground } from "../../components/LightBackground";
import { Screen, useListBottomPadding } from "../../components/Screen";
import { SideMenu } from "../../components/SideMenu";
import { listRoles, listUsers, updateUser, type RoleDef, type UserAccount } from "../../lib/api";

export default function UsersScreen() {
  const [rows, setRows] = useState<UserAccount[]>([]);
  const [roles, setRoles] = useState<RoleDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [rolePickFor, setRolePickFor] = useState<UserAccount | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const listBottomPadding = useListBottomPadding();

  const refresh = useCallback(() => {
    setLoading(true);
    setErr(null);
    Promise.all([listUsers(), listRoles().catch(() => [] as RoleDef[])])
      .then(([u, r]) => { setRows(u); setRoles(r); })
      .catch((e) => setErr(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  async function patch(user: UserAccount, p: { role?: string; is_active?: boolean }) {
    setBusyId(user.id);
    try {
      const updated = await updateUser(user.id, p);
      setRows((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
    } catch (e: any) {
      Alert.alert("Update Failed", e?.message ?? "Try again.");
    } finally {
      setBusyId(null);
    }
  }

  function toggleActive(user: UserAccount) {
    const deactivating = user.is_active;
    Alert.alert(
      deactivating ? "Deactivate User?" : "Activate User?",
      `${user.email} will ${deactivating ? "no longer be able to sign in." : "be able to sign in again."}`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: deactivating ? "Deactivate" : "Activate",
          style: deactivating ? "destructive" : "default",
          onPress: () => patch(user, { is_active: !user.is_active }),
        },
      ],
    );
  }

  return (
    <View style={styles.root}>
      <LightBackground />
      <SafeAreaView style={styles.safe}>
        <View style={styles.topBar}>
          <Pressable onPress={() => setMenuOpen(true)} hitSlop={12} style={styles.iconBtn}><MenuIcon /></Pressable>
          <View style={styles.brandRow}><BrandMark size={26} /><Text style={styles.brand}>VINTRACT</Text></View>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.iconBtn}><BackIcon /></Pressable>
        </View>

        <Screen>
          <View style={styles.head}>
            <Text style={styles.eyebrow}>Admin</Text>
            <Text style={styles.title}>Users</Text>
            <Text style={styles.sub}>{rows.length} account(s). Create new users on the web app.</Text>
          </View>

          {loading && rows.length === 0 && <View style={styles.center}><ActivityIndicator color="#4f46e5" /></View>}
          {err && !loading && <View style={styles.errBox}><Text style={styles.errText}>{err}</Text></View>}

          {!err && !(loading && rows.length === 0) && (
          <FlatList
            data={rows}
            keyExtractor={(u) => String(u.id)}
            contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: listBottomPadding }}
            refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor="#4f46e5" />}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <View style={styles.cardHead}>
                  <View style={{ flex: 1, minWidth: 0, paddingRight: 10 }}>
                    <Text style={styles.name} numberOfLines={1}>{item.name || item.email.split("@")[0]}</Text>
                    <Text style={styles.email} numberOfLines={1}>{item.email}</Text>
                  </View>
                  {busyId === item.id ? (
                    <ActivityIndicator color="#4f46e5" />
                  ) : (
                    <Switch
                      value={item.is_active}
                      onValueChange={() => toggleActive(item)}
                      trackColor={{ false: "#e2e8f0", true: "#c7d2fe" }}
                      thumbColor={item.is_active ? "#4f46e5" : "#94a3b8"}
                    />
                  )}
                </View>
                <View style={styles.cardFoot}>
                  <Pressable
                    onPress={() => setRolePickFor(item)}
                    style={({ pressed }) => [styles.roleChip, pressed && { opacity: 0.85 }]}
                  >
                    <Text style={styles.roleChipTxt}>{item.role}</Text>
                    <Text style={styles.roleChipEdit}>Change Role</Text>
                  </Pressable>
                  {!item.is_active && (
                    <View style={styles.inactivePill}><Text style={styles.inactivePillTxt}>Inactive</Text></View>
                  )}
                </View>
              </View>
            )}
          />
          )}
        </Screen>
      </SafeAreaView>

      {/* Role picker */}
      <Modal
        visible={rolePickFor !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setRolePickFor(null)}
      >
        <View style={styles.sheetBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setRolePickFor(null)} />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Change Role</Text>
            <Text style={styles.sheetSub}>{rolePickFor?.email}</Text>
            {roles.length === 0 && <Text style={styles.sheetEmpty}>Could not load the role list.</Text>}
            {roles.map((r) => (
              <Pressable
                key={r.id}
                onPress={() => {
                  const u = rolePickFor;
                  setRolePickFor(null);
                  if (u && r.name !== u.role) patch(u, { role: r.name });
                }}
                style={({ pressed }) => [
                  styles.roleRow,
                  rolePickFor?.role === r.name && styles.roleRowOn,
                  pressed && { opacity: 0.9 },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.roleRowName}>{r.name}</Text>
                  {r.description ? <Text style={styles.roleRowDesc} numberOfLines={1}>{r.description}</Text> : null}
                </View>
                {rolePickFor?.role === r.name && <Text style={styles.roleRowTick}>✓</Text>}
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>

      <SideMenu visible={menuOpen} onClose={() => setMenuOpen(false)} />
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
  eyebrow: { color: "#4f46e5", fontSize: 11, fontWeight: "800", letterSpacing: 1.5, textTransform: "uppercase" },
  title: { color: "#18181b", fontSize: 26, fontWeight: "900", marginTop: 4, letterSpacing: -0.5 },
  sub: { color: "#64748b", fontSize: 13, marginTop: 4 },
  center: { paddingVertical: 40, alignItems: "center" },
  errBox: { marginHorizontal: 18, padding: 12, backgroundColor: "#fef2f2", borderColor: "#fecaca", borderWidth: 1, borderRadius: 10 },
  errText: { color: "#b91c1c", fontSize: 13 },

  card: { backgroundColor: "#fff", borderRadius: 14, padding: 14, marginBottom: 10, borderColor: "#e2e8f0", borderWidth: 1 },
  cardHead: { flexDirection: "row", alignItems: "center" },
  name: { color: "#18181b", fontSize: 15, fontWeight: "800" },
  email: { color: "#64748b", fontSize: 12, marginTop: 2 },
  cardFoot: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  roleChip: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#eef2ff", borderColor: "#c7d2fe", borderWidth: 1,
    borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5,
  },
  roleChipTxt: { color: "#3730a3", fontSize: 12, fontWeight: "800", textTransform: "capitalize" },
  roleChipEdit: { color: "#818cf8", fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
  inactivePill: { backgroundColor: "#f1f5f9", borderColor: "#cbd5e1", borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  inactivePillTxt: { color: "#475569", fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },

  sheetBackdrop: { flex: 1, backgroundColor: "rgba(15, 16, 30, 0.45)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#fff", borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingHorizontal: 18, paddingTop: 18, paddingBottom: 34,
  },
  sheetTitle: { color: "#18181b", fontSize: 18, fontWeight: "900" },
  sheetSub: { color: "#64748b", fontSize: 12, marginTop: 2, marginBottom: 12 },
  sheetEmpty: { color: "#64748b", fontSize: 13 },
  roleRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#f8fafc", borderColor: "#e2e8f0", borderWidth: 1,
    borderRadius: 12, padding: 12, marginBottom: 8,
  },
  roleRowOn: { borderColor: "#4f46e5", backgroundColor: "#eef2ff" },
  roleRowName: { color: "#18181b", fontSize: 14, fontWeight: "800", textTransform: "capitalize" },
  roleRowDesc: { color: "#64748b", fontSize: 11, marginTop: 2 },
  roleRowTick: { color: "#4f46e5", fontSize: 16, fontWeight: "900" },
});
