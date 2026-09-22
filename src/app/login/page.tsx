"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { apiSend } from "@/lib/api";
import { useToast } from "@/components/Toast";

export default function LoginPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);

    try {
      await apiSend("/api/auth", "POST", { username, password });
      showToast("Bem-vindo de volta");
      router.replace("/");
      router.refresh();
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Falha no login",
        "error"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-screen app-shell no-nav">
      <form className="card login-card stack" onSubmit={handleSubmit}>
        <div className="brand">
          <span>Admin · Bolívia</span>
          <h1>Sabores de mi Tierra</h1>
          <p>Gestão rápida de mesas, cardápio e pedidos.</p>
        </div>

        <div className="field">
          <label htmlFor="username">Usuário</label>
          <input
            id="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            required
          />
        </div>

        <div className="field">
          <label htmlFor="password">Senha</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </div>

        <button className="btn block" type="submit" disabled={loading}>
          {loading ? "Entrando..." : "Entrar"}
        </button>

        <p className="small muted" style={{ margin: 0, textAlign: "center" }}>
        </p>
      </form>
    </div>
  );
}
