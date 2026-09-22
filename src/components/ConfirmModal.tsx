"use client";

import { Modal } from "./Modal";

type ConfirmModalProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Voltar",
  danger = false,
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  return (
    <Modal title={title} open={open} onClose={onClose} elevated centered>
      <p className="muted" style={{ margin: "0 0 16px", whiteSpace: "pre-line" }}>
        {message}
      </p>
      <div className="actions-row">
        <button type="button" className="btn secondary" onClick={onClose}>
          {cancelLabel}
        </button>
        <button
          type="button"
          className={`btn${danger ? " danger" : ""}`}
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
