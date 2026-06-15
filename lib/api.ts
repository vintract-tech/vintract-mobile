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

// ----- Profile / change password -------------------------------------

export function changePassword(old_password: string, new_password: string) {
  return request<void>("/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ old_password, new_password }),
  });
}

// ----- HR: Employee, Attendance, Payslips ----------------------------

export type Address = {
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  pin?: string | null;
  country?: string | null;
};

export type Employee = {
  id: number;
  employee_code: string;
  full_name: string;
  preferred_name: string | null;
  date_of_birth: string | null;
  gender: string | null;
  marital_status: string | null;
  blood_group: string | null;
  nationality: string | null;
  phone: string | null;
  alt_phone: string | null;
  personal_email: string | null;
  emergency_contact_name: string | null;
  emergency_contact_relation: string | null;
  emergency_contact_phone: string | null;
  photo_s3_key: string | null;
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
  reporting_manager_id: number | null;
  reporting_manager_name: string | null;

  compensation_mode: string;
  monthly_ctc: number | null;
  hourly_rate: number | null;
  daily_rate: number | null;
  basic_pct: number | null;
  hra_pct: number | null;
  conveyance: number | null;
  medical_allowance: number | null;
  lta: number | null;
  other_allowance: number | null;

  pan: string | null;
  aadhaar_masked: string | null;
  uan: string | null;
  esic_number: string | null;
  passport_number: string | null;
  bank_holder_name: string | null;
  bank_name: string | null;
  bank_branch: string | null;
  bank_account_type: string | null;
  bank_account_masked: string | null;
  bank_ifsc: string | null;

  perm: Address | null;
  current: Address | null;

  badge_token: string;
};

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

export type EmployeeExperience = {
  id: number;
  employee_id: number;
  employer_name: string;
  designation: string | null;
  from_date: string | null;
  to_date: string | null;
  ctc_per_annum: number | null;
  reason_for_leaving: string | null;
  has_relieving_letter: boolean;
  notes: string | null;
};

export type OnboardingItem = {
  id: number;
  employee_id: number;
  template_item_id: number;
  item_key: string;
  label: string;
  category: string | null;
  sort_order: number;
  status: "pending" | "done" | "skipped";
  completed_at: string | null;
  notes: string | null;
};

export type OnboardingProgress = {
  employee_id: number;
  total: number;
  done: number;
  pending: number;
  skipped: number;
  items: OnboardingItem[];
};

export type AttendanceEvent = {
  id: number;
  employee_id: number;
  event_type: "in" | "out";
  event_time: string;
  source: string | null;
  station: string | null;
};

export type ClockResult = {
  employee_id: number;
  employee_code: string;
  employee_name: string;
  event: AttendanceEvent;
};

export type SalarySlip = {
  id: number;
  payroll_run_id: number;
  employee_id: number;
  employee_code: string | null;
  employee_name: string | null;
  days_present: number;
  hours_worked: number;
  gross: number;
  pf_employee: number;
  esi_employee: number;
  tds: number;
  professional_tax: number;
  other_deductions: number;
  net: number;
  generated_at: string;
};

export function getMyEmployee(): Promise<Employee> {
  return request<Employee>(`/employees/me`);
}

export function clockBadge(badge_token: string, opts: { event_type?: "in" | "out"; station?: string } = {}): Promise<ClockResult> {
  return request<ClockResult>(`/attendance/clock`, {
    method: "POST",
    body: JSON.stringify({ badge_token, source: "mobile_qr", ...opts }),
  });
}

export function listMyAttendance(days = 14): Promise<AttendanceEvent[]> {
  return request<AttendanceEvent[]>(`/attendance/me?days=${days}`);
}

export function listMySlips(): Promise<SalarySlip[]> {
  return request<SalarySlip[]>(`/payroll/me/slips`);
}

export function listMyDocuments(): Promise<EmployeeDoc[]> {
  return request<EmployeeDoc[]>(`/employees/me/documents`);
}

export function listMyExperience(): Promise<EmployeeExperience[]> {
  return request<EmployeeExperience[]>(`/employees/me/experience`);
}

export function getMyOnboarding(): Promise<OnboardingProgress> {
  return request<OnboardingProgress>(`/employees/me/onboarding`);
}

/**
 * Build an authenticated URL for downloading the current user's salary
 * slip as a PDF. Used by the Linking.openURL() flow in /my-payslips.
 * We append the token as a query param because mobile browsers can't
 * carry an Authorization header into Linking.openURL.
 *
 * NB: the backend doesn't accept ?token= today — it expects the
 * Authorization header. The /my-payslips screen instead downloads via
 * fetch() with auth, saves to FileSystem, and opens with Sharing —
 * see that file for the actual flow.
 */
export async function getMySlipPdfPath(slipId: number): Promise<string> {
  const base = await apiBase();
  return `${base}/payroll/me/slips/${slipId}/pdf`;
}

export async function authToken(): Promise<string | null> {
  const s = await loadSession();
  return s?.token ?? null;
}
