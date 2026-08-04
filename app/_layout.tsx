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
        <Stack.Screen name="inventory" options={{ headerShown: false }} />
        <Stack.Screen name="categories" options={{ headerShown: false }} />
        <Stack.Screen name="receive" options={{ headerShown: false }} />
        <Stack.Screen name="move" options={{ headerShown: false }} />
        <Stack.Screen name="production/index" options={{ headerShown: false }} />
        <Stack.Screen name="production/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="production/flow" options={{ headerShown: false }} />
        <Stack.Screen name="production/record" options={{ headerShown: false }} />
        <Stack.Screen name="production/approvals" options={{ headerShown: false }} />
        <Stack.Screen name="production/feasibility" options={{ headerShown: false }} />
        <Stack.Screen name="waste" options={{ headerShown: false }} />
        <Stack.Screen name="hr/employees" options={{ headerShown: false }} />
        <Stack.Screen name="hr/employee/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="hr/attendance" options={{ headerShown: false }} />
        <Stack.Screen name="admin/users" options={{ headerShown: false }} />
      </Stack>
    </SafeAreaProvider>
  );
}
