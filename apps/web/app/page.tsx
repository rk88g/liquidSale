import { LoginForm } from "../components/login-form";

const pillars = [
  "Acceso multiusuario",
  "Roles desde Supabase",
  "Diseno premium y responsivo",
];

export default function LoginPage() {
  return (
    <main className="page-shell">
      <section className="brand-panel">
        <div className="brand-copy">
          <span className="eyebrow">Liquid Sale</span>
          <h1>Un acceso sobrio, moderno y listo para escalar.</h1>
          <p className="hero-text">
            Disenamos la entrada del panel para que se sienta ejecutiva, clara
            y confiable desde el primer segundo. La autenticacion queda lista
            para multiples usuarios y roles sobre la misma base de Supabase.
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
            <h2>Ingresa al dashboard</h2>
            <p>
              Usa tu correo corporativo y tu password para entrar al panel de
              control.
            </p>
          </div>

          <LoginForm />

          <div className="auth-meta">
            <span>Frontend en Vercel</span>
            <span>Backend en Railway</span>
            <span>Auth y DB en Supabase</span>
          </div>
        </div>
      </section>
    </main>
  );
}
