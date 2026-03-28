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
          <h1>Acceso sobrio para una operacion moderna.</h1>
          <p className="hero-text">
            Un login limpio, corporativo y preparado para equipos con multiples
            usuarios, roles y una autenticacion conectada con Supabase,
            Railway y Vercel.
          </p>
        </div>

        <div className="brand-grid">
          {pillars.map((item) => (
            <article className="feature-card" key={item}>
              <span className="feature-dot" />
              <p>{item}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <div className="auth-header">
            <span className="eyebrow">Acceso privado</span>
            <h2>Bienvenido de nuevo</h2>
            <p>
              Inicia sesion con tu correo corporativo para entrar al dashboard
              principal.
            </p>
          </div>

          <LoginForm />

          <div className="auth-meta">
            <span>Vercel</span>
            <span>Railway</span>
            <span>Supabase</span>
          </div>
        </div>
      </section>
    </main>
  );
}
