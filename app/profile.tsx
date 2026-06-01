/**
 * Profile screen — surfaces the signed-in user's full HR profile
 * (photo, manager, addresses, masked statutory IDs, salary structure
 * summary, contact + emergency contact) plus the existing
 * change-password card and sign-out flow.
 *
 * Data sources:
 *   - loadSession()       → user account (email, role)
 *   - loadWorkspace()     → API base URL
 *   - getMyEmployee()     → full Employee row from /employees/me
 *
 * The Employee row carries photo_url already resolved server-side
 * (S3 in prod, /uploads/* in dev), so we don't need to know about
 * the bucket layout on the client.
 */
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { BrandMark } from "../components/BrandMark";
import { LightBackground } from "../components/LightBackground";
import { SideMenu } from "../components/SideMenu";
import { changePassword, getMyEmployee, type Address, type Employee } from "../lib/api";
import { loadSession, logout, type AuthUser } from "../lib/auth";
import { loadWorkspace, type Workspace } from "../lib/workspace";

export default function ProfileScreen() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ws, setWs] = useState<Workspace | null>(null);
  const [emp, setEmp] = useState<Employee | null>(null);
  const [empErr, setEmpErr] = useState<string | null>(null);
  const [empLoading, setEmpLoading] = useState(true);
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

  // Re-fetch employee on focus so admin edits in the web app show up
  // when the user returns to this screen.
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      setEmpLoading(true);
      setEmpErr(null);
      getMyEmployee()
        .then((e) => { if (alive) setEmp(e); })
        .catch((e) => { if (alive) setEmpErr(e?.message ?? "Failed to load employee profile"); })
        .finally(() => { if (alive) setEmpLoading(false); });
      return () => { alive = false; };
    }, []),
  );

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
      setOldPw(""); setNewPw(""); setNewPw2("");
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
      { text: "Sign out", style: "destructive", onPress: async () => { await logout(); router.replace("/login"); } },
    ]);
  }

  return (
    <View style={styles.root}>
      <LightBackground />
      <SafeAreaView style={styles.safe}>
        <View style={styles.topBar}>
          <Pressable onPress={() => setMenuOpen(true)} hitSlop={12} style={styles.iconBtn}><MenuIcon /></Pressable>
          <View style={styles.brandRow}>
            <BrandMark size={26} />
            <Text style={styles.brand}>VINTRACT</Text>
          </View>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.iconBtn}><BackIcon /></Pressable>
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <View style={styles.head}>
              <Text style={styles.eyebrow}>Profile</Text>
              <Text style={styles.title}>Your account</Text>
            </View>

            {/* Hero card — photo + name + role pill + identity. Falls
                back to a coloured initials block when no photo is set. */}
            {user && (
              <View style={styles.heroCard}>
                <View style={styles.heroRow}>
                  <View style={styles.avatarWrap}>
                    {emp?.photo_url ? (
                      <Image source={{ uri: emp.photo_url }} style={styles.avatarImg} />
                    ) : (
                      <View style={styles.avatar}>
                        <Text style={styles.avatarInitial}>
                          {(emp?.full_name || user.name || user.email)[0].toUpperCase()}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.userName} numberOfLines={1}>
                      {emp?.full_name || user.name || user.email.split("@")[0]}
                    </Text>
                    {emp?.preferred_name && (
                      <Text style={styles.preferred}>"{emp.preferred_name}"</Text>
                    )}
                    <Text style={styles.userEmail} numberOfLines={1}>{user.email}</Text>
                    <View style={styles.pillRow}>
                      <View style={styles.rolePill}>
                        <Text style={styles.rolePillTxt}>{user.role.toUpperCase()}</Text>
                      </View>
                      {emp?.employee_code && (
                        <View style={styles.codePill}>
                          <Text style={styles.codePillTxt}>{emp.employee_code}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
                {emp && (emp.designation || emp.department) && (
                  <Text style={styles.heroSub}>
                    {emp.designation || "—"}{emp.department ? `  ·  ${emp.department}` : ""}
                  </Text>
                )}
              </View>
            )}

            {/* HR profile sections — only render when we have data */}
            {empLoading && (
              <View style={styles.skel}><ActivityIndicator color="#7c3aed" /></View>
            )}
            {empErr && !empLoading && (
              <View style={styles.warnBox}>
                <Text style={styles.warnTxt}>{empErr}</Text>
                <Text style={styles.warnSub}>
                  Your user account isn't linked to an HR profile yet. Ask admin to set it up
                  so you can see attendance, payslips and onboarding.
                </Text>
              </View>
            )}

            {emp && (
              <>
                <Section title="Employment">
                  <KV label="Status" value={titleCase(emp.status)} />
                  <KV label="Type" value={titleCase(emp.employment_type)} />
                  <KV label="Joined" value={fmtDate(emp.joined_at)} />
                  <KV label="Confirmation" value={fmtDate(emp.confirmation_date)} />
                  <KV label="Manager" value={emp.reporting_manager_name || "—"} />
                  <KV label="Work location" value={emp.work_location || "—"} />
                  <KV label="Shift" value={emp.shift_pattern || "—"} />
                </Section>

                <Section title="Contact">
                  <KV label="Phone" value={emp.phone || "—"} />
                  <KV label="Alt phone" value={emp.alt_phone || "—"} />
                  <KV label="Personal email" value={emp.personal_email || "—"} />
                </Section>

                {(emp.emergency_contact_name || emp.emergency_contact_phone) && (
                  <Section title="Emergency contact">
                    <KV label="Name" value={emp.emergency_contact_name || "—"} />
                    <KV label="Relation" value={emp.emergency_contact_relation || "—"} />
                    <KV label="Phone" value={emp.emergency_contact_phone || "—"} />
                  </Section>
                )}

                {emp.perm && hasAnyAddr(emp.perm) && (
                  <Section title="Permanent address">
                    <AddressBlock a={emp.perm} />
                  </Section>
                )}
                {emp.current && hasAnyAddr(emp.current) && (
                  <Section title="Current address">
                    <AddressBlock a={emp.current} />
                  </Section>
                )}

                <Section title="Statutory IDs">
                  <Note>
                    Bank account and Aadhaar numbers are encrypted at rest. We show
                    only the last 4 digits here.
                  </Note>
                  <KV label="PAN" value={emp.pan || "—"} mono />
                  <KV label="Aadhaar" value={emp.aadhaar_masked || "—"} mono />
                  <KV label="UAN" value={emp.uan || "—"} mono />
                  <KV label="ESIC" value={emp.esic_number || "—"} mono />
                </Section>

                {(emp.bank_name || emp.bank_account_masked) && (
                  <Section title="Salary account">
                    <KV label="Holder" value={emp.bank_holder_name || "—"} />
                    <KV label="Bank" value={emp.bank_name || "—"} />
                    <KV label="Branch" value={emp.bank_branch || "—"} />
                    <KV label="Account" value={emp.bank_account_masked || "—"} mono />
                    <KV label="IFSC" value={emp.bank_ifsc || "—"} mono />
                    <KV label="Type" value={titleCase(emp.bank_account_type) || "—"} />
                  </Section>
                )}

                <Section title="Compensation">
                  <KV label="Mode" value={titleCase(emp.compensation_mode)} />
                  {emp.monthly_ctc != null && (
                    <KV label="Monthly CTC" value={`₹${emp.monthly_ctc.toLocaleString("en-IN")}`} />
                  )}
                  {emp.hourly_rate != null && (
                    <KV label="Hourly rate" value={`₹${emp.hourly_rate.toLocaleString("en-IN")}`} />
                  )}
                  {emp.daily_rate != null && (
                    <KV label="Daily rate" value={`₹${emp.daily_rate.toLocaleString("en-IN")}`} />
                  )}
                  {(emp.basic_pct != null || emp.hra_pct != null) && (
                    <Text style={styles.salaryNote}>
                      Structure: Basic {emp.basic_pct ?? "—"}% · HRA {emp.hra_pct ?? "—"}% of basic
                    </Text>
                  )}
                </Section>
              </>
            )}

            {/* Workspace */}
            {ws && (
              <View style={styles.wsCard}>
                <Text style={styles.wsLabel}>Workspace</Text>
                <Text style={styles.wsName}>{ws.name}</Text>
                <Text style={styles.wsCode}>{ws.code}</Text>
                <Text style={styles.wsUrl} numberOfLines={1}>{ws.api_base}</Text>
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

// ----- small bits ---------------------------------------------------------

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function KV({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.kvRow}>
      <Text style={styles.kvLabel}>{label}</Text>
      <Text style={[styles.kvValue, mono && styles.kvMono]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <Text style={styles.noteTxt}>{children}</Text>;
}

function AddressBlock({ a }: { a: Address }) {
  const lines = [
    a.line1, a.line2,
    [a.city, a.state].filter(Boolean).join(", "),
    [a.pin, a.country].filter(Boolean).join(" · "),
  ].filter(s => s && String(s).trim() !== "");
  return (
    <View>
      {lines.map((l, i) => <Text key={i} style={styles.addrLine}>{l}</Text>)}
    </View>
  );
}

function hasAnyAddr(a: Address | null | undefined): boolean {
  if (!a) return false;
  return !!(a.line1 || a.line2 || a.city || a.state || a.pin || a.country);
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return s;
  }
}

function titleCase(s: string | null | undefined): string {
  if (!s) return "—";
  return s.split(/[_\s]/).filter(Boolean).map(p => p[0].toUpperCase() + p.slice(1).toLowerCase()).join(" ");
}

function Field({ label, value, onChangeText, secureTextEntry }:
  { label: string; value: string; onChangeText: (v: string) => void; secureTextEntry?: boolean; }) {
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
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 10,
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

  heroCard: {
    backgroundColor: "#fff", borderColor: "#ddd6fe", borderWidth: 1, borderRadius: 16,
    padding: 16, marginBottom: 12,
    shadowColor: "#7c3aed", shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 2,
  },
  heroRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  heroSub: { color: "#475569", fontSize: 12, marginTop: 10 },
  avatarWrap: { width: 64, height: 64, borderRadius: 32, overflow: "hidden", backgroundColor: "#f5f3ff" },
  avatarImg: { width: 64, height: 64 },
  avatar: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: "#7c3aed", alignItems: "center", justifyContent: "center",
  },
  avatarInitial: { color: "#fff", fontWeight: "900", fontSize: 24 },
  userName: { color: "#1f1235", fontSize: 18, fontWeight: "800" },
  preferred: { color: "#7c3aed", fontSize: 12, fontStyle: "italic", marginTop: 1 },
  userEmail: { color: "#64748b", fontSize: 12, marginTop: 2 },
  pillRow: { flexDirection: "row", gap: 6, marginTop: 8 },
  rolePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: "#f5f3ff", borderColor: "#ddd6fe", borderWidth: 1 },
  rolePillTxt: { color: "#6d28d9", fontSize: 10, fontWeight: "800", letterSpacing: 0.6 },
  codePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: "#fef3c7", borderColor: "#fde68a", borderWidth: 1 },
  codePillTxt: { color: "#a16207", fontSize: 10, fontWeight: "800", letterSpacing: 0.6 },

  sectionCard: {
    backgroundColor: "#fff", borderColor: "#e2e8f0", borderWidth: 1, borderRadius: 14,
    padding: 14, marginBottom: 12,
  },
  sectionTitle: { color: "#1f1235", fontSize: 13, fontWeight: "800", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.8 },
  kvRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  kvLabel: { color: "#64748b", fontSize: 12, fontWeight: "600", flex: 0.9 },
  kvValue: { color: "#1f1235", fontSize: 13, fontWeight: "700", flex: 1.1, textAlign: "right" },
  kvMono: { fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", fontSize: 12 },
  noteTxt: { color: "#92400e", backgroundColor: "#fef3c7", borderColor: "#fde68a", borderWidth: 1, padding: 8, borderRadius: 8, fontSize: 11, marginBottom: 8 },
  addrLine: { color: "#1f1235", fontSize: 13, lineHeight: 18 },
  salaryNote: { color: "#64748b", fontSize: 11, marginTop: 8, fontStyle: "italic" },

  skel: { backgroundColor: "#fff", borderColor: "#e2e8f0", borderWidth: 1, borderRadius: 14, padding: 24, alignItems: "center", marginBottom: 12 },
  warnBox: { backgroundColor: "#fef9c3", borderColor: "#fde68a", borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 12 },
  warnTxt: { color: "#854d0e", fontSize: 13, fontWeight: "700" },
  warnSub: { color: "#854d0e", fontSize: 11, marginTop: 4 },

  wsCard: {
    backgroundColor: "#fff", borderColor: "#e2e8f0", borderWidth: 1,
    borderRadius: 14, padding: 14, marginBottom: 12,
  },
  wsLabel: { color: "#64748b", fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.8 },
  wsName: { color: "#1f1235", fontSize: 15, fontWeight: "800", marginTop: 4 },
  wsCode: { color: "#7c3aed", fontSize: 12, marginTop: 2, fontWeight: "700" },
  wsUrl: { color: "#94a3b8", fontSize: 11, marginTop: 6 },

  card: {
    backgroundColor: "#fff", borderColor: "#e2e8f0", borderWidth: 1,
    borderRadius: 16, padding: 16, marginBottom: 14,
  },
  cardTitle: { color: "#1f1235", fontSize: 15, fontWeight: "800", marginBottom: 12 },
  field: { marginBottom: 12 },
  fieldLabel: { color: "#475569", fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 },
  input: {
    backgroundColor: "#f8fafc", color: "#1f1235",
    borderColor: "#e2e8f0", borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14,
  },
  errBox: { backgroundColor: "#fef2f2", borderColor: "#fecaca", borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 10 },
  errText: { color: "#b91c1c", fontSize: 13, fontWeight: "600" },
  okBox: { backgroundColor: "#ecfdf5", borderColor: "#a7f3d0", borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 10 },
  okText: { color: "#065f46", fontSize: 13, fontWeight: "700" },

  primary: { backgroundColor: "#7c3aed", paddingVertical: 12, borderRadius: 10, alignItems: "center", marginTop: 4 },
  primaryText: { color: "#fff", fontSize: 14, fontWeight: "800" },

  signOut: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    paddingVertical: 14, borderRadius: 12, backgroundColor: "#fff",
    borderColor: "#fecaca", borderWidth: 1,
  },
  signOutText: { color: "#dc2626", fontSize: 14, fontWeight: "800" },
});
