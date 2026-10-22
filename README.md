# Colectivos Lima (tf1)

MVP de una app web de "colectivos" para Lima, Perú: conductores publican viajes a
lo largo de una ruta y pasajeros cercanos a esa ruta piden que los recojan, como un
taxi compartido. Proyecto universitario — prioriza funcionar de punta a punta antes
que estar pulido.

## Stack

- **Frontend:** Vite + React + TypeScript (SPA), React Router, `@vis.gl/react-google-maps`
- **Backend:** Supabase (Auth, Postgres + PostGIS, Realtime, Edge Functions)
- **Mapas/rutas:** Google Maps JavaScript API + Directions API

## Requisitos

- Node.js 20+ (recomendado vía [nvm](https://github.com/nvm-sh/nvm): `nvm install --lts`)
- Una cuenta de [Supabase](https://supabase.com) (plan gratuito) y un proyecto creado
- Una API key de [Google Cloud](https://console.cloud.google.com/) con **Maps JavaScript API**
  y **Directions API** habilitadas

## Setup

```bash
npm install
cp .env.example .env.local   # completa con tus credenciales de Supabase y Google Maps
npm run dev
```

La app queda disponible en `http://localhost:5173`.

### Base de datos (Supabase)

```bash
npx supabase login
npx supabase link --project-ref <tu-project-ref>
npx supabase db push    # aplica las migraciones en supabase/migrations
```

## Scripts

| Comando | Descripción |
|---|---|
| `npm run dev` | Levanta el servidor de desarrollo |
| `npm run build` | Compila TypeScript y genera el build de producción |
| `npm run test` | Corre los tests (Vitest) |
| `npm run lint` | Corre el linter (Oxlint) |

## Estado del proyecto

Este proyecto se construye por fases. Esta sección y el diagrama de la base de
datos se irán completando a medida que avancen:

- [x] Fase 0 — Setup del proyecto (Vite + React + TS, Supabase CLI, estructura de carpetas)
- [x] Fase 1 — Base de datos y autenticación
- [ ] Fase 2 — Viajes del conductor
- [ ] Fase 3 — Búsqueda y solicitudes del pasajero
- [ ] Fase 4 — Puntuaciones

### Fase 1 — qué se construyó

- Tabla `profiles` (1:1 con `auth.users`) con DNI, nombres, apellidos, sexo,
  roles, `verification_status` y RLS: cada usuario solo lee/edita su propia
  fila completa; `verification_status` solo lo puede cambiar el Edge Function
  (vía `service_role`), nunca el cliente.
- Vista `public_profiles`: lo único visible del perfil de otro usuario
  (nombre de pila, foto, puntuación) — nunca DNI ni apellidos.
- Trigger `on_auth_user_created`: crea el `profile` automáticamente al
  registrarse, leyendo los datos extra que manda el formulario.
- Edge Function `verify-identity`: implementa `IdentityVerificationService`
  con un mock determinista (sin llamadas externas reales):
  - DNI que empieza en `00` → RENIEC no lo encuentra → `rejected`
  - DNI que termina en `9` → antecedentes encontrados → `rejected`
  - cualquier otro DNI de 8 dígitos → `verified`
- Páginas de registro (`/register`) y login (`/login`), y una ruta protegida
  (`/`) que bloquea el acceso hasta que el usuario quede verificado.
- Seed de 4 usuarios ya verificados (`supabase/seed.sql`), contraseña
  `password123` para todos:
  - `conductor1@example.com`, `conductor2@example.com` (conductores)
  - `pasajero1@example.com`, `pasajero2@example.com` (pasajeros)

### Qué probar a mano

1. `npm run dev` y abre `http://localhost:5173`.
2. **Registro + verificación automática:** ve a `/register`, usa un DNI que
   no empiece en `00` ni termine en `9` (ej. `12345678`) → debería terminar
   en "Estado de verificación: verified".
3. **Registro rechazado:** regístrate con un DNI que termine en `9` (ej.
   `12345679`) → debería mostrar el mensaje de identidad no verificada.
4. **Login con usuario sembrado:** cierra sesión y entra con
   `conductor1@example.com` / `password123`.
5. **Privacidad:** confirma en el dashboard de Supabase (Table Editor →
   `profiles`) que el DNI y apellidos existen en la tabla pero que la vista
   `public_profiles` (Table Editor → Views) no los expone.

> Nota: en el proyecto de Supabase, en Authentication → Sign In / Providers →
> Email, desactiva "Confirm email" para que el registro no dependa de un
> correo de confirmación (el plan gratuito tiene un límite de envío muy bajo).

## Estructura de carpetas

```
src/
  lib/            # clientes compartidos (supabase, etc.)
  types/          # tipos TypeScript compartidos / generados de Supabase
  components/     # componentes UI reutilizables
  features/
    auth/         # registro, login, verificación de identidad
    trips/        # publicar y listar viajes (conductor)
    requests/     # solicitudes de recojo (pasajero)
    ratings/      # calificaciones mutuas
supabase/
  migrations/     # esquema SQL versionado
  functions/      # Edge Functions (ej. verificación de identidad mock)
```
