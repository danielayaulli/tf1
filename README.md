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
- [x] Fase 2 — Viajes del conductor
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

### Fase 2 — qué se construyó

- Tablas `trips` y `pickup_requests` con RLS: cualquier usuario verificado
  puede ver los viajes; solo el conductor dueño puede publicarlos/editarlos;
  las solicitudes solo las ve el pasajero dueño o el conductor del viaje.
- Restricción a Lima: función SQL `point_in_lima()` como `CHECK` constraint
  en `origin`, `destination` y `pickup_point` (además de la validación en el
  cliente, ver [`src/lib/geo.ts`](src/lib/geo.ts)).
- Trigger `on_pickup_request_status_change`: al aceptar una solicitud resta
  un asiento del viaje (y lo repone si se cancela/rechaza después de
  aceptada); rechaza el `UPDATE` si ya no hay asientos.
- Página `/conductor/publicar`: mapa (Google Maps JS API) donde el conductor
  marca origen/destino con clics, calcula la ruta con
  `google.maps.routes.Route.computeRoutes` (la Directions API legacy ya no
  se habilita en proyectos nuevos de Google Cloud) y la dibuja; valida que
  ambos puntos estén en Lima antes de publicar.
- Página `/conductor/mis-viajes`: lista los viajes del conductor con sus
  solicitudes pendientes (nombre de pila + estrellas del pasajero) y botones
  para aceptar/rechazar.
- Seed: dos viajes de ejemplo sobre Av. Javier Prado (uno por conductor) y
  una solicitud pendiente de `pasajero1` sobre el viaje de `conductor1`.

### Qué probar a mano (Fase 2)

1. Entra con `conductor1@example.com` / `password123` → en el Home verás los
   links "Publicar viaje" y "Mis viajes" (solo visibles para conductores).
2. En **Mis viajes** verás el viaje sembrado con una solicitud pendiente de
   "Jorge" → acepta o rechaza y confirma que los asientos disponibles
   cambian.
3. En **Publicar viaje**: clic en "Elegir origen", clic en el mapa; clic en
   "Elegir destino", clic en otro punto; "Calcular ruta" (debería dibujar
   una polilínea azul); completa avenida/hora/asientos y publica. Debería
   aparecer en "Mis viajes".
4. Prueba también el bloqueo geográfico: si usas la consola del navegador
   para forzar un punto fuera de Lima, el `CHECK` de la base de datos lo
   rechaza aunque se salte la validación del cliente.

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
