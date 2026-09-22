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
  const description = String(body.description ?? "").trim();
  const price = Number(body.price);
  const category = String(body.category ?? "Geral").trim() || "Geral";
  const available = body.available === false || body.available === 0 ? 0 : 1;

  if (!name || Number.isNaN(price) || price < 0) {
    return NextResponse.json(
      { error: "Nome e preço válidos são obrigatórios" },
      { status: 400 }
    );
  }

  const db = getDb();
  const existing = db.prepare("SELECT id FROM products WHERE id = ?").get(id);
  if (!existing) {
    return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 });
  }

  db.prepare(
    `UPDATE products
     SET name = ?, description = ?, price = ?, category = ?, available = ?
     WHERE id = ?`
  ).run(name, description, price, category, available, id);

  const product = db.prepare("SELECT * FROM products WHERE id = ?").get(id);
  return NextResponse.json(product);
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const db = getDb();
  const existing = db.prepare("SELECT id FROM products WHERE id = ?").get(id);

  if (!existing) {
    return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 });
  }

  db.prepare("DELETE FROM products WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
