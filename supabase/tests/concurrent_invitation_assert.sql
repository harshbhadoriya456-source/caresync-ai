DO $$
DECLARE
  v_memberships integer;
  v_used_at timestamptz;
BEGIN
  SELECT pg_catalog.count(*)::integer
    INTO v_memberships
    FROM public.care_memberships AS membership
    WHERE membership.care_profile_id = 'd1000000-0000-4000-8000-000000000010'
      AND membership.user_id IN (
        'd0000000-0000-4000-8000-000000000011',
        'd0000000-0000-4000-8000-000000000012'
      )
      AND membership.role = 'family'
      AND membership.status = 'active';

  SELECT invitation.used_at
    INTO v_used_at
    FROM public.care_invitations AS invitation
    WHERE invitation.code_hash = extensions.digest(
      'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
      'sha256'
    );

  IF v_memberships <> 1 OR v_used_at IS NULL THEN
    RAISE EXCEPTION 'concurrent redemption must create exactly one membership and consume the invitation';
  END IF;
END;
$$;
