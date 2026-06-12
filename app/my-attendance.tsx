/**
 * My attendance — last 30 days of clock events for the signed-in
 * employee. Pairs IN/OUT events into worked shifts (mirrors the
 * server-side _hours_in_period heuristic) so the user sees both the
 * raw events and the aggregated daily hours.
 *
 * Unclosed IN with no OUT yet on the same day is shown as "in progress
 * — clocked in at …", matching the payroll heuristic that closes
 * trailing INs at end-of-day for a full 8-hour credit only at slip
 * generation time.
 */
import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { BrandMark } from "../components/BrandMark";
import { LightBackground } from "../components/LightBackground";
import { SideMenu } from "../components/SideMenu";
import { listMyAttendance, type AttendanceEvent } from "../lib/api";

type Shift = {
  dayKey: string;            // yyyy-mm-dd in local time
  in: AttendanceEvent;
  out: AttendanceEvent | null;
  hours: number | null;
};

export default function MyAttendanceScreen() {
  const [events, setEvents] = useState<AttendanceEvent[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      setLoading(true);
      setErr(null);
      listMyAttendance(30)
        .then((ev) => {
          if (!alive) return;
          setEvents(ev);
          setShifts(pairShifts(ev));
        })
        .catch((e) => { if (alive) setErr(e?.message ?? "Failed to load"); })
        .finally(() => { if (alive) setLoading(false); });
      return () => { alive = false; };
    }, []),
  );

  // Aggregate: total hours over the period
  const totalHrs = shifts.reduce((acc, s) => acc + (s.hours ?? 0), 0);
  const daysWithShifts = new Set(shifts.map(s => s.dayKey)).size;

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
          <Text style={styles.title}>My attendance</Text>
          <Text style={styles.sub}>Last 30 days</Text>
        </View>

        {!loading && !err && (
          <View style={styles.statRow}>
            <Stat label="Shifts" value={String(shifts.length)} />
            <Stat label="Days" value={String(daysWithShifts)} />
            <Stat label="Hours" value={totalHrs.toFixed(1)} accent />
          </View>
        )}

        {loading && <View style={styles.center}><ActivityIndicator color="#0d9488" /></View>}
        {err && <View style={styles.errBox}><Text style={styles.errText}>{err}</Text></View>}

        {!loading && !err && shifts.length === 0 && events.length === 0 && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No clock events yet</Text>
          </View>
        )}

        <FlatList
          data={shifts}
          keyExtractor={(s) => `${s.dayKey}-${s.in.id}`}
          contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 30 }}
          renderItem={({ item }) => <ShiftCard shift={item} />}
        />
      </SafeAreaView>
      <SideMenu visible={menuOpen} onClose={() => setMenuOpen(false)} />
    </View>
  );
}

function ShiftCard({ shift }: { shift: Shift }) {
  const inT = new Date(shift.in.event_time);
  const outT = shift.out ? new Date(shift.out.event_time) : null;
  const dayLabel = inT.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  return (
    <View style={[styles.card, shift.out ? null : styles.cardOpen]}>
      <View style={styles.cardHead}>
        <Text style={styles.dayLabel}>{dayLabel}</Text>
        {shift.hours != null ? (
          <Text style={styles.hoursPill}>{shift.hours.toFixed(2)} hrs</Text>
        ) : (
          <Text style={styles.openPill}>IN PROGRESS</Text>
        )}
      </View>
      <View style={styles.times}>
        <View style={styles.timeBlock}>
          <Text style={styles.timeLabel}>In</Text>
          <Text style={styles.timeValue}>{fmtTime(inT)}</Text>
          {shift.in.station && <Text style={styles.stationTxt}>{shift.in.station}</Text>}
        </View>
        <View style={styles.timeArrow}><Text style={styles.timeArrowTxt}>→</Text></View>
        <View style={styles.timeBlock}>
          <Text style={styles.timeLabel}>Out</Text>
          <Text style={[styles.timeValue, !outT && { color: "#94a3b8" }]}>
            {outT ? fmtTime(outT) : "—"}
          </Text>
          {shift.out?.station && <Text style={styles.stationTxt}>{shift.out.station}</Text>}
        </View>
      </View>
    </View>
  );
}

function Stat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={[styles.statBox, accent && styles.statAccent]}>
      <Text style={[styles.statValue, accent && styles.statValueAccent]}>{value}</Text>
      <Text style={[styles.statLabel, accent && styles.statLabelAccent]}>{label}</Text>
    </View>
  );
}

// ---- helpers ----

function fmtTime(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

/**
 * Mirror of backend _hours_in_period. Pairs consecutive (IN, OUT)
 * events on the same calendar day. Unclosed IN -> Shift with
 * hours=null (shown as IN PROGRESS).
 *
 * Server tolerates IN-on-day-A / OUT-on-day-B by closing them as one
 * shift, but for the mobile timeline we keep them visually pinned to
 * the IN's local day — the math on hours still spans midnight.
 */
function pairShifts(events: AttendanceEvent[]): Shift[] {
  const sorted = [...events].sort(
    (a, b) => new Date(a.event_time).getTime() - new Date(b.event_time).getTime(),
  );
  const shifts: Shift[] = [];
  let openIn: AttendanceEvent | null = null;
  for (const ev of sorted) {
    if (ev.event_type === "in") {
      // Two INs in a row: keep the earlier as an unclosed shift.
      if (openIn) {
        shifts.push({ dayKey: localDayKey(openIn.event_time), in: openIn, out: null, hours: null });
      }
      openIn = ev;
    } else if (ev.event_type === "out") {
      if (openIn) {
        const inT = new Date(openIn.event_time);
        const outT = new Date(ev.event_time);
        const hours = Math.max(0, (outT.getTime() - inT.getTime()) / 3_600_000);
        shifts.push({ dayKey: localDayKey(openIn.event_time), in: openIn, out: ev, hours });
        openIn = null;
      }
      // Lone OUT (no matching IN) — skip; don't fabricate a shift.
    }
  }
  if (openIn) {
    shifts.push({ dayKey: localDayKey(openIn.event_time), in: openIn, out: null, hours: null });
  }
  // Newest first.
  return shifts.reverse();
}

function localDayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function MenuIcon() { return (<Svg width={20} height={20} viewBox="0 0 24 24" fill="none"><Path d="M4 6h16M4 12h16M4 18h16" stroke="#18181b" strokeWidth={2.2} strokeLinecap="round" /></Svg>); }
function BackIcon() { return (<Svg width={16} height={16} viewBox="0 0 24 24" fill="none"><Path d="M19 12H5M12 19l-7-7 7-7" stroke="#18181b" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" /></Svg>); }

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fafafa" },
  safe: { flex: 1 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 10 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2e8f0", alignItems: "center", justifyContent: "center" },
  brandRow: { flexDirection: "row", alignItems: "center" },
  brand: { color: "#18181b", fontSize: 14, fontWeight: "900", marginLeft: 8, letterSpacing: 2.2 },
  head: { paddingHorizontal: 22, marginTop: 4, marginBottom: 14 },
  eyebrow: { color: "#0d9488", fontSize: 11, fontWeight: "800", letterSpacing: 1.5, textTransform: "uppercase" },
  title: { color: "#18181b", fontSize: 26, fontWeight: "900", marginTop: 4, letterSpacing: -0.5 },
  sub: { color: "#64748b", fontSize: 13, marginTop: 4 },
  center: { paddingVertical: 40, alignItems: "center" },
  errBox: { marginHorizontal: 18, padding: 12, backgroundColor: "#fef2f2", borderColor: "#fecaca", borderWidth: 1, borderRadius: 10 },
  errText: { color: "#b91c1c", fontSize: 13 },
  emptyCard: { marginHorizontal: 18, padding: 20, backgroundColor: "#fff", borderRadius: 14, borderColor: "#e2e8f0", borderWidth: 1 },
  emptyTitle: { color: "#18181b", fontSize: 16, fontWeight: "800" },
  emptyBody: { color: "#64748b", fontSize: 13, marginTop: 6 },

  statRow: { flexDirection: "row", gap: 8, paddingHorizontal: 18, marginBottom: 14 },
  statBox: { flex: 1, backgroundColor: "#fff", borderColor: "#e2e8f0", borderWidth: 1, borderRadius: 12, padding: 12 },
  statAccent: { backgroundColor: "#0d9488", borderColor: "#0d9488" },
  statValue: { color: "#18181b", fontSize: 20, fontWeight: "900" },
  statValueAccent: { color: "#fff" },
  statLabel: { color: "#64748b", fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6, marginTop: 2 },
  statLabelAccent: { color: "#99f6e4" },

  card: { backgroundColor: "#fff", borderRadius: 14, padding: 14, marginBottom: 10, borderColor: "#e2e8f0", borderWidth: 1 },
  cardOpen: { borderColor: "#fde68a", backgroundColor: "#fffbeb" },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  dayLabel: { color: "#18181b", fontSize: 14, fontWeight: "800" },
  hoursPill: { color: "#0f766e", fontSize: 12, fontWeight: "800", backgroundColor: "#f0fdfa", borderColor: "#99f6e4", borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  openPill: { color: "#92400e", fontSize: 10, fontWeight: "900", letterSpacing: 0.8, backgroundColor: "#fef3c7", borderColor: "#fde68a", borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  times: { flexDirection: "row", alignItems: "center", gap: 8 },
  timeBlock: { flex: 1 },
  timeLabel: { color: "#64748b", fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.6 },
  timeValue: { color: "#18181b", fontSize: 16, fontWeight: "800", marginTop: 2 },
  stationTxt: { color: "#94a3b8", fontSize: 10, marginTop: 2 },
  timeArrow: { paddingHorizontal: 4 },
  timeArrowTxt: { color: "#cbd5e1", fontSize: 16 },
});
