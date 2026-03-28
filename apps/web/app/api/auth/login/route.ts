import { NextRequest, NextResponse } from "next/server";

function normalizeBackendUrl(rawValue: string) {
  const trimmed = rawValue.trim().replace(/\/+$/, "");

  if (!trimmed) {
    return "";
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

const BACKEND_API_URL = normalizeBackendUrl(
  process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL || "",
);

type BackendErrorPayload = {
  error?: string;
  message?: string;
};

async function safeJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function ensureBackendUrl() {
  if (!BACKEND_API_URL) {
    throw new Error(
      "Falta BACKEND_API_URL en Vercel. Configura la URL publica de Railway.",
    );
  }

  return BACKEND_API_URL;
}

export async function POST(request: NextRequest) {
  try {
    const backendUrl = ensureBackendUrl();
    const body = await request.json();

    const response = await fetch(`${backendUrl}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const payload = await safeJson<BackendErrorPayload | Record<string, unknown>>(
      response,
    );

    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            (payload as BackendErrorPayload | null)?.error ??
            "No fue posible iniciar sesion.",
        },
        { status: response.status },
      );
    }

    return NextResponse.json(payload ?? {}, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No fue posible conectar con el backend.";

    return NextResponse.json(
      {
        error: message,
      },
      { status: 500 },
    );
  }
}
