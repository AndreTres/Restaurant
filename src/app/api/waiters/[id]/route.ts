import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getDb } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const body = await request.json();
  const name = String(body.name ?? "").trim();
  const active = body.active === false || body.active === 0 ? 0 : 1;

  if (!name) {
    return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });
  }

  const db = getDb();
  const existing = db.prepare("SELECT id FROM waiters WHERE id = ?").get(id);
  if (!existing) {
    return NextResponse.json({ error: "Garçom não encontrado" }, { status: 404 });
  }

  db.prepare("UPDATE waiters SET name = ?, active = ? WHERE id = ?").run(
    name,
    active,
    id
  );

  const waiter = db.prepare("SELECT * FROM waiters WHERE id = ?").get(id);
  return NextResponse.json(waiter);
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const db = getDb();
  const existing = db.prepare("SELECT id FROM waiters WHERE id = ?").get(id);

  if (!existing) {
    return NextResponse.json({ error: "Garçom não encontrado" }, { status: 404 });
  }

  const linked = db
    .prepare("SELECT id FROM orders WHERE waiter_id = ? LIMIT 1")
    .get(id);

  if (linked) {
    db.prepare("UPDATE waiters SET active = 0 WHERE id = ?").run(id);
    return NextResponse.json({
      ok: true,
      deactivated: true,
      message: "Garçom desativado porque possui pedidos vinculados",
    });
  }

  db.prepare("DELETE FROM waiters WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
