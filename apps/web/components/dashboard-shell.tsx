"use client";

import { usePathname, useRouter } from "next/navigation";
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
  sectionKey: "operacion",
  sectionName: "Operacion",
  sectionOrder: 20,
  visibleRoles: ["viewer"],
};

const roleOptions = [
  "super_admin",
  "admin",
  "manager",
  "seller",
  "viewer",
];

type ModuleSection = {
  key: string;
  name: string;
  order: number;
  modules: ModuleSummary[];
};

function groupModulesBySection(modules: ModuleSummary[]) {
  const grouped = new Map<string, ModuleSection>();

  for (const module of modules) {
    const existing = grouped.get(module.section_key);

    if (existing) {
      existing.modules.push(module);
      continue;
    }

    grouped.set(module.section_key, {
      key: module.section_key,
      name: module.section_name,
      order: module.section_order,
      modules: [module],
    });
  }

  return [...grouped.values()]
    .sort((left, right) => left.order - right.order || left.name.localeCompare(right.name))
    .map((section) => ({
      ...section,
      modules: [...section.modules].sort(
        (left, right) => left.sort_order - right.sort_order || left.name.localeCompare(right.name),
      ),
    }));
}

export function DashboardShell() {
  const router = useRouter();
  const pathname = usePathname();
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
        sectionKey: form.sectionKey,
        sectionName: form.sectionName,
        sectionOrder: form.sectionOrder,
        visibleRoles: form.visibleRoles,
      });

      setModules((current) =>
        [...current, created.module].sort(
          (left, right) =>
            left.section_order - right.section_order ||
            left.sort_order - right.sort_order ||
            left.name.localeCompare(right.name),
        ),
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
  const sections = groupModulesBySection(modules);
  const dashboardSections = sections.filter(
    (section) => section.key === "dashboard" || section.modules.some((module) => module.route === "/dashboard"),
  );
  const secondarySections = sections.filter((section) => !dashboardSections.includes(section));

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
          <button className={`workspace-nav-item ${pathname === "/dashboard" ? "active" : ""}`} type="button">
            Dashboard
          </button>

          {dashboardSections.map((section) => (
            <div className="workspace-nav-group" key={section.key}>
              {section.key !== "dashboard" ? (
                <span className="workspace-nav-label">{section.name}</span>
              ) : null}
              {section.modules
                .filter((module) => module.route !== "/dashboard")
                .map((module) => (
                  <button className="workspace-nav-item" key={module.id} type="button">
                    {module.name}
                  </button>
                ))}
            </div>
          ))}

          {secondarySections.map((section) => (
            <div className="workspace-nav-group" key={section.key}>
              <span className="workspace-nav-label">{section.name}</span>
              {section.modules.map((module) => (
                <button className="workspace-nav-item" key={module.id} type="button">
                  {module.name}
                </button>
              ))}
            </div>
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
          <div className="workspace-column">
            <div className="workspace-panel">
              <div className="panel-heading">
                <h2>Secciones</h2>
                <span>{sections.length}</span>
              </div>

              <div className="section-grid">
                {sections.map((section) => (
                  <article className="section-card" key={section.key}>
                    <div className="section-card-top">
                      <strong>{section.name}</strong>
                      <span>{section.modules.length}</span>
                    </div>

                    <div className="section-module-list">
                      {section.modules.map((module) => (
                        <div className="section-module-row" key={module.id}>
                          <span>{module.name}</span>
                          <small>{module.route}</small>
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </div>

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
                      <th>Seccion</th>
                      <th>Ruta</th>
                      <th>Roles</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modules.length === 0 ? (
                      <tr>
                        <td colSpan={5}>Sin modulos</td>
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
                        <td>
                          <div className="module-name-cell">
                            <strong>{module.section_name}</strong>
                            <span>{module.section_key}</span>
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
                    placeholder="/operacion/nuevo-modulo"
                    required
                    value={form.route}
                  />
                  <input
                    className="field"
                    onChange={(event) =>
                      setForm((current) => ({ ...current, sectionName: event.target.value }))
                    }
                    placeholder="Nombre de seccion"
                    required
                    value={form.sectionName}
                  />
                  <input
                    className="field"
                    onChange={(event) =>
                      setForm((current) => ({ ...current, sectionKey: event.target.value }))
                    }
                    placeholder="Clave de seccion"
                    required
                    value={form.sectionKey}
                  />
                  <input
                    className="field"
                    min={1}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        sectionOrder: Number(event.target.value || 100),
                      }))
                    }
                    placeholder="Orden de seccion"
                    type="number"
                    value={form.sectionOrder}
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
