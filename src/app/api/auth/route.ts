import { NextRequest, NextResponse } from "next/server";
import {
  clearSessionResponse,
  createSessionResponse,
  getSessionRole,
  isAuthenticated,
  validateLogin,
} from "@/lib/auth";

export async function GET() {
  const authenticated = await isAuthenticated();
  const role = await getSessionRole();
  return NextResponse.json({ authenticated, role });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const username = String(body.username ?? "").trim();
  const password = String(body.password ?? "");

  if (!username || !password) {
    return NextResponse.json(
      { error: "Informe usuário e senha" },
      { status: 400 }
    );
  }

  const user = validateLogin(username, password);

  if (!user) {
    return NextResponse.json(
      { error: "Usuário ou senha inválidos" },
      { status: 401 }
    );
  }

  return createSessionResponse(
    { ok: true, username: user.username, role: user.role },
    user.role
  );
}

export async function DELETE() {
  return clearSessionResponse();
}
