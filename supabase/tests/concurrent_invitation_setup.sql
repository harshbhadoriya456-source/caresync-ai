BEGIN;

INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
VALUES
  ('d0000000-0000-4000-8000-000000000010', 'authenticated', 'authenticated', 'concurrent-owner@example.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now()),
  ('d0000000-0000-4000-8000-000000000011', 'authenticated', 'authenticated', 'concurrent-a@example.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now()),
  ('d0000000-0000-4000-8000-000000000012', 'authenticated', 'authenticated', 'concurrent-b@example.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now())
ON CONFLICT (id) DO NOTHING;

SELECT pg_catalog.set_config(
  'request.jwt.claim.sub',
  'd0000000-0000-4000-8000-000000000010',
  true
);

INSERT INTO public.care_profiles (id, display_name, emergency_contact, created_by)
VALUES (
  'd1000000-0000-4000-8000-000000000010',
  'Concurrent redemption test',
  '555-0110',
  'd0000000-0000-4000-8000-000000000010'
)
ON CONFLICT (id) DO NOTHING;

DELETE FROM public.care_memberships
WHERE care_profile_id = 'd1000000-0000-4000-8000-000000000010'
  AND user_id IN (
    'd0000000-0000-4000-8000-000000000011',
    'd0000000-0000-4000-8000-000000000012'
  );

DELETE FROM public.care_invitation_redemption_limits
WHERE user_id IN (
  'd0000000-0000-4000-8000-000000000011',
  'd0000000-0000-4000-8000-000000000012'
);

INSERT INTO public.care_invitations (
  care_profile_id, code_hash, intended_role, expires_at, created_by
)
VALUES (
  'd1000000-0000-4000-8000-000000000010',
  extensions.digest('cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc', 'sha256'),
  'family',
  pg_catalog.clock_timestamp() + INTERVAL '1 hour',
  'd0000000-0000-4000-8000-000000000010'
)
ON CONFLICT (code_hash) DO UPDATE
  SET care_profile_id = EXCLUDED.care_profile_id,
      intended_role = EXCLUDED.intended_role,
      expires_at = EXCLUDED.expires_at,
      used_at = NULL,
      revoked_at = NULL,
      created_by = EXCLUDED.created_by;

COMMIT;
