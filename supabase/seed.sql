-- Usuarios de ejemplo para probar login manualmente sin pasar por el
-- registro completo. Contraseña para todos: "password123"
--
-- id        | email                  | rol               | sexo
-- 1111...11 | conductor1@example.com | conductor         | M
-- 2222...22 | conductor2@example.com | conductor         | F
-- 3333...33 | pasajero1@example.com  | pasajero          | M
-- 4444...44 | pasajero2@example.com  | pasajero          | F

-- Borra cualquier corrida anterior del seed para que este archivo sea
-- idempotente (se puede volver a correr sin duplicar ni chocar con datos viejos).
delete from auth.users where id in (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333',
  '44444444-4444-4444-4444-444444444444'
);

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
