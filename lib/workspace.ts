/**
 * Workspace resolution.
 *
 * The mobile app is universal — one binary, many customer backends. A
 * "workspace" is a customer's deployment. The user picks one at login
 * by typing a short code (e.g. `motley-hsr`); we resolve the code to
 * an API base URL via a manifest hosted on the vintract.com marketing
 * site. To onboard a new customer, you add a row to that JSON — no
 * app rebuild needed.
 *
 * The chosen workspace is persisted alongside the auth token so the
 * code field can be hidden on subsequent logins from the same device.
 */
import * as Storage from "./storage";

export const MANIFEST_URL = "https://vintract.com/workspaces.json";
const WORKSPACE_KEY = "vintract.workspace.v1";

export type Workspace = {
  code: string;
  name: string;
  api_base: string;
  web_base: string;
  country: string;
  active: boolean;
};

export type WorkspaceManifest = {
  version: number;
  updated_at: string;
  workspaces: Workspace[];
};

/** Fetch the manifest from vintract.com — no auth, public. We don't
 *  cache it on disk; the manifest is small and login is rare. */
export async function fetchManifest(): Promise<WorkspaceManifest> {
  const res = await fetch(MANIFEST_URL, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Could not load workspace list (HTTP ${res.status}). Check your internet.`);
  }
  const json = (await res.json()) as WorkspaceManifest;
  if (!json?.workspaces?.length) {
    throw new Error("Workspace list is empty. Contact support.");
  }
  return json;
}

/** Look up a workspace by its short code (case-insensitive). */
export async function resolveWorkspaceCode(code: string): Promise<Workspace> {
  const trimmed = code.trim().toLowerCase();
  if (!trimmed) throw new Error("Workspace code is required");
  const manifest = await fetchManifest();
  const found = manifest.workspaces.find(
    (w) => w.code.toLowerCase() === trimmed && w.active,
  );
  if (!found) {
    throw new Error(
      `Workspace "${code}" not found. Double-check the code with your administrator.`,
    );
  }
  return found;
}

/** Last workspace the user successfully logged into — used to skip the
 *  code field on the login screen and to pin the API base URL for the
 *  rest of the session. */
export async function saveWorkspace(ws: Workspace): Promise<void> {
  await Storage.setItem(WORKSPACE_KEY, JSON.stringify(ws));
}

export async function loadWorkspace(): Promise<Workspace | null> {
  const raw = await Storage.getItem(WORKSPACE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Workspace;
  } catch {
    return null;
  }
}

export async function clearWorkspace(): Promise<void> {
  await Storage.deleteItem(WORKSPACE_KEY);
}
