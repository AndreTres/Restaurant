import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getDb } from "./db";
import type { UserRole } from "./types";

const SESSION_COOKIE = "restaurant_session";
const LEGACY_ADMIN_SESSION = "admin-logged-in";

export type AuthUser = {
  username: string;
  role: UserRole;
};

function parseRole(value?: string): UserRole | null {
  if (value === "waiter") return "waiter";
  if (value === "admin" || value === LEGACY_ADMIN_SESSION) return "admin";
  return null;
}

export async function getSessionRole() {
  const cookieStore = await cookies();
  return parseRole(cookieStore.get(SESSION_COOKIE)?.value);
}

export async function isAuthenticated() {
  return (await getSessionRole()) !== null;
}

export async function requireAuth() {
  const ok = await isAuthenticated();
  if (!ok) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  return null;
}

export async function requireAdmin() {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  const role = await getSessionRole();
  if (role !== "admin") {
    return NextResponse.json(
      { error: "Acesso restrito ao administrador" },
      { status: 403 }
    );
  }

  return null;
}

export function validateLogin(
  username: string,
  password: string
): AuthUser | null {
  const db = getDb();
  const user = db
    .prepare("SELECT username, role FROM users WHERE username = ? AND password = ?")
    .get(username, password) as { username: string; role: string } | undefined;

  if (!user) return null;

  return {
    username: user.username,
    role: user.role === "waiter" ? "waiter" : "admin",
  };
}

export function createSessionResponse(body: object, role: UserRole) {
  const response = NextResponse.json(body);
  response.cookies.set(SESSION_COOKIE, role, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}

export function clearSessionResponse() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}

export { SESSION_COOKIE };
