import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { hasOpenOrderOnTable } from "@/lib/tables";

type Params = { params: Promise<{ id: string }> };

const VALID_STATUS = new Set(["free", "occupied", "reserved"]);
const VALID_AREA = new Set(["outside", "inside"]);

export async function PUT(request: NextRequest, { params }: Params) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const body = await request.json();
  const seats = Number(body.seats);
  const status = String(body.status);
  const area = String(body.area ?? "inside");
  const tableId = Number(id);

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
  const existing = db.prepare("SELECT id FROM tables WHERE id = ?").get(id);
  if (!existing) {
    return NextResponse.json({ error: "Mesa não encontrada" }, { status: 404 });
  }

  if (status !== "occupied" && hasOpenOrderOnTable(tableId, db)) {
    return NextResponse.json(
      {
        error:
          "Mesa com pedido aberto deve permanecer ocupada. Finalize o pedido para liberá-la.",
      },
      { status: 400 }
    );
  }

  db.prepare("UPDATE tables SET seats = ?, status = ?, area = ? WHERE id = ?").run(
    seats,
    status,
    area,
    id
  );

  const table = db.prepare("SELECT * FROM tables WHERE id = ?").get(id);
  return NextResponse.json(table);
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const db = getDb();
  const existing = db.prepare("SELECT id FROM tables WHERE id = ?").get(id);

  if (!existing) {
    return NextResponse.json({ error: "Mesa não encontrada" }, { status: 404 });
  }

  if (hasOpenOrderOnTable(Number(id), db)) {
    return NextResponse.json(
      { error: "Não é possível excluir mesa com pedido aberto" },
      { status: 400 }
    );
  }

  db.prepare("DELETE FROM tables WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
