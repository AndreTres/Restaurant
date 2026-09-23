"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmModal } from "@/components/ConfirmModal";
import { FormModal, Modal } from "@/components/Modal";
import { OrderTotals } from "@/components/OrderTotals";
import { useToast } from "@/components/Toast";
import { apiGet, apiSend } from "@/lib/api";
import { formatMoney, formatTableLabel, orderStatusBadgeClass, statusLabel } from "@/lib/format";
import {
  calculateOrderTotals,
  isOrderEditable,
  servicePercentLabel,
  sumItemsSubtotal,
} from "@/lib/pricing";
import type {
  OrderStatus,
  OrderWithDetails,
  Product,
  Table,
  Waiter,
} from "@/lib/types";

type DraftItem = {
  product_id: number;
  name: string;
  quantity: number;
  unit_price: number;
};

type ConfirmAction =
  | { type: "finish"; order: OrderWithDetails }
  | { type: "cancel"; order: OrderWithDetails }
  | { type: "remove-item"; productId: number; productName: string };

export default function OrdersClient() {
  const { showToast } = useToast();
  const searchParams = useSearchParams();
  const focusId = Number(searchParams.get("focus") || 0);

  const [orders, setOrders] = useState<OrderWithDetails[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [waiters, setWaiters] = useState<Waiter[]>([]);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<OrderWithDetails | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

  const [tableId, setTableId] = useState("");
  const [waiterId, setWaiterId] = useState("");
  const [notes, setNotes] = useState("");
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);

  const freeTables = useMemo(
    () => tables.filter((table) => table.status === "free"),
    [tables]
  );

  const activeWaiters = useMemo(
    () => waiters.filter((waiter) => waiter.active === 1),
    [waiters]
  );

  const availableProducts = useMemo(
    () => products.filter((product) => product.available === 1),
    [products]
  );

  const productsByCategory = useMemo(() => {
    const groups = new Map<string, Product[]>();

    for (const product of availableProducts) {
      const category = product.category?.trim() || "Geral";
      const list = groups.get(category) ?? [];
      list.push(product);
      groups.set(category, list);
    }

    return Array.from(groups.entries()).sort(([a], [b]) =>
      a.localeCompare(b, "pt-BR")
    );
  }, [availableProducts]);

  const draftTotals = useMemo(() => {
    return calculateOrderTotals(sumItemsSubtotal(draftItems));
  }, [draftItems]);

  function renderProductGroups(onAdd: (product: Product) => void) {
    if (productsByCategory.length === 0) {
      return <p className="muted small">Nenhum produto disponível.</p>;
    }

    return productsByCategory.map(([category, items]) => (
      <div key={category} className="product-group">
        <div className="product-group-title">{category}</div>
        <div className="stack" style={{ gap: 8 }}>
          {items.map((product) => (
            <button
              key={product.id}
              type="button"
              className="btn secondary"
              onClick={() => onAdd(product)}
            >
              + {product.name} ({formatMoney(product.price)})
            </button>
          ))}
        </div>
      </div>
    ));
  }
  async function loadAll() {
    const [ordersData, productsData, tablesData, waitersData] =
      await Promise.all([
        apiGet<OrderWithDetails[]>("/api/orders"),
        apiGet<Product[]>("/api/products"),
        apiGet<Table[]>("/api/tables"),
        apiGet<Waiter[]>("/api/waiters"),
      ]);

    setOrders(ordersData);
    setProducts(productsData);
    setTables(tablesData);
    setWaiters(waitersData);

    if (focusId) {
      const focused = ordersData.find((order) => order.id === focusId);
      if (focused) {
        setSelected(focused);
        setDetailOpen(true);
      }
    }
  }

  useEffect(() => {
    loadAll()
      .catch((error) =>
        showToast(error instanceof Error ? error.message : "Erro", "error")
      )
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function refreshSelected(ordersData: OrderWithDetails[]) {
    if (!selected) return;
    const updated = ordersData.find((order) => order.id === selected.id);
    if (updated) setSelected(updated);
  }

  function resetCreateForm() {
    setTableId(freeTables[0] ? String(freeTables[0].id) : "");
    setWaiterId(activeWaiters[0] ? String(activeWaiters[0].id) : "");
    setNotes("");
    setDraftItems([]);
  }

  function openCreate() {
    resetCreateForm();
    setCreateOpen(true);
  }

  function addDraftProduct(product: Product) {
    setDraftItems((current) => {
      const existing = current.find((item) => item.product_id === product.id);
      if (existing) {
        return current.map((item) =>
          item.product_id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      return [
        ...current,
        {
          product_id: product.id,
          name: product.name,
          quantity: 1,
          unit_price: product.price,
        },
      ];
    });
  }

  function changeDraftQty(productId: number, delta: number) {
    setDraftItems((current) =>
      current
        .map((item) =>
          item.product_id === productId
            ? { ...item, quantity: item.quantity + delta }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();

    try {
      await apiSend("/api/orders", "POST", {
        table_id: Number(tableId),
        waiter_id: Number(waiterId),
        notes,
        items: draftItems.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
        })),
      });

      showToast("Pedido criado");
      setCreateOpen(false);
      await loadAll();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Erro", "error");
    }
  }

  async function updateStatus(order: OrderWithDetails, status: OrderStatus) {
    try {
      const updated = await apiSend<OrderWithDetails>(
        `/api/orders/${order.id}`,
        "PUT",
        { status }
      );
      setSelected(updated);
      showToast(
        status === "closed"
          ? "Pedido finalizado"
          : status === "cancelled"
            ? "Pedido cancelado"
            : "Status atualizado"
      );
      const ordersData = await apiGet<OrderWithDetails[]>("/api/orders");
      setOrders(ordersData);
      if (status === "closed" || status === "cancelled") {
        setDetailOpen(false);
        setSelected(null);
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Erro", "error");
    }
  }

  async function finishOrder(order: OrderWithDetails) {
    await updateStatus(order, "closed");
  }

  function requestFinish(order: OrderWithDetails) {
    setConfirmAction({ type: "finish", order });
  }

  function requestCancel(order: OrderWithDetails) {
    setConfirmAction({ type: "cancel", order });
  }

  function requestRemoveItem(productId: number, productName: string) {
    if (!selected || !isOrderEditable(selected.status)) return;

    if (selected.items.length <= 1) {
      showToast("O pedido precisa de pelo menos 1 item", "error");
      return;
    }

    setConfirmAction({ type: "remove-item", productId, productName });
  }

  async function addItemToOrder(product: Product) {
    if (!selected || !isOrderEditable(selected.status)) return;

    try {
      const updated = await apiSend<OrderWithDetails>(
        `/api/orders/${selected.id}/items`,
        "POST",
        { product_id: product.id, quantity: 1 }
      );
      setSelected(updated);
      const ordersData = await apiGet<OrderWithDetails[]>("/api/orders");
      setOrders(ordersData);
      showToast("Item adicionado");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Erro", "error");
    }
  }

  async function syncOrderItems(items: DraftItem[]) {
    if (!selected || !isOrderEditable(selected.status)) return;

    try {
      const updated = await apiSend<OrderWithDetails>(
        `/api/orders/${selected.id}`,
        "PUT",
        {
          items: items.map((item) => ({
            product_id: item.product_id,
            quantity: item.quantity,
          })),
        }
      );
      setSelected(updated);
      const ordersData = await apiGet<OrderWithDetails[]>("/api/orders");
      setOrders(ordersData);
      refreshSelected(ordersData);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Erro", "error");
    }
  }

  function changeSelectedQty(productId: number, delta: number) {
    if (!selected || !isOrderEditable(selected.status)) return;

    const items = selected.items
      .map((item) =>
        item.product_id === productId
          ? { ...item, quantity: item.quantity + delta }
          : item
      )
      .filter((item) => item.quantity > 0)
      .map((item) => ({
        product_id: item.product_id,
        name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
      }));

    if (items.length === 0) {
      showToast("O pedido precisa de pelo menos 1 item", "error");
      return;
    }

    syncOrderItems(items);
  }

  function removeSelectedItem(productId: number) {
    if (!selected || !isOrderEditable(selected.status)) return;

    if (selected.items.length <= 1) {
      showToast("O pedido precisa de pelo menos 1 item", "error");
      return;
    }

    const items = selected.items
      .filter((item) => item.product_id !== productId)
      .map((item) => ({
        product_id: item.product_id,
        name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
      }));

    syncOrderItems(items);
  }

  async function handleConfirmAction() {
    if (!confirmAction) return;

    if (confirmAction.type === "finish") {
      await finishOrder(confirmAction.order);
      return;
    }

    if (confirmAction.type === "cancel") {
      await updateStatus(confirmAction.order, "cancelled");
      return;
    }

    removeSelectedItem(confirmAction.productId);
  }

  const canEditSelected = selected ? isOrderEditable(selected.status) : false;

  const confirmTitle =
    confirmAction?.type === "finish"
      ? "Finalizar pedido"
      : confirmAction?.type === "cancel"
        ? "Cancelar pedido"
        : "Remover item";

  const confirmMessage =
    confirmAction?.type === "finish"
      ? `Finalizar pedido da ${formatTableLabel(confirmAction.order.table_number, confirmAction.order.table_area)}?\n\nSubtotal: ${formatMoney(confirmAction.order.subtotal)}\nServiço (${servicePercentLabel()}): ${formatMoney(confirmAction.order.service_fee)}\nTotal: ${formatMoney(confirmAction.order.total)}`
      : confirmAction?.type === "cancel"
        ? `Cancelar o pedido da ${formatTableLabel(confirmAction.order.table_number, confirmAction.order.table_area)}? Esta ação não pode ser desfeita.`
        : confirmAction
          ? `Remover "${confirmAction.productName}" deste pedido?`
          : "";

  const confirmLabel =
    confirmAction?.type === "finish"
      ? "Finalizar"
      : confirmAction?.type === "cancel"
        ? "Cancelar pedido"
        : "Remover";

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Pedidos</h1>
          <p>Edite, acompanhe e finalize pedidos</p>
        </div>
      </header>

      {loading ? (
        <p className="muted">Carregando...</p>
      ) : orders.length === 0 ? (
        <EmptyState
          title="Sem pedidos abertos"
          description="Crie um pedido para iniciar o atendimento."
          actionLabel="Abrir pedido"
          onAction={openCreate}
        />
      ) : (
        <div className="stack">
          {orders.map((order) => (
            <div key={order.id} className="card">
              <div className="actions-row">
                <strong style={{ flex: 2 }}>
                  {formatTableLabel(order.table_number, order.table_area)}
                </strong>
                <span className={`badge ${orderStatusBadgeClass(order.status)}`}>
                  {statusLabel(order.status)}
                </span>
              </div>
              <p className="small muted" style={{ margin: "8px 0" }}>
                {order.waiter_name} · {order.items.length} itens
              </p>
              <OrderTotals
                subtotal={order.subtotal}
                serviceFee={order.service_fee}
                total={order.total}
              />
              <div className="actions-row" style={{ marginTop: 12 }}>
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => {
                    setSelected(order);
                    setDetailOpen(true);
                  }}
                >
                  Editar
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => requestFinish(order)}
                >
                  Finalizar
                </button>
              </div>
            </div>
          ))}
          <button type="button" className="btn secondary block" onClick={openCreate}>
            Abrir pedido
          </button>
        </div>
      )}

      <FormModal
        title="Novo pedido"
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
        submitLabel="Abrir pedido"
      >
        <div className="field">
          <label htmlFor="order-table">Mesa</label>
          <select
            id="order-table"
            value={tableId}
            onChange={(event) => setTableId(event.target.value)}
            required
          >
            <option value="">Selecione</option>
            {freeTables.map((table) => (
              <option key={table.id} value={table.id}>
                {formatTableLabel(table.number, table.area)}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="order-waiter">Garçom</label>
          <select
            id="order-waiter"
            value={waiterId}
            onChange={(event) => setWaiterId(event.target.value)}
            required
          >
            <option value="">Selecione</option>
            {activeWaiters.map((waiter) => (
              <option key={waiter.id} value={waiter.id}>
                {waiter.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Produtos</label>
          <div className="stack" style={{ gap: 20, maxHeight: 240, overflow: "auto" }}>
            {renderProductGroups(addDraftProduct)}
          </div>
        </div>

        {draftItems.length > 0 && (
          <div className="card" style={{ boxShadow: "none", padding: 12 }}>
            {draftItems.map((item) => (
              <div key={item.product_id} className="list-item">
                <div>
                  <strong>{item.name}</strong>
                  <div className="small muted">
                    {formatMoney(item.unit_price)}
                  </div>
                </div>
                <div className="qty-control">
                  <button
                    type="button"
                    onClick={() => changeDraftQty(item.product_id, -1)}
                  >
                    −
                  </button>
                  <span>{item.quantity}</span>
                  <button
                    type="button"
                    onClick={() => changeDraftQty(item.product_id, 1)}
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
            <OrderTotals
              subtotal={draftTotals.subtotal}
              serviceFee={draftTotals.serviceFee}
              total={draftTotals.total}
            />
          </div>
        )}

        <div className="field">
          <label htmlFor="order-notes">Observações</label>
          <textarea
            id="order-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Ex: sem cebola, ponto da carne..."
          />
        </div>
      </FormModal>

      <Modal
        title={
          selected
            ? formatTableLabel(selected.table_number, selected.table_area)
            : "Pedido"
        }
        open={detailOpen && Boolean(selected)}
        onClose={() => setDetailOpen(false)}
      >
        {selected && (
          <div className="stack">
            <div className="actions-row">
              <span className={`badge ${orderStatusBadgeClass(selected.status)}`}>
                {statusLabel(selected.status)}
              </span>
              <span className="muted small">{selected.waiter_name}</span>
            </div>

            {canEditSelected && (
              <p className="small muted" style={{ margin: 0 }}>
                Pedido aberto: você pode adicionar ou remover itens.
              </p>
            )}

            <div className="card" style={{ boxShadow: "none", padding: 12 }}>
              {selected.items.map((item) => (
                <div key={item.id} className="list-item">
                  <div>
                    <strong>{item.product_name}</strong>
                    <div className="small muted">
                      {formatMoney(item.unit_price)}
                    </div>
                  </div>
                  {canEditSelected ? (
                    <div className="stack" style={{ gap: 6, alignItems: "flex-end" }}>
                      <div className="qty-control">
                        <button
                          type="button"
                          onClick={() => changeSelectedQty(item.product_id, -1)}
                        >
                          −
                        </button>
                        <span>{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => changeSelectedQty(item.product_id, 1)}
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        className="btn ghost"
                        onClick={() =>
                          requestRemoveItem(item.product_id, item.product_name)
                        }
                      >
                        Remover
                      </button>
                    </div>
                  ) : (
                    <span className="small">{item.quantity}x</span>
                  )}
                </div>
              ))}
              <OrderTotals
                subtotal={selected.subtotal}
                serviceFee={selected.service_fee}
                total={selected.total}
              />
            </div>

            {selected.notes && (
              <p className="small muted" style={{ margin: 0 }}>
                Obs: {selected.notes}
              </p>
            )}

            {canEditSelected && (
              <div className="field">
                <label>Adicionar produto</label>
                <div
                  className="stack"
                  style={{ gap: 20, maxHeight: 220, overflow: "auto" }}
                >
                  {renderProductGroups(addItemToOrder)}
                </div>
              </div>
            )}

            <div className="actions-row">
              <button
                type="button"
                className="btn danger"
                disabled={!canEditSelected}
                onClick={() => requestCancel(selected)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn"
                disabled={!canEditSelected}
                onClick={() => requestFinish(selected)}
              >
                Finalizar
              </button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmModal
        open={Boolean(confirmAction)}
        title={confirmTitle}
        message={confirmMessage}
        confirmLabel={confirmLabel}
        danger={confirmAction?.type !== "finish"}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => {
          void handleConfirmAction();
        }}
      />
    </>
  );
}
