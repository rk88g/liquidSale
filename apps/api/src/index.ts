import "dotenv/config";
import cors from "cors";
import express from "express";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  FRONTEND_URL: z.string().url().default("http://localhost:3000"),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
});

const env = envSchema.parse(process.env);

const loginSchema = z.object({
  email: z.string().email("Captura un correo valido."),
  password: z.string().min(8, "La password debe tener al menos 8 caracteres."),
});

type ProfileRow = {
  full_name: string | null;
  role: string;
  is_active: boolean;
};

const TABLES = {
  profiles: "liq_profiles",
} as const;

function createAuthClient() {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function getProfile(
  client: ReturnType<typeof createAuthClient>,
  userId: string,
) {
  const { data, error } = await client
    .from(TABLES.profiles)
    .select("full_name, role, is_active")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as ProfileRow | null) ?? null;
}

function buildUserPayload(
  user: {
    id: string;
    email?: string | null;
    user_metadata?: Record<string, unknown>;
  },
  profile: ProfileRow | null,
) {
  const metadataFullName = user.user_metadata?.full_name;

  return {
    id: user.id,
    email: user.email ?? "",
    fullName:
      profile?.full_name ??
      (typeof metadataFullName === "string" ? metadataFullName : null),
    role: profile?.role ?? "viewer",
  };
}

const app = express();

app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  }),
);
app.use(express.json());

app.get("/health", (_request, response) => {
  response.json({
    ok: true,
    service: "liquid-sale-api",
  });
});

app.post("/auth/login", async (request, response) => {
  const parsed = loginSchema.safeParse(request.body);

  if (!parsed.success) {
    response.status(400).json({
      error: parsed.error.issues[0]?.message ?? "Datos invalidos.",
    });
    return;
  }

  try {
    const client = createAuthClient();
    const { data, error } = await client.auth.signInWithPassword(parsed.data);

    if (error || !data.user || !data.session) {
      response.status(401).json({
        error: error?.message ?? "No fue posible autenticar al usuario.",
      });
      return;
    }

    const profile = await getProfile(client, data.user.id);

    if (profile && !profile.is_active) {
      response.status(403).json({
        error: "Tu cuenta existe pero se encuentra inactiva.",
      });
      return;
    }

    response.json({
      session: {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresAt: data.session.expires_at ?? null,
      },
      user: buildUserPayload(data.user, profile),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error inesperado en login.";

    response.status(500).json({
      error: message,
    });
  }
});

app.get("/auth/me", async (request, response) => {
  const authorization = request.headers.authorization;
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;

  if (!token) {
    response.status(401).json({
      error: "Falta el token de acceso.",
    });
    return;
  }

  try {
    const client = createAuthClient();
    const {
      data: { user },
      error,
    } = await client.auth.getUser(token);

    if (error || !user) {
      response.status(401).json({
        error: error?.message ?? "La sesion no es valida.",
      });
      return;
    }

    const profile = await getProfile(client, user.id);

    if (profile && !profile.is_active) {
      response.status(403).json({
        error: "Tu cuenta fue desactivada.",
      });
      return;
    }

    response.json({
      user: buildUserPayload(user, profile),
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No fue posible consultar al usuario.";

    response.status(500).json({
      error: message,
    });
  }
});

app.listen(env.PORT, () => {
  console.log(`Liquid Sale API running on port ${env.PORT}`);
});
