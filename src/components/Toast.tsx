"use client";

import { createContext, ReactNode, useContext, useMemo, useState } from "react";

type ToastState = { message: string; type?: "ok" | "error" } | null;

type ToastContextValue = {
  showToast: (message: string, type?: "ok" | "error") => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState>(null);

  const value = useMemo(
    () => ({
      showToast(message: string, type: "ok" | "error" = "ok") {
        setToast({ message, type });
        window.setTimeout(() => setToast(null), 2600);
      },
    }),
    []
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast && (
        <div className={`toast${toast.type === "error" ? " error" : ""}`}>
          {toast.message}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast deve ser usado dentro de ToastProvider");
  }
  return context;
}
