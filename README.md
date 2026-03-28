# Liquid Sale

Base inicial del proyecto con arquitectura separada:

- `apps/web`: frontend en Next.js pensado para Vercel
- `apps/api`: backend en Express pensado para Railway
- `supabase`: SQL base para usuarios, perfiles y roles

## Stack propuesto

- Frontend: Next.js + TypeScript
- Backend: Express + TypeScript
- Auth y DB: Supabase
- Deploy:
  - Vercel para `apps/web`
  - Railway para `apps/api`
  - Supabase para autenticacion, perfiles y datos

## Flujo del login

1. El usuario entra al frontend y captura email y password.
2. El frontend llama a `POST /auth/login` en Railway.
3. El backend autentica contra Supabase Auth.
4. El backend consulta `public.liq_profiles` para obtener el `role`.
5. El frontend guarda la sesion y entra al dashboard.

## Como vamos a trabajar

1. Ya deje la base del monorepo y el primer login elegante y responsivo.
2. El siguiente paso es conectar tus variables reales de Supabase, Railway y Vercel.
3. Despues levantamos el dashboard por rol:
   - `super_admin`
   - `admin`
   - `manager`
   - `seller`
   - `viewer`
4. Luego construimos gestion de usuarios, permisos y modulos del negocio.

## Variables de entorno

### Vercel / `apps/web`

Revisar [apps/web/.env.example](/C:/Users/rk88g/Documents/GitHub/liquidSale/apps/web/.env.example)

Variable principal:

- `NEXT_PUBLIC_API_URL`: URL publica del backend en Railway

### Railway / `apps/api`

Revisar [apps/api/.env.example](/C:/Users/rk88g/Documents/GitHub/liquidSale/apps/api/.env.example)

Variables principales:

- `FRONTEND_URL`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Nota importante: las credenciales de usuarios finales no se guardan en Railway. Railway solo guarda llaves del sistema y configuracion. Los usuarios y passwords viven en Supabase Auth.

## Como manejar multiples usuarios y roles

- Los usuarios se crean en Supabase Auth.
- Cada usuario tiene un registro en `public.liq_profiles`.
- El rol vive en `public.liq_profiles.role`.
- El backend usa ese rol para decidir acceso a endpoints y modulos.

La base SQL inicial esta en [supabase/001_roles.sql](/C:/Users/rk88g/Documents/GitHub/liquidSale/supabase/001_roles.sql).

Nota: ahora todo quedo estandarizado con el prefijo `liq_` para tablas y objetos SQL auxiliares.

## Estructura

```text
apps/
  api/
  web/
supabase/
```

## Scripts esperados

Cuando tengas Node instalado en tu maquina local:

```bash
npm install
npm run dev:web
npm run dev:api
```

## Siguiente recomendacion

Despues de cargar variables reales, el siguiente bloque que conviene construir es:

1. Proteccion real del dashboard con middleware
2. Pantalla para alta de usuarios por rol
3. Modulo de recuperacion de password
