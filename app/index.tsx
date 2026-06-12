/**
 * Boot screen. Reads stored session + workspace and forwards either to
 * /scan (already signed in) or /login. Renders a small spinner so the
 * splash transition doesn't flash a blank.
 */
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { loadSession } from "../lib/auth";
import { loadWorkspace } from "../lib/workspace";

export default function BootScreen() {
  useEffect(() => {
    (async () => {
      const [ws, session] = await Promise.all([loadWorkspace(), loadSession()]);
      if (ws && session) {
        router.replace("/home");
      } else {
        router.replace("/login");
      }
    })();
  }, []);

  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color="#4f46e5" />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fafafa" },
});
