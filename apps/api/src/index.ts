import "dotenv/config";
import { createHmac, timingSafeEqual } from "node:crypto";
import cors from "cors";
import express from "express";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

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

const env = {
  PORT: Number(process.env.PORT ?? 4000),
  FRONTEND_URL: process.env.FRONTEND_URL?.trim() || "http://localhost:3000",
  ADMIN_EMAIL: process.env.ADMIN_EMAIL?.trim().toLowerCase() || "",
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD?.trim() || "",
  SUPABASE_URL: process.env.SUPABASE_URL?.trim() || "",
  SUPABASE_ANON_KEY:
    process.env.SUPABASE_ANON_KEY?.trim() ||
    process.env.SUPABASE_PUBLISHABLE_KEY?.trim() ||
    "",
  SUPABASE_SERVICE_ROLE_KEY:
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "",
};

const corsOrigins = env.FRONTEND_URL.split(",")
  .map((value) => value.trim())
  .map((value) => value.replace(/\/+$/, ""))
  .filter(Boolean);

const LOCAL_ADMIN_TOKEN_PREFIX = "local-admin";

function assertAuthEnvironment() {
  const missing: string[] = [];

  if (!env.SUPABASE_URL) {
    missing.push("SUPABASE_URL");
  }

  if (!env.SUPABASE_ANON_KEY) {
    missing.push("SUPABASE_ANON_KEY");
  }

  if (missing.length > 0) {
    throw new Error(
      `Faltan variables del backend: ${missing.join(", ")}. Configuralas en Railway.`,
    );
  }
}

function createAuthClient() {
  assertAuthEnvironment();

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
    if ("code" in error && error.code === "42P01") {
      console.warn("liq_profiles no existe todavia. Continuando sin perfil.");
      return null;
    }

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

function getLocalAdminSignature(email: string) {
  return createHmac("sha256", env.ADMIN_PASSWORD).update(email).digest("hex");
}

function buildLocalAdminToken(email: string) {
  const encodedEmail = Buffer.from(email).toString("base64url");
  const signature = getLocalAdminSignature(email);
  return `${LOCAL_ADMIN_TOKEN_PREFIX}.${encodedEmail}.${signature}`;
}

function buildLocalAdminResponse(email: string) {
  return {
    session: {
      accessToken: buildLocalAdminToken(email),
      refreshToken: "",
      expiresAt: Math.floor(Date.now() / 1000) + 60 * 60 * 12,
    },
    user: {
      id: "local-admin",
      email,
      fullName: "Administrador",
      role: "super_admin",
    },
  };
}

function isLocalAdminLogin(email: string, password: string) {
  return (
    !!env.ADMIN_EMAIL &&
    !!env.ADMIN_PASSWORD &&
    email.trim().toLowerCase() === env.ADMIN_EMAIL &&
    password === env.ADMIN_PASSWORD
  );
}

function getLocalAdminUserFromToken(token: string) {
  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) {
    return null;
  }

  const [prefix, encodedEmail, signature] = token.split(".");

  if (!prefix || !encodedEmail || !signature) {
    return null;
  }

  if (prefix !== LOCAL_ADMIN_TOKEN_PREFIX) {
    return null;
  }

  const email = Buffer.from(encodedEmail, "base64url").toString("utf8");
  const expectedSignature = getLocalAdminSignature(email);
  const provided = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);

  if (provided.length !== expected.length) {
    return null;
  }

  if (!timingSafeEqual(provided, expected)) {
    return null;
  }

  if (email.trim().toLowerCase() !== env.ADMIN_EMAIL) {
    return null;
  }

  return buildLocalAdminResponse(email).user;
}

const app = express();

app.use(
  cors({
    origin: corsOrigins.length > 0 ? corsOrigins : true,
    credentials: true,
  }),
);
app.use(express.json());

app.get("/", (_request, response) => {
  response.json({
    ok: true,
    service: "liquid-sale-api",
    status: "online",
  });
});

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
    if (isLocalAdminLogin(parsed.data.email, parsed.data.password)) {
      response.json(buildLocalAdminResponse(parsed.data.email.trim().toLowerCase()));
      return;
    }

    const client = createAuthClient();
    const { data, error } = await client.auth.signInWithPassword(parsed.data);

    if (error || !data.user || !data.session) {
      console.error("Supabase login failed", {
        email: parsed.data.email,
        message: error?.message ?? "No session returned",
        status: error?.status,
        name: error?.name,
      });

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
    const localAdminUser = getLocalAdminUserFromToken(token);

    if (localAdminUser) {
      response.json({
        user: localAdminUser,
      });
      return;
    }

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

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception", error);
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection", reason);
});

app.listen(env.PORT, () => {
  console.log(`Liquid Sale API running on port ${env.PORT}`);
  console.log(`Allowed frontend origins: ${corsOrigins.join(", ") || "any"}`);
  console.log(`Local admin configured: ${env.ADMIN_EMAIL && env.ADMIN_PASSWORD ? "yes" : "no"}`);
  console.log(
    `Supabase auth configured: ${env.SUPABASE_URL && env.SUPABASE_ANON_KEY ? "yes" : "no"}`,
  );
});
