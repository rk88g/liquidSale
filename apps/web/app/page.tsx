import { LoginForm } from "../components/login-form";

const pillars = [
  "Acceso multiusuario",
  "Permisos por rol",
  "Infraestructura empresarial",
];

export default function LoginPage() {
  return (
    <main className="page-shell">
      

      <section className="auth-panel">
        <div className="auth-card">
          <div className="auth-header">
            <span className="eyebrow">Acceso privado</span>
            <h2>Welcome</h2>
            <p>
              Inicia sesion con tu correo corporativo para entrar al dashboard
              principal.
            </p>
          </div>

          <LoginForm />

          <div className="auth-meta">
            <span>Ventas</span>
            <span>Reportes</span>
            <span>Historial</span>
          </div>
        </div>
      </section>
    </main>
  );
}
