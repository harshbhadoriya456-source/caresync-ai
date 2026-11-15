# CareSync AI database lifecycle and security

## Account deletion and care-profile closure

Accounts are deleted only through Supabase Auth after the database's `auth.users` delete trigger validates the lifecycle:

- Deleting the only active owner of an active care profile is rejected. Ownership must first be transferred to an existing active member, or the owner must explicitly close the profile.
- `close_care_profile` is an owner-only soft-close RPC. It records closure metadata, revokes unused invitations, and retains healthcare and audit rows. Existing active members retain read access; healthcare writes and invitation redemption/issuance are blocked for closed profiles.
- Ownership transfer is an atomic, profile-row-locked RPC. It promotes an existing active member, demotes the prior owner to a permissionless caretaker, and appends an ownership-transfer audit event. Closed profiles cannot be transferred.
- On permitted Auth account deletion, memberships are revoked before the user foreign key is nulled. Creator/revoker/closer references are nulled rather than cascading into healthcare records. `profiles` is the only user-owned profile data removed by cascade.
- Audit entries remain. `actor_id` is nulled by its Auth foreign key, while `actor_subject_id` and `subject_id` intentionally retain the pseudonymous Auth UUID for attribution. Those UUIDs are not foreign keys and require an approved retention/de-identification policy before any purge.

Care profiles have no client DELETE policy or table DELETE grant. Hard profile deletion is not the supported lifecycle: the audit-log foreign key uses `ON DELETE RESTRICT`, while child-row cascades are only a referential action if a privileged database operator removes a profile after first resolving its audit history. Use soft closure in normal operations.

## Foreign-key deletion behavior

| Relationship | `ON DELETE` | Effect |
|---|---|---|
| `profiles.id` → `auth.users.id` | `CASCADE` | Deletes the user's personal app profile only. |
| `care_profiles.created_by`, `care_profiles.closed_by` → `auth.users.id` | `SET NULL` | Preserves the care profile and closure state. |
| `care_memberships.care_profile_id` → `care_profiles.id` | `CASCADE` | Memberships are children of a care profile; normal client deletion is unavailable and audit history restricts hard deletion. |
| `care_memberships.user_id` → `auth.users.id` | `SET NULL` | The delete trigger first marks the membership revoked; the CHECK constraint rejects an active orphan membership. |
| `medications.care_profile_id` → `care_profiles.id` | `CASCADE` | Referential cleanup only for privileged hard profile deletion; ordinary profile closure preserves medications. |
| `medications.created_by` → `auth.users.id` | `SET NULL` | Retains the medication if its creator deletes their account. |
| `medication_events.medication_id` → `medications.id` | `RESTRICT` | A medication with event history cannot be deleted. |
| `medication_events.recorded_by` → `auth.users.id` | `SET NULL` | Preserves the medication event if its recorder deletes their account. |
| `appointments.care_profile_id` → `care_profiles.id` | `CASCADE` | Referential cleanup only for privileged hard profile deletion; closure preserves appointments. |
| `appointments.created_by` → `auth.users.id` | `SET NULL` | Retains the appointment if its creator deletes their account. |
| `care_invitations.care_profile_id` → `care_profiles.id` | `CASCADE` | Referential cleanup only for privileged hard profile deletion. |
| `care_invitations.created_by`, `care_invitations.revoked_by` → `auth.users.id` | `SET NULL` | Keeps invitation metadata without retaining an FK to a deleted account. |
| `audit_logs.care_profile_id` → `care_profiles.id` | `RESTRICT` | Preserves audit history by preventing deletion of a profile with audit entries. |
| `audit_logs.actor_id` → `auth.users.id` | `SET NULL` | Retains the event; pseudonymous subject columns preserve attribution. |
| `care_invitation_redemption_limits.user_id` → `auth.users.id` | `CASCADE` | Removes per-user throttling state only; it is not audit or healthcare data. |

Audit history is append-only through the authenticated API and is not purged by these migrations. No formal regulatory or business retention period was supplied; preserve it until a reviewed retention policy defines lawful purge/de-identification behavior.

## Invitation handling

- Invitation codes contain 256 bits of cryptographic randomness and are returned by the owner-only issuance RPC once. Only a SHA-256 hash is stored.
- Redemption locks the active care profile and invitation row, checks expiry/revocation/use state, inserts only the intended role, and marks the invitation used in the same transaction. Concurrent requests serialize; only one can succeed.
- Authenticated redemption attempts are limited to 10 per 15-minute window per user. Invalid, expired, revoked, replayed, and throttled codes return no rows so failed-attempt counters commit without exposing token validity through detailed errors.
- Invitation cancellation is owner-only. Profile closure revokes unused invitations. Invitations are bearer credentials not bound to an email; the owner must deliver them through an appropriate channel.
- The database does not log the generated code. The application must not log the RPC response or persist the code in browser storage, analytics, or application tables; deliver it once and discard it after acceptance.

## Privileged functions

`SECURITY DEFINER` is used only where required for RLS-safe membership checks, trigger-owned writes, rate limiting, and atomic owner/invitation/account lifecycle operations. These functions use a fixed `search_path`, fully qualify extension calls, revoke default `PUBLIC`/`anon` execution, and grant client execution only to `authenticated` where required. `public` and `extensions` schema `CREATE` privileges are revoked from `PUBLIC`, `anon`, and `authenticated`. Trigger-only functions have no client `EXECUTE` grant.
