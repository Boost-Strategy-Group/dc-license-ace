## Two fixes

### 1. "Open builder" button doesn't navigate
On `/admin/courses`, the card uses `<Link><Button>...</Button></Link>`. That nests a `<button>` inside an `<a>`, which is invalid HTML and prevents clicks from triggering navigation in most browsers.

**Fix:** make the Button render *as* the Link using `asChild` so a single `<a>` is rendered (no nested button). Same fix applied to the "AI Course Factory" link in the same header. Apply to any other `<Link><Button>` pairs found in admin course/builder pages.

### 2. AI Course Factory: review & approve before persisting

**Today:** The form posts to `generateCourseFromAi`, which immediately inserts the course, modules, lessons, learning objectives, final exam, and pre/post surveys, then redirects to the builder. No approval step.

**Change to a two-step flow:**

1. **Step 1 — Draft the plan.** Split the server function into:
   - `draftCourseFromAi(input)` — calls Gemini, returns the structured plan JSON (description, CEU, learning objectives, modules + lessons, final quiz, pre/post survey prompts). Writes **nothing** to the database except an `ai_generations` row for audit.
   - `createCourseFromPlan({ input, plan })` — accepts the (possibly edited) plan and performs all the inserts that `generateCourseFromAi` does today. Returns `{ courseId, slug }`.

2. **Step 2 — Review screen on `/admin/ai-factory`:**
   - After "Generate course draft", show a review panel instead of redirecting:
     - Course description (editable textarea)
     - CEU value (editable)
     - Learning objectives (editable list)
     - Modules → lessons outline (collapsible; each title/summary/kind editable; lessons can be deleted)
     - Final exam items (stem + options + correct + rationale; editable)
     - Pre / Post survey prompts (editable)
   - Three actions:
     - **Regenerate** — re-call `draftCourseFromAi` with the original brief (or an optional "refinement notes" field)
     - **Approve & create course** — call `createCourseFromPlan` with the edited plan, then redirect to `/admin/courses/$courseId`
     - **Cancel** — clears the draft, returns to the brief form

3. **State handling:** keep the draft in component state only (not persisted) until the user approves; matches the project rule that go-lives require explicit approval.

### Verification (after build mode)

Drive Playwright as `admin@boost.test`:
- Click an existing course card → confirm the builder opens (URL changes, builder UI renders)
- AI Factory: submit brief → review screen appears, no `courses` row written yet
- Edit a module title in the review → click Approve → `courses` row + correct modules/lessons exist; redirect to builder lands on the new course
- Click Cancel from review → no rows created
- Run `psql` cleanup to delete the QA test course

### Files touched
- `src/lib/ai-factory.functions.ts` — split into `draftCourseFromAi` + `createCourseFromPlan`; keep `generateCourseFromAi` as a thin wrapper for backward compat or remove it (only caller is the factory page)
- `src/routes/_app/admin.ai-factory.tsx` — add review/approve UI and state machine
- `src/routes/_app/admin.courses.tsx` — `asChild` fix on Link + Button
- (audit) other admin course pages for the same `<Link><Button>` pattern

### Out of scope
- Needs assessment flow (already has its own page; not changing)
- AI work product generation
- New AI features beyond review/approval