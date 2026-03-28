import "dotenv/config";
import { createHmac, timingSafeEqual } from "node:crypto";
import cors from "cors";
import express from "express";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

const ROLE_VALUES = [
  "super_admin",
  "admin",
  "manager",
  "seller",
  "viewer",
] as const;

const roleSchema = z.enum(ROLE_VALUES);

const loginSchema = z.object({
  email: z.string().email("Captura un correo valido."),
  password: z.string().min(8, "La password debe tener al menos 8 caracteres."),
});

const createModuleSchema = z.object({
  code: z
    .string()
    .min(2, "El codigo es obligatorio.")
    .regex(/^[a-z0-9_]+$/, "El codigo solo admite minusculas, numeros y guion bajo."),
  name: z.string().min(2, "El nombre es obligatorio."),
  slug: z
    .string()
    .min(2, "El slug es obligatorio.")
    .regex(/^[a-z0-9-]+$/, "El slug solo admite minusculas, numeros y guion medio."),
  route: z.string().min(2, "La ruta es obligatoria."),
  icon: z.string().trim().optional().default(""),
  description: z.string().trim().optional().default(""),
  sectionKey: z
    .string()
    .min(2, "La clave de seccion es obligatoria.")
    .regex(/^[a-z0-9_]+$/, "La seccion solo admite minusculas, numeros y guion bajo."),
  sectionName: z.string().min(2, "El nombre de la seccion es obligatorio."),
  sectionOrder: z.coerce.number().int().default(100),
  visibleRoles: z.array(roleSchema).min(1, "Selecciona al menos un rol."),
  sortOrder: z.coerce.number().int().default(100),
  isActive: z.coerce.boolean().default(true),
});

type AppRole = (typeof ROLE_VALUES)[number];

type ProfileRow = {
  full_name: string | null;
  role: AppRole;
  is_active: boolean;
};

type ModuleRow = {
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
  visible_roles: AppRole[];
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type AuthenticatedAppUser = {
  id: string;
  email: string;
  fullName: string | null;
  role: AppRole;
  isActive: boolean;
  isLocalAdmin: boolean;
};

const TABLES = {
  profiles: "liq_profiles",
  modules: "liq_modulos",
  logs: "liq_logs",
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
    missing.push("SUPABASE_ANON_KEY o SUPABASE_PUBLISHABLE_KEY");
  }

  if (missing.length > 0) {
    throw new Error(
      `Faltan variables del backend: ${missing.join(", ")}. Configuralas en Railway.`,
    );
  }
}

function assertServiceEnvironment() {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY en Railway.");
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

function createServiceClient() {
  assertAuthEnvironment();
  assertServiceEnvironment();

  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function getProfile(
  client: SupabaseClient,
  userId: string,
): Promise<ProfileRow | null> {
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
      role: "super_admin" as const,
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

function getLocalAdminUserFromToken(token: string): AuthenticatedAppUser | null {
  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) {
    return null;
  }

  const [prefix, encodedEmail, signature] = token.split(".");

  if (!prefix || !encodedEmail || !signature || prefix !== LOCAL_ADMIN_TOKEN_PREFIX) {
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

  return {
    id: "local-admin",
    email,
    fullName: "Administrador",
    role: "super_admin",
    isActive: true,
    isLocalAdmin: true,
  };
}

function extractBearerToken(request: express.Request) {
  const authorization = request.headers.authorization;
  return authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;
}

async function getAuthenticatedAppUser(request: express.Request) {
  const token = extractBearerToken(request);

  if (!token) {
    return {
      token: null,
      user: null,
    };
  }

  const localAdmin = getLocalAdminUserFromToken(token);

  if (localAdmin) {
    return {
      token,
      user: localAdmin,
    };
  }

  const authClient = createAuthClient();
  const serviceClient = createServiceClient();
  const {
    data: { user },
    error,
  } = await authClient.auth.getUser(token);

  if (error || !user) {
    return {
      token,
      user: null,
    };
  }

  const profile = await getProfile(serviceClient, user.id);

  return {
    token,
    user: {
      id: user.id,
      email: user.email ?? "",
      fullName:
        profile?.full_name ??
        (typeof user.user_metadata?.full_name === "string"
          ? user.user_metadata.full_name
          : null),
      role: profile?.role ?? "viewer",
      isActive: profile?.is_active ?? true,
      isLocalAdmin: false,
    } satisfies AuthenticatedAppUser,
  };
}

function requireAuthenticatedUser(
  response: express.Response,
  appUser: AuthenticatedAppUser | null,
): appUser is AuthenticatedAppUser {
  if (!appUser) {
    response.status(401).json({
      error: "La sesion no es valida.",
    });
    return false;
  }

  if (!appUser.isActive) {
    response.status(403).json({
      error: "Tu cuenta fue desactivada.",
    });
    return false;
  }

  return true;
}

function requireRole(
  response: express.Response,
  appUser: AuthenticatedAppUser,
  roles: AppRole[],
) {
  if (!roles.includes(appUser.role)) {
    response.status(403).json({
      error: "No tienes permisos para realizar esta accion.",
    });
    return false;
  }

  return true;
}

async function createAuditLog(
  client: SupabaseClient,
  payload: {
    actorUserId: string | null;
    action: string;
    entityTable: string;
    entityId: string;
    moduleId?: string | null;
    summary: string;
    beforeData?: Record<string, unknown> | null;
    afterData?: Record<string, unknown> | null;
    context?: Record<string, unknown>;
    isReversible?: boolean;
    revertPayload?: Record<string, unknown> | null;
  },
) {
  try {
    const { error } = await client.from(TABLES.logs).insert({
      actor_user_id: payload.actorUserId,
      action_type: payload.action,
      entity_table: payload.entityTable,
      entity_id: payload.entityId,
      module_id: payload.moduleId ?? null,
      summary: payload.summary,
      before_data: payload.beforeData ?? null,
      after_data: payload.afterData ?? null,
      context: payload.context ?? {},
      is_reversible: payload.isReversible ?? false,
      revert_payload: payload.revertPayload ?? null,
    });

    if (error && "code" in error && error.code === "42P01") {
      console.warn("liq_logs no existe todavia. Continuando sin log.");
      return;
    }

    if (error) {
      console.error("No fue posible guardar log", error);
    }
  } catch (error) {
    console.error("Error inesperado al guardar log", error);
  }
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

    const authClient = createAuthClient();
    const serviceClient = createServiceClient();
    const { data, error } = await authClient.auth.signInWithPassword(parsed.data);

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

    const profile = await getProfile(serviceClient, data.user.id);

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
  try {
    const { user } = await getAuthenticatedAppUser(request);

    if (!requireAuthenticatedUser(response, user)) {
      return;
    }

    response.json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
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

app.get("/modules", async (request, response) => {
  try {
    const { user } = await getAuthenticatedAppUser(request);

    if (!requireAuthenticatedUser(response, user)) {
      return;
    }

    const client = createServiceClient();
    let query = client
      .from(TABLES.modules)
      .select(
        "id, code, name, slug, route, icon, description, section_key, section_name, section_order, visible_roles, is_active, sort_order, created_at, updated_at",
      )
      .order("section_order", { ascending: true })
      .order("section_name", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (user.role !== "super_admin") {
      query = query.eq("is_active", true).contains("visible_roles", [user.role]);
    }

    const { data, error } = await query;

    if (error && "code" in error && error.code === "42P01") {
      response.json({
        modules: [],
      });
      return;
    }

    if (error) {
      throw error;
    }

    response.json({
      modules: (data as ModuleRow[] | null) ?? [],
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No fue posible consultar modulos.";

    response.status(500).json({
      error: message,
    });
  }
});

app.post("/modules", async (request, response) => {
  const parsed = createModuleSchema.safeParse(request.body);

  if (!parsed.success) {
    response.status(400).json({
      error: parsed.error.issues[0]?.message ?? "Datos invalidos.",
    });
    return;
  }

  try {
    const { user } = await getAuthenticatedAppUser(request);

    if (!requireAuthenticatedUser(response, user)) {
      return;
    }

    if (!requireRole(response, user, ["super_admin"])) {
      return;
    }

    const client = createServiceClient();
    const actorId = z.string().uuid().safeParse(user.id).success ? user.id : null;
    const payload = {
      code: parsed.data.code,
      name: parsed.data.name,
      slug: parsed.data.slug,
      route: parsed.data.route,
      icon: parsed.data.icon || null,
      description: parsed.data.description || null,
      section_key: parsed.data.sectionKey,
      section_name: parsed.data.sectionName,
      section_order: parsed.data.sectionOrder,
      visible_roles: parsed.data.visibleRoles,
      is_active: parsed.data.isActive,
      sort_order: parsed.data.sortOrder,
      created_by: actorId,
      updated_by: actorId,
    };

    const { data, error } = await client
      .from(TABLES.modules)
      .insert(payload)
      .select(
        "id, code, name, slug, route, icon, description, section_key, section_name, section_order, visible_roles, is_active, sort_order, created_at, updated_at",
      )
      .single();

    if (error) {
      throw error;
    }

    const createdModule = data as ModuleRow;

    await createAuditLog(client, {
      actorUserId: actorId,
      action: "create",
      entityTable: TABLES.modules,
      entityId: createdModule.id,
      moduleId: createdModule.id,
      summary: `Modulo creado: ${createdModule.name}`,
      afterData: createdModule as unknown as Record<string, unknown>,
      isReversible: true,
      revertPayload: {
        delete_module_id: createdModule.id,
      },
    });

    response.status(201).json({
      module: createdModule,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No fue posible crear el modulo.";

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
  console.log(
    `Local admin configured: ${env.ADMIN_EMAIL && env.ADMIN_PASSWORD ? "yes" : "no"}`,
  );
  console.log(
    `Supabase auth configured: ${env.SUPABASE_URL && env.SUPABASE_ANON_KEY ? "yes" : "no"}`,
  );
  console.log(`Service role configured: ${env.SUPABASE_SERVICE_ROLE_KEY ? "yes" : "no"}`);
});
