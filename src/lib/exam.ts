// Shared, client-safe ASWB Clinical exam constants.
export const CONTENT_AREAS = [
  {
    key: "human_development",
    label: "Human Development, Diversity & Behavior",
    short: "Development & Diversity",
    blueprintPct: 24,
  },
  {
    key: "assessment_diagnosis",
    label: "Assessment & Diagnosis",
    short: "Assessment & Diagnosis",
    blueprintPct: 30,
  },
  {
    key: "psychotherapy_interventions",
    label: "Psychotherapy, Clinical Interventions & Case Management",
    short: "Interventions",
    blueprintPct: 27,
  },
  {
    key: "ethics_values",
    label: "Professional Values & Ethics",
    short: "Ethics",
    blueprintPct: 19,
  },
] as const;

export type ContentAreaKey = (typeof CONTENT_AREAS)[number]["key"];

export const areaLabel = (k: string) =>
  CONTENT_AREAS.find((a) => a.key === k)?.label ?? k;
export const areaShort = (k: string) =>
  CONTENT_AREAS.find((a) => a.key === k)?.short ?? k;

export const MOCK_TOTAL = 170;
export const MOCK_MINUTES = 240;

export type QuestionRow = {
  id: string;
  content_area: ContentAreaKey;
  sub_topic: string | null;
  stem: string;
  choices: string[];
  correct_index: number;
  rationale: string;
  difficulty: number;
  source: string | null;
  status: "draft" | "published";
};
