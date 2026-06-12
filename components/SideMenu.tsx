/**
 * Slide-in side menu — opened from the kebab on the Dashboard top bar.
 * Mirrors the webapp's sidebar so the mobile and web feel like one app.
 *
 * Only Scan SKU is live in v1; everything else is marked SOON and is
 * tappable but routes to a "coming soon" alert. Admin-only entries
 * are filtered out for non-admins by checking the cached session.
 */
import { useEffect, useState } from "react";
import {
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle, Path } from "react-native-svg";
import { BrandMark } from "./BrandMark";
import { loadSession, logout, type AuthUser } from "../lib/auth";
import { loadWorkspace } from "../lib/workspace";

type MenuItem = {
  label: string;
  icon: React.ReactNode;
  route?: string;
  /** Opens the webapp version of the feature in the device browser. */
  webPath?: string;
  adminOnly?: boolean;
  destructive?: boolean;
};

type MenuSection = {
  title?: string;
  items: MenuItem[];
};

export function SideMenu({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    if (visible) loadSession().then((s) => setUser(s?.user ?? null));
  }, [visible]);

  const isAdmin = user?.role === "admin";

  async function handleTap(item: MenuItem) {
    onClose();
    if (item.route) {
      router.push(item.route as any);
      return;
    }
    if (item.destructive) {
      Alert.alert("Sign out?", "You will be returned to the login screen.", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign out",
          style: "destructive",
          onPress: async () => {
            await logout();
            router.replace("/login");
          },
        },
      ]);
      return;
    }
    if (item.webPath) {
      const ws = await loadWorkspace();
      if (!ws) {
        Alert.alert("No workspace", "Sign in again to open this feature.");
        return;
      }
      const url = `${ws.web_base}${item.webPath}`;
      Alert.alert(
        item.label,
        "This feature lives in the web app. Open it in your browser?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Open", onPress: () => Linking.openURL(url) },
        ],
      );
      return;
    }
    Alert.alert(item.label, "Coming in an upcoming release.", [{ text: "OK" }]);
  }

  // Sections mirror the webapp sidebar. Items with `route` are native
  // mobile screens; items with `webPath` open the feature in the device
  // browser (the web app is far better than a phone for those flows).
  const sections: MenuSection[] = [
    {
      items: [
        { label: "Dashboard", icon: <HomeIcon />, route: "/home" },
        { label: "Scan SKU", icon: <ScanIcon />, route: "/scan" },
      ],
    },
    {
      title: "Inventory",
      items: [
        { label: "Receive inward", icon: <DownIcon />, route: "/receive" },
        { label: "Move to floor", icon: <TruckIcon />, route: "/move" },
        { label: "Categories", icon: <FolderIcon />, webPath: "/inventory/add/category" },
        { label: "Print labels", icon: <PrinterIcon />, webPath: "/inventory/labels" },
      ],
    },
    {
      title: "Operations",
      items: [
        { label: "Production orders", icon: <FactoryIcon />, route: "/production" },
        { label: "Products & BOM", icon: <PackageIcon />, webPath: "/products" },
        { label: "Waste log", icon: <TrashIcon />, route: "/waste" },
      ],
    },
    {
      title: "Business",
      items: [
        { label: "Vendors", icon: <BuildingIcon />, webPath: "/vendors" },
        { label: "Reports", icon: <ChartIcon />, webPath: "/reports" },
      ],
    },
    {
      title: "HR",
      items: [
        { label: "Clock in / out",  icon: <ClockIcon />,   route: "/clock" },
        { label: "My profile",      icon: <ProfileIcon />, route: "/profile" },
        { label: "My attendance",   icon: <ClockIcon />,   route: "/my-attendance" },
        { label: "My documents",    icon: <FolderIcon />,  route: "/my-documents" },
        { label: "My onboarding",   icon: <ClipboardIcon />, route: "/my-onboarding" },
        { label: "My payslips",     icon: <RupeeIcon />,   route: "/my-payslips" },
        ...(isAdmin ? [{ label: "Employees", icon: <ProfileIcon />, webPath: "/admin/employees" } as MenuItem] : []),
        ...(isAdmin ? [{ label: "Payroll",   icon: <RupeeIcon />,   webPath: "/admin/payroll"   } as MenuItem] : []),
      ],
    },
    ...(isAdmin
      ? [
          {
            title: "Admin",
            items: [
              { label: "Users", icon: <ShieldIcon />, webPath: "/admin/users", adminOnly: true },
              { label: "Alerts", icon: <BellIcon />, webPath: "/admin/alerts", adminOnly: true },
              { label: "Audit log", icon: <ClipboardIcon />, webPath: "/admin/audit", adminOnly: true },
            ],
          },
        ]
      : []),
    {
      // Profile lives in HR now (My profile). Keep only Sign out here
      // so the destructive action stays separated from navigation.
      items: [
        { label: "Sign out", icon: <SignOutIcon />, destructive: true },
      ],
    },
  ];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      transparent
    >
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <SafeAreaView style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.brandRow}>
              <BrandMark size={26} />
              <Text style={styles.brandTxt}>VINTRACT</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
              <CloseIcon />
            </Pressable>
          </View>

          {user && (
            <View style={styles.userPod}>
              <View style={styles.avatar}>
                <Text style={styles.avatarInitial}>
                  {(user.name || user.email)[0].toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.userName} numberOfLines={1}>
                  {user.name || user.email.split("@")[0]}
                </Text>
                <Text style={styles.userEmail} numberOfLines={1}>{user.email}</Text>
              </View>
              <View style={styles.rolePill}>
                <Text style={styles.rolePillText}>{user.role}</Text>
              </View>
            </View>
          )}

          <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
          >
            {sections.map((sec, sIdx) => (
              <View key={sIdx} style={styles.section}>
                {sec.title && <Text style={styles.sectionTitle}>{sec.title}</Text>}
                {sec.items.map((item) => (
                  <Pressable
                    key={item.label}
                    onPress={() => handleTap(item)}
                    style={({ pressed }) => [
                      styles.row,
                      pressed && { backgroundColor: "#f4f4f5" },
                      item.destructive && { marginTop: 4 },
                    ]}
                  >
                    <View style={styles.rowIcon}>{item.icon}</View>
                    <Text style={[styles.rowLabel, item.destructive && styles.rowLabelDestructive]}>
                      {item.label}
                    </Text>
                    {item.webPath && (
                      <View style={styles.webPill}>
                        <Text style={styles.webPillText}>WEB</Text>
                      </View>
                    )}
                  </Pressable>
                ))}
              </View>
            ))}
            <Text style={styles.versionTxt}>v1.0 · Vintract Mobile</Text>
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

// ---------- icons ---------- //
function CloseIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path d="M18 6L6 18M6 6l12 12" stroke="#475569" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function HomeIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1V9.5z" stroke="#52525b" strokeWidth={1.8} strokeLinejoin="round" />
    </Svg>
  );
}
function ScanIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M3 12h18" stroke="#52525b" strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}
function DownIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3v14m0 0l-6-6m6 6l6-6M3 21h18" stroke="#52525b" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function TruckIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M1 3h15v13H1zM16 8h4l3 4v4h-7" stroke="#52525b" strokeWidth={1.8} strokeLinejoin="round" />
      <Circle cx="5.5" cy="18.5" r="2.5" stroke="#52525b" strokeWidth={1.8} />
      <Circle cx="18.5" cy="18.5" r="2.5" stroke="#52525b" strokeWidth={1.8} />
    </Svg>
  );
}
function FolderIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M3 7a2 2 0 0 1 2-2h4l2 3h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" stroke="#52525b" strokeWidth={1.8} strokeLinejoin="round" />
    </Svg>
  );
}
function PrinterIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v7H6z" stroke="#52525b" strokeWidth={1.8} strokeLinejoin="round" />
    </Svg>
  );
}
function FactoryIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M2 20V8l5 3V8l5 3V8l5 3V4h3v16H2z" stroke="#52525b" strokeWidth={1.8} strokeLinejoin="round" />
    </Svg>
  );
}
function PackageIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16zM3.3 7L12 12l8.7-5M12 22V12" stroke="#52525b" strokeWidth={1.8} strokeLinejoin="round" />
    </Svg>
  );
}
function TrashIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z" stroke="#52525b" strokeWidth={1.8} strokeLinejoin="round" />
    </Svg>
  );
}
function BuildingIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M3 21V7l9-4 9 4v14M9 21V12h6v9M3 21h18" stroke="#52525b" strokeWidth={1.8} strokeLinejoin="round" />
    </Svg>
  );
}
function ChartIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M3 3v18h18M7 14l4-4 4 4 5-5" stroke="#52525b" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function ShieldIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M12 2l8 4v6c0 5-3.5 8.7-8 10-4.5-1.3-8-5-8-10V6l8-4z" stroke="#52525b" strokeWidth={1.8} strokeLinejoin="round" />
    </Svg>
  );
}
function BellIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M6 8a6 6 0 0 1 12 0v4l2 4H4l2-4V8zM10 20a2 2 0 0 0 4 0" stroke="#52525b" strokeWidth={1.8} strokeLinejoin="round" />
    </Svg>
  );
}
function ProfileIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" stroke="#52525b" strokeWidth={1.8} strokeLinejoin="round" />
    </Svg>
  );
}
function SignOutIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" stroke="#dc2626" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function ClockIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="9" stroke="#52525b" strokeWidth={1.8} />
      <Path d="M12 7v5l3 2" stroke="#52525b" strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}
function RupeeIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M6 4h12M6 8h12M10 4c4 0 6 2 6 5s-2 5-6 5h-4l8 8" stroke="#52525b" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function ClipboardIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M9 3h6a1 1 0 0 1 1 1v2H8V4a1 1 0 0 1 1-1z M6 6h12v15H6z M9 11h6M9 15h6" stroke="#52525b" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(15, 16, 30, 0.45)" },
  sheet: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: "85%",
    maxWidth: 340,
    backgroundColor: "#fff",
    borderTopRightRadius: 22,
    borderBottomRightRadius: 22,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 4, height: 0 },
    elevation: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  brandRow: { flexDirection: "row", alignItems: "center" },
  brandTxt: {
    color: "#18181b",
    fontSize: 14,
    fontWeight: "900",
    marginLeft: 10,
    letterSpacing: 2.2,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  userPod: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingBottom: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#4f46e5",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: { color: "#fff", fontWeight: "800", fontSize: 16 },
  userName: { color: "#18181b", fontSize: 14, fontWeight: "800" },
  userEmail: { color: "#94a3b8", fontSize: 11, marginTop: 1 },
  rolePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "#eef2ff",
    borderWidth: 1,
    borderColor: "#c7d2fe",
  },
  rolePillText: { color: "#3730a3", fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
  scroll: { paddingHorizontal: 10, paddingBottom: 24 },
  section: { marginTop: 12 },
  sectionTitle: {
    color: "#94a3b8",
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.4,
    marginLeft: 12,
    marginBottom: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 12,
  },
  rowIcon: { width: 22, alignItems: "center" },
  rowLabel: { flex: 1, color: "#18181b", fontSize: 14, fontWeight: "600" },
  rowLabelDestructive: { color: "#dc2626" },
  webPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  webPillText: { color: "#1d4ed8", fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },
  versionTxt: { color: "#cbd5e1", fontSize: 10, textAlign: "center", marginTop: 18 },
});
