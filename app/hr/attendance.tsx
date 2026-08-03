/**
 * Attendance — company-wide day view from GET /attendance/daily.
 *
 * Pick a date, see per-employee IN / OUT / hours / status, then (with the
 * `attendance.correct` permission) tap a row to fix it: add a missing
 * punch or edit a wrong one. Corrections go through POST /attendance/manual
 * and PATCH /attendance/events/{id} — both audit-logged server-side.
 */
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { BrandMark } from "../../components/BrandMark";
import { LightBackground } from "../../components/LightBackground";
import { SideMenu } from "../../components/SideMenu";
import { hasPermission, loadSession, type AuthUser } from "../../lib/auth";
import {
  addManualPunch,
  editAttendanceEvent,
  getAttendanceDaily,
  listEmployeeAttendance,
  type AttendanceDailyRow,
  type AttendanceEvent,
} from "../../lib/api";

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export default function AttendanceScreen() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [day, setDay] = useState(new Date());
  const [rows, setRows] = useState<AttendanceDailyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [selected, setSelected] = useState<AttendanceDailyRow | null>(null);

  const key = dayKey(day);

  const refresh = useCallback(() => {
    setLoading(true);
    setErr(null);
    loadSession().then((s) => setUser(s?.user ?? null));
    getAttendanceDaily(key)
      .then(setRows)
      .catch((e) => setErr(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [key]);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const canCorrect = hasPermission(user, "attendance.correct");
  const shift = (delta: number) => {
    const d = new Date(day);
    d.setDate(d.getDate() + delta);
    setDay(d);
  };
  const isToday = key === dayKey(new Date());

  const present = rows.filter((r) => r.status === "present").length;
  const working = rows.filter((r) => r.status === "in_progress").length;
  const absent = rows.filter((r) => r.status === "absent").length;

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
          <Text style={styles.title}>Attendance</Text>
        </View>

        {/* Date picker strip */}
        <View style={styles.dateRow}>
          <Pressable onPress={() => shift(-1)} hitSlop={10} style={styles.dateBtn}><Text style={styles.dateBtnTxt}>‹</Text></Pressable>
          <View style={{ alignItems: "center" }}>
            <Text style={styles.dateTxt}>
              {day.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
            </Text>
            {!isToday && (
              <Pressable onPress={() => setDay(new Date())} hitSlop={8}>
                <Text style={styles.todayLink}>Today</Text>
              </Pressable>
            )}
          </View>
          <Pressable
            onPress={() => !isToday && shift(1)}
            hitSlop={10}
            style={[styles.dateBtn, isToday && { opacity: 0.3 }]}
          >
            <Text style={styles.dateBtnTxt}>›</Text>
          </Pressable>
        </View>

        {!loading && !err && (
          <View style={styles.statRow}>
            <Stat label="Present" value={String(present)} accent />
            <Stat label="Working" value={String(working)} />
            <Stat label="Absent" value={String(absent)} />
          </View>
        )}

        {loading && <View style={styles.center}><ActivityIndicator color="#0d9488" /></View>}
        {err && !loading && <View style={styles.errBox}><Text style={styles.errText}>{err}</Text></View>}

        {!loading && !err && (
          <FlatList
            data={rows}
            keyExtractor={(r) => String(r.employee_id)}
            contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 30 }}
            ListEmptyComponent={<Text style={styles.empty}>No Employees On Record</Text>}
            renderItem={({ item }) => (
              <DayRow row={item} onPress={canCorrect ? () => setSelected(item) : undefined} />
            )}
          />
        )}
      </SafeAreaView>

      {selected && (
        <CorrectionSheet
          row={selected}
          day={key}
          onClose={(changed) => {
            setSelected(null);
            if (changed) refresh();
          }}
        />
      )}

      <SideMenu visible={menuOpen} onClose={() => setMenuOpen(false)} />
    </View>
  );
}

function DayRow({ row, onPress }: { row: AttendanceDailyRow; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.card, pressed && onPress ? { opacity: 0.92 } : null]}
    >
      <View style={styles.cardHead}>
        <View style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
          <Text style={styles.name} numberOfLines={1}>{row.employee_name}</Text>
          <Text style={styles.code}>{row.employee_code}{row.department ? ` · ${row.department}` : ""}</Text>
        </View>
        <StatusPill status={row.status} />
      </View>
      <View style={styles.timeRow}>
        <View style={styles.timeBlock}>
          <Text style={styles.timeLabel}>In</Text>
          <Text style={styles.timeValue}>{fmtTime(row.in_time)}</Text>
        </View>
        <View style={styles.timeBlock}>
          <Text style={styles.timeLabel}>Out</Text>
          <Text style={[styles.timeValue, !row.out_time && { color: "#94a3b8" }]}>{fmtTime(row.out_time)}</Text>
        </View>
        <View style={styles.timeBlock}>
          <Text style={styles.timeLabel}>Hours</Text>
          <Text style={styles.timeValue}>{row.hours != null ? row.hours.toFixed(2) : "—"}</Text>
        </View>
      </View>
      {(row.late || row.missing_out) && (
        <View style={styles.badgeRow}>
          {row.late && (
            <View style={styles.warnBadge}>
              <Text style={styles.warnBadgeTxt}>Late{row.late_by_minutes ? ` ${row.late_by_minutes}m` : ""}</Text>
            </View>
          )}
          {row.missing_out && (
            <View style={styles.dangerBadge}>
              <Text style={styles.dangerBadgeTxt}>Missing Out</Text>
            </View>
          )}
        </View>
      )}
    </Pressable>
  );
}

function StatusPill({ status }: { status: AttendanceDailyRow["status"] }) {
  const map = {
    present: { bg: "#ecfdf5", fg: "#065f46", border: "#a7f3d0", label: "Present" },
    in_progress: { bg: "#fef3c7", fg: "#92400e", border: "#fcd34d", label: "Working" },
    absent: { bg: "#f1f5f9", fg: "#475569", border: "#cbd5e1", label: "Absent" },
  } as const;
  const s = map[status];
  return (
    <View style={[styles.pill, { backgroundColor: s.bg, borderColor: s.border }]}>
      <Text style={[styles.pillTxt, { color: s.fg }]}>{s.label}</Text>
    </View>
  );
}

/**
 * Correction sheet for one employee's day: shows the raw punches, lets
 * the corrector edit one (tap it) or add a missing one. Time is typed as
 * HH:MM (24h) — good enough for a correction flow without dragging a
 * date-picker dependency into the app.
 */
function CorrectionSheet({
  row, day, onClose,
}: {
  row: AttendanceDailyRow;
  day: string; // YYYY-MM-DD
  onClose: (changed: boolean) => void;
}) {
  const [events, setEvents] = useState<AttendanceEvent[] | null>(null);
  const [editing, setEditing] = useState<AttendanceEvent | null>(null);
  const [type, setType] = useState<"in" | "out">("in");
  const [time, setTime] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [changed, setChanged] = useState(false);

  useFocusEffect(
    useCallback(() => {
      listEmployeeAttendance(row.employee_id, day, day)
        .then((ev) => setEvents([...ev].sort((a, b) => a.event_time.localeCompare(b.event_time))))
        .catch(() => setEvents([]));
    }, [row.employee_id, day]),
  );

  function parseTimeToIso(): string | null {
    const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
    if (!m) return null;
    const hh = Number(m[1]);
    const mm = Number(m[2]);
    if (hh > 23 || mm > 59) return null;
    const [y, mo, d] = day.split("-").map(Number);
    return new Date(y, mo - 1, d, hh, mm, 0).toISOString();
  }

  function startEdit(ev: AttendanceEvent) {
    setEditing(ev);
    setType(ev.event_type);
    const t = new Date(ev.event_time);
    setTime(`${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`);
    setNote(ev.note ?? "");
  }

  async function save() {
    const iso = parseTimeToIso();
    if (!iso) {
      Alert.alert("Invalid Time", "Enter the time as HH:MM (24-hour).");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await editAttendanceEvent(editing.id, {
          event_type: type,
          event_time: iso,
          note: note.trim() || undefined,
        });
      } else {
        await addManualPunch({
          employee_id: row.employee_id,
          event_type: type,
          event_time: iso,
          note: note.trim() || undefined,
        });
      }
      setChanged(true);
      setEditing(null);
      setTime("");
      setNote("");
      const ev = await listEmployeeAttendance(row.employee_id, day, day);
      setEvents([...ev].sort((a, b) => a.event_time.localeCompare(b.event_time)));
    } catch (e: any) {
      Alert.alert("Save Failed", e?.message ?? "Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={() => onClose(changed)}>
      <View style={styles.sheetBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => onClose(changed)} />
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>{row.employee_name}</Text>
          <Text style={styles.sheetSub}>{row.employee_code} · {day}</Text>

          <Text style={styles.sheetLabel}>Punches</Text>
          {events === null ? (
            <ActivityIndicator color="#0d9488" style={{ marginVertical: 10 }} />
          ) : events.length === 0 ? (
            <Text style={styles.sheetEmpty}>No punches recorded for this day.</Text>
          ) : (
            events.map((ev) => (
              <Pressable
                key={ev.id}
                onPress={() => startEdit(ev)}
                style={({ pressed }) => [
                  styles.punchRow,
                  editing?.id === ev.id && styles.punchRowActive,
                  pressed && { opacity: 0.9 },
                ]}
              >
                <View style={[styles.punchType, ev.event_type === "in" ? styles.punchTypeIn : styles.punchTypeOut]}>
                  <Text style={[styles.punchTypeTxt, ev.event_type === "in" ? { color: "#065f46" } : { color: "#9a3412" }]}>
                    {ev.event_type === "in" ? "In" : "Out"}
                  </Text>
                </View>
                <Text style={styles.punchTime}>{fmtTime(ev.event_time)}</Text>
                <Text style={styles.punchSrc} numberOfLines={1}>{ev.source ?? ""}</Text>
                <Text style={styles.punchEdit}>Edit</Text>
              </Pressable>
            ))
          )}

          <Text style={styles.sheetLabel}>{editing ? "Edit Punch" : "Add Punch"}</Text>
          <View style={styles.formRow}>
            <View style={styles.typeToggle}>
              {(["in", "out"] as const).map((t) => (
                <Pressable
                  key={t}
                  onPress={() => setType(t)}
                  style={[styles.typeBtn, type === t && styles.typeBtnOn]}
                >
                  <Text style={[styles.typeBtnTxt, type === t && styles.typeBtnTxtOn]}>{t === "in" ? "In" : "Out"}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              value={time}
              onChangeText={setTime}
              placeholder="HH:MM"
              placeholderTextColor="#9ca3af"
              keyboardType="numbers-and-punctuation"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.timeInput}
            />
          </View>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Note (Optional)"
            placeholderTextColor="#9ca3af"
            style={styles.noteInput}
          />
          <View style={styles.formBtns}>
            {editing && (
              <Pressable
                onPress={() => { setEditing(null); setTime(""); setNote(""); }}
                style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.85 }]}
              >
                <Text style={styles.cancelBtnTxt}>Cancel Edit</Text>
              </Pressable>
            )}
            <Pressable
              onPress={save}
              disabled={saving}
              style={({ pressed }) => [styles.saveBtn, (saving || pressed) && { opacity: 0.85 }]}
            >
              {saving
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.saveBtnTxt}>{editing ? "Save Correction" : "Add Punch"}</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
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

function MenuIcon() { return (<Svg width={20} height={20} viewBox="0 0 24 24" fill="none"><Path d="M4 6h16M4 12h16M4 18h16" stroke="#18181b" strokeWidth={2.2} strokeLinecap="round" /></Svg>); }
function BackIcon() { return (<Svg width={16} height={16} viewBox="0 0 24 24" fill="none"><Path d="M19 12H5M12 19l-7-7 7-7" stroke="#18181b" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" /></Svg>); }

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fafafa" },
  safe: { flex: 1 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 10 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2e8f0", alignItems: "center", justifyContent: "center" },
  brandRow: { flexDirection: "row", alignItems: "center" },
  brand: { color: "#18181b", fontSize: 14, fontWeight: "900", marginLeft: 8, letterSpacing: 2.2 },
  head: { paddingHorizontal: 22, marginTop: 4, marginBottom: 8 },
  eyebrow: { color: "#0d9488", fontSize: 11, fontWeight: "800", letterSpacing: 1.5, textTransform: "uppercase" },
  title: { color: "#18181b", fontSize: 26, fontWeight: "900", marginTop: 4, letterSpacing: -0.5 },

  dateRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginHorizontal: 18, marginBottom: 10, backgroundColor: "#fff",
    borderColor: "#e2e8f0", borderWidth: 1, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 8,
  },
  dateBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#f1f5f9", alignItems: "center", justifyContent: "center" },
  dateBtnTxt: { color: "#18181b", fontSize: 18, fontWeight: "800", marginTop: -2 },
  dateTxt: { color: "#18181b", fontSize: 14, fontWeight: "800" },
  todayLink: { color: "#0d9488", fontSize: 11, fontWeight: "800", marginTop: 2 },

  statRow: { flexDirection: "row", gap: 8, paddingHorizontal: 18, marginBottom: 12 },
  statBox: { flex: 1, backgroundColor: "#fff", borderColor: "#e2e8f0", borderWidth: 1, borderRadius: 12, padding: 12 },
  statAccent: { backgroundColor: "#0d9488", borderColor: "#0d9488" },
  statValue: { color: "#18181b", fontSize: 20, fontWeight: "900" },
  statValueAccent: { color: "#fff" },
  statLabel: { color: "#64748b", fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6, marginTop: 2 },
  statLabelAccent: { color: "#99f6e4" },

  center: { paddingVertical: 40, alignItems: "center" },
  errBox: { marginHorizontal: 18, padding: 12, backgroundColor: "#fef2f2", borderColor: "#fecaca", borderWidth: 1, borderRadius: 10 },
  errText: { color: "#b91c1c", fontSize: 13 },
  empty: { color: "#64748b", textAlign: "center", marginTop: 32 },

  card: { backgroundColor: "#fff", borderRadius: 14, padding: 14, marginBottom: 10, borderColor: "#e2e8f0", borderWidth: 1 },
  cardHead: { flexDirection: "row", alignItems: "flex-start", marginBottom: 10 },
  name: { color: "#18181b", fontSize: 14, fontWeight: "800" },
  code: { color: "#64748b", fontSize: 11, marginTop: 2 },
  pill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  pillTxt: { fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.6 },
  timeRow: { flexDirection: "row", gap: 8 },
  timeBlock: { flex: 1 },
  timeLabel: { color: "#64748b", fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.6 },
  timeValue: { color: "#18181b", fontSize: 15, fontWeight: "800", marginTop: 2 },
  badgeRow: { flexDirection: "row", gap: 6, marginTop: 10 },
  warnBadge: { backgroundColor: "#fffbeb", borderColor: "#fde68a", borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  warnBadgeTxt: { color: "#92400e", fontSize: 10, fontWeight: "800" },
  dangerBadge: { backgroundColor: "#fef2f2", borderColor: "#fecaca", borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  dangerBadgeTxt: { color: "#b91c1c", fontSize: 10, fontWeight: "800" },

  sheetBackdrop: { flex: 1, backgroundColor: "rgba(15, 16, 30, 0.45)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#fff", borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingHorizontal: 18, paddingTop: 18, paddingBottom: 34,
  },
  sheetTitle: { color: "#18181b", fontSize: 18, fontWeight: "900" },
  sheetSub: { color: "#64748b", fontSize: 12, marginTop: 2 },
  sheetLabel: { color: "#64748b", fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.8, marginTop: 16, marginBottom: 8 },
  sheetEmpty: { color: "#64748b", fontSize: 13 },
  punchRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#f8fafc", borderColor: "#e2e8f0", borderWidth: 1,
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 6,
  },
  punchRowActive: { borderColor: "#0d9488", backgroundColor: "#f0fdfa" },
  punchType: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: 1 },
  punchTypeIn: { backgroundColor: "#ecfdf5", borderColor: "#a7f3d0" },
  punchTypeOut: { backgroundColor: "#fff7ed", borderColor: "#fed7aa" },
  punchTypeTxt: { fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.6 },
  punchTime: { color: "#18181b", fontSize: 14, fontWeight: "800" },
  punchSrc: { flex: 1, color: "#94a3b8", fontSize: 11 },
  punchEdit: { color: "#0d9488", fontSize: 12, fontWeight: "800" },

  formRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  typeToggle: { flexDirection: "row", backgroundColor: "#f1f5f9", borderRadius: 10, padding: 3 },
  typeBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  typeBtnOn: { backgroundColor: "#0d9488" },
  typeBtnTxt: { color: "#475569", fontSize: 13, fontWeight: "800" },
  typeBtnTxtOn: { color: "#fff" },
  timeInput: {
    flex: 1, backgroundColor: "#f8fafc", color: "#18181b",
    borderColor: "#e2e8f0", borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, fontWeight: "800",
  },
  noteInput: {
    backgroundColor: "#f8fafc", color: "#18181b",
    borderColor: "#e2e8f0", borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, marginTop: 10,
  },
  formBtns: { flexDirection: "row", gap: 10, marginTop: 12 },
  cancelBtn: { flex: 1, backgroundColor: "#f1f5f9", paddingVertical: 12, borderRadius: 12, alignItems: "center" },
  cancelBtnTxt: { color: "#475569", fontSize: 14, fontWeight: "800" },
  saveBtn: { flex: 2, backgroundColor: "#0d9488", paddingVertical: 12, borderRadius: 12, alignItems: "center" },
  saveBtnTxt: { color: "#fff", fontSize: 14, fontWeight: "800" },
});
