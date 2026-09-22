import { NextRequest, NextResponse } from "next/server";
import {
  clearSessionResponse,
  createSessionResponse,
  isAuthenticated,
  validateLogin,
} from "@/lib/auth";

export async function GET() {
  const authenticated = await isAuthenticated();
  return NextResponse.json({ authenticated });
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

  if (!validateLogin(username, password)) {
    return NextResponse.json(
      { error: "Usuário ou senha inválidos" },
      { status: 401 }
    );
  }

  return createSessionResponse({ ok: true, username });
}

export async function DELETE() {
  return clearSessionResponse();
}
