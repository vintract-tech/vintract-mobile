import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#fafafa" },
          headerTintColor: "#18181b",
          headerTitleStyle: { fontWeight: "700" },
          contentStyle: { backgroundColor: "#fafafa" },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="home" options={{ headerShown: false }} />
        <Stack.Screen name="scan" options={{ headerShown: false }} />
        <Stack.Screen name="item/[sku]" options={{ headerShown: false }} />
        <Stack.Screen name="receive" options={{ headerShown: false }} />
        <Stack.Screen name="move" options={{ headerShown: false }} />
        <Stack.Screen name="production/index" options={{ headerShown: false }} />
        <Stack.Screen name="production/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="waste" options={{ headerShown: false }} />
        <Stack.Screen name="profile" options={{ headerShown: false }} />
        <Stack.Screen name="clock" options={{ headerShown: false }} />
        <Stack.Screen name="my-payslips" options={{ headerShown: false }} />
        <Stack.Screen name="my-attendance" options={{ headerShown: false }} />
        <Stack.Screen name="my-documents" options={{ headerShown: false }} />
        <Stack.Screen name="my-onboarding" options={{ headerShown: false }} />
      </Stack>
    </SafeAreaProvider>
  );
}
