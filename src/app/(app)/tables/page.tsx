"use client";

import { FormEvent, useEffect, useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmModal } from "@/components/ConfirmModal";
import { FormModal } from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { apiGet, apiSend } from "@/lib/api";
import { formatTableLabel, statusLabel } from "@/lib/format";
import type { Table, TableArea } from "@/lib/types";

const emptyForm = {
  area: "inside" as TableArea,
  status: "free" as Table["status"],
};

export default function TablesPage() {
  const { showToast } = useToast();
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Table | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [pendingDelete, setPendingDelete] = useState<Table | null>(null);

  async function loadTables() {
    setTables(await apiGet<Table[]>("/api/tables"));
  }

  useEffect(() => {
    loadTables()
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

  function openEdit(table: Table) {
    setEditing(table);
    setForm({
      area: table.area ?? "inside",
      status: table.status,
    });
    setOpen(true);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const payload = {
      seats: editing?.seats ?? 4,
      area: form.area,
      status: form.status,
    };

    try {
      if (editing) {
        await apiSend(`/api/tables/${editing.id}`, "PUT", payload);
        showToast("Mesa atualizada");
      } else {
        await apiSend("/api/tables", "POST", payload);
        showToast("Mesa criada");
      }

      setOpen(false);
      await loadTables();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Erro", "error");
    }
  }

  async function handleDelete(table: Table) {
    try {
      await apiSend(`/api/tables/${table.id}`, "DELETE");
      showToast("Mesa excluída");
      await loadTables();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Erro", "error");
    }
  }

  async function cycleStatus(table: Table) {
    const next =
      table.status === "free"
        ? "occupied"
        : table.status === "occupied"
          ? "reserved"
          : "free";

    try {
      await apiSend(`/api/tables/${table.id}`, "PUT", {
        seats: table.seats,
        area: table.area ?? "inside",
        status: next,
      });
      await loadTables();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Erro", "error");
    }
  }

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Mesas</h1>
          <p>7 externas e 4 internas</p>
        </div>
        <button type="button" className="btn" onClick={openCreate}>
          Adicionar
        </button>
      </header>

      {loading ? (
        <p className="muted">Carregando...</p>
      ) : tables.length === 0 ? (
        <EmptyState
          title="Nenhuma mesa"
          description="Cadastre as mesas do restaurante."
          actionLabel="Nova mesa"
          onAction={openCreate}
        />
      ) : (
        <div className="grid-2">
          {tables.map((table) => (
            <div key={table.id} className="card interactive">
              <div className="actions-row">
                <strong style={{ flex: 2, fontSize: "1.2rem" }}>
                  {formatTableLabel(table.number, table.area)}
                </strong>
                <span className={`badge squared ${table.status}`}>
                  {statusLabel(table.status)}
                </span>
              </div>
              <div className="stack" style={{ gap: 8, marginTop: 14 }}>
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => cycleStatus(table)}
                >
                  Alternar status
                </button>
                <div className="actions-row">
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => openEdit(table)}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => setPendingDelete(table)}
                  >
                    Excluir
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <FormModal
        title={editing ? `Editar mesa ${editing.number}` : "Nova mesa"}
        open={open}
        onClose={() => setOpen(false)}
        onSubmit={handleSubmit}
      >
        <div className="field">
          <label htmlFor="table-area">Área</label>
          <select
            id="table-area"
            value={form.area}
            onChange={(event) =>
              setForm({
                ...form,
                area: event.target.value as TableArea,
              })
            }
          >
            <option value="outside">Externa</option>
            <option value="inside">Interna</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="table-status">Status</label>
          <select
            id="table-status"
            value={form.status}
            onChange={(event) =>
              setForm({
                ...form,
                status: event.target.value as Table["status"],
              })
            }
          >
            <option value="free">Livre</option>
            <option value="occupied">Ocupada</option>
            <option value="reserved">Reservada</option>
          </select>
        </div>
      </FormModal>

      <ConfirmModal
        open={Boolean(pendingDelete)}
        title="Excluir mesa"
        message={
          pendingDelete
            ? `Excluir a mesa ${pendingDelete.number}? Esta ação não pode ser desfeita.`
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
