import type { StoredAuth } from "./auth-storage";

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

export type ModuleSummary = {
  id: string;
  code: string;
  name: string;
  slug: string;
  route: string;
  icon: string | null;
  description: string | null;
  section_key: string;
  section_name: string;
  section_order: number;
  visible_roles: string[];
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type ModulesResponse = {
  modules: ModuleSummary[];
};

type CreateModulePayload = {
  code: string;
  name: string;
  slug: string;
  route: string;
  icon?: string;
  description?: string;
  sectionKey: string;
  sectionName: string;
  sectionOrder?: number;
  visibleRoles: string[];
  sortOrder?: number;
  isActive?: boolean;
};

type CreateModuleResponse = {
  module: ModuleSummary;
};

async function safeJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

async function safeFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch {
    throw new Error(
      "No fue posible conectar con el servidor. Revisa Vercel, Railway y la URL del backend.",
    );
  }
}

export async function loginRequest(payload: LoginPayload): Promise<LoginResponse> {
  const response = await safeFetch("/api/auth/login", {
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
  const response = await safeFetch("/api/auth/me", {
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

export async function fetchModules(accessToken: string): Promise<ModulesResponse> {
  const response = await safeFetch("/api/modules", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorPayload = await safeJson<ApiErrorPayload>(response);
    throw new Error(errorPayload?.error ?? "No fue posible consultar modulos.");
  }

  const data = await safeJson<ModulesResponse>(response);

  if (!data) {
    throw new Error("No se recibio informacion de modulos.");
  }

  return data;
}

export async function createModule(
  accessToken: string,
  payload: CreateModulePayload,
): Promise<CreateModuleResponse> {
  const response = await safeFetch("/api/modules", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorPayload = await safeJson<ApiErrorPayload>(response);
    throw new Error(errorPayload?.error ?? "No fue posible crear el modulo.");
  }

  const data = await safeJson<CreateModuleResponse>(response);

  if (!data) {
    throw new Error("No se recibio el modulo creado.");
  }

  return data;
}
