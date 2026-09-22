import { DatabaseSync } from "node:sqlite";
import { getDb } from "./db";
import {
  getHistoryDateRange,
  type HistoryFilters,
} from "./order-filters";
import { calculateOrderTotals, sumItemsSubtotal } from "./pricing";
import type { DashboardStats, OrderWithDetails } from "./types";

export function recalculateOrderTotal(
  orderId: number,
  database?: DatabaseSync
) {
  const db = database ?? getDb();
  const result = db
    .prepare(
      `SELECT COALESCE(SUM(quantity * unit_price), 0) as subtotal
       FROM order_items WHERE order_id = ?`
    )
    .get(orderId) as { subtotal: number };

  const { total } = calculateOrderTotals(result.subtotal);
  db.prepare("UPDATE orders SET total = ? WHERE id = ?").run(total, orderId);
  return total;
}

function attachPricing<T extends { total: number; items: OrderWithDetails["items"] }>(
  order: T
): T & { subtotal: number; service_fee: number; total: number } {
  const subtotal = sumItemsSubtotal(order.items);
  const { serviceFee, total } = calculateOrderTotals(subtotal);

  return {
    ...order,
    subtotal,
    service_fee: serviceFee,
    total,
  };
}

export function getOrderWithDetails(orderId: number): OrderWithDetails | null {
  const db = getDb();

  const order = db
    .prepare(
      `SELECT o.*, t.number as table_number, t.area as table_area, w.name as waiter_name
       FROM orders o
       JOIN tables t ON t.id = o.table_id
       JOIN waiters w ON w.id = o.waiter_id
       WHERE o.id = ?`
    )
    .get(orderId) as Omit<OrderWithDetails, "items" | "subtotal" | "service_fee"> | undefined;

  if (!order) return null;

  const items = db
    .prepare(
      `SELECT oi.*, p.name as product_name
       FROM order_items oi
       JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = ?
       ORDER BY oi.id`
    )
    .all(orderId) as OrderWithDetails["items"];

  return attachPricing({ ...order, items });
}

export function listOrders(options: {
  history?: boolean;
  status?: string;
  filters?: HistoryFilters;
} = {}): OrderWithDetails[] {
  const db = getDb();
  const { history = false, status, filters } = options;

  const clauses: string[] = [];
  const params: string[] = [];

  if (status) {
    clauses.push("o.status = ?");
    params.push(status);
  } else if (history) {
    // Histórico: apenas finalizados (sem cancelados)
    clauses.push("o.status = 'closed'");
  } else {
    clauses.push("o.status NOT IN ('closed', 'cancelled')");
  }

  if (history && filters) {
    const range = getHistoryDateRange(filters);
    if (range) {
      clauses.push(
        "date(COALESCE(o.closed_at, o.created_at)) BETWEEN date(?) AND date(?)"
      );
      params.push(range.from, range.to);
    }
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";

  const orders = db
    .prepare(
      `SELECT o.*, t.number as table_number, t.area as table_area, w.name as waiter_name
       FROM orders o
       JOIN tables t ON t.id = o.table_id
       JOIN waiters w ON w.id = o.waiter_id
       ${where}
       ORDER BY COALESCE(o.closed_at, o.created_at) DESC`
    )
    .all(...params) as Omit<OrderWithDetails, "items" | "subtotal" | "service_fee">[];

  return orders.map((order) => {
    const items = db
      .prepare(
        `SELECT oi.*, p.name as product_name
         FROM order_items oi
         JOIN products p ON p.id = oi.product_id
         WHERE oi.order_id = ?
         ORDER BY oi.id`
      )
      .all(order.id) as OrderWithDetails["items"];

    return attachPricing({ ...order, items });
  });
}

export function getDashboardStats(): DashboardStats {
  const db = getDb();

  const openOrders = (
    db
      .prepare(
        `SELECT COUNT(*) as count FROM orders
         WHERE status NOT IN ('closed', 'cancelled')`
      )
      .get() as { count: number }
  ).count;

  const freeTables = (
    db
      .prepare(`SELECT COUNT(*) as count FROM tables WHERE status = 'free'`)
      .get() as { count: number }
  ).count;

  const occupiedTables = (
    db
      .prepare(`SELECT COUNT(*) as count FROM tables WHERE status = 'occupied'`)
      .get() as { count: number }
  ).count;

  const today = db
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN status = 'closed' THEN total ELSE 0 END), 0) as revenue,
         COUNT(*) as orders
       FROM orders
       WHERE date(created_at) = date('now', 'localtime')`
    )
    .get() as { revenue: number; orders: number };

  const activeWaiters = (
    db
      .prepare(`SELECT COUNT(*) as count FROM waiters WHERE active = 1`)
      .get() as { count: number }
  ).count;

  const productsCount = (
    db.prepare(`SELECT COUNT(*) as count FROM products`).get() as { count: number }
  ).count;

  return {
    openOrders,
    freeTables,
    occupiedTables,
    todayRevenue: today.revenue,
    todayOrders: today.orders,
    activeWaiters,
    productsCount,
  };
}
