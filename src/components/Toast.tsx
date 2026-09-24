"use client";

import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const VISIBLE_MS = 2600;
const LEAVE_MS = 280;

type ToastState = { message: string; type?: "ok" | "error" } | null;

type ToastContextValue = {
  showToast: (message: string, type?: "ok" | "error") => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState>(null);
  const [leaving, setLeaving] = useState(false);
  const hideTimer = useRef(0);
  const removeTimer = useRef(0);

  useEffect(() => {
    return () => {
      window.clearTimeout(hideTimer.current);
      window.clearTimeout(removeTimer.current);
    };
  }, []);

  const value = useMemo(
    () => ({
      showToast(message: string, type: "ok" | "error" = "ok") {
        window.clearTimeout(hideTimer.current);
        window.clearTimeout(removeTimer.current);
        setLeaving(false);
        setToast({ message, type });

        hideTimer.current = window.setTimeout(() => {
          setLeaving(true);
          removeTimer.current = window.setTimeout(() => {
            setToast(null);
            setLeaving(false);
          }, LEAVE_MS);
        }, VISIBLE_MS);
      },
    }),
    []
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast && (
        <div
          className={`toast${toast.type === "error" ? " error" : ""}${
            leaving ? " leaving" : ""
          }`}
        >
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
