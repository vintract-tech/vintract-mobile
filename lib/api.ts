/**
 * Fetch wrapper. Reads the active workspace + token at call time, so
 * caller doesn't have to thread them through props.
 */
import { loadSession } from "./auth";
import { loadWorkspace } from "./workspace";

export type Item = {
  id: number;
  sku_code: string;
  category: string;
  category_code: string;
  sub_category: string | null;
  sub_category_code: string | null;
  source_label: string | null;
  model: string | null;
  item_use: string | null;
  on_hand: number;
  opening_stock: number;
  low_stock_threshold: number | null;
  is_low: boolean;
  serial: number | null;
  size_label: string | null;
  qty_per_label: number;
  stock_unit: string | null;
  supplier: string | null;
  brand: string | null;
};

async function authHeaders(): Promise<Record<string, string>> {
  const s = await loadSession();
  return s ? { Authorization: `Bearer ${s.token}` } : {};
}

async function apiBase(): Promise<string> {
  const ws = await loadWorkspace();
  if (!ws) throw new Error("No active workspace. Log in again.");
  return ws.api_base;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const base = await apiBase();
  const auth = await authHeaders();
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...auth,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    let detail = `${res.status}`;
    try {
      const body = await res.json();
      if (body?.detail) detail = String(body.detail);
    } catch {}
    throw new Error(detail);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Resolve a scanned barcode to an Item. The backend's GET /items/{sku}
 *  endpoint already strips the trailing per-label serial AND the new
 *  `|Q<qty>` suffix that labels printed after the qty-in-barcode change
 *  carry, so any scan resolves to the SKU class.
 *
 *  Callers that want the qty hint should use `parseQtyHint(raw)`
 *  separately to extract it from the original scan payload BEFORE
 *  passing the cleaned code here. */
export function getItemBySku(sku: string): Promise<Item> {
  return request<Item>(`/items/${encodeURIComponent(sku)}`);
}

/** Browsable inventory list (optionally filtered by a search query and/or
 *  a category code — the backend accepts a main category code and expands
 *  it to every sub-cat underneath). */
export function listItems(q?: string, category?: string): Promise<Item[]> {
  const params = new URLSearchParams();
  if (q && q.trim()) params.set("q", q.trim());
  if (category && category.trim()) params.set("category", category.trim());
  const qs = params.toString();
  return request<Item[]>(`/items${qs ? `?${qs}` : ""}`);
}

// ── Inventory dashboard (same figures as the web dashboard) ──────────────
export type InventorySummary = {
  inventory_value: number;
  sku_count: number;
  sku_with_cost: number;
  waste_cost_mtd: number;
  waste_qty_mtd: number;
  vendor_count_active: number;
  vendor_count_total: number;
  currency: string;
};
export type InventoryStats = {
  total_items: number;
  low_stock: number;
  out_of_stock: number;
  by_category: { category: string; count: number }[];
};
export function getInventorySummary(): Promise<InventorySummary> {
  return request<InventorySummary>(`/items/dashboard/summary`);
}
export function getInventoryStats(): Promise<InventoryStats> {
  return request<InventoryStats>(`/items/stats/summary`);
}

/** Pull the `|Q<qty>` suffix off a freshly-scanned barcode payload.
 *
 *  Returns the qty as a number if present, else null. Mirrors the
 *  backend's `_split_qty_hint` so both sides agree on the parse.
 *
 *    "MTL-BRK-MAHE-A-0001|Q10"   -> 10
 *    "MTL-BRK-MAHE-A-0001|Q7.5"  -> 7.5
 *    "MTL-BRK-MAHE-A-0001"      -> null  (older label)
 *    "MTL-BRK-MAHE-A|Qabc"      -> null  (malformed; ignore the hint)
 */
export function parseQtyHint(raw: string): number | null {
  if (!raw || !raw.includes("|Q")) return null;
  const qtyPart = raw.split("|Q").pop() ?? "";
  const n = Number(qtyPart);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// ----- Movements (receive / move / adjust) ---------------------------

export type Movement = {
  id: number;
  sku_code: string;
  kind: "INWARD" | "OUTWARD" | "ADJUST" | "TRANSFER";
  qty: number;
  balance_after: number;
  occurred_at: string;
  operator: string | null;
  note: string | null;
};

export type MovementIn = {
  sku_code: string;
  qty: number;
  kind: "INWARD" | "OUTWARD" | "ADJUST" | "TRANSFER";
  operator?: string;
  location_code?: string;
  note?: string;
};

export function createMovement(input: MovementIn): Promise<Movement> {
  return request<Movement>("/movements", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

// ----- Production orders ---------------------------------------------

export type ProductionOrder = {
  id: number;
  code: string;
  product_name: string;
  product_category_id: number | null;
  qty_planned: number;
  qty_produced: number;
  qty_wasted: number;
  status: "planned" | "in_progress" | "completed" | "cancelled";
  priority: string;
  planned_start: string | null;
  target_completion: string | null;
  actual_completion: string | null;
  customer: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export function getProductionOrders(): Promise<ProductionOrder[]> {
  return request<ProductionOrder[]>("/production");
}

export function getProductionOrder(id: number): Promise<ProductionOrder> {
  return request<ProductionOrder>(`/production/${id}`);
}

export function updateProductionOrder(
  id: number,
  patch: Partial<{
    status: ProductionOrder["status"];
    qty_produced: number;
    qty_wasted: number;
    notes: string;
  }>,
): Promise<ProductionOrder> {
  return request<ProductionOrder>(`/production/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

// ----- Waste log ------------------------------------------------------

export type WasteReason = "damaged" | "qc_reject" | "rework_scrap" | "expired" | "spoilage" | "other";

export type WasteIn = {
  sku_code: string;
  qty: number;
  reason: WasteReason;
  notes?: string;
  operator?: string;
  production_order_id?: number;
};

export type Waste = {
  id: number;
  sku_code: string | null;
  item_name: string | null;
  stock_unit: string | null;
  qty: number;
  reason: string;
  notes: string | null;
  operator: string | null;
  occurred_at: string;
};

export function logWaste(input: WasteIn): Promise<Waste> {
  return request<Waste>("/waste", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

// ----- Categories (native browse) ------------------------------------

/** A row of the two-level category taxonomy. Mains carry `children`
 *  (their SKUs); leaves carry the live stock split. The backend returns
 *  far more fields than these — we only type what the app renders. */
export type CategoryNode = {
  id: number;
  code: string;
  name: string;
  parent_id: number | null;
  sku_code: string | null;
  stock_unit: string | null;
  on_hand: number;
  on_floor: number;
  total_qty: number;
  is_active: boolean;
  children: CategoryNode[];
};

/** Main categories with their SKUs nested (`GET /categories`). */
export function listCategories(): Promise<CategoryNode[]> {
  return request<CategoryNode[]>(`/categories`);
}

export function getCategory(code: string): Promise<CategoryNode> {
  return request<CategoryNode>(`/categories/${encodeURIComponent(code)}`);
}

// ----- HR: employees (managerial) ------------------------------------

export type Address = {
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  pin?: string | null;
  country?: string | null;
};

/** Managerial projection of the backend's EmployeeOut. Compensation,
 *  bank and statutory fields are deliberately NOT typed here — salary
 *  must never surface in Vintract Ops (it stays on the web + payroll). */
export type Employee = {
  id: number;
  employee_code: string;
  full_name: string;
  preferred_name: string | null;
  date_of_birth: string | null;
  gender: string | null;
  blood_group: string | null;
  phone: string | null;
  alt_phone: string | null;
  personal_email: string | null;
  emergency_contact_name: string | null;
  emergency_contact_relation: string | null;
  emergency_contact_phone: string | null;
  photo_url: string | null;

  designation: string | null;
  department: string | null;
  employment_type: string;
  work_location: string | null;
  shift_pattern: string | null;
  joined_at: string | null;
  confirmation_date: string | null;
  terminated_at: string | null;
  status: string;
  leave_status: string | null;
  reporting_manager_id: number | null;
  reporting_manager_name: string | null;

  perm: Address | null;
  current: Address | null;
};

export function listEmployees(q?: string, status?: string): Promise<Employee[]> {
  const params = new URLSearchParams();
  if (q && q.trim()) params.set("q", q.trim());
  if (status) params.set("status", status);
  const qs = params.toString();
  return request<Employee[]>(`/employees${qs ? `?${qs}` : ""}`);
}

export function getEmployee(id: number): Promise<Employee> {
  return request<Employee>(`/employees/${id}`);
}

// ----- HR: employee documents ----------------------------------------

export type EmployeeDoc = {
  id: number;
  employee_id: number;
  doc_type: string;
  file_s3_key: string;
  file_url: string | null;
  original_filename: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  issue_date: string | null;
  expiry_date: string | null;
  status: string;
  verified_at: string | null;
  uploaded_at: string;
};

/** Mirror of the backend's DOC_TYPES keys (hr_sub.py). Order matters —
 *  it is the order the picker shows them in. */
export const DOC_TYPES: { key: string; label: string }[] = [
  { key: "photo", label: "Photograph" },
  { key: "pan", label: "PAN Card" },
  { key: "aadhaar", label: "Aadhaar" },
  { key: "cheque", label: "Cancelled Cheque" },
  { key: "passport", label: "Passport" },
  { key: "driving_licence", label: "Driving Licence" },
  { key: "offer_letter", label: "Offer Letter" },
  { key: "education_10th", label: "Class 10 Marksheet" },
  { key: "education_12th", label: "Class 12 Marksheet" },
  { key: "education_grad", label: "Graduation Certificate" },
  { key: "education_pg", label: "Post-Graduation Certificate" },
  { key: "experience_letter", label: "Experience Letter" },
  { key: "contract", label: "Signed Contract" },
  { key: "other", label: "Other" },
];

export function listEmployeeDocuments(employeeId: number): Promise<EmployeeDoc[]> {
  return request<EmployeeDoc[]>(`/employees/${employeeId}/documents`);
}

/** Upload one document for an employee.
 *
 *  Backend contract (hr_sub.upload_document): `doc_type` (and the other
 *  scalars) travel as QUERY params; the file is the single multipart
 *  form field named `file`. We must NOT set Content-Type ourselves —
 *  fetch writes the multipart boundary only when it owns the header. */
export async function uploadEmployeeDocument(
  employeeId: number,
  docType: string,
  file: { uri: string; name: string; mimeType: string },
  notes?: string,
): Promise<EmployeeDoc> {
  const base = await apiBase();
  const auth = await authHeaders();
  const params = new URLSearchParams({ doc_type: docType });
  if (notes && notes.trim()) params.set("notes", notes.trim());
  const form = new FormData();
  // React Native's FormData takes {uri, name, type} for file parts.
  form.append("file", { uri: file.uri, name: file.name, type: file.mimeType } as any);
  const res = await fetch(`${base}/employees/${employeeId}/documents?${params.toString()}`, {
    method: "POST",
    headers: { Accept: "application/json", ...auth },
    body: form,
  });
  if (!res.ok) {
    let detail = `${res.status}`;
    try {
      const body = await res.json();
      if (body?.detail) detail = String(body.detail);
    } catch {}
    throw new Error(detail);
  }
  return (await res.json()) as EmployeeDoc;
}

// ----- HR: attendance (managerial) -----------------------------------

export type AttendanceEvent = {
  id: number;
  employee_id: number;
  event_type: "in" | "out";
  event_time: string;
  source: string | null;
  station: string | null;
  note: string | null;
};

/** One row of GET /attendance/daily — the whole company for one day. */
export type AttendanceDailyRow = {
  employee_id: number;
  employee_code: string;
  employee_name: string;
  department: string | null;
  designation: string | null;
  in_time: string | null;
  out_time: string | null;
  hours: number | null;
  status: "present" | "absent" | "in_progress";
  missing_out: boolean;
  shift_name: string | null;
  late: boolean | null;
  late_by_minutes: number | null;
  overtime_hours: number | null;
};

/** One row of GET /attendance/summary — per-employee range aggregates. */
export type AttendanceSummaryRow = {
  employee_id: number;
  employee_code: string;
  employee_name: string;
  department: string | null;
  designation: string | null;
  days_present: number;
  days_absent: number;
  late_days: number;
  total_hours: number;
  overtime_hours: number;
  missing_out_days: number;
};

/** Company-wide roll-up for one plant-local day (YYYY-MM-DD; omit for today). */
export function getAttendanceDaily(on?: string): Promise<AttendanceDailyRow[]> {
  return request<AttendanceDailyRow[]>(`/attendance/daily${on ? `?on=${on}` : ""}`);
}

export function getAttendanceSummary(from: string, to: string): Promise<AttendanceSummaryRow[]> {
  return request<AttendanceSummaryRow[]>(`/attendance/summary?from=${from}&to=${to}`);
}

/** Raw punches for one employee across a date range (both YYYY-MM-DD). */
export function listEmployeeAttendance(
  employeeId: number,
  fromDate: string,
  toDate: string,
): Promise<AttendanceEvent[]> {
  return request<AttendanceEvent[]>(
    `/attendance/employee/${employeeId}?from_date=${fromDate}&to_date=${toDate}`,
  );
}

/** Backfill a missed punch (requires `attendance.correct`). */
export function addManualPunch(input: {
  employee_id: number;
  event_type: "in" | "out";
  event_time: string; // ISO datetime
  note?: string;
}): Promise<AttendanceEvent> {
  return request<AttendanceEvent>(`/attendance/manual`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** Fix a wrong punch time/type (requires `attendance.correct`). */
export function editAttendanceEvent(
  eventId: number,
  patch: { event_type?: "in" | "out"; event_time?: string; note?: string },
): Promise<AttendanceEvent> {
  return request<AttendanceEvent>(`/attendance/events/${eventId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

// ----- Flow: stages, board, record -----------------------------------

export type Stage = {
  id: number;
  code: string;
  name: string;
  kind: "PRODUCTION" | "QUALITY" | "PACKING" | "FINISHED";
  sequence: number;
  colour: string | null;
  wip_limit: number | null;
  description: string | null;
  is_active: boolean;
  in_use: boolean;
};

export function listStages(activeOnly = false): Promise<Stage[]> {
  return request<Stage[]>(`/stages${activeOnly ? "?active_only=true" : ""}`);
}

export type FlowBoardOrder = {
  order_id: number;
  order_code: string;
  product_name: string;
  priority: string;
  qty: number;
  entered_at: string | null;
  days_waiting: number;
};

export type FlowBoardStage = {
  stage_id: number;
  code: string;
  name: string;
  kind: string;
  colour: string | null;
  sequence: number;
  is_active: boolean;
  wip_limit: number | null;
  total_qty: number;
  over_wip_limit: boolean;
  order_count: number;
  orders: FlowBoardOrder[];
};

export type FlowBoard = {
  generated_at: string;
  statuses: string[];
  total_wip: number;
  order_count: number;
  bottleneck_stage_ids: number[];
  stages: FlowBoardStage[];
};

/** The live kanban: per-stage totals + the orders sitting in each stage.
 *  `status` is comma-separated order statuses, or "all". */
export function getFlowBoard(status = "in_progress"): Promise<FlowBoard> {
  return request<FlowBoard>(`/flow/board?status=${encodeURIComponent(status)}`);
}

export type OrderFlowStage = {
  stage_id: number;
  code: string;
  name: string;
  kind: string;
  colour: string | null;
  sequence: number;
  is_optional: boolean;
  wip_limit: number | null;
  qty: number;
  total_entered: number;
  total_completed: number;
  total_rejected: number;
  total_reworked: number;
  entered_at: string | null;
  days_waiting: number;
};

export type OrderFlow = {
  production_order_id: number;
  order_code: string;
  product_name: string;
  status: string;
  priority: string;
  customer: string | null;
  qty_planned: number;
  qty_produced: number;
  qty_wasted: number;
  qty_in_progress: number;
  progress_pct: number;
  target_completion: string | null;
  actual_completion: string | null;
  has_route: boolean;
  current_stage_id: number | null;
  current_stage_name: string | null;
  route: OrderFlowStage[];
};

export function getOrderFlow(orderId: number): Promise<OrderFlow> {
  return request<OrderFlow>(`/flow/orders/${orderId}`);
}

export type MaterialLine = {
  category_id: number;
  name: string;
  sku_code: string | null;
  unit: string | null;
  consume_stage_id: number | null;
  consume_stage_name: string | null;
  qty_per_unit: number;
  qty_required: number;
  qty_issued: number;
  qty_consumed: number;
  qty_returned: number;
  qty_on_floor: number;
  short: boolean;
  shortfall: number;
};

export function getOrderMaterials(orderId: number): Promise<MaterialLine[]> {
  return request<MaterialLine[]>(`/flow/orders/${orderId}/materials`);
}

/** POST /flow/record body. `client_event_id` makes the write idempotent —
 *  the offline queue replays safely because the server dedupes on it. */
export type FlowRecordIn = {
  production_order_id: number;
  stage_id: number;
  completed_qty: number;
  rejected_qty: number;
  rework_to_stage_id?: number;
  defect_code?: string;
  operator?: string;
  station?: string;
  note?: string;
  source: "mobile";
  client_event_id: string;
  occurred_at: string; // ISO datetime — when the work actually happened
};

export type FlowStageBalance = {
  stage_id: number;
  stage_code: string;
  stage_name: string;
  colour: string | null;
  sequence: number;
  qty: number;
  entered_at: string | null;
  days_waiting: number;
};

export type FlowRecordResult = {
  production_order_id: number;
  order_code: string;
  status: string;
  qty_planned: number;
  qty_produced: number;
  qty_wasted: number;
  applied: boolean; // false = idempotent replay (already recorded)
  message: string | null;
  balances: FlowStageBalance[];
};

export function recordFlow(input: FlowRecordIn): Promise<FlowRecordResult> {
  return request<FlowRecordResult>(`/flow/record`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

// ----- Admin: users ---------------------------------------------------

export type UserAccount = {
  id: number;
  email: string;
  name: string | null;
  role: string;
  is_active: boolean;
  must_change_password: boolean;
  created_at: string;
  last_login_at: string | null;
};

export type RoleDef = {
  id: number;
  name: string;
  description: string | null;
  permissions: string[];
  is_system: boolean;
  user_count: number;
};

export function listUsers(): Promise<UserAccount[]> {
  return request<UserAccount[]>(`/users`);
}

export function listRoles(): Promise<RoleDef[]> {
  return request<RoleDef[]>(`/roles`);
}

export function updateUser(
  id: number,
  patch: { name?: string; role?: string; is_active?: boolean },
): Promise<UserAccount> {
  return request<UserAccount>(`/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}
