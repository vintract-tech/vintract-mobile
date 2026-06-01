/**
 * My documents — read-only list of HR documents on file for the
 * signed-in employee (PAN, Aadhaar copy, cheque leaf, offer letter,
 * marksheets, etc.). Operators can't upload from mobile; the admin
 * web app owns the upload flow because it needs camera/scanner +
 * larger inputs anyway.
 *
 * Tap a row to View — opens the file in the system browser. We append
 * `?token=` so the backend can authenticate without an Authorization
 * header (see /auth.get_current_user fallback).
 *
 * BUT: the document URL itself points to S3 directly (file_url) and
 * is NOT protected by our JWT — it's just an unguessable key under
 * the public uploads/ prefix. That matches how the web app shows
 * documents too. If we later want to gate document reads, we'd add a
 * /documents/{id}/download endpoint on the backend. For now: hand the
 * URL straight to Linking.openURL.
 */
import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { BrandMark } from "../components/BrandMark";
import { LightBackground } from "../components/LightBackground";
import { SideMenu } from "../components/SideMenu";
import { listMyDocuments, type EmployeeDoc } from "../lib/api";

// Human labels — keep in sync with backend DOC_TYPES in hr_sub.py.
const DOC_LABELS: Record<string, string> = {
  photo: "Photograph",
  pan: "PAN card",
  aadhaar: "Aadhaar",
  cheque: "Cancelled cheque",
  passport: "Passport",
  driving_licence: "Driving licence",
  offer_letter: "Offer letter",
  education_10th: "Class 10 marksheet",
  education_12th: "Class 12 marksheet",
  education_grad: "Graduation certificate",
  education_pg: "Post-graduation certificate",
  experience_letter: "Experience / relieving letter",
  contract: "Signed contract",
  other: "Other",
};

const STATUS_STYLE: Record<string, { bg: string; fg: string; border: string }> = {
  verified: { bg: "#ecfdf5", fg: "#065f46", border: "#a7f3d0" },
  pending:  { bg: "#fffbeb", fg: "#92400e", border: "#fde68a" },
  rejected: { bg: "#fef2f2", fg: "#b91c1c", border: "#fecaca" },
};

export default function MyDocumentsScreen() {
  const [docs, setDocs] = useState<EmployeeDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      setLoading(true);
      setErr(null);
      listMyDocuments()
        .then((d) => { if (alive) setDocs(d); })
        .catch((e) => { if (alive) setErr(e?.message ?? "Failed to load"); })
        .finally(() => { if (alive) setLoading(false); });
      return () => { alive = false; };
    }, []),
  );

  async function openDoc(doc: EmployeeDoc) {
    if (!doc.file_url) return;
    try {
      await Linking.openURL(doc.file_url);
    } catch {
      // swallow — best-effort
    }
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

        <View style={styles.head}>
          <Text style={styles.eyebrow}>HR</Text>
          <Text style={styles.title}>My documents</Text>
          <Text style={styles.sub}>What HR has on file for you. Tap a row to view.</Text>
        </View>

        {loading && <View style={styles.center}><ActivityIndicator color="#7c3aed" /></View>}
        {err && <View style={styles.errBox}><Text style={styles.errText}>{err}</Text></View>}

        {!loading && !err && docs.length === 0 && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No documents uploaded yet</Text>
            <Text style={styles.emptyBody}>
              Your admin will upload onboarding documents as they collect them. They'll show up here.
            </Text>
          </View>
        )}

        <FlatList
          data={docs}
          keyExtractor={(d) => String(d.id)}
          contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 30 }}
          renderItem={({ item }) => <DocRow doc={item} onPress={() => openDoc(item)} />}
        />
      </SafeAreaView>
      <SideMenu visible={menuOpen} onClose={() => setMenuOpen(false)} />
    </View>
  );
}

function DocRow({ doc, onPress }: { doc: EmployeeDoc; onPress: () => void }) {
  const label = DOC_LABELS[doc.doc_type] ?? doc.doc_type;
  const sStyle = STATUS_STYLE[doc.status] ?? STATUS_STYLE.pending;
  const uploaded = new Date(doc.uploaded_at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.92, transform: [{ scale: 0.997 }] }]}
    >
      <View style={styles.docIcon}>
        <DocIcon />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.docName} numberOfLines={1}>{label}</Text>
        <Text style={styles.docMeta} numberOfLines={1}>
          {doc.original_filename || doc.file_s3_key} · uploaded {uploaded}
        </Text>
        {doc.expiry_date && (
          <Text style={styles.docExpiry}>
            Expires {new Date(doc.expiry_date).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
          </Text>
        )}
      </View>
      <View style={[styles.statusPill, { backgroundColor: sStyle.bg, borderColor: sStyle.border }]}>
        <Text style={[styles.statusTxt, { color: sStyle.fg }]}>
          {doc.status.toUpperCase()}
        </Text>
      </View>
    </Pressable>
  );
}

function MenuIcon() { return (<Svg width={20} height={20} viewBox="0 0 24 24" fill="none"><Path d="M4 6h16M4 12h16M4 18h16" stroke="#1f1235" strokeWidth={2.2} strokeLinecap="round" /></Svg>); }
function BackIcon() { return (<Svg width={16} height={16} viewBox="0 0 24 24" fill="none"><Path d="M19 12H5M12 19l-7-7 7-7" stroke="#1f1235" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" /></Svg>); }
function DocIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6z" stroke="#7c3aed" strokeWidth={1.8} strokeLinejoin="round" />
      <Path d="M14 3v6h6M8 13h8M8 17h5" stroke="#7c3aed" strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

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
  row: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#fff", borderColor: "#e2e8f0", borderWidth: 1,
    borderRadius: 12, padding: 12, marginBottom: 10,
  },
  docIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: "#f5f3ff", alignItems: "center", justifyContent: "center" },
  docName: { color: "#1f1235", fontSize: 14, fontWeight: "800" },
  docMeta: { color: "#64748b", fontSize: 11, marginTop: 2 },
  docExpiry: { color: "#92400e", fontSize: 11, marginTop: 2, fontWeight: "700" },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: 1 },
  statusTxt: { fontSize: 9, fontWeight: "900", letterSpacing: 0.6 },
});
