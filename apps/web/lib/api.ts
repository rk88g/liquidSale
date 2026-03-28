import type { StoredAuth } from "./auth-storage";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:4000";

type LoginPayload = {
  email: string;
  password: string;
};

type UserPayload = StoredAuth["user"];

type ApiErrorPayload = {
  error?: string;
  message?: string;
};

type LoginResponse = {
  session: StoredAuth["session"];
  user: UserPayload;
};

type MeResponse = {
  user: UserPayload;
};

async function safeJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export async function loginRequest(payload: LoginPayload): Promise<LoginResponse> {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorPayload = await safeJson<ApiErrorPayload>(response);
    throw new Error(errorPayload?.error ?? "Credenciales invalidas.");
  }

  const data = await safeJson<LoginResponse>(response);

  if (!data) {
    throw new Error("El backend no devolvio una sesion valida.");
  }

  return data;
}

export async function fetchCurrentUser(accessToken: string): Promise<MeResponse> {
  const response = await fetch(`${API_URL}/auth/me`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorPayload = await safeJson<ApiErrorPayload>(response);
    throw new Error(errorPayload?.error ?? "No fue posible validar la sesion.");
  }

  const data = await safeJson<MeResponse>(response);

  if (!data) {
    throw new Error("No se recibio informacion del usuario.");
  }

  return data;
}
