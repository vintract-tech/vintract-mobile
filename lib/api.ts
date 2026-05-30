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
 *  endpoint already strips the trailing per-label serial, so a scan of
 *  e.g. `MTL-CIR-ALUM-242X2.4-7F3A` resolves to the SKU class. */
export function getItemBySku(sku: string): Promise<Item> {
  return request<Item>(`/items/${encodeURIComponent(sku)}`);
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
