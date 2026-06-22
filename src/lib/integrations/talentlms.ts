/**
 * TalentLMS connector — STUB
 *
 * Docs: https://help.talentlms.com/hc/en-us/articles/9651527213468
 *
 * Imported courses land in `courses` with source = 'talentlms' and flow
 * through the standard `course_publications` pipeline.
 *
 * No credentials yet — every call returns a "not connected" result until
 * a SuperAdmin configures domain + API key on /admin/integrations/talentlms.
 */

export type TalentLmsConfig = { domain: string; apiKey: string };

export type TalentLmsCourse = {
  externalId: string;
  title: string;
  description?: string;
  coverUrl?: string;
};

export async function importCatalog(_cfg: TalentLmsConfig | null): Promise<TalentLmsCourse[]> {
  if (!_cfg) return [];
  // TODO: GET https://{domain}.talentlms.com/api/v1/courses
  // eslint-disable-next-line no-console
  console.log("[TalentLMS stub] importCatalog");
  return [];
}

export async function syncEnrollment(_cfg: TalentLmsConfig | null, _userEmail: string, _externalCourseId: string) {
  if (!_cfg) return { ok: false, note: "not connected" };
  // eslint-disable-next-line no-console
  console.log("[TalentLMS stub] syncEnrollment");
  return { ok: true };
}

export async function recordCompletion(_cfg: TalentLmsConfig | null, _userEmail: string, _externalCourseId: string) {
  if (!_cfg) return { ok: false, note: "not connected" };
  // eslint-disable-next-line no-console
  console.log("[TalentLMS stub] recordCompletion");
  return { ok: true };
}
