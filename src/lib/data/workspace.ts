import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type {
  Appointment,
  CareMembership,
  CareProfile,
  Medication,
  MedicationEvent,
} from "@/types/database";

export interface CareWorkspace {
  referenceTime: string;
  user: {
    id: string;
    email: string | null;
  };
  careProfiles: CareProfile[];
  activeMembership: CareMembership | null;
  careProfile: CareProfile | null;
  memberships: CareMembership[];
  medications: Medication[];
  medicationEvents: MedicationEvent[];
  appointments: Appointment[];
}

function throwOnQueryError(
  error: { message: string } | null,
  resource: string
): void {
  if (error) {
    throw new Error(`Unable to load ${resource}: ${error.message}`);
  }
}

export async function loadCareWorkspace(
  requestedCareProfileId?: string
): Promise<CareWorkspace> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError && authError.message !== "Auth session missing!") {
    throw new Error(`Unable to load your authenticated session: ${authError.message}`);
  }
  if (!user) {
    redirect("/login");
  }
  const referenceTime = new Date().toISOString();

  const { data: membershipRows, error: membershipsError } = await supabase
    .from("care_memberships")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: true });

  throwOnQueryError(membershipsError, "your care memberships");
  const memberships = (membershipRows ?? []) as CareMembership[];
  const careProfileIds = [...new Set(memberships.map((member) => member.care_profile_id))];

  if (careProfileIds.length === 0) {
    return {
      referenceTime,
      user: { id: user.id, email: user.email ?? null },
      careProfiles: [],
      activeMembership: null,
      careProfile: null,
      memberships: [],
      medications: [],
      medicationEvents: [],
      appointments: [],
    };
  }

  const { data: profileRows, error: profilesError } = await supabase
    .from("care_profiles")
    .select("*")
    .in("id", careProfileIds)
    .order("display_name", { ascending: true });

  throwOnQueryError(profilesError, "your care profiles");
  const careProfiles = (profileRows ?? []) as CareProfile[];
  const selectedProfile = requestedCareProfileId
    ? careProfiles.find((profile) => profile.id === requestedCareProfileId) ?? null
    : careProfiles[0] ?? null;

  if (requestedCareProfileId && !selectedProfile) {
    notFound();
  }

  if (!selectedProfile) {
    return {
      referenceTime,
      user: { id: user.id, email: user.email ?? null },
      careProfiles,
      activeMembership: null,
      careProfile: null,
      memberships: [],
      medications: [],
      medicationEvents: [],
      appointments: [],
    };
  }

  const activeMembership =
    memberships.find((member) => member.care_profile_id === selectedProfile.id) ?? null;

  const [teamResult, medicationResult, appointmentResult] = await Promise.all([
    supabase
      .from("care_memberships")
      .select("*")
      .eq("care_profile_id", selectedProfile.id)
      .eq("status", "active")
      .order("created_at", { ascending: true }),
    supabase
      .from("medications")
      .select("*")
      .eq("care_profile_id", selectedProfile.id)
      .order("start_date", { ascending: false }),
    supabase
      .from("appointments")
      .select("*")
      .eq("care_profile_id", selectedProfile.id)
      .order("appointment_at", { ascending: true }),
  ]);

  throwOnQueryError(teamResult.error, "the care team");
  throwOnQueryError(medicationResult.error, "medications");
  throwOnQueryError(appointmentResult.error, "appointments");

  const medications = (medicationResult.data ?? []) as Medication[];
  const eventResult = medications.length
    ? await supabase
        .from("medication_events")
        .select("*")
        .in("medication_id", medications.map((medication) => medication.id))
        .gte(
          "scheduled_at",
          new Date(new Date(referenceTime).getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
        )
        .order("scheduled_at", { ascending: false })
        .limit(1000)
    : { data: [], error: null };
  throwOnQueryError(eventResult.error, "medication events");
  const medicationEvents = (eventResult.data ?? []) as MedicationEvent[];

  return {
    referenceTime,
    user: { id: user.id, email: user.email ?? null },
    careProfiles,
    activeMembership,
    careProfile: selectedProfile,
    memberships: (teamResult.data ?? []) as CareMembership[],
    medications,
    medicationEvents: medicationEvents.filter((event) =>
      medications.some((medication) => medication.id === event.medication_id)
    ),
    appointments: (appointmentResult.data ?? []) as Appointment[],
  };
}
