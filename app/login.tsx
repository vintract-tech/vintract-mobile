/**
 * Login screen — LIGHT theme.
 *
 * Cream background + subtle purple accents. Brand mark + "?" help in
 * the top bar, glossy white card in the centre with the three fields,
 * forgot-password + sign-in actions, contact footer.
 */
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
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
import Svg, { Circle, Defs, Pattern, Rect } from "react-native-svg";
import { BrandMark } from "../components/BrandMark";
import { login } from "../lib/auth";
import { loadWorkspace, resolveWorkspaceCode, saveWorkspace } from "../lib/workspace";

const SUPPORT_EMAIL = "admin@vintract.com";

export default function LoginScreen() {
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    loadWorkspace().then((ws) => {
      if (ws) setCode(ws.code);
    });
  }, []);

  async function onSubmit() {
    setErr(null);
    if (!code.trim() || !email.trim() || !password) {
      setErr("Workspace, email and password are all required");
      return;
    }
    setBusy(true);
    try {
      const ws = await resolveWorkspaceCode(code);
      await saveWorkspace(ws);
      await login(ws, email, password);
      router.replace("/home");
    } catch (e: any) {
      setErr(e?.message ?? "Login failed");
    } finally {
      setBusy(false);
    }
  }

  function onHelp() {
    Alert.alert(
      "Need help?",
      `Contact your administrator or write to ${SUPPORT_EMAIL} for a new account, a workspace code, or a password reset.`,
      [
        { text: "Email support", onPress: () => Linking.openURL(`mailto:${SUPPORT_EMAIL}`) },
        { text: "Close", style: "cancel" },
      ],
    );
  }

  function onForgotPassword() {
    Linking.openURL(
      `mailto:${SUPPORT_EMAIL}?subject=Password%20reset&body=Please%20reset%20my%20password.%20Workspace:%20${encodeURIComponent(code)}%20Email:%20${encodeURIComponent(email)}`,
    );
  }

  return (
    <View style={styles.root}>
      {/* Subtle dot-grid background, light tone */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Svg width="100%" height="100%" opacity={0.5}>
          <Defs>
            <Pattern id="lightdots" x="0" y="0" width="28" height="28" patternUnits="userSpaceOnUse">
              <Circle cx="2" cy="2" r="1" fill="rgba(124, 58, 237, 0.22)" />
            </Pattern>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#lightdots)" />
        </Svg>
      </View>

      <SafeAreaView style={styles.safe}>
        {/* Top bar — brand left, help right */}
        <View style={styles.topBar}>
          <View style={styles.brandRow}>
            <BrandMark size={32} />
            <Text style={styles.brand}>VINTRACT</Text>
          </View>
          <Pressable
            onPress={onHelp}
            hitSlop={12}
            style={styles.helpBtn}
            accessibilityLabel="Help"
          >
            <Text style={styles.helpQ}>?</Text>
          </Pressable>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.flex}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.cardWrap}>
              <View style={styles.card}>
                <Text style={styles.signIn}>Sign in</Text>

                <Field
                  label="Workspace code"
                  value={code}
                  onChangeText={(v) => setCode(v.trim())}
                  autoCapitalize="none"
                />
                <Field
                  label="Email"
                  value={email}
                  onChangeText={(v) => setEmail(v.trim())}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
                <Field
                  label="Password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />

                {err && (
                  <View style={styles.errBox}>
                    <Text style={styles.errText}>{err}</Text>
                  </View>
                )}

                <View style={styles.actionRow}>
                  <Pressable onPress={onForgotPassword} hitSlop={8}>
                    <Text style={styles.link}>Forgot password?</Text>
                  </Pressable>
                  <Pressable
                    onPress={onSubmit}
                    disabled={busy}
                    style={({ pressed }) => [
                      styles.primary,
                      (busy || pressed) && { opacity: 0.85 },
                    ]}
                  >
                    {busy ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.primaryText}>Sign in</Text>
                    )}
                  </Pressable>
                </View>
              </View>

              <Text style={styles.footer}>
                Need help or an account?{" "}
                <Text
                  style={styles.footerLink}
                  onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
                >
                  {SUPPORT_EMAIL}
                </Text>
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  keyboardType?: "default" | "email-address" | "numeric";
  secureTextEntry?: boolean;
  placeholder?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{props.label}</Text>
      <TextInput
        value={props.value}
        onChangeText={props.onChangeText}
        autoCapitalize={props.autoCapitalize}
        keyboardType={props.keyboardType}
        secureTextEntry={props.secureTextEntry}
        placeholder={props.placeholder}
        placeholderTextColor="#a3a3a3"
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f6f5fb" },
  safe: { flex: 1 },
  flex: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  brandRow: { flexDirection: "row", alignItems: "center" },
  brand: {
    color: "#1f1235",
    fontSize: 16,
    fontWeight: "900",
    marginLeft: 10,
    letterSpacing: 2.5,
  },
  helpBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.25)",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  helpQ: { color: "#7c3aed", fontSize: 14, fontWeight: "800" },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  cardWrap: { width: "100%", maxWidth: 380, alignSelf: "center" },
  card: {
    padding: 22,
    borderRadius: 20,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.08)",
    shadowColor: "#7c3aed",
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    // Android shadow
    elevation: 4,
  },
  signIn: {
    color: "#1f1235",
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 18,
    letterSpacing: -0.2,
  },
  field: { marginBottom: 12 },
  label: {
    color: "#475569",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  input: {
    backgroundColor: "#f8fafc",
    color: "#1f1235",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  errBox: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginTop: 4,
    marginBottom: 12,
  },
  errText: { color: "#b91c1c", fontSize: 12 },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
  },
  link: { color: "#7c3aed", fontSize: 13, fontWeight: "700" },
  primary: {
    backgroundColor: "#7c3aed",
    paddingVertical: 12,
    paddingHorizontal: 26,
    borderRadius: 10,
    alignItems: "center",
    minWidth: 120,
    shadowColor: "#7c3aed",
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  primaryText: { color: "#fff", fontSize: 15, fontWeight: "700", letterSpacing: 0.3 },
  footer: {
    color: "#64748b",
    fontSize: 12,
    marginTop: 16,
    textAlign: "center",
  },
  footerLink: { color: "#7c3aed", fontWeight: "700" },
});
