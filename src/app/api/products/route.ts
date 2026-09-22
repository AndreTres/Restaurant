import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET() {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

  const products = getDb()
    .prepare("SELECT * FROM products ORDER BY category, name")
    .all();

  return NextResponse.json(products);
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;

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

  const result = getDb()
    .prepare(
      `INSERT INTO products (name, description, price, category, available)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(name, description, price, category, available);

  const product = getDb()
    .prepare("SELECT * FROM products WHERE id = ?")
    .get(result.lastInsertRowid);

  return NextResponse.json(product, { status: 201 });
}
