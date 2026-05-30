/**
 * Profile screen. Shows the signed-in user's info + workspace, with a
 * change-password card and a sign-out button.
 */
import { useEffect, useState } from "react";
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
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { BrandMark } from "../components/BrandMark";
import { LightBackground } from "../components/LightBackground";
import { SideMenu } from "../components/SideMenu";
import { changePassword } from "../lib/api";
import { loadSession, logout, type AuthUser } from "../lib/auth";
import { loadWorkspace, type Workspace } from "../lib/workspace";

export default function ProfileScreen() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ws, setWs] = useState<Workspace | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [newPw2, setNewPw2] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [s, w] = await Promise.all([loadSession(), loadWorkspace()]);
      setUser(s?.user ?? null);
      setWs(w);
    })();
  }, []);

  async function onChangePassword() {
    setErr(null);
    setOk(null);
    if (!oldPw || !newPw) {
      setErr("Current and new password are required");
      return;
    }
    if (newPw.length < 4) {
      setErr("New password must be at least 4 characters");
      return;
    }
    if (newPw !== newPw2) {
      setErr("New password and confirmation do not match");
      return;
    }
    setSubmitting(true);
    try {
      await changePassword(oldPw, newPw);
      setOldPw("");
      setNewPw("");
      setNewPw2("");
      setOk("Password updated.");
    } catch (e: any) {
      setErr(e?.message ?? "Could not change password");
    } finally {
      setSubmitting(false);
    }
  }

  async function onSignOut() {
    Alert.alert("Sign out?", "You will be returned to the login screen.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/login");
        },
      },
    ]);
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
              <Text style={styles.eyebrow}>Profile</Text>
              <Text style={styles.title}>Your account</Text>
            </View>

            {/* Identity */}
            {user && (
              <View style={styles.identityCard}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarInitial}>
                    {(user.name || user.email)[0].toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.userName}>{user.name || user.email.split("@")[0]}</Text>
                  <Text style={styles.userEmail}>{user.email}</Text>
                  <View style={styles.rolePill}>
                    <Text style={styles.rolePillTxt}>{user.role.toUpperCase()}</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Workspace */}
            {ws && (
              <View style={styles.wsCard}>
                <Text style={styles.wsLabel}>Workspace</Text>
                <Text style={styles.wsName}>{ws.name}</Text>
                <Text style={styles.wsCode}>{ws.code}</Text>
                <Text style={styles.wsUrl}>{ws.api_base}</Text>
              </View>
            )}

            {/* Change password */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Change password</Text>
              <Field label="Current password" value={oldPw} onChangeText={setOldPw} secureTextEntry />
              <Field label="New password" value={newPw} onChangeText={setNewPw} secureTextEntry />
              <Field label="Confirm new password" value={newPw2} onChangeText={setNewPw2} secureTextEntry />

              {err && <View style={styles.errBox}><Text style={styles.errText}>{err}</Text></View>}
              {ok && <View style={styles.okBox}><Text style={styles.okText}>✓ {ok}</Text></View>}

              <Pressable
                onPress={onChangePassword}
                disabled={submitting}
                style={({ pressed }) => [styles.primary, (submitting || pressed) && { opacity: 0.85 }]}
              >
                {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Update password</Text>}
              </Pressable>
            </View>

            <Pressable onPress={onSignOut} style={({ pressed }) => [styles.signOut, pressed && { opacity: 0.85 }]}>
              <SignOutIcon />
              <Text style={styles.signOutText}>Sign out</Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <SideMenu visible={menuOpen} onClose={() => setMenuOpen(false)} />
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  secureTextEntry,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  secureTextEntry?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        style={styles.input}
        autoCapitalize="none"
        autoCorrect={false}
        placeholderTextColor="#a3a3a3"
      />
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
function SignOutIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" stroke="#dc2626" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
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
  eyebrow: { color: "#7c3aed", fontSize: 11, fontWeight: "800", letterSpacing: 1.5, textTransform: "uppercase" },
  title: { color: "#1f1235", fontSize: 26, fontWeight: "900", marginTop: 4, letterSpacing: -0.5 },

  identityCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "#fff",
    borderColor: "#ddd6fe",
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#7c3aed",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  avatar: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: "#7c3aed", alignItems: "center", justifyContent: "center",
  },
  avatarInitial: { color: "#fff", fontWeight: "900", fontSize: 22 },
  userName: { color: "#1f1235", fontSize: 18, fontWeight: "800" },
  userEmail: { color: "#64748b", fontSize: 12, marginTop: 2 },
  rolePill: {
    marginTop: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "#f5f3ff",
    borderColor: "#ddd6fe",
    borderWidth: 1,
  },
  rolePillTxt: { color: "#6d28d9", fontSize: 10, fontWeight: "800", letterSpacing: 0.6 },

  wsCard: {
    backgroundColor: "#fff",
    borderColor: "#e2e8f0",
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  wsLabel: { color: "#64748b", fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.8 },
  wsName: { color: "#1f1235", fontSize: 15, fontWeight: "800", marginTop: 4 },
  wsCode: { color: "#7c3aed", fontSize: 12, marginTop: 2, fontWeight: "700" },
  wsUrl: { color: "#94a3b8", fontSize: 11, marginTop: 6 },

  card: {
    backgroundColor: "#fff",
    borderColor: "#e2e8f0",
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  cardTitle: { color: "#1f1235", fontSize: 15, fontWeight: "800", marginBottom: 12 },
  field: { marginBottom: 12 },
  fieldLabel: {
    color: "#475569",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#f8fafc",
    color: "#1f1235",
    borderColor: "#e2e8f0",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  errBox: { backgroundColor: "#fef2f2", borderColor: "#fecaca", borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 10 },
  errText: { color: "#b91c1c", fontSize: 13, fontWeight: "600" },
  okBox: { backgroundColor: "#ecfdf5", borderColor: "#a7f3d0", borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 10 },
  okText: { color: "#065f46", fontSize: 13, fontWeight: "700" },

  primary: {
    backgroundColor: "#7c3aed",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 4,
  },
  primaryText: { color: "#fff", fontSize: 14, fontWeight: "800" },

  signOut: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#fff",
    borderColor: "#fecaca",
    borderWidth: 1,
  },
  signOutText: { color: "#dc2626", fontSize: 14, fontWeight: "800" },
});
