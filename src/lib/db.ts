import { DatabaseSync } from "node:sqlite";
import fs from "fs";
import path from "path";
import { calculateOrderTotals } from "./pricing";
import { syncTablesAvailability } from "./tables";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "restaurant.db");

export const DEFAULT_TABLES = [
  ...Array.from({ length: 9 }, (_, index) => ({
    number: index + 1,
    seats: 4,
    area: "outside" as const,
  })),
  ...Array.from({ length: 8 }, (_, index) => ({
    number: index + 1,
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
      number INTEGER NOT NULL,
      seats INTEGER NOT NULL DEFAULT 4,
      area TEXT NOT NULL DEFAULT 'inside',
      status TEXT NOT NULL DEFAULT 'free',
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      UNIQUE(number, area)
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

function hasGlobalNumberUnique(db: DatabaseSync) {
  const indexes = db.prepare("PRAGMA index_list(tables)").all() as {
    name: string;
    unique: number;
  }[];

  for (const index of indexes) {
    if (!index.unique) continue;
    const columns = db
      .prepare(`PRAGMA index_info(${JSON.stringify(index.name)})`)
      .all() as { name: string }[];
    if (columns.length === 1 && columns[0].name === "number") {
      return true;
    }
  }

  return false;
}

function rebuildTablesAreaUnique(db: DatabaseSync) {
  db.exec("PRAGMA foreign_keys = OFF");
  db.exec(`
    CREATE TABLE tables_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      number INTEGER NOT NULL,
      seats INTEGER NOT NULL DEFAULT 4,
      area TEXT NOT NULL DEFAULT 'inside',
      status TEXT NOT NULL DEFAULT 'free',
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      UNIQUE(number, area)
    );
    INSERT INTO tables_new (id, number, seats, area, status, created_at)
    SELECT id, number, seats, area, status, created_at FROM tables;
    DROP TABLE tables;
    ALTER TABLE tables_new RENAME TO tables;
  `);
  db.exec("PRAGMA foreign_keys = ON");
}

function renumberTablesByArea(db: DatabaseSync, area: "outside" | "inside") {
  const rows = db
    .prepare("SELECT id FROM tables WHERE area = ? ORDER BY number, id")
    .all(area) as { id: number }[];
  const update = db.prepare("UPDATE tables SET number = ? WHERE id = ?");

  rows.forEach((row, index) => {
    update.run(9000 + index, row.id);
  });
  rows.forEach((row, index) => {
    update.run(index + 1, row.id);
  });
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

  if (hasGlobalNumberUnique(db)) {
    rebuildTablesAreaUnique(db);
  }

  return !hasArea;
}

function ensureDefaultTables(db: DatabaseSync, areaJustAdded: boolean) {
  if (areaJustAdded) {
    db.prepare(
      "UPDATE tables SET area = 'outside' WHERE number BETWEEN 1 AND 7"
    ).run();
    db.prepare(
      "UPDATE tables SET area = 'inside' WHERE number >= 8"
    ).run();
  }

  renumberTablesByArea(db, "outside");
  renumberTablesByArea(db, "inside");

  const insert = db.prepare(
    `INSERT INTO tables (number, seats, status, area)
     VALUES (?, ?, 'free', ?)
     ON CONFLICT(number, area) DO NOTHING`
  );

  for (const table of DEFAULT_TABLES) {
    insert.run(table.number, table.seats, table.area);
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
