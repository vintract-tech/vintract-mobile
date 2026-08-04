/**
 * Screen — shared screen-body wrapper that centralises the two chrome
 * bugs every screen kept re-fixing (or forgetting):
 *
 * 1. Keyboard hides inputs — wraps children in a KeyboardAvoidingView
 *    ("padding" on iOS, "height" on Android), same as the login /
 *    waste / MovementForm screens already did by hand.
 * 2. Bottom nav bar covers the last row — the scroll variant (and the
 *    `useListBottomPadding` hook for FlatList screens) pads the bottom
 *    by the safe-area inset + 24 so the final item clears Android's
 *    nav bar.
 *
 * Usage — inside the screen's SafeAreaView, below the top bar:
 *
 *   <Screen scroll contentContainerStyle={styles.scroll}>…</Screen>
 *
 * for ScrollView bodies (keyboardShouldPersistTaps="handled" included),
 * or plain `<Screen>` around a FlatList — then give the FlatList
 * `contentContainerStyle={{ paddingBottom: useListBottomPadding() }}`.
 */
import type { ReactElement, ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type RefreshControlProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Gap kept between the last row and the bottom edge / nav bar. */
export const BOTTOM_GAP = 24;

/**
 * Bottom padding for scrollable content: safe-area inset + BOTTOM_GAP.
 * Use on FlatList `contentContainerStyle` (the Screen scroll variant
 * already applies it).
 */
export function useListBottomPadding(): number {
  const insets = useSafeAreaInsets();
  return insets.bottom + BOTTOM_GAP;
}

export function Screen({
  scroll = false,
  children,
  contentContainerStyle,
  refreshControl,
}: {
  /** true → body is a ScrollView (inputs stay tappable + visible). */
  scroll?: boolean;
  children: ReactNode;
  /** Scroll variant only: layout for the ScrollView content. */
  contentContainerStyle?: StyleProp<ViewStyle>;
  /** Scroll variant only: pull-to-refresh control. */
  refreshControl?: ReactElement<RefreshControlProps>;
}) {
  const paddingBottom = useListBottomPadding();
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.flex}
    >
      {scroll ? (
        <ScrollView
          contentContainerStyle={[contentContainerStyle, { paddingBottom }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={styles.flex}>{children}</View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
