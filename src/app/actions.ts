"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { MedicationEventStatus } from "@/types/database";

export type ActionResult =
  | { success: true }
  | { success: false; message: string };

function getAuthFailureMessage(error: {
  name?: string;
  message: string;
  status?: number;
}): string {
  const message = error.message.toLowerCase();
  if (
    error.status === 0 ||
    error.name === "AuthRetryableFetchError" ||
    message.includes("fetch failed")
  ) {
    return "CareSync could not reach Supabase Auth. Check the Supabase project URL and public anon/publishable key in .env.local, then restart the dev server.";
  }
  if (
    error.status === 401 ||
    error.status === 403 ||
    message.includes("invalid api key") ||
    message.includes("project not found")
  ) {
    return "Supabase rejected the project configuration. Verify the project URL and public anon/publishable key in .env.local.";
  }
  if (error.status === 429) {
    return "Too many sign-in attempts. Wait a few minutes before trying again.";
  }
  if (message.includes("email not confirmed")) {
    return "Confirm your email address before signing in. Check your inbox for the confirmation link.";
  }
  if (message.includes("invalid login credentials")) {
    return "Email or password is incorrect. If you have not created an account for this Supabase project, register first.";
  }
  return "Sign-in failed. Check your account details and Supabase Auth configuration, then try again.";
}

const signInSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1).max(256),
});

export async function signIn(input: unknown): Promise<ActionResult> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: "Enter a valid email address and password." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return { success: false, message: getAuthFailureMessage(error) };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

const signUpSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(12).max(128),
});

export async function signUp(input: unknown): Promise<
  | { success: true; message: string }
  | { success: false; message: string }
> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: "Use a valid email address and a password of at least 12 characters." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp(parsed.data);
  if (error) {
    return { success: false, message: getAuthFailureMessage(error) };
  }
  if (data.session) {
    revalidatePath("/", "layout");
    redirect("/invite");
  }
  return {
    success: true,
    message: "Check your email to confirm the account. After signing in, redeem the invitation code provided by the care-profile owner.",
  };
}

const medicationEventSchema = z.object({
  medicationId: z.string().uuid(),
  scheduledAt: z.string().datetime({ offset: true }),
  status: z.enum(["taken", "skipped"]),
});

const appointmentSchema = z.object({
  careProfileId: z.string().uuid(),
  doctorName: z.string().trim().min(1).max(160),
  facilityName: z.string().trim().max(200).nullable(),
  appointmentAt: z.string().datetime({ offset: true }),
  notes: z.string().trim().max(2000).nullable(),
});

export async function recordMedicationEvent(
  input: unknown
): Promise<ActionResult> {
  const parsed = medicationEventSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: "The medication update was invalid." };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return { success: false, message: "Sign in again before recording a dose." };
  }

  const { medicationId, scheduledAt, status } = parsed.data;
  const { data: existingEvent, error: lookupError } = await supabase
    .from("medication_events")
    .select("id,status")
    .eq("medication_id", medicationId)
    .eq("scheduled_at", scheduledAt)
    .maybeSingle();

  if (lookupError) {
    return { success: false, message: "The medication schedule could not be checked." };
  }

  let eventId = existingEvent?.id;
  if (existingEvent && existingEvent.status !== "pending") {
    return { success: false, message: "This dose has already been recorded." };
  }

  if (!eventId) {
    const { data: insertedEvent, error: insertError } = await supabase
      .from("medication_events")
      .insert({
        medication_id: medicationId,
        scheduled_at: scheduledAt,
        status: "pending" satisfies MedicationEventStatus,
      })
      .select("id")
      .single();

    if (insertError || !insertedEvent) {
      return {
        success: false,
        message: "A pending dose record could not be created. Refresh and try again.",
      };
    }
    eventId = insertedEvent.id;
  }

  const { data: updatedEvent, error: updateError } = await supabase
    .from("medication_events")
    .update({ status })
    .eq("id", eventId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (updateError || !updatedEvent) {
    return {
      success: false,
      message: "The pending record remains unchanged. Refresh before trying again.",
    };
  }

  revalidatePath("/dashboard");
  revalidatePath("/medications");
  return { success: true };
}

const medicationSchema = z.object({
  careProfileId: z.string().uuid(),
  name: z.string().trim().min(1).max(160),
  dosage: z.string().trim().min(1).max(120),
  instructions: z.string().trim().max(1000).nullable(),
  frequency: z.string().trim().min(1).max(120),
  scheduledTimes: z.array(z.string().regex(/^\d{2}:\d{2}$/)).min(1).max(12),
  startDate: z.string().date(),
  endDate: z.string().date().nullable(),
});

export async function createMedication(input: unknown): Promise<ActionResult> {
  const parsed = medicationSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: "Check the medication details and try again." };
  }
  if (
    parsed.data.endDate &&
    parsed.data.endDate < parsed.data.startDate
  ) {
    return { success: false, message: "The end date must be on or after the start date." };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return { success: false, message: "Sign in again before adding a medication." };
  }

  const { careProfileId, scheduledTimes, startDate, endDate, ...details } = parsed.data;
  const { error } = await supabase.from("medications").insert({
    ...details,
    care_profile_id: careProfileId,
    scheduled_times: scheduledTimes,
    start_date: startDate,
    end_date: endDate,
    created_by: user.id,
  });
  if (error) {
    return {
      success: false,
      message: "You may not have permission to manage medications for this profile, or the details are invalid.",
    };
  }

  revalidatePath("/dashboard");
  revalidatePath("/medications");
  revalidatePath(`/patients/${careProfileId}`);
  return { success: true };
}

export async function createAppointment(
  input: unknown
): Promise<ActionResult> {
  const parsed = appointmentSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: "Check the appointment details and try again." };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return { success: false, message: "Sign in again before scheduling a visit." };
  }

  const { error } = await supabase.from("appointments").insert({
    ...parsed.data,
    created_by: user.id,
  });

  if (error) {
    return {
      success: false,
      message: "You may not have appointment access for this patient, or the details are invalid.",
    };
  }

  revalidatePath("/dashboard");
  revalidatePath("/appointments");
  return { success: true };
}

const invitationSchema = z.object({
  careProfileId: z.string().uuid(),
  role: z.enum(["elderly", "caretaker", "family"]),
});

const memberPermissionsSchema = z.object({
  membershipId: z.string().uuid(),
  permissions: z.array(
    z.enum([
      "read_healthcare",
      "manage_medications",
      "record_medication_events",
      "manage_appointments",
    ])
  ).max(4),
});

const redeemInvitationSchema = z.object({
  code: z.string().trim().min(1).max(256),
});

export async function redeemCareInvitation(input: unknown): Promise<ActionResult> {
  const parsed = redeemInvitationSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: "Enter a valid invitation code." };
  }
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return { success: false, message: "Sign in before redeeming an invitation." };
  }

  const { data: response, error } = await supabase.rpc("redeem_care_invitation", {
    p_code: parsed.data.code,
  });
  if (error) {
    return { success: false, message: "The invitation could not be redeemed. Check the code and try again." };
  }
  const memberships = response as { care_profile_id: string }[] | null;
  if (!memberships?.length) {
    return { success: false, message: "This invitation is invalid, expired, already used, or not available to this account." };
  }

  revalidatePath("/dashboard");
  revalidatePath("/patients");
  revalidatePath("/team");
  return { success: true };
}

export async function updateMemberPermissions(input: unknown): Promise<ActionResult> {
  const parsed = memberPermissionsSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: "The permission selection was invalid." };
  }
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return { success: false, message: "Sign in again before changing access." };
  }

  const { error } = await supabase.rpc("set_care_member_permissions", {
    p_membership_id: parsed.data.membershipId,
    p_permissions: parsed.data.permissions,
  });
  if (error) {
    return { success: false, message: "Only the care-profile owner can change these permissions." };
  }
  revalidatePath("/team");
  revalidatePath("/dashboard");
  return { success: true };
}

const revokeMembershipSchema = z.object({ membershipId: z.string().uuid() });

export async function revokeCareMembership(input: unknown): Promise<ActionResult> {
  const parsed = revokeMembershipSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: "The membership selection was invalid." };
  }
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return { success: false, message: "Sign in again before removing access." };
  }

  const { error } = await supabase.rpc("revoke_care_membership", {
    p_membership_id: parsed.data.membershipId,
  });
  if (error) {
    return { success: false, message: "Only the care-profile owner can remove this membership." };
  }
  revalidatePath("/team");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function createCareInvitation(
  input: unknown
): Promise<
  | { success: true; code: string; expiresAt: string }
  | { success: false; message: string }
> {
  const parsed = invitationSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: "Select a valid invitation role." };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return { success: false, message: "Sign in again before inviting a care team member." };
  }

  const { data: response, error } = await supabase
    .rpc("create_care_invitation", {
      p_care_profile_id: parsed.data.careProfileId,
      p_intended_role: parsed.data.role,
      p_expires_in_hours: 72,
    })
    .returns<{ code: string; expires_at: string }>()
    .single();
  const data = response as { code: string; expires_at: string } | null;

  if (error || !data) {
    return {
      success: false,
      message: "Only an active owner can issue an invitation for this care profile.",
    };
  }

  revalidatePath("/team");
  return { success: true, code: data.code, expiresAt: data.expires_at };
}
