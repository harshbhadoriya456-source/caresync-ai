# CareSync AI database security tests

Run only against a disposable local Supabase database with no production data.

## Automated pgTAP coverage

`security_hardening.test.sql` creates deterministic Auth fixtures inside a transaction and rolls them back after testing. It covers:

- Unauthenticated table access and unrelated-patient reads.
- Medication writes without explicit grants.
- Owner transfer to a current member, one-owner consistency, previous-owner downgrade, transfer audit, rejection of unauthorized callers, and rejection of unrelated targets.
- Last-active-owner deletion prevention; explicit profile closure followed by account deletion.
- Healthcare record and audit retention after account deletion, creator-FK nulling, and revoked membership retention.
- Expired invitations, single-use/replay behavior, intended-role assignment, owner-role invitation rejection, per-user redemption throttling, role escalation, and audit-log write protection.

Run after applying all migrations to a local stack:

```powershell
supabase start
supabase status
supabase test db
```

## Automated concurrent redemption test

`run_concurrent_redemption.ps1` prepares isolated test users and a hashed test invitation, runs two authenticated pgbench clients concurrently, and asserts that exactly one membership was created and the invitation was consumed. It leaves the deterministic fixtures in the disposable database so reruns can reset and reuse them.

```powershell
$env:DATABASE_URL = "<local PostgreSQL connection string from supabase status>"
.\supabase\tests\run_concurrent_redemption.ps1
```

Requires `psql` and `pgbench` from PostgreSQL client tools and a running **local** Supabase database. The test token is a fixed test-only value; setup stores only its SHA-256 digest.

## Additional checks

- Inspect `pg_policies`, `pg_class.relrowsecurity`, and effective table/function grants. Confirm all application tables, including the private rate-limit table, have RLS enabled and no unintended `anon`/`PUBLIC` grants.
- Confirm authenticated clients cannot directly insert, update, or delete memberships, invitations, audit logs, or rate-limit state.
- Verify closed profiles remain readable to existing active members but healthcare writes, new invitations, and ownership transfers fail.
- Confirm no production migration was applied as part of these tests.
