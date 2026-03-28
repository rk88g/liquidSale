import { LoginForm } from "../components/login-form";

const pillars = [
  "Acceso multiusuario",
  "Permisos por rol",
  "Infraestructura empresarial",
];

export default function LoginPage() {
  return (
    <main className="page-shell">
      <section className="brand-panel">
        <div className="brand-copy">
          <span className="eyebrow">Liquid Sale Enterprise</span>
          <div className="brand-mark">LIQUID SALE</div>
          <h1></h1>
          <p className="hero-text">
           
          </p>
        </div>

        <div className="brand-grid">
          
        </div>
      </section>

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
