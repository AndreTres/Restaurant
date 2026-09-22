import type { OrderStatus } from "./types";

export function formatMoney(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function formatDateTime(value: string) {
  const date = new Date(value.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function statusLabel(status: OrderStatus | string) {
  const map: Record<string, string> = {
    open: "Aberto",
    preparing: "Aberto",
    ready: "Aberto",
    closed: "Finalizado",
    cancelled: "Cancelado",
    free: "Livre",
    occupied: "Ocupada",
    reserved: "Reservada",
    outside: "Externa",
    inside: "Interna",
  };

  return map[status] ?? status;
}

/** Classe visual do badge: só aberto ou finalizado (cancelado à parte) */
export function orderStatusBadgeClass(status: string) {
  if (status === "closed") return "closed";
  if (status === "cancelled") return "cancelled";
  return "open";
}

export function formatTableLabel(
  number: number,
  area?: string | null
) {
  if (!area) return `Mesa ${number}`;
  return `Mesa ${number} - ${statusLabel(area)}`;
}
