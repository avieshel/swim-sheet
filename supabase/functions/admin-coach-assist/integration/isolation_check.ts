// End-to-end isolation check for the admin coach-assist flow.
//
// This is NOT part of `deno task test` (it needs a live Supabase). Run it
// against a local stack with:  supabase start && deno task integration
//
// It proves the core safety property: an owner write to Coach A's tenant is
// delivered to Coach A (via the same query shape the PWA's sync pull uses) and
// is invisible to Coach B — at both the function-query layer and the RLS layer.
//
// The owner is simulated here by the service-role client writing through the
// REAL admin service (normalizeScopedWrite + resolveCoachOrg + materializeDraft),
// exactly as the deployed function does. Local dev keys are used as a fallback
// only; override with env vars to target another stack.

import { createClient } from "npm:@supabase/supabase-js@2";
import type { SessionDraftV1 } from "../shared/sessionDraft/types.ts";
import {
  resolveCoachOrg,
  getCoachData,
  materializeDraft,
} from "../service/adminService.ts";

type ServiceRoleClient = {
  from: ReturnType<typeof createClient>["from"];
  auth: { admin: { createUser: ReturnType<typeof createClient>["auth"]["admin"]["createUser"] } };
};

const URL = Deno.env.get("SUPABASE_URL") ?? "http://127.0.0.1:54321";
const ANON = Deno.env.get("SUPABASE_ANON_KEY") ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const authOpts = { auth: { persistSession: false, autoRefreshToken: false } };
const svc = createClient(URL, SERVICE, authOpts) as unknown as ServiceRoleClient;

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`);
  console.log(`  ok: ${msg}`);
}

async function createCoach(email: string, password: string): Promise<string> {
  const { data, error } = await svc.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: email },
  });
  if (error) throw new Error(`createUser ${email}: ${error.message}`);
  const id = data.user.id;

  // The coach creates their own personal organization (mirrors app signup).
  const userClient = createClient(URL, ANON, authOpts);
  const { error: signInErr } = await userClient.auth.signInWithPassword({ email, password });
  if (signInErr) throw new Error(`signIn ${email}: ${signInErr.message}`);
  const { error: orgErr } = await userClient.rpc("create_organization", {
    p_name: `${email} personal`,
  });
  if (orgErr) throw new Error(`create_organization ${email}: ${orgErr.message}`);
  return id;
}

async function main(): Promise<void> {
  // Run-unique emails keep the check repeatable against a persistent local DB
  // (each run creates fresh coaches + orgs, so resolveCoachOrg stays one-to-one).
  const runId = Date.now();
  const emailA = `coach-a-${runId}@example.com`;
  const emailB = `coach-b-${runId}@example.com`;
  const coachA = await createCoach(emailA, "password123");
  const coachB = await createCoach(emailB, "password123");

  const orgA = await resolveCoachOrg(svc, coachA);
  const orgB = await resolveCoachOrg(svc, coachB);
  assert(orgA !== orgB, "coach A and coach B resolve to distinct orgs");

  // Owner writes a session + drill into Coach A's tenant (real service path).
  const draft: SessionDraftV1 = {
    session: { name: "Owner-assisted Session" },
    drills: [
      { name: "Warmup 4x100", repeatCount: 1, items: [{ distance: 100, stroke: "freestyle", repeatCount: 4 }] },
    ],
  };
  const { sessionId, drillIds } = await materializeDraft(svc, orgA, coachA, draft);
  assert(!!sessionId && drillIds.length === 1, "materializeDraft created one session + one drill");

  // The row is stamped with the TARGET coach's org and identity, never the owner's.
  const { data: row, error: readErr } = await svc
    .from("sessions")
    .select("organization_id, created_by, visibility, name")
    .eq("id", sessionId)
    .single();
  if (readErr) throw new Error(`read session: ${readErr.message}`);
  assert(row.organization_id === orgA, "session.organization_id === coach A's org");
  assert(row.created_by === coachA, "session.created_by === coach A (not the owner)");
  assert(row.visibility === "private", "session.visibility === 'private'");

  // Function-level isolation: querying Coach B's tenant never returns A's row.
  const bData = await getCoachData(svc, orgB);
  assert(!bData.sessions.some((s) => (s as { id: string }).id === sessionId), "org B getCoachData excludes A's session");

  // PULL-level isolation mirroring SupabaseSyncTransport.pull: anon key + coach JWT,
  // filtered by organization_id. Coach A sees it; Coach B does not.
  const aClient = createClient(URL, ANON, authOpts);
  await aClient.auth.signInWithPassword({ email: emailA, password: "password123" });
  const { data: aSessions, error: aErr } = await aClient
    .from("sessions")
    .select("id")
    .eq("organization_id", orgA);
  if (aErr) throw new Error(`A pull: ${aErr.message}`);
  assert(
    (aSessions ?? []).some((s) => s.id === sessionId),
    "coach A's pull includes the owner-assisted session",
  );

  const bClient = createClient(URL, ANON, authOpts);
  await bClient.auth.signInWithPassword({ email: emailB, password: "password123" });
  const { data: bAll, error: bErr } = await bClient.from("sessions").select("id");
  if (bErr) throw new Error(`B pull: ${bErr.message}`);
  assert(!bAll.some((s) => s.id === sessionId), "coach B cannot read coach A's session (RLS isolation)");
  const { data: bInA } = await bClient.from("sessions").select("id").eq("organization_id", orgA);
  assert((bInA ?? []).length === 0, "coach B querying org A returns nothing");

  console.log("\nALL ISOLATION ASSERTIONS PASSED");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  Deno.exit(1);
});
