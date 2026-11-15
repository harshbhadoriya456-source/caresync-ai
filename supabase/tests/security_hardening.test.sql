BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT extensions.plan(31);

INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
VALUES
  ('d0000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'owner@example.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now()),
  ('d0000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'member@example.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now()),
  ('d0000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'invited@example.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now()),
  ('d0000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'unrelated@example.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now()),
  ('d0000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'closure-owner@example.test', '', pg_catalog.now(), pg_catalog.now(), pg_catalog.now());

SELECT pg_catalog.set_config(
  'request.jwt.claim.sub',
  'd0000000-0000-4000-8000-000000000001',
  true
);

INSERT INTO public.care_profiles (id, display_name, emergency_contact, created_by)
VALUES
  ('d1000000-0000-4000-8000-000000000001', 'Test patient one', '555-0101', 'd0000000-0000-4000-8000-000000000001');

INSERT INTO public.care_memberships (care_profile_id, user_id, role)
VALUES
  ('d1000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000002', 'caretaker');

INSERT INTO public.medications (
  id, care_profile_id, name, dosage, frequency, scheduled_times, start_date, created_by
)
VALUES (
  'd2000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  'Test medication',
  '1 tablet',
  'daily',
  ARRAY['09:00']::time[],
  CURRENT_DATE,
  'd0000000-0000-4000-8000-000000000001'
);

INSERT INTO public.care_invitations (
  care_profile_id, code_hash, intended_role, expires_at, created_by
)
VALUES
  (
    'd1000000-0000-4000-8000-000000000001',
    extensions.digest('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'sha256'),
    'family',
    pg_catalog.clock_timestamp() + INTERVAL '1 hour',
    'd0000000-0000-4000-8000-000000000001'
  ),
  (
    'd1000000-0000-4000-8000-000000000001',
    extensions.digest('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 'sha256'),
    'family',
    pg_catalog.clock_timestamp() - INTERVAL '1 hour',
    'd0000000-0000-4000-8000-000000000001'
  );

INSERT INTO public.care_profiles (id, display_name, emergency_contact, created_by)
VALUES (
  'd1000000-0000-4000-8000-000000000005',
  'Test patient closure',
  '555-0105',
  'd0000000-0000-4000-8000-000000000005'
);

INSERT INTO public.medications (
  id, care_profile_id, name, dosage, frequency, scheduled_times, start_date, created_by
)
VALUES (
  'd2000000-0000-4000-8000-000000000005',
  'd1000000-0000-4000-8000-000000000005',
  'Retained test medication',
  '1 tablet',
  'daily',
  ARRAY['09:00']::time[],
  CURRENT_DATE,
  'd0000000-0000-4000-8000-000000000005'
);

SET LOCAL ROLE anon;
SELECT extensions.throws_ok(
  $$SELECT * FROM public.care_profiles$$,
  '42501',
  'permission denied for table care_profiles',
  'unauthenticated users cannot read care profiles'
);
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT pg_catalog.set_config('request.jwt.claim.sub', 'd0000000-0000-4000-8000-000000000001', true);

SELECT extensions.lives_ok(
  $$SELECT public.transfer_care_profile_ownership(
    'd1000000-0000-4000-8000-000000000001',
    'd0000000-0000-4000-8000-000000000002'
  )$$,
  'current owner transfers to an existing active member'
);
SELECT extensions.is(
  (SELECT role::text FROM public.care_memberships
   WHERE care_profile_id = 'd1000000-0000-4000-8000-000000000001'
     AND user_id = 'd0000000-0000-4000-8000-000000000002'),
  'owner',
  'authorized target becomes owner'
);
SELECT extensions.is(
  (SELECT pg_catalog.count(*)::integer FROM public.care_memberships
   WHERE care_profile_id = 'd1000000-0000-4000-8000-000000000001'
     AND role = 'owner' AND status = 'active'),
  1,
  'transfer leaves exactly one active owner'
);
SELECT extensions.is(
  (SELECT role::text FROM public.care_memberships
   WHERE care_profile_id = 'd1000000-0000-4000-8000-000000000001'
     AND user_id = 'd0000000-0000-4000-8000-000000000001'),
  'caretaker',
  'previous owner is downgraded during transfer'
);
SELECT extensions.ok(
  EXISTS (
    SELECT 1 FROM public.audit_logs
    WHERE care_profile_id = 'd1000000-0000-4000-8000-000000000001'
      AND entity_type = 'ownership_transfers'
      AND entity_id = 'd1000000-0000-4000-8000-000000000001'
  ),
  'ownership transfer is explicitly audited'
);
SELECT extensions.throws_ok(
  $$SELECT * FROM public.create_care_invitation(
    'd1000000-0000-4000-8000-000000000001',
    'owner',
    24
  )$$,
  '42501',
  'only an active care-profile owner may create invitations',
  'former owner cannot issue invitations after transfer'
);

SELECT pg_catalog.set_config('request.jwt.claim.sub', 'd0000000-0000-4000-8000-000000000004', true);
SELECT extensions.throws_ok(
  $$SELECT public.transfer_care_profile_ownership(
    'd1000000-0000-4000-8000-000000000001',
    'd0000000-0000-4000-8000-000000000003'
  )$$,
  '42501',
  'only the active owner may transfer an active care profile',
  'unrelated user cannot transfer ownership'
);
SELECT pg_catalog.set_config('request.jwt.claim.sub', 'd0000000-0000-4000-8000-000000000002', true);
SELECT extensions.throws_ok(
  $$SELECT public.transfer_care_profile_ownership(
    'd1000000-0000-4000-8000-000000000001',
    'd0000000-0000-4000-8000-000000000004'
  )$$,
  '42501',
  'target must be an existing active member of this care profile',
  'owner cannot transfer ownership to an unrelated user'
);
SELECT pg_catalog.set_config('request.jwt.claim.sub', 'd0000000-0000-4000-8000-000000000004', true);
SELECT extensions.is(
  (SELECT pg_catalog.count(*)::integer FROM public.care_profiles
   WHERE id = 'd1000000-0000-4000-8000-000000000001'),
  0,
  'unrelated user cannot read another patient profile'
);
SELECT extensions.is(
  (SELECT pg_catalog.count(*)::integer FROM public.medications
   WHERE id = 'd2000000-0000-4000-8000-000000000001'),
  0,
  'unrelated user cannot read another patient medication'
);

SELECT pg_catalog.set_config('request.jwt.claim.sub', 'd0000000-0000-4000-8000-000000000001', true);
SELECT extensions.throws_ok(
  $$INSERT INTO public.medications (
      care_profile_id, name, dosage, frequency, scheduled_times, start_date, created_by
    )
    VALUES (
      'd1000000-0000-4000-8000-000000000001',
      'Unauthorized medication',
      '1 tablet',
      'daily',
      ARRAY['09:00']::time[],
      CURRENT_DATE,
      'd0000000-0000-4000-8000-000000000001'
    )$$,
  '42501',
  'new row violates row-level security policy for table "medications"',
  'caretaker without grants cannot insert medication'
);
SELECT extensions.is(
  (WITH changed AS (
    UPDATE public.medications
      SET name = 'Unauthorized update'
      WHERE id = 'd2000000-0000-4000-8000-000000000001'
      RETURNING id
  )
  SELECT pg_catalog.count(*)::integer FROM changed),
  0,
  'caretaker without grants cannot update medication'
);

SELECT pg_catalog.set_config('request.jwt.claim.sub', 'd0000000-0000-4000-8000-000000000003', true);
SELECT extensions.is(
  (SELECT pg_catalog.count(*)::integer
   FROM public.redeem_care_invitation('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')),
  0,
  'expired invitation returns no membership'
);
SELECT extensions.is(
  (SELECT pg_catalog.count(*)::integer FROM public.care_memberships
   WHERE care_profile_id = 'd1000000-0000-4000-8000-000000000001'
     AND user_id = 'd0000000-0000-4000-8000-000000000003'),
  0,
  'expired invitation does not create membership'
);

SELECT extensions.is(
  (SELECT pg_catalog.count(*)::integer
   FROM public.redeem_care_invitation('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')),
  1,
  'valid invitation is redeemed once with its intended role'
);
SELECT extensions.is(
  (SELECT role::text FROM public.care_memberships
   WHERE care_profile_id = 'd1000000-0000-4000-8000-000000000001'
     AND user_id = 'd0000000-0000-4000-8000-000000000003'),
  'family',
  'redemption applies the invitation role rather than a caller-supplied role'
);
SELECT extensions.is(
  (SELECT pg_catalog.count(*)::integer
   FROM public.redeem_care_invitation('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')),
  0,
  'redeemed invitation cannot be replayed'
);
SELECT extensions.throws_ok(
  $$UPDATE public.care_memberships
      SET role = 'owner'
    WHERE care_profile_id = 'd1000000-0000-4000-8000-000000000001'
      AND user_id = 'd0000000-0000-4000-8000-000000000003'$$,
  '42501',
  'permission denied for table care_memberships',
  'member cannot directly escalate their role'
);
SELECT pg_catalog.set_config('request.jwt.claim.sub', 'd0000000-0000-4000-8000-000000000002', true);
SELECT extensions.throws_ok(
  $$SELECT * FROM public.create_care_invitation(
    'd1000000-0000-4000-8000-000000000001',
    'owner',
    24
  )$$,
  '22023',
  'invalid invitation role or expiration',
  'owner cannot issue an owner-role invitation'
);

SELECT pg_catalog.set_config('request.jwt.claim.sub', 'd0000000-0000-4000-8000-000000000003', true);
SELECT extensions.throws_ok(
  $$INSERT INTO public.audit_logs (care_profile_id, actor_id, action, entity_type, entity_id)
    VALUES (
      'd1000000-0000-4000-8000-000000000001',
      'd0000000-0000-4000-8000-000000000003',
      'UPDATE',
      'care_profiles',
      'd1000000-0000-4000-8000-000000000001'
    )$$,
  '42501',
  'permission denied for table audit_logs',
  'authenticated members cannot insert audit rows'
);
SELECT extensions.throws_ok(
  $$UPDATE public.audit_logs
      SET action = 'DELETE'
    WHERE care_profile_id = 'd1000000-0000-4000-8000-000000000001'$$,
  '42501',
  'permission denied for table audit_logs',
  'authenticated members cannot update audit rows'
);
SELECT extensions.throws_ok(
  $$DELETE FROM public.audit_logs
    WHERE care_profile_id = 'd1000000-0000-4000-8000-000000000001'$$,
  '42501',
  'permission denied for table audit_logs',
  'authenticated members cannot delete audit rows'
);

SELECT pg_catalog.set_config('request.jwt.claim.sub', 'd0000000-0000-4000-8000-000000000004', true);
SELECT pg_catalog.count(*)::integer
  FROM pg_catalog.generate_series(1, 11) AS attempt(n)
  CROSS JOIN LATERAL public.redeem_care_invitation(
    'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd'
  );
RESET ROLE;
SELECT extensions.is(
  (SELECT attempt_count FROM public.care_invitation_redemption_limits
   WHERE user_id = 'd0000000-0000-4000-8000-000000000004'),
  11,
  'redemption attempts are capped and rate-limited per authenticated user'
);

SELECT pg_catalog.set_config('request.jwt.claim.sub', 'd0000000-0000-4000-8000-000000000002', true);
SELECT extensions.throws_ok(
  $$DELETE FROM auth.users WHERE id = 'd0000000-0000-4000-8000-000000000002'$$,
  '23514',
  'transfer ownership or close every active care profile before deleting this account',
  'last active owner cannot be deleted before transfer or closure'
);

SELECT pg_catalog.set_config('request.jwt.claim.sub', 'd0000000-0000-4000-8000-000000000005', true);
SET LOCAL ROLE authenticated;
SELECT extensions.lives_ok(
  $$SELECT public.close_care_profile('d1000000-0000-4000-8000-000000000005')$$,
  'owner can explicitly close a care profile'
);
RESET ROLE;
SELECT extensions.lives_ok(
  $$DELETE FROM auth.users WHERE id = 'd0000000-0000-4000-8000-000000000005'$$,
  'closed profile owner account can be deleted'
);
SELECT extensions.is(
  (SELECT pg_catalog.count(*)::integer FROM public.medications
   WHERE id = 'd2000000-0000-4000-8000-000000000005'),
  1,
  'account deletion retains healthcare records'
);
SELECT extensions.is(
  (SELECT created_by FROM public.care_profiles
   WHERE id = 'd1000000-0000-4000-8000-000000000005'),
  NULL::uuid,
  'account deletion nulls creator foreign keys instead of deleting the profile'
);
SELECT extensions.is(
  (SELECT status::text FROM public.care_memberships
   WHERE care_profile_id = 'd1000000-0000-4000-8000-000000000005'
     AND user_id IS NULL),
  'revoked',
  'account deletion preserves the membership row as revoked'
);
SELECT extensions.is(
  (SELECT pg_catalog.count(*)::integer FROM public.audit_logs
   WHERE care_profile_id = 'd1000000-0000-4000-8000-000000000005'
     AND entity_type = 'account_deletions'
     AND subject_id = 'd0000000-0000-4000-8000-000000000005'),
  1,
  'account deletion retains pseudonymous audit attribution'
);

SELECT * FROM extensions.finish();
ROLLBACK;
