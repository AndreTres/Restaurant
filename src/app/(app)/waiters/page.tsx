"use client";

import { FormEvent, useEffect, useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmModal } from "@/components/ConfirmModal";
import { FormModal } from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { apiGet, apiSend } from "@/lib/api";
import type { Waiter } from "@/lib/types";

export default function WaitersPage() {
  const { showToast } = useToast();
  const [waiters, setWaiters] = useState<Waiter[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Waiter | null>(null);
  const [name, setName] = useState("");
  const [active, setActive] = useState(true);
  const [pendingDelete, setPendingDelete] = useState<Waiter | null>(null);

  async function loadWaiters() {
    setWaiters(await apiGet<Waiter[]>("/api/waiters"));
  }

  useEffect(() => {
    loadWaiters()
      .catch((error) =>
        showToast(error instanceof Error ? error.message : "Erro", "error")
      )
      .finally(() => setLoading(false));
  }, [showToast]);

  function openCreate() {
    setEditing(null);
    setName("");
    setActive(true);
    setOpen(true);
  }

  function openEdit(waiter: Waiter) {
    setEditing(waiter);
    setName(waiter.name);
    setActive(waiter.active === 1);
    setOpen(true);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    try {
      if (editing) {
        await apiSend(`/api/waiters/${editing.id}`, "PUT", { name, active });
        showToast("Garçom atualizado");
      } else {
        await apiSend("/api/waiters", "POST", { name, active });
        showToast("Garçom criado");
      }

      setOpen(false);
      await loadWaiters();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Erro", "error");
    }
  }

  async function handleDelete(waiter: Waiter) {
    try {
      const result = await apiSend<{ deactivated?: boolean; message?: string }>(
        `/api/waiters/${waiter.id}`,
        "DELETE"
      );
      showToast(result.deactivated ? result.message || "Desativado" : "Removido");
      await loadWaiters();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Erro", "error");
    }
  }

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Garçons</h1>
          <p>Equipe disponível para atender mesas.</p>
        </div>
        <button type="button" className="btn" onClick={openCreate}>
          Adicionar
        </button>
      </header>

      {loading ? (
        <p className="muted">Carregando...</p>
      ) : waiters.length === 0 ? (
        <EmptyState
          title="Nenhum garçom"
          description="Cadastre a equipe para lançar pedidos."
          actionLabel="Novo garçom"
          onAction={openCreate}
        />
      ) : (
        <section className="card">
          {waiters.map((waiter) => (
            <div key={waiter.id} className="list-item">
              <div>
                <strong>{waiter.name}</strong>
                <div style={{ marginTop: 6 }}>
                  <span className={`badge ${waiter.active ? "free" : "cancelled"}`}>
                    {waiter.active ? "Ativo" : "Inativo"}
                  </span>
                </div>
              </div>
              <div className="stack" style={{ gap: 8 }}>
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => openEdit(waiter)}
                >
                  Editar
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => setPendingDelete(waiter)}
                >
                  Remover
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      <FormModal
        title={editing ? "Editar garçom" : "Novo garçom"}
        open={open}
        onClose={() => setOpen(false)}
        onSubmit={handleSubmit}
      >
        <div className="field">
          <label htmlFor="waiter-name">Nome</label>
          <input
            id="waiter-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </div>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={active}
            onChange={(event) => setActive(event.target.checked)}
          />
          Ativo
        </label>
      </FormModal>

      <ConfirmModal
        open={Boolean(pendingDelete)}
        title="Remover garçom"
        message={
          pendingDelete
            ? `Remover "${pendingDelete.name}"? Esta ação não pode ser desfeita.`
            : ""
        }
        confirmLabel="Remover"
        danger
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) void handleDelete(pendingDelete);
        }}
      />
    </>
  );
}
