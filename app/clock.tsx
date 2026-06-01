/**
 * Clock-in / clock-out — scan the employee badge QR, server auto-toggles
 * IN/OUT based on the last event for that employee.
 */
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions, type BarcodeType } from "expo-camera";
import Svg, { Path } from "react-native-svg";
import { BrandMark } from "../components/BrandMark";
import { LightBackground } from "../components/LightBackground";
import { SideMenu } from "../components/SideMenu";
import { clockBadge, type ClockResult } from "../lib/api";

const BARCODE_TYPES: BarcodeType[] = ["qr", "code128", "datamatrix"];

export default function ClockScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [manual, setManual] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [last, setLast] = useState<ClockResult | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const handled = useRef(false);

  useFocusEffect(useCallback(() => { handled.current = false; setLast(null); setErr(null); }, []));

  async function submit(token: string) {
    if (handled.current || !token?.trim()) return;
    handled.current = true;
    setBusy(true); setErr(null);
    try {
      const res = await clockBadge(token.trim());
      setLast(res);
      // Re-arm after 4s so the same operator can scan another colleague.
      setTimeout(() => { handled.current = false; setLast(null); }, 4000);
    } catch (e: any) {
      setErr(e?.message ?? "Couldn't record clock event");
      setTimeout(() => { handled.current = false; }, 2000);
    } finally { setBusy(false); }
  }

  return (
    <View style={styles.root}>
      <LightBackground />
      <SafeAreaView style={styles.safe} edges={["bottom"]}>
        <View style={styles.topBar}>
          <Pressable onPress={() => setMenuOpen(true)} hitSlop={12} style={styles.iconBtn}><MenuIcon /></Pressable>
          <View style={styles.brandRow}>
            <BrandMark size={26} />
            <Text style={styles.brand}>VINTRACT</Text>
          </View>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.iconBtn}><BackIcon /></Pressable>
        </View>

        <View style={styles.head}>
          <Text style={styles.eyebrow}>Attendance</Text>
          <Text style={styles.title}>Clock in / out</Text>
          <Text style={styles.sub}>Scan your employee badge QR.</Text>
        </View>

        {/* Confirmation flash */}
        {last && (
          <View style={[styles.flash, last.event.event_type === "in" ? styles.flashIn : styles.flashOut]}>
            <Text style={styles.flashTitle}>{last.event.event_type === "in" ? "✓ Clocked IN" : "✓ Clocked OUT"}</Text>
            <Text style={styles.flashName}>{last.employee_name}</Text>
            <Text style={styles.flashMeta}>{last.employee_code} · {new Date(last.event.event_time).toLocaleTimeString()}</Text>
          </View>
        )}

        {err && <View style={styles.err}><Text style={styles.errText}>{err}</Text></View>}

        {/* Camera */}
        <View style={styles.viewerWrap}>
          {!permission ? (
            <View style={styles.viewer}><ActivityIndicator color="#7c3aed" /></View>
          ) : !permission.granted ? (
            <View style={[styles.viewer, styles.permWrap]}>
              <Text style={styles.permTitle}>Camera access</Text>
              <Text style={styles.permBody}>Allow the camera to scan badge QR codes.</Text>
              <Pressable onPress={requestPermission} style={styles.permBtn}>
                <Text style={styles.permBtnText}>Allow</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.viewer}>
              <CameraView
                style={StyleSheet.absoluteFill}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES }}
                onBarcodeScanned={({ data }) => submit(data)}
              />
              <View pointerEvents="none" style={styles.reticleWrap}>
                <View style={styles.reticle}>
                  <View style={[styles.corner, styles.cornerTL]} />
                  <View style={[styles.corner, styles.cornerTR]} />
                  <View style={[styles.corner, styles.cornerBL]} />
                  <View style={[styles.corner, styles.cornerBR]} />
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Manual fallback */}
        <View style={styles.manualCard}>
          <Text style={styles.manualLabel}>Or type badge token</Text>
          <View style={styles.manualRow}>
            <TextInput value={manual} onChangeText={setManual}
              placeholder="Badge token"
              placeholderTextColor="#a3a3a3"
              autoCapitalize="none" autoCorrect={false}
              style={styles.manualInput}
              onSubmitEditing={() => submit(manual)}
              returnKeyType="send" />
            <Pressable onPress={() => submit(manual)} disabled={busy} style={({ pressed }) => [styles.manualBtn, (busy || pressed) && { opacity: 0.85 }]}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.manualBtnText}>Clock</Text>}
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
      <SideMenu visible={menuOpen} onClose={() => setMenuOpen(false)} />
    </View>
  );
}

function MenuIcon() {
  return (<Svg width={20} height={20} viewBox="0 0 24 24" fill="none"><Path d="M4 6h16M4 12h16M4 18h16" stroke="#1f1235" strokeWidth={2.2} strokeLinecap="round" /></Svg>);
}
function BackIcon() {
  return (<Svg width={16} height={16} viewBox="0 0 24 24" fill="none"><Path d="M19 12H5M12 19l-7-7 7-7" stroke="#1f1235" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" /></Svg>);
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f6f5fb" },
  safe: { flex: 1 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 10 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2e8f0", alignItems: "center", justifyContent: "center" },
  brandRow: { flexDirection: "row", alignItems: "center" },
  brand: { color: "#1f1235", fontSize: 14, fontWeight: "900", marginLeft: 8, letterSpacing: 2.2 },
  head: { paddingHorizontal: 22, marginTop: 4, marginBottom: 12 },
  eyebrow: { color: "#7c3aed", fontSize: 11, fontWeight: "800", letterSpacing: 1.5, textTransform: "uppercase" },
  title: { color: "#1f1235", fontSize: 26, fontWeight: "900", marginTop: 4, letterSpacing: -0.5 },
  sub: { color: "#64748b", fontSize: 13, marginTop: 4 },

  flash: { marginHorizontal: 18, marginBottom: 12, padding: 14, borderRadius: 14, borderWidth: 1 },
  flashIn: { backgroundColor: "#ecfdf5", borderColor: "#a7f3d0" },
  flashOut: { backgroundColor: "#fffbeb", borderColor: "#fcd34d" },
  flashTitle: { fontSize: 16, fontWeight: "900", color: "#065f46", marginBottom: 4 },
  flashName: { fontSize: 18, fontWeight: "800", color: "#1f1235" },
  flashMeta: { fontSize: 12, color: "#64748b", marginTop: 2 },

  err: { marginHorizontal: 18, marginBottom: 12, padding: 10, borderRadius: 10, backgroundColor: "#fef2f2", borderColor: "#fecaca", borderWidth: 1 },
  errText: { color: "#b91c1c", fontSize: 13, fontWeight: "600" },

  viewerWrap: { marginHorizontal: 18, borderRadius: 22, padding: 6, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2e8f0" },
  viewer: { aspectRatio: 1, borderRadius: 16, overflow: "hidden", backgroundColor: "#0b0f1a", alignItems: "center", justifyContent: "center" },
  reticleWrap: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" } as any,
  reticle: { width: "70%", aspectRatio: 1 },
  corner: { position: "absolute", width: 28, height: 28, borderColor: "#a78bfa", borderWidth: 3 },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 8 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 8 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 8 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 8 },
  permWrap: { padding: 22 },
  permTitle: { color: "#fff", fontSize: 18, fontWeight: "800", marginBottom: 6 },
  permBody: { color: "#cbd5e1", fontSize: 13, textAlign: "center", marginBottom: 16 },
  permBtn: { backgroundColor: "#7c3aed", paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10 },
  permBtnText: { color: "#fff", fontWeight: "700" },

  manualCard: { marginHorizontal: 18, marginTop: 14, padding: 14, borderRadius: 14, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2e8f0" },
  manualLabel: { color: "#475569", fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 },
  manualRow: { flexDirection: "row", gap: 8 },
  manualInput: { flex: 1, backgroundColor: "#f8fafc", color: "#1f1235", borderColor: "#e2e8f0", borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  manualBtn: { backgroundColor: "#7c3aed", paddingHorizontal: 16, justifyContent: "center", borderRadius: 10 },
  manualBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
});
