/**
 * Offline queue for POST /flow/record.
 *
 * The floor's Wi-Fi drops; the scan must not. Every submission carries a
 * client-generated UUID (`client_event_id`) and the server dedupes on it,
 * so the rules here can stay simple and safe:
 *
 *   - Try the POST. Network failure → append the payload to an
 *     AsyncStorage-backed array and tell the caller it was queued.
 *   - `replay()` walks the queue oldest-first. Success (including the
 *     server's "already recorded" idempotent replay) removes the entry.
 *     Network / 5xx failures keep it for next time. A 4xx means the
 *     server SAW the payload and rejected it (bad stage, not enough
 *     units) — retrying can never succeed, so the entry is removed and
 *     its message surfaced to the caller for an alert.
 *   - Replays run on screen focus (Flow Board / Record) and right after
 *     any successful submit. Only one replay at a time.
 *
 * Entries are only ever removed after the server answered for that exact
 * client_event_id — a crash mid-replay just replays again next time.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { recordFlow, type FlowRecordIn, type FlowRecordResult } from "./api";

const QUEUE_KEY = "vintract.ops.flowqueue.v1";

export type QueuedRecord = FlowRecordIn & { queued_at: string };

export type SubmitOutcome =
  | { kind: "sent"; result: FlowRecordResult }
  | { kind: "queued"; pending: number }
  | { kind: "rejected"; message: string };

export type ReplayOutcome = {
  sent: number;
  remaining: number;
  /** Human-readable messages for entries the server permanently rejected. */
  rejected: string[];
};

/** Best-effort RFC4122 v4. Math.random is fine here — the id only needs
 *  to be unique per device, not cryptographically unguessable. */
export function newClientEventId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function isNetworkError(e: unknown): boolean {
  // fetch rejects with TypeError("Network request failed") on RN when the
  // device is offline / the host is unreachable. Our api.request() throws
  // plain Error(detail) for HTTP responses, so a TypeError is transport.
  if (e instanceof TypeError) return true;
  const msg = e instanceof Error ? e.message : String(e);
  return /network|abort|timed? ?out|failed to fetch/i.test(msg);
}

function isServerRejection(e: unknown): boolean {
  // api.request() throws Error whose message is either the backend's
  // `detail` string or the bare status code. 5xx bodies rarely carry a
  // detail, so a bare "5xx" message is treated as retryable.
  const msg = e instanceof Error ? e.message : String(e);
  if (/^5\d\d$/.test(msg.trim())) return false;
  return !isNetworkError(e);
}

async function loadQueue(): Promise<QueuedRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as QueuedRecord[]) : [];
  } catch {
    return [];
  }
}

async function saveQueue(entries: QueuedRecord[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(entries));
}

export async function pendingCount(): Promise<number> {
  return (await loadQueue()).length;
}

async function enqueue(entry: FlowRecordIn): Promise<number> {
  const queue = await loadQueue();
  // Dedupe by client_event_id — a double-tap must not queue twice.
  if (!queue.some((q) => q.client_event_id === entry.client_event_id)) {
    queue.push({ ...entry, queued_at: new Date().toISOString() });
    await saveQueue(queue);
  }
  return queue.length;
}

/** Submit now if we can, queue for later if the network is down. */
export async function submitOrQueue(input: FlowRecordIn): Promise<SubmitOutcome> {
  try {
    const result = await recordFlow(input);
    // Opportunistically drain anything queued earlier — we clearly have
    // connectivity right now. Fire-and-forget; its errors surface on the
    // next focus-triggered replay.
    void replay();
    return { kind: "sent", result };
  } catch (e) {
    if (isNetworkError(e)) {
      const pending = await enqueue(input);
      return { kind: "queued", pending };
    }
    return { kind: "rejected", message: e instanceof Error ? e.message : String(e) };
  }
}

let replaying = false;

/** Drain the queue oldest-first. Safe to call often; no-ops when empty
 *  or when another replay is already running. */
export async function replay(): Promise<ReplayOutcome> {
  if (replaying) return { sent: 0, remaining: await pendingCount(), rejected: [] };
  replaying = true;
  try {
    let queue = await loadQueue();
    let sent = 0;
    const rejected: string[] = [];
    for (const entry of [...queue]) {
      try {
        await recordFlow(entry);
        sent += 1;
        queue = queue.filter((q) => q.client_event_id !== entry.client_event_id);
        await saveQueue(queue);
      } catch (e) {
        if (isServerRejection(e)) {
          // The server saw it and said no — keeping it would jam the
          // queue forever. Drop it and tell the user what was refused.
          const msg = e instanceof Error ? e.message : String(e);
          rejected.push(`${entry.completed_qty}+${entry.rejected_qty} on order #${entry.production_order_id}: ${msg}`);
          queue = queue.filter((q) => q.client_event_id !== entry.client_event_id);
          await saveQueue(queue);
        } else {
          // Still offline (or the server is down) — stop; order matters.
          break;
        }
      }
    }
    return { sent, remaining: queue.length, rejected };
  } finally {
    replaying = false;
  }
}
