"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { loginRequest } from "../lib/api";
import { saveStoredAuth } from "../lib/auth-storage";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    setIsError(false);

    try {
      const response = await loginRequest({ email, password });
      saveStoredAuth(response);
      setMessage("Acceso correcto. Redirigiendo al dashboard...");
      router.push("/dashboard");
    } catch (error) {
      const fallback = "No fue posible iniciar sesion.";
      const nextMessage =
        error instanceof Error && error.message ? error.message : fallback;
      setIsError(true);
      setMessage(nextMessage);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="login-form" onSubmit={handleSubmit}>
      <div className="field-group">
        <label className="label" htmlFor="email">
          Correo electronico
        </label>
        <input
          autoComplete="email"
          className="field"
          id="email"
          name="email"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="usuario@empresa.com"
          required
          type="email"
          value={email}
        />
      </div>

      <div className="field-group">
        <div className="field-row">
          <label className="label" htmlFor="password">
            Password
          </label>
          <button className="text-button" type="button">
            Olvide mi password
          </button>
        </div>

        <div className="password-field">
          <input
            autoComplete="current-password"
            className="field"
            id="password"
            name="password"
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Tu password seguro"
            required
            type={showPassword ? "text" : "password"}
            value={password}
          />
          <button
            aria-label={showPassword ? "Ocultar password" : "Mostrar password"}
            className="password-toggle"
            onClick={() => setShowPassword((current) => !current)}
            type="button"
          >
            {showPassword ? "Ocultar" : "Mostrar"}
          </button>
        </div>

        <span className="field-hint">
          Las cuentas reales se administran desde Supabase Auth y los roles se
          leen desde `liq_profiles`.
        </span>
      </div>

      {message ? (
        <div className={`status-message ${isError ? "error" : ""}`}>
          {message}
        </div>
      ) : null}

      <button className="button-primary" disabled={isSubmitting} type="submit">
        {isSubmitting ? "Validando acceso..." : "Entrar al panel"}
      </button>
    </form>
  );
}
