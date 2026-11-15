export type CareRole = 'owner' | 'elderly' | 'caretaker' | 'family';
export type CareMembershipStatus = 'active' | 'revoked';
export type CarePermission =
  | 'read_healthcare'
  | 'manage_medications'
  | 'record_medication_events'
  | 'manage_appointments';

export type MedicationEventStatus =
  | 'pending'
  | 'taken'
  | 'skipped'
  | 'missed'
  | 'unconfirmed';

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  created_at: string;
  updated_at: string;
}

export interface CareProfile {
  id: string;
  display_name: string;
  date_of_birth: string | null;
  emergency_contact: string;
  status: 'active' | 'closed';
  created_by: string | null;
  closed_at: string | null;
  closed_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CareMembership {
  id: string;
  care_profile_id: string;
  user_id: string | null;
  role: CareRole;
  status: CareMembershipStatus;
  permissions: CarePermission[];
  created_at: string;
  profile?: Profile;
}

export interface Medication {
  id: string;
  care_profile_id: string;
  name: string;
  dosage: string;
  instructions: string | null;
  frequency: string;
  scheduled_times: string[];
  start_date: string;
  end_date: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface MedicationEvent {
  id: string;
  medication_id: string;
  scheduled_at: string;
  status: MedicationEventStatus;
  recorded_by: string | null;
  recorded_at: string | null;
  created_at: string;
  medication?: Medication;
}

export interface Appointment {
  id: string;
  care_profile_id: string;
  doctor_name: string;
  facility_name: string | null;
  appointment_at: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CareInvitation {
  id: string;
  care_profile_id: string;
  intended_role: CareRole;
  expires_at: string;
  used_at: string | null;
  revoked_at: string | null;
  created_by: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  care_profile_id: string;
  actor_id: string | null;
  actor_subject_id: string | null;
  subject_id: string | null;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  entity_type: string;
  entity_id: string;
  created_at: string;
}
