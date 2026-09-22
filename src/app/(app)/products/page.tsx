"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmModal } from "@/components/ConfirmModal";
import { FormModal } from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { apiGet, apiSend } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import type { Product } from "@/lib/types";

const emptyForm = {
  name: "",
  description: "",
  price: "",
  category: "Geral",
  available: true,
};

export default function ProductsPage() {
  const { showToast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [pendingDelete, setPendingDelete] = useState<Product | null>(null);

  const productsByCategory = useMemo(() => {
    const groups = new Map<string, Product[]>();

    for (const product of products) {
      const category = product.category?.trim() || "Geral";
      const list = groups.get(category) ?? [];
      list.push(product);
      groups.set(category, list);
    }

    return Array.from(groups.entries()).sort(([a], [b]) =>
      a.localeCompare(b, "pt-BR")
    );
  }, [products]);

  async function loadProducts() {
    const data = await apiGet<Product[]>("/api/products");
    setProducts(data);
  }

  useEffect(() => {
    loadProducts()
      .catch((error) =>
        showToast(error instanceof Error ? error.message : "Erro", "error")
      )
      .finally(() => setLoading(false));
  }, [showToast]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(product: Product) {
    setEditing(product);
    setForm({
      name: product.name,
      description: product.description,
      price: String(product.price),
      category: product.category,
      available: product.available === 1,
    });
    setOpen(true);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const payload = {
      name: form.name,
      description: form.description,
      price: Number(form.price),
      category: form.category,
      available: form.available,
    };

    try {
      if (editing) {
        await apiSend(`/api/products/${editing.id}`, "PUT", payload);
        showToast("Produto atualizado");
      } else {
        await apiSend("/api/products", "POST", payload);
        showToast("Produto criado");
      }

      setOpen(false);
      await loadProducts();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Erro", "error");
    }
  }

  async function handleDelete(product: Product) {
    try {
      await apiSend(`/api/products/${product.id}`, "DELETE");
      showToast("Produto excluído");
      await loadProducts();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Erro", "error");
    }
  }

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Cardápio</h1>
          <p>Cadastre e atualize os produtos.</p>
        </div>
        <button type="button" className="btn" onClick={openCreate}>
          Adicionar
        </button>
      </header>

      {loading ? (
        <p className="muted">Carregando...</p>
      ) : products.length === 0 ? (
        <EmptyState
          title="Nenhum produto"
          description="Comece adicionando itens ao cardápio."
          actionLabel="Novo produto"
          onAction={openCreate}
        />
      ) : (
        <div className="stack" style={{ gap: 20 }}>
          {productsByCategory.map(([category, items]) => (
            <section key={category} className="card product-group">
              <div className="product-group-title">{category}</div>
              {items.map((product) => (
                <div key={product.id} className="list-item">
                  <div>
                    <strong>{product.name}</strong>
                    <div className="small muted">{formatMoney(product.price)}</div>
                    <div style={{ marginTop: 6 }}>
                      <span
                        className={`badge ${product.available ? "free" : "cancelled"}`}
                      >
                        {product.available ? "Disponível" : "Indisponível"}
                      </span>
                    </div>
                  </div>
                  <div className="stack" style={{ gap: 8 }}>
                    <button
                      type="button"
                      className="btn secondary"
                      onClick={() => openEdit(product)}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={() => setPendingDelete(product)}
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              ))}
            </section>
          ))}
        </div>
      )}

      <FormModal
        title={editing ? "Editar produto" : "Novo produto"}
        open={open}
        onClose={() => setOpen(false)}
        onSubmit={handleSubmit}
      >
        <div className="field">
          <label htmlFor="name">Nome</label>
          <input
            id="name"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="category">Categoria</label>
          <input
            id="category"
            value={form.category}
            onChange={(event) =>
              setForm({ ...form, category: event.target.value })
            }
          />
        </div>
        <div className="field">
          <label htmlFor="price">Preço</label>
          <input
            id="price"
            type="number"
            min="0"
            step="0.01"
            value={form.price}
            onChange={(event) => setForm({ ...form, price: event.target.value })}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="description">Descrição</label>
          <textarea
            id="description"
            value={form.description}
            onChange={(event) =>
              setForm({ ...form, description: event.target.value })
            }
          />
        </div>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={form.available}
            onChange={(event) =>
              setForm({ ...form, available: event.target.checked })
            }
          />
          Disponível para pedidos
        </label>
      </FormModal>

      <ConfirmModal
        open={Boolean(pendingDelete)}
        title="Excluir produto"
        message={
          pendingDelete
            ? `Excluir "${pendingDelete.name}" do cardápio? Esta ação não pode ser desfeita.`
            : ""
        }
        confirmLabel="Excluir"
        danger
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) void handleDelete(pendingDelete);
        }}
      />
    </>
  );
}
