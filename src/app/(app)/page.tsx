"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import { formatMoney, formatTableLabel, orderStatusBadgeClass, statusLabel } from "@/lib/format";
import type { DashboardStats, OrderWithDetails } from "@/lib/types";

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [orders, setOrders] = useState<OrderWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [dashboard, openOrders] = await Promise.all([
          apiGet<DashboardStats>("/api/dashboard"),
          apiGet<OrderWithDetails[]>("/api/orders"),
        ]);
        setStats(dashboard);
        setOrders(openOrders.slice(0, 4));
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  if (loading || !stats) {
    return <p className="muted">Carregando painel...</p>;
  }

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Painel</h1>
          <p>Sabores de mi Tierra</p>
        </div>
      </header>

      <div className="grid-2" style={{ marginBottom: 12 }}>
        <div className="card stat-card">
          <div className="label">Pedidos abertos</div>
          <div className="value">{stats.openOrders}</div>
        </div>
        <div className="card stat-card">
          <div className="label">Receita de hoje</div>
          <div className="value" style={{ fontSize: "1.25rem" }}>
            {formatMoney(stats.todayRevenue)}
          </div>
        </div>
        <div className="card stat-card">
          <div className="label">Mesas livres</div>
          <div className="value">{stats.freeTables}</div>
        </div>
        <div className="card stat-card">
          <div className="label">Mesas ocupadas</div>
          <div className="value">{stats.occupiedTables}</div>
        </div>
      </div>

      <section className="card stack" style={{ marginBottom: 12 }}>
        <div className="actions-row">
          <strong style={{ flex: 2 }}>Atalhos</strong>
        </div>
        <div className="grid-2">
          <Link href="/orders" className="btn secondary">
            Pedidos
          </Link>
          <Link href="/products" className="btn secondary">
            Cardápio
          </Link>
          <Link href="/tables" className="btn secondary">
            Mesas
          </Link>
          <Link href="/history" className="btn secondary">
            Histórico
          </Link>
        </div>
      </section>

      <section className="card">
        <div className="actions-row" style={{ marginBottom: 8 }}>
          <strong style={{ flex: 2 }}>Pedidos em andamento</strong>
          <Link href="/orders" className="btn ghost">
            Ver todos
          </Link>
        </div>

        {orders.length === 0 ? (
          <p className="muted small" style={{ margin: 0 }}>
            Nenhum pedido aberto no momento.
          </p>
        ) : (
          orders.map((order) => (
            <Link key={order.id} href={`/orders?focus=${order.id}`} className="list-item">
              <div>
                <strong>
                  {formatTableLabel(order.table_number, order.table_area)}
                </strong>
                <div className="small muted">
                  {order.waiter_name} · {order.items.length} itens
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <span className={`badge ${orderStatusBadgeClass(order.status)}`}>
                  {statusLabel(order.status)}
                </span>
                <div className="small" style={{ marginTop: 6 }}>
                  {formatMoney(order.total)}
                </div>
              </div>
            </Link>
          ))
        )}
      </section>
    </>
  );
}
