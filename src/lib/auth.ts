import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getDb } from "./db";

const SESSION_COOKIE = "restaurant_session";
const SESSION_VALUE = "admin-logged-in";

export async function isAuthenticated() {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE)?.value === SESSION_VALUE;
}

export async function requireAuth() {
  const ok = await isAuthenticated();
  if (!ok) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  return null;
}

export function validateLogin(username: string, password: string) {
  const db = getDb();
  const user = db
    .prepare("SELECT id FROM users WHERE username = ? AND password = ?")
    .get(username, password);

  return Boolean(user);
}

export function createSessionResponse(body: object) {
  const response = NextResponse.json(body);
  response.cookies.set(SESSION_COOKIE, SESSION_VALUE, {
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

export { SESSION_COOKIE, SESSION_VALUE };
