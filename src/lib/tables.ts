import type { DatabaseSync } from "node:sqlite";
import { getDb } from "./db";

export function hasOpenOrderOnTable(
  tableId: number,
  database?: DatabaseSync
) {
  const db = database ?? getDb();
  const open = db
    .prepare(
      `SELECT id FROM orders
       WHERE table_id = ? AND status NOT IN ('closed', 'cancelled')
       LIMIT 1`
    )
    .get(tableId);

  return Boolean(open);
}

export function markTableOccupied(tableId: number, database?: DatabaseSync) {
  const db = database ?? getDb();
  db.prepare("UPDATE tables SET status = 'occupied' WHERE id = ?").run(tableId);
}

export function releaseTable(tableId: number, database?: DatabaseSync) {
  const db = database ?? getDb();
  db.prepare("UPDATE tables SET status = 'free' WHERE id = ?").run(tableId);
}

/** Mantém mesas com pedido aberto como ocupadas e libera as demais sem pedido. */
export function syncTablesAvailability(database?: DatabaseSync) {
  const db = database ?? getDb();

  db.prepare(
    `UPDATE tables
     SET status = 'occupied'
     WHERE id IN (
       SELECT DISTINCT table_id FROM orders
       WHERE status NOT IN ('closed', 'cancelled')
     )`
  ).run();

  db.prepare(
    `UPDATE tables
     SET status = 'free'
     WHERE status = 'occupied'
       AND id NOT IN (
         SELECT DISTINCT table_id FROM orders
         WHERE status NOT IN ('closed', 'cancelled')
       )`
  ).run();
}
