"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import { apiSend } from "@/lib/api";

export default function MorePage() {
  const router = useRouter();
  const { showToast } = useToast();

  async function handleLogout() {
    try {
      await apiSend("/api/auth", "DELETE");
      showToast("Sessão encerrada");
      router.replace("/login");
      router.refresh();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Erro", "error");
    }
  }

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Mais</h1>
          <p>Cadastros e configurações do sistema.</p>
        </div>
      </header>

      <section className="card stack">
        <Link href="/waiters" className="btn secondary">
          Garçons
        </Link>
        <Link href="/history" className="btn secondary">
          Histórico de pedidos
        </Link>
        <Link href="/products" className="btn secondary">
          Cardápio
        </Link>
        <Link href="/tables" className="btn secondary">
          Mesas
        </Link>
      </section>

      <section className="card" style={{ marginTop: 12 }}>
        <p className="muted small" style={{ marginTop: 0 }}>
          Sabores de mi Tierra
        </p>
        <button type="button" className="btn danger block" onClick={handleLogout}>
          Sair
        </button>
      </section>
    </>
  );
}
