import {
  getHistoryDateRange,
  parseDateInput,
  toDateInputValue,
  type HistoryFilters,
} from "./order-filters";
import { roundMoney } from "./pricing";
import type { OrderWithDetails } from "./types";

export type ChartMetric = "total" | "count";
export type ChartGroup = "hour" | "day" | "week" | "month";

export type ChartPoint = {
  key: string;
  label: string;
  total: number;
  count: number;
};

const WEEKDAYS = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];
const MONTHS = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function orderDate(order: OrderWithDetails) {
  const raw = (order.closed_at || order.created_at).replace(" ", "T");
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfWeek(date: Date) {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = result.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + diff);
  return result;
}

function dayKey(date: Date) {
  return toDateInputValue(date);
}

function weekKey(date: Date) {
  return toDateInputValue(startOfWeek(date));
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

function hourKey(date: Date) {
  return String(date.getHours());
}

export function defaultChartGroup(filters: HistoryFilters): ChartGroup {
  if (filters.period === "day") return "hour";
  if (filters.period === "all") return "month";
  return "day";
}

function rangeFromOrders(orders: OrderWithDetails[]) {
  const dates = orders
    .map(orderDate)
    .filter((date): date is Date => Boolean(date))
    .sort((a, b) => a.getTime() - b.getTime());

  if (dates.length === 0) return null;
  return { from: dates[0], to: dates[dates.length - 1] };
}

function resolveRange(filters: HistoryFilters, orders: OrderWithDetails[]) {
  const range = getHistoryDateRange(filters);
  if (range) {
    const from = parseDateInput(range.from);
    const to = parseDateInput(range.to);
    if (from && to) return { from, to };
  }
  return rangeFromOrders(orders);
}

function keyFor(date: Date, group: ChartGroup) {
  if (group === "hour") return hourKey(date);
  if (group === "week") return weekKey(date);
  if (group === "month") return monthKey(date);
  return dayKey(date);
}

function labelFor(key: string, group: ChartGroup, filters: HistoryFilters) {
  if (group === "hour") return `${key.padStart(2, "0")}h`;

  if (group === "month") {
    const [year, month] = key.split("-").map(Number);
    return `${MONTHS[(month || 1) - 1]}/${String(year).slice(2)}`;
  }

  const date = parseDateInput(key) ?? parseDateInput(`${key}-01`);
  if (!date) return key;

  if (group === "week") {
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}`;
  }

  if (filters.period === "week") {
    const weekday = (date.getDay() + 6) % 7;
    return WEEKDAYS[weekday];
  }

  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}`;
}

function buildKeys(
  filters: HistoryFilters,
  orders: OrderWithDetails[],
  group: ChartGroup
) {
  if (group === "hour") {
    const hours = orders
      .map(orderDate)
      .filter((date): date is Date => Boolean(date))
      .map((date) => date.getHours());
    const start = hours.length ? Math.min(11, ...hours) : 11;
    const end = hours.length ? Math.max(22, ...hours) : 22;
    const keys = [];
    for (let hour = start; hour <= end; hour += 1) {
      keys.push(String(hour));
    }
    return keys;
  }

  const range = resolveRange(filters, orders);
  if (!range) return [];

  if (group === "month") {
    const keys = [];
    const cursor = new Date(range.from.getFullYear(), range.from.getMonth(), 1);
    const last = new Date(range.to.getFullYear(), range.to.getMonth(), 1);
    while (cursor <= last) {
      keys.push(monthKey(cursor));
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return keys;
  }

  if (group === "week") {
    const keys = [];
    const cursor = startOfWeek(range.from);
    const last = startOfWeek(range.to);
    while (cursor <= last) {
      keys.push(weekKey(cursor));
      cursor.setDate(cursor.getDate() + 7);
    }
    return keys;
  }

  const keys = [];
  const cursor = new Date(
    range.from.getFullYear(),
    range.from.getMonth(),
    range.from.getDate()
  );
  const last = new Date(
    range.to.getFullYear(),
    range.to.getMonth(),
    range.to.getDate()
  );
  while (cursor <= last) {
    keys.push(dayKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  if (keys.length > 31) return [];
  return keys;
}

export function buildChartSeries(
  orders: OrderWithDetails[],
  filters: HistoryFilters,
  group: ChartGroup
): ChartPoint[] {
  const keys = buildKeys(filters, orders, group);
  const buckets = new Map<string, ChartPoint>();

  for (const key of keys) {
    buckets.set(key, {
      key,
      label: labelFor(key, group, filters),
      total: 0,
      count: 0,
    });
  }

  for (const order of orders) {
    const date = orderDate(order);
    if (!date) continue;
    const key = keyFor(date, group);
    let current = buckets.get(key);
    if (!current) {
      current = {
        key,
        label: labelFor(key, group, filters),
        total: 0,
        count: 0,
      };
      buckets.set(key, current);
    }
    current.count += 1;
    current.total = roundMoney(current.total + order.total);
  }

  const points = Array.from(buckets.values());
  if (group === "hour") {
    return points.sort((a, b) => Number(a.key) - Number(b.key));
  }
  return points.sort((a, b) => a.key.localeCompare(b.key));
}

export function buildWaiterSeries(orders: OrderWithDetails[]): ChartPoint[] {
  const buckets = new Map<string, ChartPoint>();

  for (const order of orders) {
    const name = order.waiter_name || "Garçom";
    const current = buckets.get(name) ?? {
      key: name,
      label: name,
      total: 0,
      count: 0,
    };
    current.count += 1;
    current.total = roundMoney(current.total + order.total);
    buckets.set(name, current);
  }

  return Array.from(buckets.values()).sort((a, b) => b.total - a.total);
}

export function peakPoint(points: ChartPoint[], metric: ChartMetric) {
  if (points.length === 0) return null;
  return points.reduce((best, point) =>
    point[metric] > best[metric] ? point : best
  );
}
