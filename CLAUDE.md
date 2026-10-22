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
- **Supabase Realtime** (Postgres Changes) para la ubicación en vivo durante
  un viaje `ongoing`: cada navegador hace upsert de su posición en
  `live_locations` y se suscribe a los cambios de la fila de la otra parte.
- **Vercel** para el despliegue (SPA estática + HTTPS gratis). Ver sección
  "Despliegue" más abajo para los pasos exactos.
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
- [x] **Fase 5** — Prueba piloto: vehículo del conductor (gate antes de
      publicar), ubicación en tiempo real por Supabase Realtime (RLS
      controla quién ve a quién), modo prueba, despliegue en Vercel

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
  pase por `ongoing` — se permite `scheduled -> finished` directo (MVP). Para
  la Fase 5 sí se usa el estado `ongoing` (botón "Iniciar viaje"): es lo que
  activa la ubicación en vivo.
- **`live_locations` usa columnas `lat`/`lng` sueltas (`double precision`),
  NO `geography`.** Se probó y el problema es Realtime: Supabase manda los
  cambios de fila tal cual los serializa la replicación lógica de Postgres,
  y para un `geography` eso es WKB hexadecimal sin parsear, no GeoJSON — el
  navegador tendría que decodificar WKB a mano en cada evento. Con columnas
  numéricas simples, el payload ya trae `lat`/`lng` como números usables
  directo. `point_in_lima()` no aplica a esta tabla a propósito: el modo
  prueba puede fijar una ubicación manual que no esté exactamente sobre
  Lima.
- **La visibilidad de `live_locations` se implementa dos veces, a propósito**
  (mismo patrón que `point_in_lima`/`isInLima`): las policies de RLS en
  `supabase/migrations/20261022170000_live_locations.sql` son el control de
  acceso real; `src/features/location/visibility.ts` (`canViewLocation`) es
  un espejo en TypeScript de la misma regla, solo para poder testearla con
  Vitest sin una base de datos (`visibility.test.ts`). Si cambias una
  policy, cambia la otra también.
- **Un conductor solo puede tener un vehículo** (`vehicles.driver_id` es
  `unique`). El `insert` en `trips` pasa por un trigger `before insert`
  (`set_trip_vehicle`) que autocompleta `vehicle_id` con el vehículo del
  conductor y **rechaza el insert si no tiene ninguno registrado** — el gate
  real está en la base de datos, no solo en el frontend
  (`PublishTripPage` igual revisa antes, para dar un mejor mensaje).
- **`nearby_trips` filtra por el tramo de ruta NO recorrido cuando el viaje
  está `ongoing`.** Ubica la posición más reciente del conductor sobre
  `route_geom` con `ST_LineLocatePoint` y recorta el tramo ya pasado con
  `ST_LineSubstring`; si el conductor todavía no mandó ninguna posición, usa
  la ruta completa como fallback. Es una aproximación por fracción de
  vértices, no por distancia geográfica real — suficiente para el área
  chica de Lima y la escala de este MVP.
- **Verificación automática en modo prueba, sin guardar DNIs reales.** Para
  la validación con personas reales (Fase 5), un DNI real de 8 dígitos
  puede terminar en "9" o lo que sea y el mock lo rechazaría sin razón real.
  En vez de hardcodear excepciones por DNI (lo que obligaría a guardar los
  DNIs reales de quienes prueban, en código o en el repo), el Edge Function
  `verify-identity` lee el secret `TEST_MODE_AUTO_VERIFY` (nunca committeado,
  se activa con `supabase secrets set TEST_MODE_AUTO_VERIFY=true` solo
  durante la prueba): si está en `"true"`, aprueba a cualquiera sin importar
  el DNI. Recuerda desactivarlo (`supabase secrets unset
  TEST_MODE_AUTO_VERIFY`) al terminar la prueba piloto.

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
- **Agregar una tabla a Realtime no es automático.** `alter table ... enable
  row level security` no basta para que Postgres Changes mande eventos: hay
  que hacer también `alter publication supabase_realtime add table
  <tabla>;` (ver la migración de `live_locations`), o el navegador se queda
  esperando eventos que nunca llegan, sin ningún error visible.
- **La Screen Wake Lock API (`navigator.wakeLock`) requiere HTTPS** (o
  `localhost`) y falla silenciosamente si no está soportada — no lanza un
  error que rompa la app, pero en `npm run dev` por IP de la red local
  (en vez de `localhost`) no va a funcionar; para probar con el celular por
  wifi, usar `localhost` vía túnel o ya directamente la build desplegada en
  Vercel (HTTPS).
- **`watchPosition` en iPhone Safari puede devolver lecturas con `accuracy`
  de cientos de metros** (mala señal, interiores). Se descartan las lecturas
  con `accuracy` > 100 m en `useGeolocation` — si ves el marcador "saltando"
  en el mapa, revisa primero si de verdad es una lectura mala antes de
  pensar que es un bug de renderizado.
- **Vercel necesita un rewrite a `index.html`** (`vercel.json` en la raíz)
  porque esto es una SPA con `BrowserRouter`: sin eso, recargar la página en
  cualquier ruta que no sea `/` (ej. `/conductor/mis-viajes`) da 404.
- **El proyecto de Vercel está conectado a `danielayaulli/trabajofinal1`
  (rama `main`), NO a `danielayaulli/tf1` (rama `master`).** Al conectar
  Vercel la primera vez se creó sin querer un repo nuevo (`trabajofinal1`,
  con un solo commit "Initial commit" co-autoreado por `vercel-commit`) en
  vez de usar el repo real. Se resolvió agregando un segundo remoto local
  (`git remote add vercel https://github.com/danielayaulli/trabajofinal1.git`)
  y sobrescribiendo ese commit con el historial real
  (`git push vercel master:main --force`). **Para que un cambio llegue a lo
  desplegado, además del push normal a `origin` hay que correr:**
  `git push vercel master:main`. Si en algún momento se reconecta Vercel
  directo al repo `tf1` (Project Settings → Git), este paso extra deja de
  ser necesario.

## Qué falta

- **Avenida automática desde la ruta** (ver "Decisiones importantes" arriba):
  evaluado, deferred por complejidad/confiabilidad.
- **Diagrama de la base de datos** en el README: pendiente.
- **Un conductor solo puede registrar un vehículo** (no hay UI para varios
  ni para elegir cuál usar en cada viaje). Suficiente para el MVP.
- **`live_locations` no guarda historial**, solo la última posición por
  usuario (se sobreescribe con cada upsert): no hay replay del recorrido
  después de que el viaje termina.
- El filtro de "tramo no recorrido" en `nearby_trips` depende de que el
  conductor ya haya mandado al menos una posición; si recién arrancó el
  viaje y todavía no llegó la primera lectura de GPS, se usa la ruta
  completa como fallback (una ventana de pocos segundos, no debería notarse
  en la práctica).
- Ver la sección "Despliegue" más abajo para pasar de `npm run dev` local a
  Vercel.

## Despliegue

Pasos exactos para pasar de `localhost:5173` a una URL pública con HTTPS en
Vercel. El resumen corto para la persona que ejecuta esto está en el README
(sección "Despliegue en Vercel"); aquí va el detalle con el porqué de cada
paso.

1. **Conectar el repositorio.** En [vercel.com](https://vercel.com) → "Add
   New" → "Project" → importar este repositorio de GitHub. Framework
   preset: Vite (debería detectarlo solo). Build command `npm run build`,
   output directory `dist` (son los defaults de Vite, no hace falta
   tocarlos).
2. **Variables de entorno** (Project Settings → Environment Variables),
   las mismas claves que `.env.example`, con los valores reales:
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (Supabase → Project
     Settings → API). **Nunca** la `service_role` key aquí: esta es la app
     de cliente, no un backend; la `service_role` solo vive en el secret
     del Edge Function.
   - `VITE_GOOGLE_MAPS_API_KEY`. En Google Cloud Console, edita la key y
     agrega el dominio de Vercel (`https://tu-proyecto.vercel.app/*`) a
     "Application restrictions → HTTP referrers", o las llamadas a Maps
     fallarán en producción aunque funcionen en local.
   - `VITE_TEST_MODE` / `VITE_TEST_TOLERANCE_M`: déjalos en `false` salvo
     que la prueba piloto los necesite también en producción.
3. **Deploy.** Vercel construye y publica solo; cada push a la rama
   conectada vuelve a desplegar.
4. **`vercel.json`** (ya está en la raíz del repo) agrega un rewrite de
   cualquier ruta a `index.html`: sin esto, recargar la página en
   `/conductor/mis-viajes` (o cualquier ruta que no sea `/`) da 404, porque
   React Router maneja el ruteo en el cliente y Vercel por defecto busca un
   archivo físico en esa ruta.
5. **Supabase Auth → URL Configuration** (Authentication → URL
   Configuration en el dashboard del proyecto):
   - **Site URL**: la URL de Vercel (ej. `https://tf1.vercel.app`).
   - **Redirect URLs**: agrega esa misma URL (y `https://tf1.vercel.app/**`
     si Supabase pide un patrón). No es estrictamente necesario para
     login/registro con email+contraseña sin links de confirmación (que
     están desactivados, ver Gotchas), pero sí lo es si en algún momento se
     reactiva "Confirm email" o se agrega login social.
6. **Verificar en el celular.** Abre la URL de Vercel en Safari de iPhone,
   no en modo privado (para que `localStorage`/la sesión persistan), y
   confirma que pide el permiso de ubicación al llegar a un viaje
   `ongoing` (ver Gotchas sobre Wake Lock y HTTPS).
