-- Usuarios de ejemplo para probar login manualmente sin pasar por el
-- registro completo. Contraseña para todos: "password123"
--
-- id        | email                  | rol               | sexo
-- 1111...11 | conductor1@example.com | conductor         | M
-- 2222...22 | conductor2@example.com | conductor         | F
-- 3333...33 | pasajero1@example.com  | pasajero          | M
-- 4444...44 | pasajero2@example.com  | pasajero          | F

-- Este archivo es idempotente vía "on conflict ... do nothing" en cada
-- insert (nunca DELETE): se puede volver a correr sin duplicar datos y sin
-- chocar con viajes/solicitudes reales que se hayan creado desde la app
-- (ej. publicando un viaje de prueba con estos mismos usuarios).

-- Los campos *_token / *_change deben ir como '' (no NULL): GoTrue falla con
-- "Database error querying schema" si intenta leerlos como NULL.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  confirmation_token, recovery_token, email_change, email_change_token_new,
  email_change_token_current, phone_change, phone_change_token,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111',
   'authenticated', 'authenticated', 'conductor1@example.com',
   extensions.crypt('password123', extensions.gen_salt('bf')), now(),
   '', '', '', '', '', '', '',
   '{"provider":"email","providers":["email"]}',
   '{"dni":"10000001","nombres":"Carlos","apellidos":"Ramírez","sexo":"M","is_driver":true,"is_passenger":false}',
   now(), now()),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222',
   'authenticated', 'authenticated', 'conductor2@example.com',
   extensions.crypt('password123', extensions.gen_salt('bf')), now(),
   '', '', '', '', '', '', '',
   '{"provider":"email","providers":["email"]}',
   '{"dni":"10000002","nombres":"Luisa","apellidos":"Torres","sexo":"F","is_driver":true,"is_passenger":false}',
   now(), now()),
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-3333-3333-333333333333',
   'authenticated', 'authenticated', 'pasajero1@example.com',
   extensions.crypt('password123', extensions.gen_salt('bf')), now(),
   '', '', '', '', '', '', '',
   '{"provider":"email","providers":["email"]}',
   '{"dni":"10000003","nombres":"Jorge","apellidos":"Mendoza","sexo":"M","is_driver":false,"is_passenger":true}',
   now(), now()),
  ('00000000-0000-0000-0000-000000000000', '44444444-4444-4444-4444-444444444444',
   'authenticated', 'authenticated', 'pasajero2@example.com',
   extensions.crypt('password123', extensions.gen_salt('bf')), now(),
   '', '', '', '', '', '', '',
   '{"provider":"email","providers":["email"]}',
   '{"dni":"10000004","nombres":"Ana","apellidos":"Flores","sexo":"F","is_driver":false,"is_passenger":true}',
   now(), now())
on conflict (id) do nothing;

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select
  gen_random_uuid(),
  id,
  id::text,
  jsonb_build_object('sub', id::text, 'email', email),
  'email',
  now(), now(), now()
from auth.users
where id in (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333',
  '44444444-4444-4444-4444-444444444444'
)
on conflict (provider_id, provider) do nothing;

-- El trigger on_auth_user_created ya creó las filas en public.profiles con
-- verification_status='pending'. Las marcamos como verificadas para poder
-- probar las fases 2-4 sin pasar por el flujo mock de verificación.
update public.profiles
set verification_status = 'verified'
where id in (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333',
  '44444444-4444-4444-4444-444444444444'
);

-- Un vehículo por conductor sembrado: lo necesitan para poder publicar
-- viajes (el trigger set_trip_vehicle exige que exista antes del insert).
insert into public.vehicles (id, driver_id, placa, modelo, color, asientos)
values
  (
    'cccccccc-0000-0000-0000-000000000001',
    '11111111-1111-1111-1111-111111111111',
    'ABC-123', 'Toyota Yaris', 'Gris', 4
  ),
  (
    'cccccccc-0000-0000-0000-000000000002',
    '22222222-2222-2222-2222-222222222222',
    'XYZ-789', 'Hyundai Accent', 'Blanco', 3
  )
on conflict (id) do nothing;

-- Dos viajes de ejemplo sobre Av. Javier Prado (San Isidro -> La Molina),
-- uno por cada conductor sembrado. route_geom es una aproximación recta de
-- la avenida (no viene de la Routes API real, solo para poder probar
-- cercanía a la ruta en la Fase 3).
insert into public.trips (
  id, driver_id, origin, destination, route_geom, avenida,
  departure_time, seats_total, seats_available, status
) values
  (
    'aaaaaaaa-0000-0000-0000-000000000001',
    '11111111-1111-1111-1111-111111111111',
    'SRID=4326;POINT(-77.0428 -12.0927)',
    'SRID=4326;POINT(-76.9706 -12.0810)',
    'SRID=4326;LINESTRING(-77.0428 -12.0927, -77.0030 -12.0875, -76.9706 -12.0810)',
    'Av. Javier Prado',
    now() + interval '2 hours',
    4, 3, 'scheduled'
  ),
  (
    'aaaaaaaa-0000-0000-0000-000000000002',
    '22222222-2222-2222-2222-222222222222',
    'SRID=4326;POINT(-77.0428 -12.0927)',
    'SRID=4326;POINT(-76.9706 -12.0810)',
    'SRID=4326;LINESTRING(-77.0428 -12.0927, -77.0030 -12.0875, -76.9706 -12.0810)',
    'Av. Javier Prado',
    now() + interval '1 day',
    3, 3, 'scheduled'
  ),
  -- Viaje ya finalizado, para poder probar la Fase 4 (calificaciones) de
  -- inmediato sin tener que primero publicar un viaje, aceptar una
  -- solicitud y marcarlo como finalizado a mano.
  (
    'aaaaaaaa-0000-0000-0000-000000000003',
    '11111111-1111-1111-1111-111111111111',
    'SRID=4326;POINT(-77.0428 -12.0927)',
    'SRID=4326;POINT(-76.9706 -12.0810)',
    'SRID=4326;LINESTRING(-77.0428 -12.0927, -77.0030 -12.0875, -76.9706 -12.0810)',
    'Av. Javier Prado',
    now() - interval '1 day',
    4, 3, 'finished'
  )
on conflict (id) do nothing;

-- Dos solicitudes pendientes de ejemplo (una por cada viaje/conductor
-- sembrado), para poder probar aceptar/rechazar sin pasar todavía por el
-- flujo de búsqueda del pasajero (Fase 3).
insert into public.pickup_requests (id, trip_id, passenger_id, pickup_point, status)
values
  (
    'bbbbbbbb-0000-0000-0000-000000000001',
    'aaaaaaaa-0000-0000-0000-000000000001',
    '33333333-3333-3333-3333-333333333333',
    'SRID=4326;POINT(-77.0030 -12.0875)',
    'pending'
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000002',
    'aaaaaaaa-0000-0000-0000-000000000002',
    '44444444-4444-4444-4444-444444444444',
    'SRID=4326;POINT(-77.0030 -12.0875)',
    'pending'
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000003',
    'aaaaaaaa-0000-0000-0000-000000000003',
    '44444444-4444-4444-4444-444444444444',
    'SRID=4326;POINT(-77.0030 -12.0875)',
    'accepted'
  )
on conflict (id) do nothing;
