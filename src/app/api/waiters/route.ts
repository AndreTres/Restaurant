import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET() {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  const waiters = getDb()
    .prepare("SELECT * FROM waiters ORDER BY name")
    .all();

  return NextResponse.json(waiters);
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  const body = await request.json();
  const name = String(body.name ?? "").trim();
  const active = body.active === false || body.active === 0 ? 0 : 1;

  if (!name) {
    return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });
  }

  const result = getDb()
    .prepare("INSERT INTO waiters (name, active) VALUES (?, ?)")
    .run(name, active);

  const waiter = getDb()
    .prepare("SELECT * FROM waiters WHERE id = ?")
    .get(result.lastInsertRowid);

  return NextResponse.json(waiter, { status: 201 });
}
