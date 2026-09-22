/** Filtros simples do histórico de pedidos finalizados */

export type HistoryPeriod = "all" | "week" | "month" | "day";

export type HistoryFilters = {
  period: HistoryPeriod;
  /** Data âncora no formato YYYY-MM-DD (usada em day / opcional em week e month) */
  date?: string;
};

export type DateRange = {
  from: string;
  to: string;
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function toDateInputValue(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseDateInput(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

/** Início da semana (segunda-feira) da data informada */
function startOfWeek(date: Date) {
  const result = new Date(date);
  const day = result.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + diff);
  return result;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

/**
 * Converte o filtro da UI em intervalo de datas.
 * Retorna null quando o período é "todos" (sem recorte).
 */
export function getHistoryDateRange(filters: HistoryFilters): DateRange | null {
  const anchor =
    (filters.date && parseDateInput(filters.date)) || new Date();

  if (filters.period === "all") {
    return null;
  }

  if (filters.period === "day") {
    const day = toDateInputValue(anchor);
    return { from: day, to: day };
  }

  if (filters.period === "week") {
    const start = startOfWeek(anchor);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return {
      from: toDateInputValue(start),
      to: toDateInputValue(end),
    };
  }

  // month
  return {
    from: toDateInputValue(startOfMonth(anchor)),
    to: toDateInputValue(endOfMonth(anchor)),
  };
}

export function parseHistoryFilters(params: {
  period?: string | null;
  date?: string | null;
}): HistoryFilters {
  const periodParam = params.period ?? "week";
  const period: HistoryPeriod =
    periodParam === "all" ||
    periodParam === "week" ||
    periodParam === "month" ||
    periodParam === "day"
      ? periodParam
      : "week";

  const date = params.date?.trim() || undefined;

  if (period === "day" && !date) {
    return { period: "day", date: toDateInputValue(new Date()) };
  }

  return { period, date };
}

export function historyFiltersToQuery(filters: HistoryFilters) {
  const query = new URLSearchParams();
  query.set("history", "1");
  query.set("period", filters.period);
  if (filters.date) {
    query.set("date", filters.date);
  }
  return query.toString();
}

export function describeHistoryRange(filters: HistoryFilters) {
  const range = getHistoryDateRange(filters);
  if (!range) return "Todos os pedidos finalizados";

  if (range.from === range.to) {
    const [year, month, day] = range.from.split("-");
    return `Dia ${day}/${month}/${year}`;
  }

  const [fy, fm, fd] = range.from.split("-");
  const [ty, tm, td] = range.to.split("-");
  return `${fd}/${fm}/${fy} até ${td}/${tm}/${ty}`;
}
