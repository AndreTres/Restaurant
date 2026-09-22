import { DatabaseSync } from "node:sqlite";
import fs from "fs";
import path from "path";
import { calculateOrderTotals } from "./pricing";
import { syncTablesAvailability } from "./tables";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "restaurant.db");

/** 7 externas (1–7) + 4 internas (8–11) */
export const DEFAULT_TABLES = [
  ...Array.from({ length: 7 }, (_, index) => ({
    number: index + 1,
    seats: 4,
    area: "outside" as const,
  })),
  ...Array.from({ length: 4 }, (_, index) => ({
    number: index + 8,
    seats: 4,
    area: "inside" as const,
  })),
];

export type AppDatabase = DatabaseSync & {
  transaction: <T>(fn: () => T) => () => T;
};

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function withTransaction(db: DatabaseSync) {
  return function transaction<T>(fn: () => T) {
    return () => {
      db.exec("BEGIN");
      try {
        const result = fn();
        db.exec("COMMIT");
        return result;
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    };
  };
}

function createSchema(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      price REAL NOT NULL,
      category TEXT NOT NULL DEFAULT 'Geral',
      available INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS waiters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS tables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      number INTEGER NOT NULL UNIQUE,
      seats INTEGER NOT NULL DEFAULT 4,
      area TEXT NOT NULL DEFAULT 'inside',
      status TEXT NOT NULL DEFAULT 'free',
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_id INTEGER NOT NULL,
      waiter_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      notes TEXT NOT NULL DEFAULT '',
      total REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      closed_at TEXT,
      FOREIGN KEY (table_id) REFERENCES tables(id),
      FOREIGN KEY (waiter_id) REFERENCES waiters(id)
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_price REAL NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );
  `);
}

function migrateSchema(db: DatabaseSync) {
  const columns = db.prepare("PRAGMA table_info(tables)").all() as {
    name: string;
  }[];
  const hasArea = columns.some((column) => column.name === "area");

  if (!hasArea) {
    db.exec(
      "ALTER TABLE tables ADD COLUMN area TEXT NOT NULL DEFAULT 'inside'"
    );
  }

  return !hasArea;
}

function ensureDefaultTables(db: DatabaseSync, areaJustAdded: boolean) {
  const insert = db.prepare(
    `INSERT INTO tables (number, seats, status, area)
     VALUES (?, ?, 'free', ?)
     ON CONFLICT(number) DO NOTHING`
  );

  for (const table of DEFAULT_TABLES) {
    insert.run(table.number, table.seats, table.area);
  }

  if (areaJustAdded) {
    const updateArea = db.prepare(
      "UPDATE tables SET area = ? WHERE number = ?"
    );
    for (const table of DEFAULT_TABLES) {
      updateArea.run(table.area, table.number);
    }
  }
}

function seedIfEmpty(db: DatabaseSync) {
  const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get() as
    | { count: number }
    | undefined;

  if (userCount && userCount.count > 0) return;

  db.prepare("INSERT INTO users (username, password) VALUES (?, ?)").run(
    "admin",
    "admin"
  );

  const insertProduct = db.prepare(
    "INSERT INTO products (name, description, price, category) VALUES (?, ?, ?, ?)"
  );
  insertProduct.run("X-Burger", "Hambúrguer artesanal com queijo", 28.9, "Lanches");
  insertProduct.run("X-Salada", "Hambúrguer com salada fresca", 26.5, "Lanches");
  insertProduct.run("Batata Frita", "Porção média crocante", 18.0, "Acompanhamentos");
  insertProduct.run("Refrigerante", "Lata 350ml", 7.5, "Bebidas");
  insertProduct.run("Suco Natural", "Copo 400ml", 12.0, "Bebidas");
  insertProduct.run("Petit Gateau", "Com sorvete de creme", 22.0, "Sobremesas");

  const insertWaiter = db.prepare("INSERT INTO waiters (name) VALUES (?)");
  insertWaiter.run("Ana Silva");
  insertWaiter.run("Carlos Souza");
  insertWaiter.run("Marina Costa");
}

function syncOrderTotalsWithService(db: DatabaseSync) {
  const orders = db.prepare("SELECT id FROM orders").all() as { id: number }[];
  const subtotalStmt = db.prepare(
    `SELECT COALESCE(SUM(quantity * unit_price), 0) as subtotal
     FROM order_items WHERE order_id = ?`
  );
  const updateStmt = db.prepare("UPDATE orders SET total = ? WHERE id = ?");

  for (const order of orders) {
    const { subtotal } = subtotalStmt.get(order.id) as { subtotal: number };
    const { total } = calculateOrderTotals(subtotal);
    updateStmt.run(total, order.id);
  }
}

let dbInstance: AppDatabase | null = null;

export function getDb(): AppDatabase {
  if (dbInstance) return dbInstance;

  ensureDataDir();
  const db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  createSchema(db);
  const areaJustAdded = migrateSchema(db);
  seedIfEmpty(db);
  ensureDefaultTables(db, areaJustAdded);
  syncOrderTotalsWithService(db);
  syncTablesAvailability(db);

  dbInstance = Object.assign(db, {
    transaction: withTransaction(db),
  });

  return dbInstance;
}
