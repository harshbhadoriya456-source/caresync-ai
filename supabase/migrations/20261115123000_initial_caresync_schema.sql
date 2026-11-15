BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TYPE public.care_role AS ENUM (
  'owner',
  'elderly',
  'caretaker',
  'family'
);

CREATE TYPE public.care_membership_status AS ENUM (
  'active',
  'revoked'
);

CREATE TYPE public.care_permission AS ENUM (
  'read_healthcare',
  'manage_medications',
  'record_medication_events',
  'manage_appointments'
);

CREATE TYPE public.medication_event_status AS ENUM (
  'pending',
  'taken',
  'skipped',
  'missed',
  'unconfirmed'
);

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  full_name text,
  email text,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);

CREATE TABLE public.care_profiles (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  display_name text NOT NULL CHECK (pg_catalog.length(pg_catalog.btrim(display_name)) > 0),
  date_of_birth date CHECK (date_of_birth IS NULL OR date_of_birth <= CURRENT_DATE),
  emergency_contact text NOT NULL CHECK (pg_catalog.length(pg_catalog.btrim(emergency_contact)) > 0),
  created_by uuid NOT NULL DEFAULT auth.uid()
    REFERENCES auth.users (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);

CREATE TABLE public.care_memberships (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  care_profile_id uuid NOT NULL REFERENCES public.care_profiles (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  role public.care_role NOT NULL,
  status public.care_membership_status NOT NULL DEFAULT 'active',
  permissions public.care_permission[] NOT NULL DEFAULT ARRAY[]::public.care_permission[],
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT care_memberships_profile_user_key UNIQUE (care_profile_id, user_id),
  CONSTRAINT care_memberships_permissions_limit CHECK (pg_catalog.cardinality(permissions) <= 4),
  CONSTRAINT care_memberships_owner_has_no_grants CHECK (
    role <> 'owner' OR pg_catalog.cardinality(permissions) = 0
  )
);

CREATE TABLE public.medications (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  care_profile_id uuid NOT NULL REFERENCES public.care_profiles (id) ON DELETE CASCADE,
  name text NOT NULL CHECK (pg_catalog.length(pg_catalog.btrim(name)) > 0),
  dosage text NOT NULL CHECK (pg_catalog.length(pg_catalog.btrim(dosage)) > 0),
  instructions text,
  frequency text NOT NULL CHECK (pg_catalog.length(pg_catalog.btrim(frequency)) > 0),
  scheduled_times time[] NOT NULL CHECK (
    pg_catalog.cardinality(scheduled_times) BETWEEN 1 AND 24
    AND pg_catalog.array_position(scheduled_times, NULL) IS NULL
  ),
  start_date date NOT NULL,
  end_date date,
  created_by uuid NOT NULL DEFAULT auth.uid()
    REFERENCES auth.users (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT medications_date_range CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE TABLE public.medication_events (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  medication_id uuid NOT NULL REFERENCES public.medications (id) ON DELETE RESTRICT,
  scheduled_at timestamptz NOT NULL,
  status public.medication_event_status NOT NULL DEFAULT 'pending',
  recorded_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  recorded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT medication_events_one_per_schedule UNIQUE (medication_id, scheduled_at),
  CONSTRAINT medication_events_recording_state CHECK (
    (status = 'pending' AND recorded_by IS NULL AND recorded_at IS NULL)
    OR (status <> 'pending' AND recorded_at IS NOT NULL)
  )
);

CREATE TABLE public.appointments (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  care_profile_id uuid NOT NULL REFERENCES public.care_profiles (id) ON DELETE CASCADE,
  doctor_name text NOT NULL CHECK (pg_catalog.length(pg_catalog.btrim(doctor_name)) > 0),
  facility_name text,
  appointment_at timestamptz NOT NULL,
  notes text,
  created_by uuid NOT NULL DEFAULT auth.uid()
    REFERENCES auth.users (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);

CREATE TABLE public.care_invitations (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  care_profile_id uuid NOT NULL REFERENCES public.care_profiles (id) ON DELETE CASCADE,
  code_hash bytea NOT NULL UNIQUE CHECK (pg_catalog.octet_length(code_hash) = 32),
  intended_role public.care_role NOT NULL CHECK (intended_role <> 'owner'),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_by uuid NOT NULL DEFAULT auth.uid()
    REFERENCES auth.users (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT care_invitations_expiration CHECK (expires_at > created_at),
  CONSTRAINT care_invitations_use_time CHECK (used_at IS NULL OR used_at >= created_at)
);

CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  care_profile_id uuid NOT NULL REFERENCES public.care_profiles (id) ON DELETE RESTRICT,
  actor_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  entity_type text NOT NULL CHECK (
    entity_type IN (
      'care_profiles',
      'care_memberships',
      'medications',
      'medication_events',
      'appointments',
      'care_invitations'
    )
  ),
  entity_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);

CREATE INDEX care_memberships_user_profile_status_idx
  ON public.care_memberships (user_id, care_profile_id, status);
CREATE INDEX care_memberships_profile_status_role_idx
  ON public.care_memberships (care_profile_id, status, role);
CREATE INDEX medications_profile_start_date_idx
  ON public.medications (care_profile_id, start_date);
CREATE INDEX medication_events_medication_scheduled_idx
  ON public.medication_events (medication_id, scheduled_at);
CREATE INDEX appointments_profile_appointment_at_idx
  ON public.appointments (care_profile_id, appointment_at);
CREATE INDEX care_invitations_profile_expiration_idx
  ON public.care_invitations (care_profile_id, expires_at)
  WHERE used_at IS NULL;
CREATE INDEX audit_logs_profile_created_at_idx
  ON public.audit_logs (care_profile_id, created_at DESC);

CREATE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.updated_at := pg_catalog.now();
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.sync_profile_from_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        updated_at = pg_catalog.now();
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.create_initial_owner_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.created_by IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'care profile creator must be the authenticated user'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.care_memberships (care_profile_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'owner');
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.has_care_permission(
  p_care_profile_id uuid,
  p_permission public.care_permission
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.care_memberships AS membership
    WHERE membership.care_profile_id = p_care_profile_id
      AND membership.user_id = auth.uid()
      AND membership.status = 'active'
      AND (
        membership.role IN ('owner', 'elderly')
        OR p_permission = ANY (membership.permissions)
      )
  );
$$;

CREATE FUNCTION public.is_care_owner(p_care_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.care_memberships AS membership
    WHERE membership.care_profile_id = p_care_profile_id
      AND membership.user_id = auth.uid()
      AND membership.role = 'owner'
      AND membership.status = 'active'
  );
$$;

CREATE FUNCTION public.audit_row_change()
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
BEGIN
  v_row := CASE WHEN TG_OP = 'DELETE' THEN pg_catalog.to_jsonb(OLD) ELSE pg_catalog.to_jsonb(NEW) END;
  v_entity_id := (v_row ->> 'id')::uuid;

  IF TG_TABLE_NAME = 'care_profiles' THEN
    v_care_profile_id := v_entity_id;
  ELSIF TG_TABLE_NAME IN ('care_memberships', 'medications', 'appointments', 'care_invitations') THEN
    v_care_profile_id := (v_row ->> 'care_profile_id')::uuid;
  ELSIF TG_TABLE_NAME = 'medication_events' THEN
    v_medication_id := (v_row ->> 'medication_id')::uuid;
    SELECT medication.care_profile_id
      INTO v_care_profile_id
      FROM public.medications AS medication
      WHERE medication.id = v_medication_id;
  ELSE
    RAISE EXCEPTION 'unsupported audit table: %', TG_TABLE_NAME;
  END IF;

  INSERT INTO public.audit_logs (care_profile_id, actor_id, action, entity_type, entity_id)
  VALUES (v_care_profile_id, auth.uid(), TG_OP, TG_TABLE_NAME, v_entity_id);
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.guard_medication_event_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'pending' OR NEW.recorded_by IS NOT NULL OR NEW.recorded_at IS NOT NULL THEN
      RAISE EXCEPTION 'medication events must be created as pending'
        USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status <> 'pending' OR NEW.status = 'pending' THEN
    RAISE EXCEPTION 'medication event status can only transition from pending once'
      USING ERRCODE = '23514';
  END IF;

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'an authenticated user must record the medication event'
      USING ERRCODE = '42501';
  END IF;

  NEW.recorded_by := auth.uid();
  NEW.recorded_at := pg_catalog.now();
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.create_care_invitation(
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

  IF p_intended_role IS NULL OR p_expires_in_hours IS NULL
     OR p_intended_role = 'owner' OR p_expires_in_hours NOT BETWEEN 1 AND 168 THEN
    RAISE EXCEPTION 'invalid invitation role or expiration'
      USING ERRCODE = '22023';
  END IF;

  v_code := pg_catalog.encode(extensions.gen_random_bytes(32), 'hex');
  v_expires_at := pg_catalog.now() + pg_catalog.make_interval(hours => p_expires_in_hours);

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

CREATE FUNCTION public.redeem_care_invitation(p_code text)
RETURNS TABLE (care_profile_id uuid, role public.care_role)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_invitation public.care_invitations%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR p_code IS NULL OR pg_catalog.length(p_code) <> 64 THEN
    RAISE EXCEPTION 'invalid invitation'
      USING ERRCODE = '22023';
  END IF;

  SELECT invitation.*
    INTO v_invitation
    FROM public.care_invitations AS invitation
    WHERE invitation.code_hash = extensions.digest(p_code, 'sha256')
      AND invitation.used_at IS NULL
      AND invitation.expires_at > pg_catalog.clock_timestamp()
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid, expired, or already used invitation'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.care_memberships AS membership
    WHERE membership.care_profile_id = v_invitation.care_profile_id
      AND membership.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'user already has a membership for this care profile'
      USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.care_memberships (care_profile_id, user_id, role)
  VALUES (v_invitation.care_profile_id, auth.uid(), v_invitation.intended_role);

  UPDATE public.care_invitations
    SET used_at = pg_catalog.now()
    WHERE id = v_invitation.id;

  RETURN QUERY SELECT v_invitation.care_profile_id, v_invitation.intended_role;
END;
$$;

CREATE FUNCTION public.set_care_member_permissions(
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
  SELECT membership.care_profile_id, membership.role
    INTO v_profile_id, v_role
    FROM public.care_memberships AS membership
    WHERE membership.id = p_membership_id
      AND membership.status = 'active';

  IF NOT FOUND OR auth.uid() IS NULL OR NOT public.is_care_owner(v_profile_id) THEN
    RAISE EXCEPTION 'only an active care-profile owner may change permissions'
      USING ERRCODE = '42501';
  END IF;

  IF v_role NOT IN ('caretaker', 'family') OR p_permissions IS NULL
     OR pg_catalog.cardinality(p_permissions) > 4 THEN
    RAISE EXCEPTION 'invalid membership permission update'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.care_memberships
    SET permissions = p_permissions
    WHERE id = p_membership_id;
END;
$$;

CREATE FUNCTION public.revoke_care_membership(p_membership_id uuid)
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

  IF NOT FOUND OR auth.uid() IS NULL OR NOT public.is_care_owner(v_profile_id) THEN
    RAISE EXCEPTION 'only an active care-profile owner may revoke this membership'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.care_memberships
    SET status = 'revoked',
        permissions = ARRAY[]::public.care_permission[]
    WHERE id = p_membership_id;
END;
$$;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER care_profiles_updated_at
  BEFORE UPDATE ON public.care_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER medications_updated_at
  BEFORE UPDATE ON public.medications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER auth_user_profile_sync
  AFTER INSERT OR UPDATE OF email ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_from_auth();
INSERT INTO public.profiles (id, email)
SELECT user_record.id, user_record.email
FROM auth.users AS user_record
ON CONFLICT (id) DO NOTHING;
CREATE TRIGGER care_profile_owner_membership
  AFTER INSERT ON public.care_profiles
  FOR EACH ROW EXECUTE FUNCTION public.create_initial_owner_membership();

CREATE TRIGGER medication_event_state_guard
  BEFORE INSERT OR UPDATE ON public.medication_events
  FOR EACH ROW EXECUTE FUNCTION public.guard_medication_event_transition();

CREATE TRIGGER care_profiles_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.care_profiles
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER care_memberships_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.care_memberships
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER medications_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.medications
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER medication_events_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.medication_events
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER appointments_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER care_invitations_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.care_invitations
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medication_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_select_self ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());
CREATE POLICY profiles_update_self ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY care_profiles_select_member ON public.care_profiles
  FOR SELECT TO authenticated
  USING (public.has_care_permission(id, 'read_healthcare'));
CREATE POLICY care_profiles_insert_creator ON public.care_profiles
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
CREATE POLICY care_profiles_update_owner_or_patient ON public.care_profiles
  FOR UPDATE TO authenticated
  USING (
    public.has_care_permission(id, 'read_healthcare')
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
    public.has_care_permission(id, 'read_healthcare')
    AND EXISTS (
      SELECT 1
      FROM public.care_memberships AS membership
      WHERE membership.care_profile_id = care_profiles.id
        AND membership.user_id = auth.uid()
        AND membership.status = 'active'
        AND membership.role IN ('owner', 'elderly')
    )
  );

CREATE POLICY care_memberships_select_self_or_owner ON public.care_memberships
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_care_owner(care_profile_id));

CREATE POLICY medications_select_authorized ON public.medications
  FOR SELECT TO authenticated
  USING (
    public.has_care_permission(care_profile_id, 'read_healthcare')
    OR public.has_care_permission(care_profile_id, 'manage_medications')
    OR public.has_care_permission(care_profile_id, 'record_medication_events')
  );
CREATE POLICY medications_insert_authorized ON public.medications
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND public.has_care_permission(care_profile_id, 'manage_medications')
  );
CREATE POLICY medications_update_authorized ON public.medications
  FOR UPDATE TO authenticated
  USING (public.has_care_permission(care_profile_id, 'manage_medications'))
  WITH CHECK (public.has_care_permission(care_profile_id, 'manage_medications'));
CREATE POLICY medications_delete_authorized ON public.medications
  FOR DELETE TO authenticated
  USING (public.has_care_permission(care_profile_id, 'manage_medications'));

CREATE POLICY medication_events_select_authorized ON public.medication_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.medications AS medication
      WHERE medication.id = medication_id
        AND (
          public.has_care_permission(medication.care_profile_id, 'read_healthcare')
          OR public.has_care_permission(medication.care_profile_id, 'manage_medications')
          OR public.has_care_permission(medication.care_profile_id, 'record_medication_events')
        )
    )
  );
CREATE POLICY medication_events_insert_authorized ON public.medication_events
  FOR INSERT TO authenticated
  WITH CHECK (
    status = 'pending'
    AND EXISTS (
      SELECT 1
      FROM public.medications AS medication
      WHERE medication.id = medication_id
        AND (
          public.has_care_permission(medication.care_profile_id, 'record_medication_events')
          OR public.has_care_permission(medication.care_profile_id, 'manage_medications')
        )
    )
  );
CREATE POLICY medication_events_update_authorized ON public.medication_events
  FOR UPDATE TO authenticated
  USING (
    status = 'pending'
    AND EXISTS (
      SELECT 1
      FROM public.medications AS medication
      WHERE medication.id = medication_id
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
        AND (
          public.has_care_permission(medication.care_profile_id, 'record_medication_events')
          OR public.has_care_permission(medication.care_profile_id, 'manage_medications')
        )
    )
  );

CREATE POLICY appointments_select_authorized ON public.appointments
  FOR SELECT TO authenticated
  USING (
    public.has_care_permission(care_profile_id, 'read_healthcare')
    OR public.has_care_permission(care_profile_id, 'manage_appointments')
  );
CREATE POLICY appointments_insert_authorized ON public.appointments
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND public.has_care_permission(care_profile_id, 'manage_appointments')
  );
CREATE POLICY appointments_update_authorized ON public.appointments
  FOR UPDATE TO authenticated
  USING (public.has_care_permission(care_profile_id, 'manage_appointments'))
  WITH CHECK (public.has_care_permission(care_profile_id, 'manage_appointments'));
CREATE POLICY appointments_delete_authorized ON public.appointments
  FOR DELETE TO authenticated
  USING (public.has_care_permission(care_profile_id, 'manage_appointments'));

CREATE POLICY care_invitations_select_owner ON public.care_invitations
  FOR SELECT TO authenticated
  USING (public.is_care_owner(care_profile_id));

CREATE POLICY audit_logs_select_owner ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.is_care_owner(care_profile_id));

REVOKE ALL ON TABLE
  public.profiles,
  public.care_profiles,
  public.care_memberships,
  public.medications,
  public.medication_events,
  public.appointments,
  public.care_invitations,
  public.audit_logs
FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE (full_name) ON public.profiles TO authenticated;

GRANT SELECT ON public.care_profiles TO authenticated;
GRANT INSERT (display_name, date_of_birth, emergency_contact)
  ON public.care_profiles TO authenticated;
GRANT UPDATE (display_name, date_of_birth, emergency_contact)
  ON public.care_profiles TO authenticated;

GRANT SELECT ON public.care_memberships TO authenticated;

GRANT SELECT, DELETE ON public.medications TO authenticated;
GRANT INSERT (care_profile_id, name, dosage, instructions, frequency, scheduled_times, start_date, end_date)
  ON public.medications TO authenticated;
GRANT UPDATE (name, dosage, instructions, frequency, scheduled_times, start_date, end_date)
  ON public.medications TO authenticated;

GRANT SELECT ON public.medication_events TO authenticated;
GRANT INSERT (medication_id, scheduled_at, status)
  ON public.medication_events TO authenticated;
GRANT UPDATE (status) ON public.medication_events TO authenticated;

GRANT SELECT, DELETE ON public.appointments TO authenticated;
GRANT INSERT (care_profile_id, doctor_name, facility_name, appointment_at, notes)
  ON public.appointments TO authenticated;
GRANT UPDATE (doctor_name, facility_name, appointment_at, notes)
  ON public.appointments TO authenticated;

GRANT SELECT ON public.care_invitations, public.audit_logs TO authenticated;

REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_profile_from_auth() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_initial_owner_membership() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_row_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_medication_event_transition() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_care_permission(uuid, public.care_permission) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_care_owner(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_care_invitation(uuid, public.care_role, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.redeem_care_invitation(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_care_member_permissions(uuid, public.care_permission[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.revoke_care_membership(uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.has_care_permission(uuid, public.care_permission) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_care_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_care_invitation(uuid, public.care_role, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_care_invitation(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_care_member_permissions(uuid, public.care_permission[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_care_membership(uuid) TO authenticated;

COMMIT;
