"use client";

import { Suspense, useEffect, useState } from "react";
import { ConfirmModal } from "@/components/ConfirmModal";
import { EmptyState } from "@/components/EmptyState";
import { OrderTotals } from "@/components/OrderTotals";
import { useToast } from "@/components/Toast";
import { apiGet, apiSend } from "@/lib/api";
import {
  describeHistoryRange,
  historyFiltersToQuery,
  toDateInputValue,
  type HistoryFilters,
  type HistoryPeriod,
} from "@/lib/order-filters";
import {
  formatDateTime,
  formatIsoDate,
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
  const [pendingDelete, setPendingDelete] = useState<OrderWithDetails | null>(
    null
  );

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

  async function deleteOrder(order: OrderWithDetails) {
    try {
      await apiSend(`/api/orders/${order.id}`, "DELETE");
      setOrders((current) => current.filter((item) => item.id !== order.id));
      showToast("Pedido excluído");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Erro", "error");
    }
  }

  return (
    <>
      <section className="card stack history-filters" style={{ marginBottom: 12 }}>
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
          <div className="date-field">
            <span className="date-field-value">
              {formatIsoDate(filters.date || toDateInputValue(new Date()))}
            </span>
            <input
              id="history-date"
              type="date"
              value={filters.date || toDateInputValue(new Date())}
              onChange={(event) => setDate(event.target.value)}
            />
            <span className="date-field-icon" aria-hidden="true">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M16 2v4" />
                <path d="M8 2v4" />
                <path d="M3 10h18" />
              </svg>
            </span>
          </div>
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
                  <div className="history-card-top">
                    <div className="history-card-heading">
                      <strong>
                        {formatTableLabel(order.table_number, order.table_area)}
                      </strong>
                      <span
                        className={`badge ${orderStatusBadgeClass(order.status)}`}
                      >
                        {statusLabel(order.status)}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="btn ghost history-delete"
                      aria-label="Excluir pedido"
                      onClick={() => setPendingDelete(order)}
                    >
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M3 6h18" />
                        <path d="M8 6V4h8v2" />
                        <path d="M19 6l-1 14H6L5 6" />
                        <path d="M10 11v6" />
                        <path d="M14 11v6" />
                      </svg>
                    </button>
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

      <ConfirmModal
        open={Boolean(pendingDelete)}
        title="Excluir pedido"
        message={
          pendingDelete
            ? `Excluir o pedido da ${formatTableLabel(pendingDelete.table_number, pendingDelete.table_area)}? Esta ação não pode ser desfeita.`
            : ""
        }
        confirmLabel="Excluir"
        danger
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) void deleteOrder(pendingDelete);
        }}
      />
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
