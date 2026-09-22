"use client";

import { Suspense, useEffect, useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { OrderTotals } from "@/components/OrderTotals";
import { useToast } from "@/components/Toast";
import { apiGet } from "@/lib/api";
import {
  describeHistoryRange,
  historyFiltersToQuery,
  toDateInputValue,
  type HistoryFilters,
  type HistoryPeriod,
} from "@/lib/order-filters";
import {
  formatDateTime,
  formatMoney,
  formatTableLabel,
  orderStatusBadgeClass,
  statusLabel,
} from "@/lib/format";
import type { OrderWithDetails } from "@/lib/types";

const PERIOD_OPTIONS: { value: HistoryPeriod; label: string }[] = [
  { value: "week", label: "Semana" },
  { value: "month", label: "Mês" },
  { value: "all", label: "Todos" },
];

function HistoryContent() {
  const { showToast } = useToast();
  const [orders, setOrders] = useState<OrderWithDetails[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState<HistoryFilters>({
    period: "week",
    date: toDateInputValue(new Date()),
  });

  useEffect(() => {
    let active = true;

    if (initialLoading) {
      setRefreshing(false);
    } else {
      setRefreshing(true);
    }

    apiGet<OrderWithDetails[]>(`/api/orders?${historyFiltersToQuery(filters)}`)
      .then((data) => {
        if (!active) return;
        setOrders(data);
      })
      .catch((error) => {
        if (!active) return;
        showToast(error instanceof Error ? error.message : "Erro", "error");
      })
      .finally(() => {
        if (!active) return;
        setInitialLoading(false);
        setRefreshing(false);
      });

    return () => {
      active = false;
    };
    // initialLoading intencionalmente fora: só distingue 1ª carga vs troca de filtro
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, showToast]);

  function setPeriod(period: HistoryPeriod) {
    setFilters((current) => ({
      ...current,
      period,
      date: current.date || toDateInputValue(new Date()),
    }));
  }

  function setDate(date: string) {
    setFilters({
      period: "day",
      date,
    });
  }

  return (
    <>
      <section className="card stack" style={{ marginBottom: 12 }}>
        <div className="status-pills" style={{ marginBottom: 0 }}>
          {PERIOD_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={filters.period === option.value ? "active" : ""}
              onClick={() => setPeriod(option.value)}
            >
              {option.label}
            </button>
          ))}
          {filters.period === "day" && (
            <button type="button" className="active">
              Dia
            </button>
          )}
        </div>

        <div className="field">
          <label htmlFor="history-date">Buscar por data</label>
          <input
            id="history-date"
            type="date"
            value={filters.date || toDateInputValue(new Date())}
            onChange={(event) => setDate(event.target.value)}
          />
        </div>

        <p className="small muted" style={{ margin: 0 }}>
          {describeHistoryRange(filters)}
          {filters.period === "day" ? " · filtro por dia" : ""}
        </p>
      </section>

      {initialLoading ? (
        <p className="muted">Carregando histórico...</p>
      ) : (
        <div
          className={`history-results${refreshing ? " is-refreshing" : ""}`}
          aria-busy={refreshing}
        >
          {orders.length === 0 ? (
            <EmptyState
              title="Nenhum pedido neste período"
              description="Pedidos finalizados neste filtro aparecerão aqui."
            />
          ) : (
            <div className="stack">
              {orders.map((order) => (
                <article key={order.id} className="card history-card">
                  <div className="actions-row">
                    <strong style={{ flex: 2 }}>
                      {formatTableLabel(order.table_number, order.table_area)}
                    </strong>
                    <span
                      className={`badge ${orderStatusBadgeClass(order.status)}`}
                    >
                      {statusLabel(order.status)}
                    </span>
                  </div>
                  <p className="small muted" style={{ margin: "8px 0" }}>
                    {order.waiter_name} ·{" "}
                    {formatDateTime(order.closed_at || order.created_at)}
                  </p>
                  <div className="stack" style={{ gap: 6 }}>
                    {order.items.map((item) => (
                      <div
                        key={item.id}
                        className="small"
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                        }}
                      >
                        <span>
                          {item.quantity}x {item.product_name}
                        </span>
                        <span>
                          {formatMoney(item.quantity * item.unit_price)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <OrderTotals
                    subtotal={order.subtotal}
                    serviceFee={order.service_fee}
                    total={order.total}
                  />
                </article>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}

export default function HistoryPage() {
  return (
    <>
      <header className="page-header">
        <div>
          <h1>Histórico</h1>
          <p>Pedidos finalizados - filtre por semana, mês ou data.</p>
        </div>
      </header>

      <Suspense fallback={<p className="muted">Carregando...</p>}>
        <HistoryContent />
      </Suspense>
    </>
  );
}
