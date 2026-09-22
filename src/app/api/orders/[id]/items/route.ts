import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getOrderWithDetails, recalculateOrderTotal } from "@/lib/orders";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const orderId = Number(id);
  const body = await request.json();
  const productId = Number(body.product_id);
  const quantity = Number(body.quantity ?? 1);

  if (!productId || !Number.isInteger(quantity) || quantity <= 0) {
    return NextResponse.json({ error: "Item inválido" }, { status: 400 });
  }

  const db = getDb();
  const order = db
    .prepare("SELECT id, status FROM orders WHERE id = ?")
    .get(orderId) as { id: number; status: string } | undefined;

  if (!order) {
    return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
  }

  if (order.status === "closed" || order.status === "cancelled") {
    return NextResponse.json(
      { error: "Não é possível alterar pedido finalizado" },
      { status: 400 }
    );
  }

  const product = db
    .prepare("SELECT id, price, available FROM products WHERE id = ?")
    .get(productId) as
    | { id: number; price: number; available: number }
    | undefined;

  if (!product || product.available !== 1) {
    return NextResponse.json(
      { error: "Produto indisponível" },
      { status: 400 }
    );
  }

  const existing = db
    .prepare(
      "SELECT id, quantity FROM order_items WHERE order_id = ? AND product_id = ?"
    )
    .get(orderId, productId) as { id: number; quantity: number } | undefined;

  if (existing) {
    db.prepare("UPDATE order_items SET quantity = ? WHERE id = ?").run(
      existing.quantity + quantity,
      existing.id
    );
  } else {
    db.prepare(
      `INSERT INTO order_items (order_id, product_id, quantity, unit_price)
       VALUES (?, ?, ?, ?)`
    ).run(orderId, productId, quantity, product.price);
  }

  recalculateOrderTotal(orderId);
  return NextResponse.json(getOrderWithDetails(orderId));
}
