"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  clearStoredAuth,
  getStoredAuth,
  saveStoredAuth,
  type StoredAuth,
} from "../lib/auth-storage";
import { fetchCurrentUser } from "../lib/api";

const stats = [
  {
    label: "Usuarios activos",
    value: "24",
    description: "Base pensada para operar varios accesos y distintos permisos.",
  },
  {
    label: "Rol detectado",
    value: "Seguro",
    description: "La vista ya queda lista para personalizar modulos por rol.",
  },
  {
    label: "Estado backend",
    value: "Online",
    description: "El dashboard consulta a Railway y valida la sesion.",
  },
];

export function DashboardShell() {
  const router = useRouter();
  const [auth, setAuth] = useState<StoredAuth | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const expiresAtLabel =
    auth?.session.expiresAt != null
      ? new Date(auth.session.expiresAt * 1000).toLocaleString("es-MX")
      : "sin dato";

  useEffect(() => {
    async function bootstrap() {
      const stored = getStoredAuth();

      if (!stored) {
        setIsLoading(false);
        router.replace("/");
        return;
      }

      setAuth(stored);

      try {
        const current = await fetchCurrentUser(stored.session.accessToken);
        const nextAuth: StoredAuth = {
          session: stored.session,
          user: current.user,
        };

        saveStoredAuth(nextAuth);
        setAuth(nextAuth);
      } catch (requestError) {
        clearStoredAuth();
        const message =
          requestError instanceof Error
            ? requestError.message
            : "La sesion ya no es valida.";
        setError(message);
        router.replace("/");
        return;
      } finally {
        setIsLoading(false);
      }
    }

    void bootstrap();
  }, [router]);

  function handleLogout() {
    clearStoredAuth();
    router.push("/");
  }

  if (isLoading) {
    return <div className="loading-state">Cargando dashboard...</div>;
  }

  if (!auth) {
    return <div className="loading-state">{error ?? "Redirigiendo..."}</div>;
  }

  return (
    <main className="dashboard-shell">
      <section className="dashboard-card">
        <div className="dashboard-topbar">
          <span className="eyebrow">Panel principal</span>
          <span className="role-chip">{auth.user.role}</span>
        </div>

        <div className="dashboard-hero">
          <h1>Bienvenido al dashboard de Liquid Sale.</h1>
          <p className="panel-note">
            Esta pantalla ya reconoce sesion y rol. El siguiente paso es
            encender permisos por modulo y construir las vistas especificas para
            cada tipo de usuario.
          </p>
        </div>

        <div className="profile-meta">
          <span>{auth.user.fullName ?? "Usuario sin nombre configurado"}</span>
          <span>{auth.user.email}</span>
          <span>Sesion expira: {expiresAtLabel}</span>
        </div>

        <div className="dashboard-actions">
          <button className="button-primary" type="button">
            Gestionar usuarios
          </button>
          <button
            className="button-secondary"
            onClick={handleLogout}
            type="button"
          >
            Cerrar sesion
          </button>
        </div>
      </section>

      <section className="stats-grid">
        {stats.map((stat) => (
          <article className="stat-card" key={stat.label}>
            <span>{stat.label}</span>
            <strong>
              {stat.label === "Rol detectado" ? auth.user.role : stat.value}
            </strong>
            <p>{stat.description}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
