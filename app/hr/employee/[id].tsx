/**
 * Employee detail — managerial view. Profile fields (NO salary — Ops
 * never shows compensation; that stays on web/payroll), this month's
 * attendance summary, and the document list with camera / file upload.
 *
 * Upload contract (backend hr_sub.upload_document): doc_type is a QUERY
 * param, the file is one multipart field named `file`. PDF/PNG/JPEG/WEBP
 * up to 10 MB. Upload needs `hr.manage`; the button hides without it.
 */
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { BrandMark } from "../../../components/BrandMark";
import { LightBackground } from "../../../components/LightBackground";
import { Screen } from "../../../components/Screen";
import { SideMenu } from "../../../components/SideMenu";
import { hasPermission, loadSession, type AuthUser } from "../../../lib/auth";
import {
  DOC_TYPES,
  getAttendanceSummary,
  getEmployee,
  listEmployeeDocuments,
  uploadEmployeeDocument,
  type AttendanceSummaryRow,
  type Employee,
  type EmployeeDoc,
} from "../../../lib/api";

function monthRange(): { from: string; to: string; label: string } {
  const now = new Date();
  const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const to = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const label = now.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  return { from, to, label };
}

export default function EmployeeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const employeeId = Number(id);

  const [user, setUser] = useState<AuthUser | null>(null);
  const [emp, setEmp] = useState<Employee | null>(null);
  const [summary, setSummary] = useState<AttendanceSummaryRow | null>(null);
  const [docs, setDocs] = useState<EmployeeDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [docType, setDocType] = useState<string>("other");
  const [uploading, setUploading] = useState(false);

  const month = monthRange();

  const refresh = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const [s, e, d] = await Promise.all([
        loadSession(),
        getEmployee(employeeId),
        listEmployeeDocuments(employeeId).catch(() => [] as EmployeeDoc[]),
      ]);
      setUser(s?.user ?? null);
      setEmp(e);
      setDocs(d);
      // Summary is company-wide per range; pick this employee's row.
      getAttendanceSummary(month.from, month.to)
        .then((rows) => setSummary(rows.find((r) => r.employee_id === employeeId) ?? null))
        .catch(() => {});
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId]);

  useFocusEffect(useCallback(() => { if (employeeId) refresh(); }, [employeeId, refresh]));

  const canUpload = hasPermission(user, "hr.manage");

  async function doUpload(file: { uri: string; name: string; mimeType: string }) {
    setUploading(true);
    try {
      const doc = await uploadEmployeeDocument(employeeId, docType, file);
      setDocs((prev) => [doc, ...prev]);
      setUploadOpen(false);
    } catch (e: any) {
      Alert.alert("Upload Failed", e?.message ?? "Try again.");
    } finally {
      setUploading(false);
    }
  }

  async function pickFromCamera() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Camera Permission", "Allow camera access to photograph documents.");
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8 });
    if (res.canceled || !res.assets?.length) return;
    const a = res.assets[0];
    await doUpload({
      uri: a.uri,
      name: a.fileName || `${docType}-${Date.now()}.jpg`,
      mimeType: a.mimeType || "image/jpeg",
    });
  }

  async function pickFromFiles() {
    const res = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "image/png", "image/jpeg", "image/webp"],
      copyToCacheDirectory: true,
    });
    if (res.canceled || !res.assets?.length) return;
    const a = res.assets[0];
    await doUpload({
      uri: a.uri,
      name: a.name || `${docType}-${Date.now()}`,
      mimeType: a.mimeType || "application/octet-stream",
    });
  }

  const terminated = emp?.status === "terminated";

  return (
    <View style={styles.root}>
      <LightBackground />
      <SafeAreaView style={styles.safe}>
        <View style={styles.topBar}>
          <Pressable onPress={() => setMenuOpen(true)} hitSlop={12} style={styles.iconBtn}><MenuIcon /></Pressable>
          <View style={styles.brandRow}><BrandMark size={26} /><Text style={styles.brand}>VINTRACT</Text></View>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.iconBtn}><BackIcon /></Pressable>
        </View>

        <Screen
          scroll
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={loading && !!emp} onRefresh={refresh} tintColor="#0d9488" />}
        >
          {loading && !emp && <View style={styles.center}><ActivityIndicator color="#0d9488" /></View>}
          {err && !loading && <View style={styles.errBox}><Text style={styles.errText}>{err}</Text></View>}

          {emp && !err && (
            <>
              <Text style={styles.eyebrow}>Employee</Text>
              <Text style={styles.title}>{emp.full_name}</Text>
              <View style={styles.subRow}>
                <Text style={styles.sub}>{emp.employee_code}</Text>
                <View style={[styles.statusPill, terminated ? styles.statusPillOff : styles.statusPillOn]}>
                  <Text style={[styles.statusPillTxt, terminated ? styles.statusPillTxtOff : styles.statusPillTxtOn]}>
                    {terminated ? "Terminated" : "Active"}
                  </Text>
                </View>
              </View>

              {/* Profile */}
              <Text style={styles.section}>Profile</Text>
              <View style={styles.metaCard}>
                <MetaRow label="Designation" value={emp.designation ?? "—"} />
                <MetaRow label="Department" value={emp.department ?? "—"} />
                <MetaRow label="Employment Type" value={pretty(emp.employment_type)} />
                <MetaRow label="Work Location" value={emp.work_location ?? "—"} />
                <MetaRow label="Joined" value={emp.joined_at ?? "—"} />
                <MetaRow label="Reporting Manager" value={emp.reporting_manager_name ?? "—"} />
                <MetaRow label="Phone" value={emp.phone ?? "—"} />
                <MetaRow label="Email" value={emp.personal_email ?? "—"} />
                <MetaRow label="Blood Group" value={emp.blood_group ?? "—"} />
                <MetaRow
                  label="Emergency Contact"
                  value={emp.emergency_contact_name
                    ? `${emp.emergency_contact_name}${emp.emergency_contact_phone ? ` · ${emp.emergency_contact_phone}` : ""}`
                    : "—"}
                  last
                />
              </View>

              {/* Attendance summary — current month */}
              <Text style={styles.section}>Attendance · {month.label}</Text>
              {summary ? (
                <View style={styles.statRow}>
                  <Stat label="Present" value={String(summary.days_present)} accent />
                  <Stat label="Late" value={String(summary.late_days)} />
                  <Stat label="Hours" value={summary.total_hours.toFixed(1)} />
                  <Stat label="OT Hrs" value={summary.overtime_hours.toFixed(1)} />
                </View>
              ) : (
                <View style={styles.emptyCard}><Text style={styles.emptyBody}>No attendance recorded this month.</Text></View>
              )}

              {/* Documents */}
              <View style={styles.docsHead}>
                <Text style={[styles.section, { marginTop: 0, marginBottom: 0 }]}>Documents</Text>
                {canUpload && (
                  <Pressable onPress={() => setUploadOpen(true)} style={({ pressed }) => [styles.uploadBtn, pressed && { opacity: 0.85 }]}>
                    <Text style={styles.uploadBtnTxt}>Upload Document</Text>
                  </Pressable>
                )}
              </View>
              {docs.length === 0 ? (
                <View style={styles.emptyCard}><Text style={styles.emptyBody}>No documents on file yet.</Text></View>
              ) : (
                docs.map((d) => <DocRow key={d.id} doc={d} />)
              )}
            </>
          )}
        </Screen>
      </SafeAreaView>

      {/* Upload sheet */}
      <Modal visible={uploadOpen} transparent animationType="slide" onRequestClose={() => setUploadOpen(false)}>
        <View style={styles.sheetBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => !uploading && setUploadOpen(false)} />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Upload Document</Text>
            <Text style={styles.sheetLabel}>Document Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {DOC_TYPES.map((t) => (
                <Pressable
                  key={t.key}
                  onPress={() => setDocType(t.key)}
                  style={[styles.chip, docType === t.key && styles.chipOn]}
                >
                  <Text style={[styles.chipTxt, docType === t.key && styles.chipTxtOn]}>{t.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
            {uploading ? (
              <View style={styles.center}><ActivityIndicator color="#0d9488" /></View>
            ) : (
              <View style={styles.sheetBtns}>
                <Pressable onPress={pickFromCamera} style={({ pressed }) => [styles.srcBtn, pressed && { opacity: 0.85 }]}>
                  <Text style={styles.srcBtnTxt}>Camera</Text>
                </Pressable>
                <Pressable onPress={pickFromFiles} style={({ pressed }) => [styles.srcBtn, pressed && { opacity: 0.85 }]}>
                  <Text style={styles.srcBtnTxt}>Choose File</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </Modal>

      <SideMenu visible={menuOpen} onClose={() => setMenuOpen(false)} />
    </View>
  );
}

function DocRow({ doc }: { doc: EmployeeDoc }) {
  const label = DOC_TYPES.find((t) => t.key === doc.doc_type)?.label ?? doc.doc_type;
  const verified = doc.status === "verified";
  return (
    <View style={styles.docCard}>
      <View style={{ flex: 1, minWidth: 0, paddingRight: 10 }}>
        <Text style={styles.docType}>{label}</Text>
        <Text style={styles.docMeta} numberOfLines={1}>
          {doc.original_filename ?? doc.file_s3_key}
          {doc.size_bytes ? ` · ${(doc.size_bytes / 1024).toFixed(0)} KB` : ""}
        </Text>
      </View>
      <View style={[styles.docPill, verified ? styles.docPillOk : styles.docPillPending]}>
        <Text style={[styles.docPillTxt, verified ? styles.docPillTxtOk : styles.docPillTxtPending]}>
          {verified ? "Verified" : "Pending"}
        </Text>
      </View>
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

function Stat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={[styles.statBox, accent && styles.statAccent]}>
      <Text style={[styles.statValue, accent && styles.statValueAccent]}>{value}</Text>
      <Text style={[styles.statLabel, accent && styles.statLabelAccent]}>{label}</Text>
    </View>
  );
}

function pretty(s: string): string {
  return s.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function MenuIcon() { return (<Svg width={20} height={20} viewBox="0 0 24 24" fill="none"><Path d="M4 6h16M4 12h16M4 18h16" stroke="#18181b" strokeWidth={2.2} strokeLinecap="round" /></Svg>); }
function BackIcon() { return (<Svg width={16} height={16} viewBox="0 0 24 24" fill="none"><Path d="M19 12H5M12 19l-7-7 7-7" stroke="#18181b" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" /></Svg>); }

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fafafa" },
  safe: { flex: 1 },
  scroll: { paddingHorizontal: 18 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 10 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2e8f0", alignItems: "center", justifyContent: "center" },
  brandRow: { flexDirection: "row", alignItems: "center" },
  brand: { color: "#18181b", fontSize: 14, fontWeight: "900", marginLeft: 8, letterSpacing: 2.2 },

  eyebrow: { color: "#0d9488", fontSize: 11, fontWeight: "800", letterSpacing: 1.5, textTransform: "uppercase", marginTop: 8 },
  title: { color: "#18181b", fontSize: 26, fontWeight: "900", marginTop: 4, letterSpacing: -0.5 },
  subRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 },
  sub: { color: "#64748b", fontSize: 13 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: 1 },
  statusPillOn: { backgroundColor: "#ecfdf5", borderColor: "#a7f3d0" },
  statusPillOff: { backgroundColor: "#fef2f2", borderColor: "#fecaca" },
  statusPillTxt: { fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.6 },
  statusPillTxtOn: { color: "#065f46" },
  statusPillTxtOff: { color: "#b91c1c" },

  section: {
    color: "#64748b", fontSize: 11, fontWeight: "800",
    textTransform: "uppercase", letterSpacing: 1.2, marginTop: 18, marginBottom: 8,
  },
  metaCard: { backgroundColor: "#fff", borderColor: "#e2e8f0", borderWidth: 1, borderRadius: 14, paddingHorizontal: 14 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomColor: "#f1f5f9", borderBottomWidth: 1 },
  metaLabel: { color: "#64748b", fontSize: 13 },
  metaValue: { color: "#18181b", fontSize: 13, fontWeight: "700", maxWidth: "60%" },

  statRow: { flexDirection: "row", gap: 8 },
  statBox: { flex: 1, backgroundColor: "#fff", borderColor: "#e2e8f0", borderWidth: 1, borderRadius: 12, padding: 12 },
  statAccent: { backgroundColor: "#0d9488", borderColor: "#0d9488" },
  statValue: { color: "#18181b", fontSize: 20, fontWeight: "900" },
  statValueAccent: { color: "#fff" },
  statLabel: { color: "#64748b", fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 2 },
  statLabelAccent: { color: "#99f6e4" },

  docsHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 18, marginBottom: 8 },
  uploadBtn: { backgroundColor: "#0d9488", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
  uploadBtnTxt: { color: "#fff", fontSize: 12, fontWeight: "800" },
  docCard: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#fff",
    borderColor: "#e2e8f0", borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 8,
  },
  docType: { color: "#18181b", fontSize: 14, fontWeight: "800" },
  docMeta: { color: "#94a3b8", fontSize: 11, marginTop: 2 },
  docPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: 1 },
  docPillOk: { backgroundColor: "#ecfdf5", borderColor: "#a7f3d0" },
  docPillPending: { backgroundColor: "#fffbeb", borderColor: "#fde68a" },
  docPillTxt: { fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.6 },
  docPillTxtOk: { color: "#065f46" },
  docPillTxtPending: { color: "#92400e" },

  emptyCard: { padding: 16, backgroundColor: "#fff", borderRadius: 12, borderColor: "#e2e8f0", borderWidth: 1 },
  emptyBody: { color: "#64748b", fontSize: 13 },
  center: { paddingVertical: 30, alignItems: "center" },
  errBox: { backgroundColor: "#fef2f2", borderColor: "#fecaca", borderWidth: 1, borderRadius: 10, padding: 12 },
  errText: { color: "#b91c1c", fontSize: 13 },

  sheetBackdrop: { flex: 1, backgroundColor: "rgba(15, 16, 30, 0.45)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#fff", borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingHorizontal: 18, paddingTop: 18, paddingBottom: 34,
  },
  sheetTitle: { color: "#18181b", fontSize: 18, fontWeight: "900" },
  sheetLabel: { color: "#64748b", fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.8, marginTop: 14, marginBottom: 8 },
  chipRow: { gap: 8, paddingBottom: 4 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
    backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#e2e8f0",
  },
  chipOn: { backgroundColor: "#ccfbf1", borderColor: "#0d9488" },
  chipTxt: { color: "#475569", fontSize: 13, fontWeight: "700" },
  chipTxtOn: { color: "#0f766e" },
  sheetBtns: { flexDirection: "row", gap: 10, marginTop: 16 },
  srcBtn: { flex: 1, backgroundColor: "#0d9488", paddingVertical: 13, borderRadius: 12, alignItems: "center" },
  srcBtnTxt: { color: "#fff", fontSize: 15, fontWeight: "800" },
});
