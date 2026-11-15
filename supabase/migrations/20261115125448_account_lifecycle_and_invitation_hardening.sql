BEGIN;

ALTER TABLE public.care_profiles
  ADD COLUMN status text NOT NULL DEFAULT 'active',
  ADD COLUMN closed_at timestamptz,
  ADD COLUMN closed_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD CONSTRAINT care_profiles_status_check CHECK (status IN ('active', 'closed')),
  ADD CONSTRAINT care_profiles_closure_state_check CHECK (
    (status = 'active' AND closed_at IS NULL)
    OR (status = 'closed' AND closed_at IS NOT NULL)
  );

ALTER TABLE public.care_memberships
  ALTER COLUMN user_id DROP NOT NULL,
  DROP CONSTRAINT care_memberships_user_id_fkey,
  ADD CONSTRAINT care_memberships_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD CONSTRAINT care_memberships_deleted_user_is_revoked_check
    CHECK (user_id IS NOT NULL OR status = 'revoked');

ALTER TABLE public.care_profiles
  ALTER COLUMN created_by DROP NOT NULL,
  DROP CONSTRAINT care_profiles_created_by_fkey,
  ADD CONSTRAINT care_profiles_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users (id) ON DELETE SET NULL;

ALTER TABLE public.medications
  ALTER COLUMN created_by DROP NOT NULL,
  DROP CONSTRAINT medications_created_by_fkey,
  ADD CONSTRAINT medications_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users (id) ON DELETE SET NULL;

ALTER TABLE public.appointments
  ALTER COLUMN created_by DROP NOT NULL,
  DROP CONSTRAINT appointments_created_by_fkey,
  ADD CONSTRAINT appointments_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users (id) ON DELETE SET NULL;

ALTER TABLE public.care_invitations
  ALTER COLUMN created_by DROP NOT NULL,
  DROP CONSTRAINT care_invitations_created_by_fkey,
  ADD CONSTRAINT care_invitations_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN revoked_at timestamptz,
  ADD COLUMN revoked_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD CONSTRAINT care_invitations_terminal_state_check CHECK (
    NOT (used_at IS NOT NULL AND revoked_at IS NOT NULL)
  );

ALTER TABLE public.audit_logs
  ADD COLUMN actor_subject_id uuid,
  ADD COLUMN subject_id uuid;

UPDATE public.audit_logs
  SET actor_subject_id = actor_id
  WHERE actor_subject_id IS NULL AND actor_id IS NOT NULL;

ALTER TABLE public.audit_logs
  DROP CONSTRAINT audit_logs_entity_type_check,
  ADD CONSTRAINT audit_logs_entity_type_check CHECK (
    entity_type IN (
      'care_profiles',
      'care_memberships',
      'medications',
      'medication_events',
      'appointments',
      'care_invitations',
      'ownership_transfers',
      'account_deletions'
    )
  );

CREATE UNIQUE INDEX care_memberships_one_active_owner_idx
  ON public.care_memberships (care_profile_id)
  WHERE role = 'owner' AND status = 'active';

CREATE TABLE public.care_invitation_redemption_limits (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  window_started_at timestamptz NOT NULL,
  attempt_count integer NOT NULL CHECK (attempt_count BETWEEN 1 AND 11)
);

ALTER TABLE public.care_invitation_redemption_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.care_invitation_redemption_limits
  FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.is_care_profile_active(p_care_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.care_profiles AS care_profile
    WHERE care_profile.id = p_care_profile_id
      AND care_profile.status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.audit_row_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_row jsonb;
  v_care_profile_id uuid;
  v_entity_id uuid;
  v_medication_id uuid;
  v_subject_id uuid;
BEGIN
  v_row := CASE WHEN TG_OP = 'DELETE' THEN pg_catalog.to_jsonb(OLD) ELSE pg_catalog.to_jsonb(NEW) END;
  v_entity_id := (v_row ->> 'id')::uuid;

  IF TG_TABLE_NAME = 'care_profiles' THEN
    v_care_profile_id := v_entity_id;
  ELSIF TG_TABLE_NAME IN ('care_memberships', 'medications', 'appointments', 'care_invitations') THEN
    v_care_profile_id := (v_row ->> 'care_profile_id')::uuid;
    IF TG_TABLE_NAME = 'care_memberships' THEN
      IF TG_OP = 'UPDATE' THEN
        v_subject_id := COALESCE(NEW.user_id, OLD.user_id);
      ELSE
        v_subject_id := (v_row ->> 'user_id')::uuid;
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME = 'medication_events' THEN
    v_medication_id := (v_row ->> 'medication_id')::uuid;
    SELECT medication.care_profile_id
      INTO v_care_profile_id
      FROM public.medications AS medication
      WHERE medication.id = v_medication_id;
  ELSE
    RAISE EXCEPTION 'unsupported audit table: %', TG_TABLE_NAME;
  END IF;

  INSERT INTO public.audit_logs (
    care_profile_id,
    actor_id,
    actor_subject_id,
    subject_id,
    action,
    entity_type,
    entity_id
  )
  VALUES (
    v_care_profile_id,
    auth.uid(),
    auth.uid(),
    v_subject_id,
    TG_OP,
    TG_TABLE_NAME,
    v_entity_id
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.prevent_auth_user_deletion_without_handoff()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  PERFORM care_profile.id
    FROM public.care_profiles AS care_profile
    JOIN public.care_memberships AS membership
      ON membership.care_profile_id = care_profile.id
    WHERE membership.user_id = OLD.id
      AND membership.role = 'owner'
      AND membership.status = 'active'
      AND care_profile.status = 'active'
    ORDER BY care_profile.id
    FOR UPDATE OF care_profile;

  IF EXISTS (
    SELECT 1
    FROM public.care_profiles AS care_profile
    JOIN public.care_memberships AS membership
      ON membership.care_profile_id = care_profile.id
    WHERE membership.user_id = OLD.id
      AND membership.role = 'owner'
      AND membership.status = 'active'
      AND care_profile.status = 'active'
  ) THEN
    RAISE EXCEPTION 'transfer ownership or close every active care profile before deleting this account'
      USING ERRCODE = '23514';
  END IF;

  UPDATE public.care_memberships
    SET status = 'revoked',
        permissions = ARRAY[]::public.care_permission[]
    WHERE user_id = OLD.id
      AND status = 'active';

  INSERT INTO public.audit_logs (
    care_profile_id,
    actor_id,
    actor_subject_id,
    subject_id,
    action,
    entity_type,
    entity_id
  )
  SELECT membership.care_profile_id,
         auth.uid(),
         auth.uid(),
         OLD.id,
         'UPDATE',
         'account_deletions',
         OLD.id
  FROM public.care_memberships AS membership
  WHERE membership.user_id = OLD.id;

  RETURN OLD;
END;
$$;

CREATE FUNCTION public.guard_active_care_profile_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_care_profile_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'medication_events' THEN
    SELECT care_profile.id
      INTO v_care_profile_id
      FROM public.medications AS medication
      JOIN public.care_profiles AS care_profile
        ON care_profile.id = medication.care_profile_id
      WHERE medication.id = CASE WHEN TG_OP = 'DELETE' THEN OLD.medication_id ELSE NEW.medication_id END
        AND care_profile.status = 'active'
      FOR SHARE OF care_profile;
  ELSE
    v_care_profile_id := CASE
      WHEN TG_OP = 'DELETE' THEN OLD.care_profile_id
      ELSE NEW.care_profile_id
    END;

    PERFORM care_profile.id
      FROM public.care_profiles AS care_profile
      WHERE care_profile.id = v_care_profile_id
        AND care_profile.status = 'active'
      FOR SHARE;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'healthcare data for a closed or missing care profile is read-only'
      USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_care_member_permissions(
  p_membership_id uuid,
  p_permissions public.care_permission[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_profile_id uuid;
  v_role public.care_role;
BEGIN
  SELECT membership.care_profile_id
    INTO v_profile_id
    FROM public.care_memberships AS membership
    WHERE membership.id = p_membership_id
      AND membership.status = 'active';

  IF NOT FOUND OR auth.uid() IS NULL THEN
    RAISE EXCEPTION 'only an active care-profile owner may change permissions'
      USING ERRCODE = '42501';
  END IF;

  PERFORM care_profile.id
    FROM public.care_profiles AS care_profile
    WHERE care_profile.id = v_profile_id
    FOR UPDATE;

  SELECT membership.role
    INTO v_role
    FROM public.care_memberships AS membership
    WHERE membership.id = p_membership_id
      AND membership.status = 'active'
    FOR UPDATE;

  IF NOT FOUND OR NOT public.is_care_owner(v_profile_id) THEN
    RAISE EXCEPTION 'only an active care-profile owner may change permissions'
      USING ERRCODE = '42501';
  END IF;

  IF NOT public.is_care_profile_active(v_profile_id)
     OR v_role NOT IN ('caretaker', 'family')
     OR p_permissions IS NULL
     OR pg_catalog.cardinality(p_permissions) > 4 THEN
    RAISE EXCEPTION 'invalid membership permission update'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.care_memberships
    SET permissions = p_permissions
    WHERE id = p_membership_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_care_membership(p_membership_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_profile_id uuid;
BEGIN
  SELECT membership.care_profile_id
    INTO v_profile_id
    FROM public.care_memberships AS membership
    WHERE membership.id = p_membership_id
      AND membership.role <> 'owner'
      AND membership.status = 'active';

  IF NOT FOUND OR auth.uid() IS NULL THEN
    RAISE EXCEPTION 'only an active care-profile owner may revoke this membership'
      USING ERRCODE = '42501';
  END IF;

  PERFORM care_profile.id
    FROM public.care_profiles AS care_profile
    WHERE care_profile.id = v_profile_id
    FOR UPDATE;

  PERFORM membership.id
    FROM public.care_memberships AS membership
    WHERE membership.id = p_membership_id
      AND membership.role <> 'owner'
      AND membership.status = 'active'
    FOR UPDATE;

  IF NOT FOUND OR NOT public.is_care_owner(v_profile_id) THEN
    RAISE EXCEPTION 'only an active care-profile owner may revoke this membership'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.care_memberships
    SET status = 'revoked',
        permissions = ARRAY[]::public.care_permission[]
    WHERE id = p_membership_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_care_invitation(
  p_care_profile_id uuid,
  p_intended_role public.care_role,
  p_expires_in_hours integer
)
RETURNS TABLE (invitation_id uuid, code text, expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_code text;
  v_invitation_id uuid;
  v_expires_at timestamptz;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_care_owner(p_care_profile_id) THEN
    RAISE EXCEPTION 'only an active care-profile owner may create invitations'
      USING ERRCODE = '42501';
  END IF;

  PERFORM care_profile.id
    FROM public.care_profiles AS care_profile
    WHERE care_profile.id = p_care_profile_id
      AND care_profile.status = 'active'
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'closed care profiles cannot create invitations'
      USING ERRCODE = '23514';
  END IF;

  IF NOT public.is_care_owner(p_care_profile_id) THEN
    RAISE EXCEPTION 'only an active care-profile owner may create invitations'
      USING ERRCODE = '42501';
  END IF;

  IF p_intended_role IS NULL OR p_expires_in_hours IS NULL
     OR p_intended_role = 'owner' OR p_expires_in_hours NOT BETWEEN 1 AND 168 THEN
    RAISE EXCEPTION 'invalid invitation role or expiration'
      USING ERRCODE = '22023';
  END IF;

  v_code := pg_catalog.encode(extensions.gen_random_bytes(32), 'hex');
  v_expires_at := pg_catalog.clock_timestamp()
    + pg_catalog.make_interval(hours => p_expires_in_hours);

  INSERT INTO public.care_invitations (
    care_profile_id,
    code_hash,
    intended_role,
    expires_at,
    created_by
  )
  VALUES (
    p_care_profile_id,
    extensions.digest(v_code, 'sha256'),
    p_intended_role,
    v_expires_at,
    auth.uid()
  )
  RETURNING id INTO v_invitation_id;

  RETURN QUERY SELECT v_invitation_id, v_code, v_expires_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.redeem_care_invitation(p_code text)
RETURNS TABLE (care_profile_id uuid, role public.care_role)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_attempt_count integer;
  v_invitation public.care_invitations%ROWTYPE;
  v_care_profile_id uuid;
  v_rows_inserted integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication is required to redeem an invitation'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.care_invitation_redemption_limits AS rate_limit (
    user_id,
    window_started_at,
    attempt_count
  )
  VALUES (v_user_id, pg_catalog.clock_timestamp(), 1)
  ON CONFLICT (user_id) DO UPDATE
    SET window_started_at = CASE
          WHEN rate_limit.window_started_at <= pg_catalog.clock_timestamp() - INTERVAL '15 minutes'
            THEN pg_catalog.clock_timestamp()
          ELSE rate_limit.window_started_at
        END,
        attempt_count = CASE
          WHEN rate_limit.window_started_at <= pg_catalog.clock_timestamp() - INTERVAL '15 minutes'
            THEN 1
          ELSE LEAST(rate_limit.attempt_count + 1, 11)
        END
  RETURNING attempt_count INTO v_attempt_count;

  IF v_attempt_count > 10 OR p_code IS NULL OR pg_catalog.length(p_code) <> 64 THEN
    RETURN;
  END IF;

  SELECT care_profile.id
    INTO v_care_profile_id
    FROM public.care_invitations AS invitation
    JOIN public.care_profiles AS care_profile
      ON care_profile.id = invitation.care_profile_id
    WHERE invitation.code_hash = extensions.digest(p_code, 'sha256')
      AND invitation.used_at IS NULL
      AND invitation.revoked_at IS NULL
      AND invitation.expires_at > pg_catalog.clock_timestamp()
      AND care_profile.status = 'active'
    FOR SHARE OF care_profile;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT invitation.*
    INTO v_invitation
    FROM public.care_invitations AS invitation
    WHERE invitation.code_hash = extensions.digest(p_code, 'sha256')
      AND invitation.care_profile_id = v_care_profile_id
      AND invitation.used_at IS NULL
      AND invitation.revoked_at IS NULL
      AND invitation.expires_at > pg_catalog.clock_timestamp()
    FOR UPDATE;

  IF NOT FOUND OR EXISTS (
    SELECT 1
    FROM public.care_memberships AS membership
    WHERE membership.care_profile_id = v_invitation.care_profile_id
      AND membership.user_id = v_user_id
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.care_memberships (care_profile_id, user_id, role)
  VALUES (v_invitation.care_profile_id, v_user_id, v_invitation.intended_role)
  ON CONFLICT (care_profile_id, user_id) DO NOTHING;
  GET DIAGNOSTICS v_rows_inserted = ROW_COUNT;

  IF v_rows_inserted <> 1 THEN
    RETURN;
  END IF;

  UPDATE public.care_invitations
    SET used_at = pg_catalog.clock_timestamp()
    WHERE id = v_invitation.id
      AND used_at IS NULL
      AND revoked_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invitation could not be consumed'
      USING ERRCODE = '40001';
  END IF;

  RETURN QUERY SELECT v_invitation.care_profile_id, v_invitation.intended_role;
END;
$$;

CREATE FUNCTION public.cancel_care_invitation(p_invitation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_care_profile_id uuid;
BEGIN
  SELECT invitation.care_profile_id
    INTO v_care_profile_id
    FROM public.care_invitations AS invitation
    WHERE invitation.id = p_invitation_id;

  IF NOT FOUND OR auth.uid() IS NULL THEN
    RAISE EXCEPTION 'only an active care-profile owner may cancel this invitation'
      USING ERRCODE = '42501';
  END IF;

  PERFORM care_profile.id
    FROM public.care_profiles AS care_profile
    WHERE care_profile.id = v_care_profile_id
    FOR UPDATE;

  IF NOT public.is_care_owner(v_care_profile_id) THEN
    RAISE EXCEPTION 'only an active care-profile owner may cancel this invitation'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.care_invitations
    SET revoked_at = pg_catalog.clock_timestamp(),
        revoked_by = auth.uid()
    WHERE id = p_invitation_id
      AND used_at IS NULL
      AND revoked_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invitation is already used or revoked'
      USING ERRCODE = '23514';
  END IF;
END;
$$;

CREATE FUNCTION public.transfer_care_profile_ownership(
  p_care_profile_id uuid,
  p_target_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_target_membership_id uuid;
  v_previous_owner_membership_id uuid;
BEGIN
  IF auth.uid() IS NULL OR p_target_user_id IS NULL OR p_target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'an authenticated owner must select a different active member'
      USING ERRCODE = '42501';
  END IF;

  PERFORM care_profile.id
    FROM public.care_profiles AS care_profile
    WHERE care_profile.id = p_care_profile_id
      AND care_profile.status = 'active'
    FOR UPDATE;

  IF NOT FOUND OR NOT public.is_care_owner(p_care_profile_id) THEN
    RAISE EXCEPTION 'only the active owner may transfer an active care profile'
      USING ERRCODE = '42501';
  END IF;

  SELECT membership.id
    INTO v_target_membership_id
    FROM public.care_memberships AS membership
    WHERE membership.care_profile_id = p_care_profile_id
      AND membership.user_id = p_target_user_id
      AND membership.status = 'active'
      AND membership.role <> 'owner'
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'target must be an existing active member of this care profile'
      USING ERRCODE = '42501';
  END IF;

  SELECT membership.id
    INTO v_previous_owner_membership_id
    FROM public.care_memberships AS membership
    WHERE membership.care_profile_id = p_care_profile_id
      AND membership.user_id = auth.uid()
      AND membership.role = 'owner'
      AND membership.status = 'active'
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'caller is no longer the active owner'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.care_memberships
    SET role = 'caretaker',
        permissions = ARRAY[]::public.care_permission[]
    WHERE id = v_previous_owner_membership_id;

  UPDATE public.care_memberships
    SET role = 'owner',
        permissions = ARRAY[]::public.care_permission[]
    WHERE id = v_target_membership_id;

  INSERT INTO public.audit_logs (
    care_profile_id,
    actor_id,
    actor_subject_id,
    subject_id,
    action,
    entity_type,
    entity_id
  )
  VALUES (
    p_care_profile_id,
    auth.uid(),
    auth.uid(),
    p_target_user_id,
    'UPDATE',
    'ownership_transfers',
    p_care_profile_id
  );
END;
$$;

CREATE FUNCTION public.close_care_profile(p_care_profile_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication is required to close a care profile'
      USING ERRCODE = '42501';
  END IF;

  PERFORM care_profile.id
    FROM public.care_profiles AS care_profile
    WHERE care_profile.id = p_care_profile_id
      AND care_profile.status = 'active'
    FOR UPDATE;

  IF NOT FOUND OR NOT public.is_care_owner(p_care_profile_id) THEN
    RAISE EXCEPTION 'only the active owner may close an active care profile'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.care_profiles
    SET status = 'closed',
        closed_at = pg_catalog.clock_timestamp(),
        closed_by = auth.uid()
    WHERE id = p_care_profile_id;

  UPDATE public.care_invitations
    SET revoked_at = pg_catalog.clock_timestamp(),
        revoked_by = auth.uid()
    WHERE care_profile_id = p_care_profile_id
      AND used_at IS NULL
      AND revoked_at IS NULL;
END;
$$;

CREATE TRIGGER auth_user_deletion_guard
  BEFORE DELETE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.prevent_auth_user_deletion_without_handoff();

CREATE TRIGGER medications_active_profile_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.medications
  FOR EACH ROW EXECUTE FUNCTION public.guard_active_care_profile_write();
CREATE TRIGGER medication_events_active_profile_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.medication_events
  FOR EACH ROW EXECUTE FUNCTION public.guard_active_care_profile_write();
CREATE TRIGGER appointments_active_profile_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.guard_active_care_profile_write();

DROP POLICY care_profiles_update_owner_or_patient ON public.care_profiles;
CREATE POLICY care_profiles_update_owner_or_patient ON public.care_profiles
  FOR UPDATE TO authenticated
  USING (
    public.is_care_profile_active(id)
    AND public.has_care_permission(id, 'read_healthcare')
    AND EXISTS (
      SELECT 1
      FROM public.care_memberships AS membership
      WHERE membership.care_profile_id = care_profiles.id
        AND membership.user_id = auth.uid()
        AND membership.status = 'active'
        AND membership.role IN ('owner', 'elderly')
    )
  )
  WITH CHECK (
    public.is_care_profile_active(id)
    AND public.has_care_permission(id, 'read_healthcare')
    AND EXISTS (
      SELECT 1
      FROM public.care_memberships AS membership
      WHERE membership.care_profile_id = care_profiles.id
        AND membership.user_id = auth.uid()
        AND membership.status = 'active'
        AND membership.role IN ('owner', 'elderly')
    )
  );

DROP POLICY medications_insert_authorized ON public.medications;
CREATE POLICY medications_insert_authorized ON public.medications
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND public.is_care_profile_active(care_profile_id)
    AND public.has_care_permission(care_profile_id, 'manage_medications')
  );

DROP POLICY medications_update_authorized ON public.medications;
CREATE POLICY medications_update_authorized ON public.medications
  FOR UPDATE TO authenticated
  USING (
    public.is_care_profile_active(care_profile_id)
    AND public.has_care_permission(care_profile_id, 'manage_medications')
  )
  WITH CHECK (
    public.is_care_profile_active(care_profile_id)
    AND public.has_care_permission(care_profile_id, 'manage_medications')
  );

DROP POLICY medications_delete_authorized ON public.medications;
CREATE POLICY medications_delete_authorized ON public.medications
  FOR DELETE TO authenticated
  USING (
    public.is_care_profile_active(care_profile_id)
    AND public.has_care_permission(care_profile_id, 'manage_medications')
  );

DROP POLICY medication_events_insert_authorized ON public.medication_events;
CREATE POLICY medication_events_insert_authorized ON public.medication_events
  FOR INSERT TO authenticated
  WITH CHECK (
    status = 'pending'
    AND EXISTS (
      SELECT 1
      FROM public.medications AS medication
      WHERE medication.id = medication_id
        AND public.is_care_profile_active(medication.care_profile_id)
        AND (
          public.has_care_permission(medication.care_profile_id, 'record_medication_events')
          OR public.has_care_permission(medication.care_profile_id, 'manage_medications')
        )
    )
  );

DROP POLICY medication_events_update_authorized ON public.medication_events;
CREATE POLICY medication_events_update_authorized ON public.medication_events
  FOR UPDATE TO authenticated
  USING (
    status = 'pending'
    AND EXISTS (
      SELECT 1
      FROM public.medications AS medication
      WHERE medication.id = medication_id
        AND public.is_care_profile_active(medication.care_profile_id)
        AND (
          public.has_care_permission(medication.care_profile_id, 'record_medication_events')
          OR public.has_care_permission(medication.care_profile_id, 'manage_medications')
        )
    )
  )
  WITH CHECK (
    status <> 'pending'
    AND EXISTS (
      SELECT 1
      FROM public.medications AS medication
      WHERE medication.id = medication_id
        AND public.is_care_profile_active(medication.care_profile_id)
        AND (
          public.has_care_permission(medication.care_profile_id, 'record_medication_events')
          OR public.has_care_permission(medication.care_profile_id, 'manage_medications')
        )
    )
  );

DROP POLICY appointments_insert_authorized ON public.appointments;
CREATE POLICY appointments_insert_authorized ON public.appointments
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND public.is_care_profile_active(care_profile_id)
    AND public.has_care_permission(care_profile_id, 'manage_appointments')
  );

DROP POLICY appointments_update_authorized ON public.appointments;
CREATE POLICY appointments_update_authorized ON public.appointments
  FOR UPDATE TO authenticated
  USING (
    public.is_care_profile_active(care_profile_id)
    AND public.has_care_permission(care_profile_id, 'manage_appointments')
  )
  WITH CHECK (
    public.is_care_profile_active(care_profile_id)
    AND public.has_care_permission(care_profile_id, 'manage_appointments')
  );

DROP POLICY appointments_delete_authorized ON public.appointments;
CREATE POLICY appointments_delete_authorized ON public.appointments
  FOR DELETE TO authenticated
  USING (
    public.is_care_profile_active(care_profile_id)
    AND public.has_care_permission(care_profile_id, 'manage_appointments')
  );

REVOKE CREATE ON SCHEMA public, extensions FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.is_care_profile_active(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_auth_user_deletion_without_handoff() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_active_care_profile_write() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancel_care_invitation(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.transfer_care_profile_ownership(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.close_care_profile(uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.is_care_profile_active(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_care_invitation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_care_profile_ownership(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_care_profile(uuid) TO authenticated;

COMMENT ON FUNCTION public.sync_profile_from_auth() IS
  'Auth trigger only: synchronizes email into the caller-owned profile; fixed search_path and no client EXECUTE.';
COMMENT ON FUNCTION public.create_initial_owner_membership() IS
  'Care-profile insert trigger only: grants initial ownership to the authenticated creator; fixed search_path and no client EXECUTE.';
COMMENT ON FUNCTION public.has_care_permission(uuid, public.care_permission) IS
  'RLS membership check using auth.uid(); SECURITY DEFINER avoids recursive membership policies; fixed search_path and authenticated-only EXECUTE.';
COMMENT ON FUNCTION public.is_care_owner(uuid) IS
  'RLS/RPC ownership check using auth.uid(); SECURITY DEFINER avoids recursive membership policies; fixed search_path and authenticated-only EXECUTE.';
COMMENT ON FUNCTION public.is_care_profile_active(uuid) IS
  'Read-only profile lifecycle check for RLS/RPCs; SECURITY DEFINER avoids care-profile policy recursion; fixed search_path and authenticated-only EXECUTE.';
COMMENT ON FUNCTION public.audit_row_change() IS
  'Audit trigger only: appends profile-scoped change events and retained subject UUIDs; fixed search_path and no client EXECUTE.';
COMMENT ON FUNCTION public.prevent_auth_user_deletion_without_handoff() IS
  'Auth-user delete trigger: blocks deletion while the user owns an active profile, then revokes memberships; fixed search_path and no client EXECUTE.';
COMMENT ON FUNCTION public.guard_active_care_profile_write() IS
  'Healthcare write trigger: locks the active care profile so closure serializes against healthcare writes; fixed search_path and no client EXECUTE.';
COMMENT ON FUNCTION public.guard_medication_event_transition() IS
  'Medication-event trigger only: enforces one-way pending-to-recorded transitions; fixed search_path and no client EXECUTE.';
COMMENT ON FUNCTION public.create_care_invitation(uuid, public.care_role, integer) IS
  'Owner-only invitation issuance; returns a 256-bit bearer code once and stores only SHA-256; clients must not log or persist the returned code.';
COMMENT ON FUNCTION public.redeem_care_invitation(text) IS
  'Authenticated invitation redemption with per-user 15-minute rate limiting, row-locked single use, expiry, and intended-role enforcement; invalid attempts return no rows.';
COMMENT ON FUNCTION public.cancel_care_invitation(uuid) IS
  'Owner-only invitation revocation; serializes with profile closure and redemption and never returns the bearer code.';
COMMENT ON FUNCTION public.set_care_member_permissions(uuid, public.care_permission[]) IS
  'Owner-only scoped grants for caretaker/family members; fixed search_path and authenticated-only EXECUTE.';
COMMENT ON FUNCTION public.revoke_care_membership(uuid) IS
  'Owner-only membership revocation; fixed search_path and authenticated-only EXECUTE.';
COMMENT ON FUNCTION public.transfer_care_profile_ownership(uuid, uuid) IS
  'Atomically transfers an active profile to an existing active member under a profile row lock and audits the transfer.';
COMMENT ON FUNCTION public.close_care_profile(uuid) IS
  'Owner-only soft closure; freezes writes, revokes unused invitations, and retains healthcare and audit records.';

COMMIT;
