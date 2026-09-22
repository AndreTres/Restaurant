"use client";

import { FormEvent, ReactNode, useEffect } from "react";

type ModalProps = {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  elevated?: boolean;
  centered?: boolean;
};

export function Modal({
  title,
  open,
  onClose,
  children,
  elevated = false,
  centered = false,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const backdropClass = [
    "modal-backdrop",
    elevated ? "elevated" : "",
    centered ? "centered" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={backdropClass} onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="actions-row" style={{ marginBottom: 8 }}>
          <h2 style={{ flex: 2, margin: 0 }}>{title}</h2>
          <button type="button" className="btn ghost" onClick={onClose}>
            Fechar
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

type FormModalProps = ModalProps & {
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  submitLabel?: string;
};

export function FormModal({
  title,
  open,
  onClose,
  onSubmit,
  submitLabel = "Salvar",
  children,
}: FormModalProps) {
  return (
    <Modal title={title} open={open} onClose={onClose}>
      <form className="stack" onSubmit={onSubmit}>
        {children}
        <div className="actions-row" style={{ marginTop: 8 }}>
          <button type="button" className="btn secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn">
            {submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}
