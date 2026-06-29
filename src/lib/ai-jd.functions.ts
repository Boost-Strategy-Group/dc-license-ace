import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const FEATURE = "job_description";

const Input = z.object({
  tenant_id: z.string().uuid(),
  user_id: z.string().uuid(),
  job_title: z.string().min(1),
  department: z.string().default(""),
  pay_band_id: z.string().default(""),
  naics_code: z.string().default(""),
  responsibilities: z.array(z.string()).default([]),
  required_skills: z.array(z.string()).default([]),
  nice_to_have: z.array(z.string()).default([]),
});

export type JobDescriptionDraft = {
  title: string;
  summary: string;
  responsibilities: string[];
  requirements: string[];
  preferred_qualifications: string[];
  benefits_placeholder: string;
  dei_statement: string;
};

// Job Description AI Drafter (Boost!Roles). Returns a draft only — the user must
// publish through the existing JD workflow.
export const generateJobDescription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => Input.parse(i))
  .handler(async ({ data, context }) => {
    const { createOpenAIClient, chatJson, logAiUsage, MODELS } = await import("./openai.server");

    const system =
      "You are an HR expert and DEI-conscious job description writer. Create a compelling, inclusive job description that attracts diverse candidates. Use gender-neutral language. Avoid jargon. Lead with impact, not requirements.";
    const user = `Draft a job description.

Job title: ${data.job_title}
Department: ${data.department || "(unspecified)"}
NAICS code: ${data.naics_code || "(unspecified)"}
Responsibilities:
${data.responsibilities.map((r) => `- ${r}`).join("\n") || "- (none provided)"}
Required skills:
${data.required_skills.map((s) => `- ${s}`).join("\n") || "- (none provided)"}
Nice to have:
${data.nice_to_have.map((s) => `- ${s}`).join("\n") || "- (none)"}

Return JSON:
{
  "title": "string",
  "summary": "string",
  "responsibilities": ["string", ...],
  "requirements": ["string", ...],
  "preferred_qualifications": ["string", ...],
  "benefits_placeholder": "string",
  "dei_statement": "string"
}`;

    const { data: output, usage } = await chatJson<JobDescriptionDraft>({
      client: createOpenAIClient(),
      model: MODELS.MINI,
      system,
      user,
    });

    await logAiUsage({
      tenant_id: data.tenant_id,
      user_id: context.userId,
      feature: FEATURE,
      model: MODELS.MINI,
      usage,
      metadata: {
        tenant_id: data.tenant_id,
        user_id: context.userId,
        feature: FEATURE,
        job_title: data.job_title,
        pay_band_id: data.pay_band_id,
      },
    });

    return { draft: output };
  });
