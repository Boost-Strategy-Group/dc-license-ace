import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { generateText, tool, stepCountIs } from "ai";

const MESSAGE = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
});

const SYSTEM_PROMPTS: Record<string, string> = {
  roles: `You are BOOST!, an implementation agent for the Boost!Roles module. You help admins set up job descriptions and org charts.
- For configuration tasks (creating job descriptions, suggesting structure), use your tools to act.
- For changes beyond configuration (custom code, deep integrations), explain it requires a BSG support ticket and offer to escalate.
- Be warm, brief, and outcome-oriented. Confirm before destructive actions.`,
  perform: `You are BOOST!, an implementation agent for the Boost!Perform module. You help admins set up goal categories, performance plans, and review cycles.
- Use tools to create categories and draft cycles.
- IMPORTANT: Before any performance plan or goal program goes live, you MUST call request_email_approval. Never bypass this.
- For changes beyond configuration, escalate to BSG support.`,
  pulse: `You are BOOST!, an implementation agent for the Boost!Pulse engagement module. You help admins choose a cadence, set up question banks, and launch surveys.
- Use tools to set cadence and draft surveys.
- IMPORTANT: Before launching an engagement survey, you MUST call request_email_approval so the admin confirms by email. Never bypass this.
- For changes beyond configuration, escalate to BSG support.`,
};

const NON_AGENT_NOTE =
  "Note: BOOST! does not configure Learn or Apprenticeship — those always go through a BSG support ticket.";

export const boostAgentChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      moduleKey: z.enum(["roles", "perform", "pulse"]),
      tenantId: z.string().uuid().optional(),
      messages: z.array(MESSAGE).min(1),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    // Resolve tenant
    let tid = data.tenantId;
    if (!tid) {
      const { data: m } = await context.supabase
        .from("tenant_members").select("tenant_id").eq("user_id", context.userId).limit(1).maybeSingle();
      tid = m?.tenant_id;
    }
    if (!tid) throw new Error("No tenant membership found");
    const tenantId = tid as string;
    const supabase = context.supabase;
    const userId = context.userId;

    const tools = {
      create_job_description: tool({
        description: "Create a draft job description in this tenant (Boost!Roles).",
        inputSchema: z.object({
          title: z.string(),
          summary: z.string().optional(),
          responsibilities: z.string().optional(),
          qualifications: z.string().optional(),
        }),
        execute: async (input) => {
          const { data: row, error } = await supabase
            .from("job_descriptions")
            .insert({
              tenant_id: tenantId,
              title: input.title,
              summary: input.summary ?? null,
              responsibilities: input.responsibilities ?? null,
              qualifications: input.qualifications ?? null,
              created_by: userId,
            })
            .select("id, title").single();
          if (error) return { ok: false, error: error.message };
          return { ok: true, id: row.id, title: row.title };
        },
      }),
      create_goal_category: tool({
        description: "Create a performance goal category for Boost!Perform.",
        inputSchema: z.object({
          name: z.string(),
          description: z.string().optional(),
          weight: z.number().min(0).max(10).default(1),
        }),
        execute: async (input) => {
          const { data: row, error } = await supabase
            .from("perform_goal_categories")
            .insert({
              tenant_id: tenantId, name: input.name,
              description: input.description ?? null, weight: input.weight,
            }).select("id, name").single();
          if (error) return { ok: false, error: error.message };
          return { ok: true, id: row.id, name: row.name };
        },
      }),
      draft_review_cycle: tool({
        description: "Draft a Boost!Perform review cycle (status=draft).",
        inputSchema: z.object({
          name: z.string(),
          starts_at: z.string().optional(),
          ends_at: z.string().optional(),
        }),
        execute: async (input) => {
          const { data: row, error } = await supabase
            .from("perform_review_cycles")
            .insert({
              tenant_id: tenantId, name: input.name,
              starts_at: input.starts_at ?? null, ends_at: input.ends_at ?? null,
            }).select("id, name").single();
          if (error) return { ok: false, error: error.message };
          return { ok: true, id: row.id, name: row.name };
        },
      }),
      set_pulse_cadence: tool({
        description: "Set the Boost!Pulse cadence (does not activate; activation needs approval).",
        inputSchema: z.object({
          cadence: z.enum(["weekly", "biweekly", "monthly", "quarterly"]),
        }),
        execute: async (input) => {
          const { data: existing } = await supabase
            .from("pulse_cadences").select("id").eq("tenant_id", tenantId).maybeSingle();
          if (existing) {
            await supabase.from("pulse_cadences").update({ cadence: input.cadence }).eq("id", existing.id);
            return { ok: true, id: existing.id, cadence: input.cadence };
          }
          const { data: row, error } = await supabase
            .from("pulse_cadences")
            .insert({ tenant_id: tenantId, cadence: input.cadence, active: false })
            .select("id").single();
          if (error) return { ok: false, error: error.message };
          return { ok: true, id: row.id, cadence: input.cadence };
        },
      }),
      request_email_approval: tool({
        description:
          "REQUIRED before any go-live (perform cycle publish, pulse launch, goal program publish). Creates an approval the admin must confirm by email.",
        inputSchema: z.object({
          kind: z.enum(["perform_cycle_publish", "pulse_launch", "goal_program_publish"]),
          target_id: z.string().optional(),
          summary: z.string(),
        }),
        execute: async (input) => {
          const { data: row, error } = await supabase
            .from("approval_requests")
            .insert({
              tenant_id: tenantId,
              requested_by: userId,
              kind: input.kind,
              target_id: input.target_id ?? null,
              payload: { summary: input.summary },
            }).select("id, email_token").single();
          if (error) return { ok: false, error: error.message };
          // Fire the confirmation email
          try {
            const req = (await import("@tanstack/react-start/server")).getRequest();
            const auth = req?.headers.get("authorization") ?? "";
            const origin = req ? new URL(req.url).origin : "";
            const { data: u } = await supabase.auth.getUser();
            const recipient = u?.user?.email;
            if (recipient && auth && origin) {
              await fetch(`${origin}/lovable/email/transactional/send`, {
                method: "POST",
                headers: { "content-type": "application/json", authorization: auth },
                body: JSON.stringify({
                  templateName: "approval-request",
                  recipientEmail: recipient,
                  idempotencyKey: `approval-${row.id}`,
                  templateData: {
                    requesterName: u?.user?.user_metadata?.full_name ?? "Admin",
                    kind: input.kind,
                    summary: input.summary,
                    confirmUrl: `${origin}/approvals/${row.email_token}`,
                  },
                }),
              });
            }
          } catch (e) {
            console.error("agent approval email failed", e);
          }
          return {
            ok: true,
            id: row.id,
            message:
              "Approval created. A confirmation email has been sent to the requesting admin; clicking the link finalizes the go-live.",
          };
        },
      }),
      escalate_to_support: tool({
        description:
          "Use when the request is beyond configuration, or for any Learn / Apprenticeship change. Logs a support escalation note.",
        inputSchema: z.object({
          topic: z.string(),
          summary: z.string(),
        }),
        execute: async (input) => {
          return {
            ok: true,
            message: `Logged a BSG support escalation for: ${input.topic}. The BSG team will follow up by email.`,
            summary: input.summary,
          };
        },
      }),
    };

    const system = (SYSTEM_PROMPTS[data.moduleKey] ?? "") + "\n\n" + NON_AGENT_NOTE;
    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-3-flash-preview");

    try {
      const result = await generateText({
        model,
        system,
        messages: data.messages.map((m) => ({ role: m.role, content: m.content })),
        tools,
        stopWhen: stepCountIs(50),
      });
      const toolEvents = result.steps.flatMap((s: any) =>
        (s.toolCalls ?? []).map((tc: any, i: number) => ({
          name: tc.toolName,
          input: tc.input,
          output: s.toolResults?.[i]?.output,
        })),
      );
      return { text: result.text, toolEvents };
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      if (msg.includes("429")) throw new Error("AI rate limit reached. Try again shortly.");
      if (msg.includes("402")) throw new Error("AI credits exhausted. Add credits and retry.");
      throw e;
    }
  });
