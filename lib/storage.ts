/**
 * Cross-platform key/value storage.
 *
 * SecureStore is native-only — on web (Expo's browser preview / dev) it
 * throws on import. We fall through to localStorage there. The keys we
 * store are JWTs and a workspace pointer; on a phone they live in the
 * iOS Keychain / Android Keystore via SecureStore, on web they live in
 * localStorage. Web is dev-preview only, so the security delta is
 * acceptable.
 */
import { Platform } from "react-native";

let nativeStore: typeof import("expo-secure-store") | null = null;
if (Platform.OS !== "web") {
  // Lazy-require so the metro web bundle never tries to evaluate the
  // native module (which would re-throw the original error).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  nativeStore = require("expo-secure-store");
}

export async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    if (typeof window === "undefined" || !window.localStorage) return null;
    return window.localStorage.getItem(key);
  }
  return (await nativeStore!.getItemAsync(key)) ?? null;
}

export async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    if (typeof window === "undefined" || !window.localStorage) return;
    window.localStorage.setItem(key, value);
    return;
  }
  await nativeStore!.setItemAsync(key, value);
}

export async function deleteItem(key: string): Promise<void> {
  if (Platform.OS === "web") {
    if (typeof window === "undefined" || !window.localStorage) return;
    window.localStorage.removeItem(key);
    return;
  }
  await nativeStore!.deleteItemAsync(key);
}
