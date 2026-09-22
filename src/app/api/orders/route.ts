import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { parseHistoryFilters } from "@/lib/order-filters";
import {
  getOrderWithDetails,
  listOrders,
  recalculateOrderTotal,
} from "@/lib/orders";
import { markTableOccupied } from "@/lib/tables";

export async function GET(request: NextRequest) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  const history = request.nextUrl.searchParams.get("history") === "1";
  const status = request.nextUrl.searchParams.get("status") ?? undefined;
  const filters = history
    ? parseHistoryFilters({
        period: request.nextUrl.searchParams.get("period"),
        date: request.nextUrl.searchParams.get("date"),
      })
    : undefined;

  return NextResponse.json(listOrders({ history, status, filters }));
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  const body = await request.json();
  const tableId = Number(body.table_id);
  const waiterId = Number(body.waiter_id);
  const notes = String(body.notes ?? "").trim();
  const items = Array.isArray(body.items) ? body.items : [];

  if (!tableId || !waiterId) {
    return NextResponse.json(
      { error: "Mesa e garçom são obrigatórios" },
      { status: 400 }
    );
  }

  if (items.length === 0) {
    return NextResponse.json(
      { error: "Adicione pelo menos um produto" },
      { status: 400 }
    );
  }

  const db = getDb();
  const table = db
    .prepare("SELECT * FROM tables WHERE id = ?")
    .get(tableId) as { id: number; status: string } | undefined;
  const waiter = db
    .prepare("SELECT * FROM waiters WHERE id = ? AND active = 1")
    .get(waiterId);

  if (!table) {
    return NextResponse.json({ error: "Mesa não encontrada" }, { status: 404 });
  }

  if (table.status !== "free") {
    return NextResponse.json(
      { error: "Esta mesa não está disponível" },
      { status: 400 }
    );
  }

  if (!waiter) {
    return NextResponse.json(
      { error: "Garçom não encontrado ou inativo" },
      { status: 404 }
    );
  }

  const openOnTable = db
    .prepare(
      `SELECT id FROM orders
       WHERE table_id = ? AND status NOT IN ('closed', 'cancelled')
       LIMIT 1`
    )
    .get(tableId);

  if (openOnTable) {
    return NextResponse.json(
      { error: "Esta mesa já possui um pedido aberto" },
      { status: 400 }
    );
  }

  const create = db.transaction(() => {
    const orderResult = db
      .prepare(
        `INSERT INTO orders (table_id, waiter_id, status, notes)
         VALUES (?, ?, 'open', ?)`
      )
      .run(tableId, waiterId, notes);

    const orderId = Number(orderResult.lastInsertRowid);
    const insertItem = db.prepare(
      `INSERT INTO order_items (order_id, product_id, quantity, unit_price)
       VALUES (?, ?, ?, ?)`
    );

    for (const item of items) {
      const productId = Number(item.product_id);
      const quantity = Number(item.quantity);

      if (!productId || !Number.isInteger(quantity) || quantity <= 0) {
        throw new Error("Item inválido");
      }

      const product = db
        .prepare("SELECT id, price, available FROM products WHERE id = ?")
        .get(productId) as
        | { id: number; price: number; available: number }
        | undefined;

      if (!product || product.available !== 1) {
        throw new Error("Produto indisponível");
      }

      insertItem.run(orderId, productId, quantity, product.price);
    }

    recalculateOrderTotal(orderId, db);
    markTableOccupied(tableId, db);

    return orderId;
  });

  try {
    const orderId = create();
    return NextResponse.json(getOrderWithDetails(orderId), { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro ao criar pedido";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
