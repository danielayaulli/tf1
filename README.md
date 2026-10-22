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
- [x] Fase 3 — Búsqueda y solicitudes del pasajero
- [x] Fase 4 — Puntuaciones

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

### Fase 3 — qué se construyó

- RPC `nearby_trips(passenger_lat, passenger_lng, tolerance_m default 150)`:
  usa `ST_DWithin`/`ST_Distance` de PostGIS para encontrar viajes
  `scheduled` con asientos libres cuya ruta pasa a menos de
  `tolerance_m` metros de un punto, y devuelve también la composición de
  sexo (conteo de `pickup_requests` aceptadas por sexo) y el nombre de
  pila + estrellas del conductor. `security definer` porque necesita leer
  `profiles.sexo` de otros usuarios para el conteo agregado.
- RPC `trip_route_points(trip_id)`: devuelve los puntos de la ruta de un
  viaje, usada solo para dar feedback inmediato en el cliente al elegir el
  punto de recojo (la restricción real sigue siendo el `CHECK` de Lima).
- [`src/lib/distance.ts`](src/lib/distance.ts): distancia punto-polilínea
  (fórmula de Haversine + proyección local), usada para ese feedback.
  [`src/lib/composition.ts`](src/lib/composition.ts): formatea la
  composición de sexo (`"solo mujeres"`, `"3 hombres, 2 mujeres"`, etc.).
  Ambas con tests.
- Página `/pasajero/buscar`: el pasajero marca su ubicación en el mapa,
  ve los viajes cercanos con su composición de sexo (para decidir si
  subirse antes de pedir el recojo), y al solicitar recojo elige el punto
  en el mapa sobre la ruta del viaje.
- Probado de punta a punta en el navegador: un pasajero real solicitó
  recojo desde la UI y el conductor aceptó la solicitud desde "Mis
  viajes", confirmando que todo el flujo (no solo los datos sembrados)
  funciona.

### Qué probar a mano (Fase 3)

1. Entra con `pasajero1@example.com` / `password123` → "Buscar viajes" →
   marca un punto cerca de Javier Prado (San Isidro - La Molina) → "Buscar
   viajes". Deberías ver los 2 viajes sembrados con su composición de sexo.
2. Pulsa "Solicitar recojo" en uno, elige un punto sobre la línea azul de
   la ruta y confirma. El botón debe cambiar a "Solicitud enviada".
3. Entra con el conductor dueño de ese viaje (`conductor1` o `conductor2`)
   → "Mis viajes" → deberías ver la nueva solicitud pendiente y poder
   aceptarla/rechazarla.

### Fase 4 — qué se construyó

- Tabla `ratings` (`trip_id`, `rater_id`, `rated_id`, `stars` 1-5, `comment`
  opcional) con RLS: solo se puede calificar a la contraparte (conductor ↔
  pasajero aceptado) de un viaje ya `finished`, y solo una vez por par
  (índice único `trip_id, rater_id, rated_id`). Cada usuario solo ve las
  calificaciones que dio o recibió.
- Trigger `on_rating_insert`: recalcula `profiles.rating_avg`/`rating_count`
  del calificado tras cada `insert` en `ratings`. `security definer` porque
  quien califica no tiene permiso de `UPDATE` sobre esas columnas de otro
  perfil.
- Botón "Finalizar viaje" en `/conductor/mis-viajes` (usa el `grant update
  (status)` que ya existía desde la Fase 2, sin migración nueva).
- Página `/pasajero/mis-solicitudes`: lista las solicitudes del pasajero con
  el conductor y el estado del viaje; si el viaje terminó y la solicitud fue
  aceptada, muestra el formulario para calificar al conductor.
- En `/conductor/mis-viajes`, cuando un viaje está `finished`, aparece un
  formulario para calificar a cada pasajero aceptado.
- El promedio y conteo de calificaciones (`rating_avg`/`rating_count`) ahora
  se muestran en el Home de cada usuario.
- Seed: un tercer viaje de `conductor1` ya `finished` con una solicitud
  `accepted` de `pasajero2`, para poder probar la calificación de inmediato.

### Qué probar a mano (Fase 4)

1. Entra con `conductor1@example.com` / `password123` → "Mis viajes": el
   viaje sembrado en estado `finished` debería mostrar "Calificar
   pasajeros" con un formulario para Ana (`pasajero2`). Envíalo.
2. Entra con `pasajero2@example.com` / `password123` → "Mis solicitudes":
   la solicitud de ese mismo viaje debería mostrar el formulario para
   calificar a Carlos (`conductor1`). Envíalo.
3. Verifica en el Home de ambos usuarios que "Tu calificación" ahora
   muestre el promedio y conteo actualizados.
4. Prueba también el ciclo completo: en "Mis viajes", pulsa "Finalizar
   viaje" en uno de los viajes `scheduled` con un pasajero aceptado, y
   confirma que aparece el formulario de calificación para ese viaje.

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
