import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getDb } from "@/lib/db";

const VALID_STATUS = new Set(["free", "occupied", "reserved"]);
const VALID_AREA = new Set(["outside", "inside"]);

export async function GET() {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  const tables = getDb()
    .prepare(
      `SELECT * FROM tables
       ORDER BY CASE area WHEN 'outside' THEN 0 ELSE 1 END, number`
    )
    .all();

  return NextResponse.json(tables);
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  const body = await request.json();
  const seats = Number(body.seats ?? 4);
  const status = String(body.status ?? "free");
  const area = String(body.area ?? "inside");

  if (!Number.isInteger(seats) || seats <= 0) {
    return NextResponse.json({ error: "Lugares inválidos" }, { status: 400 });
  }

  if (!VALID_STATUS.has(status)) {
    return NextResponse.json({ error: "Status inválido" }, { status: 400 });
  }

  if (!VALID_AREA.has(area)) {
    return NextResponse.json({ error: "Área inválida" }, { status: 400 });
  }

  const db = getDb();
  const maxNumber = db
    .prepare("SELECT COALESCE(MAX(number), 0) as max FROM tables")
    .get() as { max: number };
  const number = maxNumber.max + 1;

  const result = db
    .prepare(
      "INSERT INTO tables (number, seats, status, area) VALUES (?, ?, ?, ?)"
    )
    .run(number, seats, status, area);

  const table = db
    .prepare("SELECT * FROM tables WHERE id = ?")
    .get(result.lastInsertRowid);

  return NextResponse.json(table, { status: 201 });
}
