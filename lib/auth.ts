/**
 * Auth: JWT stored in SecureStore, resolved against the workspace's
 * backend (see workspace.ts). The mobile app talks directly to that
 * backend — no Vintract-central auth server. The workspace decides
 * who can log in; we just hold the token.
 */
import * as Storage from "./storage";
import type { Workspace } from "./workspace";

const TOKEN_KEY = "vintract.auth.token.v1";
const USER_KEY = "vintract.auth.user.v1";

export type AuthUser = {
  id: number;
  email: string;
  name: string | null;
  // Backend allows custom roles beyond the three system ones, so this is a
  // plain string with the well-known values still inferable.
  role: "admin" | "operator" | "viewer" | (string & {});
  must_change_password: boolean;
  // Resolved permission set for the user's role — returned by /auth/login
  // since the RBAC matrix landed. Sessions cached before that lack it, so
  // always read through hasPermission() which treats admin as all-access.
  permissions?: string[];
};

/** True when the user holds ANY of the given permissions. Admin short-
 *  circuits to true (the admin system role owns the full catalog), which
 *  also covers admin sessions cached before `permissions` was returned. */
export function hasPermission(user: AuthUser | null, ...perms: string[]): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  const held = user.permissions ?? [];
  return perms.some((p) => held.includes(p));
}

export type Session = {
  token: string;
  user: AuthUser;
};

/** POST {api_base}/auth/login with email + password. Backend returns
 *  {access_token, user}. We persist both so subsequent app launches
 *  can skip the login screen. */
export async function login(
  ws: Workspace,
  email: string,
  password: string,
): Promise<Session> {
  const res = await fetch(`${ws.api_base}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email: email.trim(), password }),
  });
  if (!res.ok) {
    let detail = `Login failed (HTTP ${res.status})`;
    try {
      const body = await res.json();
      if (body?.detail) detail = String(body.detail);
    } catch {}
    throw new Error(detail);
  }
  const body = await res.json();
  // Backend returns { token, expires_at, user } — the access_token key was
  // wishful thinking on my part. Make sure we read the right field.
  if (!body?.token || !body?.user) {
    throw new Error("Unexpected response from backend (missing token/user).");
  }
  const session: Session = {
    token: body.token,
    user: body.user,
  };
  await Storage.setItem(TOKEN_KEY, session.token);
  await Storage.setItem(USER_KEY, JSON.stringify(session.user));
  return session;
}

export async function loadSession(): Promise<Session | null> {
  const token = await Storage.getItem(TOKEN_KEY);
  const userRaw = await Storage.getItem(USER_KEY);
  if (!token || !userRaw) return null;
  try {
    return { token, user: JSON.parse(userRaw) as AuthUser };
  } catch {
    return null;
  }
}

export async function logout(): Promise<void> {
  await Storage.deleteItem(TOKEN_KEY);
  await Storage.deleteItem(USER_KEY);
  // workspace stays — same device usually goes back to the same workspace.
}
