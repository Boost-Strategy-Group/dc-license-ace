/**
 * BBS (Business BOOST! Society) connector — STUB
 *
 * BBS lives in a separate Lovable project ("BBS Community Builder Pro").
 * When a SuperAdmin publishes a course with target_type = 'bbs', we POST
 * to BBS's intake webhook signed with BBS_WEBHOOK_SECRET.
 *
 * This stub no-ops + logs until the BBS endpoint and shared secret exist.
 */

export type BbsPublishPayload = {
  courseId: string;
  title: string;
  summary: string;
  source: string;
  rtiHours?: number;
};

export async function publishCourseToBbs(payload: BbsPublishPayload): Promise<{ ok: boolean; note: string }> {
  // TODO: real implementation
  // const url = process.env.BBS_WEBHOOK_URL;
  // const secret = process.env.BBS_WEBHOOK_SECRET;
  // sign + POST JSON
  // eslint-disable-next-line no-console
  console.log("[BBS stub] publishCourseToBbs", payload);
  return { ok: true, note: "stub: not yet wired to BBS" };
}
