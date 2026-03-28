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

async function proxyRequest(request: NextRequest, method: "GET" | "POST") {
  const backendUrl = ensureBackendUrl();
  const authorization = request.headers.get("authorization");
  const body =
    method === "POST" ? JSON.stringify(await request.json()) : undefined;

  const response = await fetch(`${backendUrl}/modules`, {
    method,
    headers: {
      ...(authorization ? { Authorization: authorization } : {}),
      ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
    },
    body,
    cache: "no-store",
  });

  const payload = await safeJson<BackendErrorPayload | Record<string, unknown>>(response);

  if (!response.ok) {
    return NextResponse.json(
      {
        error:
          (payload as BackendErrorPayload | null)?.error ??
          (payload as BackendErrorPayload | null)?.message ??
          "No fue posible procesar modulos.",
      },
      { status: response.status },
    );
  }

  return NextResponse.json(payload ?? {}, { status: response.status });
}

export async function GET(request: NextRequest) {
  try {
    return await proxyRequest(request, "GET");
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No fue posible consultar modulos.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    return await proxyRequest(request, "POST");
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No fue posible crear el modulo.",
      },
      { status: 500 },
    );
  }
}
