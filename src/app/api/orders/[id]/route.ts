import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import {
  getOrderWithDetails,
  recalculateOrderTotal,
} from "@/lib/orders";
import { markTableOccupied, releaseTable } from "@/lib/tables";
import type { OrderStatus } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

const VALID_STATUS = new Set<OrderStatus>([
  "open",
  "preparing",
  "ready",
  "closed",
  "cancelled",
]);

export async function GET(_request: NextRequest, { params }: Params) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const order = getOrderWithDetails(Number(id));

  if (!order) {
    return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
  }

  return NextResponse.json(order);
}

export async function PUT(request: NextRequest, { params }: Params) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const orderId = Number(id);
  const body = await request.json();
  const db = getDb();

  const current = db
    .prepare("SELECT * FROM orders WHERE id = ?")
    .get(orderId) as
    | { id: number; table_id: number; status: OrderStatus; notes: string }
    | undefined;

  if (!current) {
    return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
  }

  if (current.status === "closed" || current.status === "cancelled") {
    return NextResponse.json(
      { error: "Pedido já finalizado não pode ser editado" },
      { status: 400 }
    );
  }

  const notes =
    body.notes !== undefined ? String(body.notes).trim() : current.notes;
  const status = (body.status ?? current.status) as OrderStatus;

  if (!VALID_STATUS.has(status)) {
    return NextResponse.json({ error: "Status inválido" }, { status: 400 });
  }

  const update = db.transaction(() => {
    if (Array.isArray(body.items)) {
      if (body.items.length === 0) {
        throw new Error("Pedido precisa ter pelo menos um item");
      }

      db.prepare("DELETE FROM order_items WHERE order_id = ?").run(orderId);
      const insertItem = db.prepare(
        `INSERT INTO order_items (order_id, product_id, quantity, unit_price)
         VALUES (?, ?, ?, ?)`
      );

      for (const item of body.items) {
        const productId = Number(item.product_id);
        const quantity = Number(item.quantity);

        if (!productId || !Number.isInteger(quantity) || quantity <= 0) {
          throw new Error("Item inválido");
        }

        const product = db
          .prepare("SELECT id, price FROM products WHERE id = ?")
          .get(productId) as { id: number; price: number } | undefined;

        if (!product) {
          throw new Error("Produto não encontrado");
        }

        insertItem.run(orderId, productId, quantity, product.price);
      }

      recalculateOrderTotal(orderId, db);
    }

    const closedAt =
      status === "closed" || status === "cancelled"
        ? new Date().toISOString().replace("T", " ").slice(0, 19)
        : null;

    db.prepare(
      `UPDATE orders SET notes = ?, status = ?, closed_at = ? WHERE id = ?`
    ).run(notes, status, closedAt, orderId);

    if (status === "closed" || status === "cancelled") {
      releaseTable(current.table_id, db);
    } else {
      markTableOccupied(current.table_id, db);
    }
  });

  try {
    update();
    return NextResponse.json(getOrderWithDetails(orderId));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro ao atualizar pedido";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const orderId = Number(id);
  const db = getDb();

  const current = db
    .prepare("SELECT * FROM orders WHERE id = ?")
    .get(orderId) as { id: number; table_id: number; status: string } | undefined;

  if (!current) {
    return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
  }

  db.transaction(() => {
    db.prepare("DELETE FROM order_items WHERE order_id = ?").run(orderId);
    db.prepare("DELETE FROM orders WHERE id = ?").run(orderId);

    if (current.status !== "closed" && current.status !== "cancelled") {
      releaseTable(current.table_id, db);
    }
  })();

  return NextResponse.json({ ok: true });
}
