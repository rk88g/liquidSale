"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import {
  clearStoredAuth,
  getStoredAuth,
  saveStoredAuth,
  type StoredAuth,
} from "../lib/auth-storage";
import {
  createModule,
  fetchCurrentUser,
  fetchModules,
  type ModuleSummary,
} from "../lib/api";

const defaultForm = {
  code: "",
  name: "",
  slug: "",
  route: "",
  visibleRoles: ["viewer"],
};

const roleOptions = [
  "super_admin",
  "admin",
  "manager",
  "seller",
  "viewer",
];

export function DashboardShell() {
  const router = useRouter();
  const [auth, setAuth] = useState<StoredAuth | null>(null);
  const [modules, setModules] = useState<ModuleSummary[]>([]);
  const [modulesError, setModulesError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState(defaultForm);

  useEffect(() => {
    async function bootstrap() {
      const stored = getStoredAuth();

      if (!stored) {
        setIsLoading(false);
        router.replace("/");
        return;
      }

      try {
        const current = await fetchCurrentUser(stored.session.accessToken);
        const nextAuth: StoredAuth = {
          session: stored.session,
          user: current.user,
        };

        saveStoredAuth(nextAuth);
        setAuth(nextAuth);

        const modulesResponse = await fetchModules(stored.session.accessToken);
        setModules(modulesResponse.modules);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "No fue posible abrir el dashboard.";
        clearStoredAuth();
        setModulesError(message);
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

  function toggleRole(role: string) {
    setForm((current) => {
      const exists = current.visibleRoles.includes(role);

      if (exists) {
        const nextRoles = current.visibleRoles.filter((item) => item !== role);
        return {
          ...current,
          visibleRoles: nextRoles.length > 0 ? nextRoles : current.visibleRoles,
        };
      }

      return {
        ...current,
        visibleRoles: [...current.visibleRoles, role],
      };
    });
  }

  async function handleCreateModule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!auth) {
      return;
    }

    setIsCreating(true);
    setModulesError(null);

    try {
      const created = await createModule(auth.session.accessToken, {
        code: form.code,
        name: form.name,
        slug: form.slug,
        route: form.route,
        visibleRoles: form.visibleRoles,
      });

      setModules((current) =>
        [...current, created.module].sort((left, right) => left.sort_order - right.sort_order),
      );
      setForm(defaultForm);
      setIsCreateOpen(false);
    } catch (error) {
      setModulesError(
        error instanceof Error ? error.message : "No fue posible crear el modulo.",
      );
    } finally {
      setIsCreating(false);
    }
  }

  if (isLoading) {
    return <div className="loading-state">Cargando dashboard...</div>;
  }

  if (!auth) {
    return <div className="loading-state">{modulesError ?? "Redirigiendo..."}</div>;
  }

  const isSuperAdmin = auth.user.role === "super_admin";

  return (
    <main className="workspace-shell">
      <aside className="workspace-sidebar">
        <div className="workspace-brand">
          <span className="workspace-brand-mark">LS</span>
          <div>
            <strong>Liquid Sale</strong>
            <span>{auth.user.role}</span>
          </div>
        </div>

        <div className="workspace-profile">
          <strong>{auth.user.fullName ?? auth.user.email}</strong>
          <span>{auth.user.email}</span>
        </div>

        <nav className="workspace-nav">
          <button className="workspace-nav-item active" type="button">
            Dashboard
          </button>
          {modules.map((module) => (
            <button className="workspace-nav-item" key={module.id} type="button">
              {module.name}
            </button>
          ))}
        </nav>

        <button className="workspace-logout" onClick={handleLogout} type="button">
          Cerrar sesion
        </button>
      </aside>

      <section className="workspace-main">
        <header className="workspace-header">
          <div>
            <span className="workspace-kicker">Dashboard</span>
            <h1>Modulos</h1>
          </div>

          {isSuperAdmin ? (
            <button
              className="button-primary"
              onClick={() => setIsCreateOpen((current) => !current)}
              type="button"
            >
              {isCreateOpen ? "Cerrar" : "Nuevo modulo"}
            </button>
          ) : null}
        </header>

        {modulesError ? <div className="status-message error">{modulesError}</div> : null}

        <section className="workspace-grid">
          <div className="workspace-panel">
            <div className="panel-heading">
              <h2>Tabla de modulos</h2>
              <span>{modules.length}</span>
            </div>

            <div className="modules-table-wrap">
              <table className="modules-table">
                <thead>
                  <tr>
                    <th>Modulo</th>
                    <th>Ruta</th>
                    <th>Roles</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {modules.length === 0 ? (
                    <tr>
                      <td colSpan={4}>Sin modulos</td>
                    </tr>
                  ) : null}

                  {modules.map((module) => (
                    <tr key={module.id}>
                      <td>
                        <div className="module-name-cell">
                          <strong>{module.name}</strong>
                          <span>{module.code}</span>
                        </div>
                      </td>
                      <td>{module.route}</td>
                      <td>
                        <div className="role-list">
                          {module.visible_roles.map((role) => (
                            <span className="role-pill" key={`${module.id}-${role}`}>
                              {role}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>
                        <span className={`state-pill ${module.is_active ? "on" : "off"}`}>
                          {module.is_active ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {isSuperAdmin ? (
            <aside className="workspace-panel side-panel">
              <div className="panel-heading">
                <h2>Crear modulo</h2>
              </div>

              {isCreateOpen ? (
                <form className="module-form" onSubmit={handleCreateModule}>
                  <input
                    className="field"
                    onChange={(event) =>
                      setForm((current) => ({ ...current, name: event.target.value }))
                    }
                    placeholder="Nombre"
                    required
                    value={form.name}
                  />
                  <input
                    className="field"
                    onChange={(event) =>
                      setForm((current) => ({ ...current, code: event.target.value }))
                    }
                    placeholder="Codigo"
                    required
                    value={form.code}
                  />
                  <input
                    className="field"
                    onChange={(event) =>
                      setForm((current) => ({ ...current, slug: event.target.value }))
                    }
                    placeholder="Slug"
                    required
                    value={form.slug}
                  />
                  <input
                    className="field"
                    onChange={(event) =>
                      setForm((current) => ({ ...current, route: event.target.value }))
                    }
                    placeholder="/dashboard/nuevo-modulo"
                    required
                    value={form.route}
                  />

                  <div className="role-selector">
                    {roleOptions.map((role) => (
                      <button
                        className={`role-select-pill ${
                          form.visibleRoles.includes(role) ? "selected" : ""
                        }`}
                        key={role}
                        onClick={() => toggleRole(role)}
                        type="button"
                      >
                        {role}
                      </button>
                    ))}
                  </div>

                  <button className="button-primary" disabled={isCreating} type="submit">
                    {isCreating ? "Guardando..." : "Guardar modulo"}
                  </button>
                </form>
              ) : (
                <button
                  className="button-secondary full-width"
                  onClick={() => setIsCreateOpen(true)}
                  type="button"
                >
                  Abrir formulario
                </button>
              )}
            </aside>
          ) : null}
        </section>
      </section>
    </main>
  );
}
