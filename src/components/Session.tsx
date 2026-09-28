"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import { apiGet } from "@/lib/api";
import type { UserRole } from "@/lib/types";

type Session = {
  authenticated: boolean;
  role: UserRole | null;
};

type SessionContextValue = {
  session: Session;
  isAdmin: boolean;
  refreshSession: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue>({
  session: { authenticated: false, role: null },
  isAdmin: false,
  refreshSession: async () => {},
});

export function SessionProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [session, setSession] = useState<Session>({
    authenticated: false,
    role: null,
  });

  const refreshSession = useCallback(async () => {
    try {
      const data = await apiGet<{
        authenticated: boolean;
        role?: UserRole | null;
      }>("/api/auth");
      setSession({
        authenticated: data.authenticated,
        role: data.role ?? null,
      });
    } catch {
      setSession({ authenticated: false, role: null });
    }
  }, []);

  useEffect(() => {
    void refreshSession();
  }, [pathname, refreshSession]);

  return (
    <SessionContext.Provider
      value={{
        session,
        isAdmin: session.role === "admin",
        refreshSession,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}
