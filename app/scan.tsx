/**
 * Scan screen — LIGHT theme.
 *
 * Light chrome: white app bar with back/menu, light dot-grid bg, a
 * dark camera viewer (kept dark so the picture reads) framed with a
 * white card around it, then a white manual-entry card below.
 */
import { useCallback, useEffect, useRef, useState } from "react";
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
import { loadWorkspace } from "../lib/workspace";

const BARCODE_TYPES: BarcodeType[] = [
  "code128", "code39", "code93",
  "ean13", "ean8", "upc_a", "upc_e",
  "qr", "datamatrix", "pdf417",
];

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [wsName, setWsName] = useState<string>("");
  const [manualSku, setManualSku] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const handled = useRef(false);

  useFocusEffect(useCallback(() => { handled.current = false; }, []));

  useEffect(() => {
    loadWorkspace().then((ws) => setWsName(ws?.name ?? ""));
  }, []);

  function onScanned(sku: string) {
    if (handled.current || !sku || sku.trim().length < 2) return;
    handled.current = true;
    router.push({ pathname: "/item/[sku]", params: { sku: sku.trim() } });
  }

  return (
    <View style={styles.root}>
      <LightBackground />
      <SafeAreaView style={styles.safe}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <Pressable
            onPress={() => setMenuOpen(true)}
            hitSlop={12}
            style={styles.iconBtn}
            accessibilityLabel="Menu"
          >
            <MenuIcon />
          </Pressable>
          <View style={styles.brandRow}>
            <BrandMark size={26} />
            <Text style={styles.brand}>VINTRACT</Text>
          </View>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            style={styles.iconBtn}
            accessibilityLabel="Back"
          >
            <BackIcon />
          </Pressable>
        </View>

        <View style={styles.head}>
          <Text style={styles.eyebrow}>Step 1</Text>
          <Text style={styles.title}>Scan an SKU</Text>
          <Text style={styles.sub}>Point the camera at any barcode or QR.</Text>
        </View>

        {/* Camera viewer */}
        <View style={styles.viewerWrap}>
          {!permission ? (
            <View style={styles.viewer}>
              <ActivityIndicator color="#7c3aed" />
            </View>
          ) : !permission.granted ? (
            <View style={[styles.viewer, styles.permWrap]}>
              <Text style={styles.permTitle}>Camera access</Text>
              <Text style={styles.permBody}>
                Allow the camera so you can scan SKUs on the floor.
              </Text>
              <Pressable onPress={requestPermission} style={styles.permBtn}>
                <Text style={styles.permBtnText}>Allow camera</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.viewer}>
              <CameraView
                style={StyleSheet.absoluteFill}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES }}
                onBarcodeScanned={({ data }) => onScanned(data)}
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

        {/* Manual entry */}
        <View style={styles.manualCard}>
          <Text style={styles.manualLabel}>Or type the SKU</Text>
          <View style={styles.manualRow}>
            <TextInput
              value={manualSku}
              onChangeText={setManualSku}
              placeholder="SKU code"
              placeholderTextColor="#a3a3a3"
              autoCapitalize="characters"
              autoCorrect={false}
              style={styles.manualInput}
              onSubmitEditing={() => onScanned(manualSku)}
              returnKeyType="search"
            />
            <Pressable
              onPress={() => onScanned(manualSku)}
              style={({ pressed }) => [styles.manualBtn, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.manualBtnText}>Look up</Text>
            </Pressable>
          </View>
          {wsName ? <Text style={styles.wsLabel}>WORKSPACE · {wsName}</Text> : null}
        </View>
      </SafeAreaView>

      <SideMenu visible={menuOpen} onClose={() => setMenuOpen(false)} />
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f6f5fb" },
  safe: { flex: 1 },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  brandRow: { flexDirection: "row", alignItems: "center" },
  brand: {
    color: "#1f1235",
    fontSize: 14,
    fontWeight: "900",
    marginLeft: 8,
    letterSpacing: 2.2,
  },

  head: { paddingHorizontal: 22, marginTop: 8, marginBottom: 14 },
  eyebrow: { color: "#7c3aed", fontSize: 11, fontWeight: "800", letterSpacing: 1.5, textTransform: "uppercase" },
  title: { color: "#1f1235", fontSize: 26, fontWeight: "900", marginTop: 4, letterSpacing: -0.5 },
  sub: { color: "#64748b", fontSize: 13, marginTop: 4 },

  viewerWrap: {
    marginHorizontal: 18,
    borderRadius: 22,
    padding: 6,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  viewer: {
    aspectRatio: 1,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#0b0f1a",
    alignItems: "center",
    justifyContent: "center",
  },
  reticleWrap: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" } as any,
  reticle: { width: "70%", aspectRatio: 1.4 },
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

  manualCard: {
    marginHorizontal: 18,
    marginTop: 18,
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  manualLabel: {
    color: "#475569",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  manualRow: { flexDirection: "row", gap: 8 },
  manualInput: {
    flex: 1,
    backgroundColor: "#f8fafc",
    color: "#1f1235",
    borderColor: "#e2e8f0",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  manualBtn: {
    backgroundColor: "#7c3aed",
    paddingHorizontal: 16,
    justifyContent: "center",
    borderRadius: 10,
    shadowColor: "#7c3aed",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  manualBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  wsLabel: {
    color: "#94a3b8",
    fontSize: 10,
    marginTop: 10,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
});
