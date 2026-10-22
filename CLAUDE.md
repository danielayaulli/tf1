# CLAUDE.md

Contexto de proyecto para Claude Code. Ver también [README.md](README.md) para
instrucciones de setup y qué probar a mano en cada fase.

## Qué es esto

MVP universitario de una app web de "colectivos" para Lima, Perú: conductores
publican viajes a lo largo de una ruta (ej. Av. Javier Prado) y pasajeros
cercanos a esa ruta piden que los recojan. Prioridad: que funcione de punta a
punta, no que esté pulido.

## Stack y por qué

- **Vite + React + TypeScript** (SPA, no Next.js): no se necesita SSR/SEO,
  todo pasa por el cliente de Supabase. Vite da arranque más simple.
- **Supabase** (Auth, Postgres + PostGIS, Edge Functions): proyecto en la
  **nube** (no local), porque esta máquina no tiene Docker. Las migraciones
  son SQL versionado en `supabase/migrations/`, aplicadas con
  `supabase db push`.
- **Google Maps JavaScript API + Routes API** (no Mapbox): mejor cobertura en
  Lima. Ver "Gotchas" abajo sobre por qué NO es `DirectionsService`.
- Node se instaló vía **nvm** (no Homebrew: el Homebrew de esta máquina es de
  2019 y está roto). Cada comando de shell necesita
  `export NVM_DIR="$HOME/.nvm"; [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"`
  al inicio si el shell no lo carga solo.

## Estado por fases

- [x] **Fase 0** — Setup (Vite+React+TS, Supabase CLI, estructura de carpetas)
- [x] **Fase 1** — Base de datos y autenticación (`profiles`, RLS, trigger de
      registro, Edge Function `verify-identity` mock, registro/login)
- [x] **Fase 2** — Viajes del conductor (`trips`, `pickup_requests`, trigger
      de asientos, publicar viaje con mapa, aceptar/rechazar solicitudes)
- [x] **Fase 3** — Búsqueda y solicitudes del pasajero (RPC `nearby_trips`
      con PostGIS, composición de sexo, solicitar recojo con mapa)
- [x] **Fase 4** — Puntuaciones (tabla `ratings`, trigger que recalcula
      `profiles.rating_avg`/`rating_count`, UI de calificación mutua)

Detalle de qué se construyó y qué probar a mano en cada fase: ver las
secciones "Fase N — qué se construyó" en [README.md](README.md).

## Decisiones importantes (y por qué)

- **No se borra nada en `seed.sql`.** La primera versión usaba
  `DELETE ... WHERE id IN (...)` antes de re-insertar, pero
  `trips`/`pickup_requests` referencian `profiles`/`auth.users` SIN
  `ON DELETE CASCADE` (a propósito, para no perder historial por accidente).
  Si ya existía un viaje real creado desde la app con uno de los usuarios
  sembrados, el DELETE fallaba con violación de foreign key. Ahora todo
  insert usa `on conflict (id) do nothing`: el seed es puramente aditivo y
  nunca toca datos reales.
- **`verification_status` nunca lo puede tocar el cliente.** Column-level
  grants (`revoke update ... / grant update (cols sin verification_status)`)
  en vez de confiar solo en RLS, para que ni siquiera un bug en una policy
  pueda dejar que alguien se auto-verifique. Solo el Edge Function
  `verify-identity` (con `service_role`) la cambia.
- **`public_profiles` es una vista sin `security_invoker`.** Esto es
  intencional: corre con los permisos de quien la creó, no de quien
  consulta, así que salta la policy restrictiva de `profiles` a propósito
  para exponer `nombre_pila`/`foto_url`/`rating_avg` a cualquier usuario
  autenticado sin exponer `dni`/`apellidos`.
- **`nearby_trips` y `trip_route_points` son `security definer`.** Necesitan
  leer `profiles.sexo` de otros usuarios (para el conteo agregado) y
  `trips`/`pickup_requests` sin las restricciones normales de RLS. Ambas
  funciones validan `is_verified()` internamente porque al ser
  `security definer` se saltan las policies de las tablas base.
- **Restricción a Lima en dos capas:** `src/lib/geo.ts` (`isInLima`) da
  feedback inmediato en el cliente; `point_in_lima()` como `CHECK` constraint
  en `origin`/`destination`/`pickup_point` es la que de verdad protege la
  base de datos. Si cambias el bounding box, actualiza ambos lugares.
- **Avenida principal es un input manual del conductor**, no se deriva
  automáticamente de la ruta. Se evaluó y es posible pero no 100% confiable
  (la Routes API no da un campo "nombre de calle" estructurado, solo texto
  libre de instrucciones de navegación que habría que parsear con regex).
  Queda **pendiente / deferred** si se quiere retomar.
- **`ratings` no tiene policy de `update`/`delete`.** Una calificación es
  definitiva una vez enviada (evita que alguien la edite después de ver la
  calificación que recibió a cambio). El índice único
  `(trip_id, rater_id, rated_id)` es lo que realmente impide calificar dos
  veces al mismo par en el mismo viaje; el cliente solo usa esa info para
  ocultar el formulario, no para bloquear el insert.
- **Finalizar un viaje reutiliza el `grant update (status)` de la Fase 2**
  (`trips_update_own`): no hizo falta ninguna migración nueva para que el
  conductor pueda pasar un viaje a `finished`, ni restricción de que primero
  pase por `ongoing` — se permite `scheduled -> finished` directo (MVP).

## Gotchas (para no volver a perder tiempo en esto)

- **`google.maps.DirectionsService` está deprecado** (desde feb 2026) y los
  proyectos nuevos de Google Cloud ya no lo habilitan (solo exponen "Routes
  API" en el listado, no "Directions API"). Usamos
  `google.maps.routes.Route.computeRoutes` en su lugar (misma librería JS
  `"routes"` vía `useMapsLibrary`, clase distinta). Si ves
  `REQUEST_DENIED` / `ApiNotActivatedMapError`, revisa qué API está
  realmente habilitada en Google Cloud Console antes de asumir que es un
  bug de código.
- **Los Edge Functions de Supabase no agregan CORS solos.** Hay que manejar
  `OPTIONS` explícitamente y agregar `Access-Control-Allow-Origin` /
  `Access-Control-Allow-Headers` a cada respuesta, o el navegador bloquea el
  preflight con un error de CORS que parece (pero no es) un problema del
  lado del cliente.
- **Seed de `auth.users`:** las columnas `confirmation_token`,
  `recovery_token`, `email_change*`, `phone_change*` deben ir como `''`
  (string vacío), nunca `NULL`, o GoTrue falla al hacer login con
  `"Database error querying schema"`.
- **`supabase db push --include-seed` no siempre re-ejecuta `seed.sql`** si
  ya corrió antes (solo "actualiza el hash"). Para aplicar cambios al seed
  de forma confiable, usar `supabase db query --linked -f supabase/seed.sql`
  directamente.
- **`pgcrypto` en proyectos de Supabase se instala en el schema
  `extensions`**, no en `public`. Hay que llamar `extensions.crypt(...)` /
  `extensions.gen_salt(...)`, no `crypt(...)` a secas.
- **"Confirm email" viene activado por defecto** en proyectos nuevos de
  Supabase, y el límite de envío de correo del plan gratuito es muy bajo
  (se agota con ~3 registros de prueba). Para esta demo está desactivado
  (Authentication → Sign In / Providers → Email). Si se reactiva, el
  registro no da sesión inmediata y la verificación mock no se dispara
  hasta que el usuario confirme su correo e inicie sesión.
- **Homebrew de esta máquina es de 2019 y está roto** (`brew install node`
  falla). Node se maneja con nvm, no con brew.

## Qué falta

- **Avenida automática desde la ruta** (ver "Decisiones importantes" arriba):
  evaluado, deferred por complejidad/confiabilidad.
- **Diagrama de la base de datos** en el README: pendiente, se agregará al
  cerrar la Fase 4 junto con el esquema completo.
- Nada de esto se ha desplegado a un dominio público; todo corre local con
  `npm run dev` contra el proyecto de Supabase en la nube.
