# Addendum — nearform_todo_app

Depth captured for downstream consumers (PRD, architecture, sprint planning, QA).
The brief itself stays lean; the source-of-record detail lives here.

---

## A. Supplied PRD (verbatim, user-provided)

The goal of this project is to design and build a simple full-stack Todo application that allows
individual users to manage personal tasks in a clear, reliable, and intuitive way. The application
should focus on clarity and ease of use, avoiding unnecessary features or complexity, while providing
a solid technical foundation that can be extended in the future if needed.

From a user perspective, the application should allow the creation, visualization, completion, and
deletion of todo items. Each todo represents a single task and should include a short textual
description, a completion status, and basic metadata such as creation time. Users should be able to
immediately see their list of todos upon opening the application and interact with it without any
onboarding or explanation.

The frontend experience should be fast and responsive, with updates reflected instantly when the user
performs an action such as adding or completing a task. Completed tasks should be visually
distinguishable from active ones to clearly communicate status at a glance. The interface should work
well across desktop and mobile devices and include sensible empty, loading, and error states to
maintain a polished user experience.

The backend will expose a small, well-defined API responsible for persisting and retrieving todo data.
This API should support basic CRUD operations and ensure data consistency and durability across user
sessions. While authentication and multi-user support are not required for the initial version, the
architecture should not prevent these features from being added later if the product evolves.

From a non-functional standpoint, the system should prioritize simplicity, performance, and
maintainability. Interactions should feel instantaneous under normal conditions, and the overall
solution should be easy to understand, deploy, and extend by future developers. Basic error handling is
expected both client-side and server-side to gracefully handle failures without disrupting the user flow.

The first version of the application intentionally excludes advanced features such as user accounts,
collaboration, task prioritization, deadlines, or notifications. These capabilities may be considered in
future iterations, but the initial delivery should remain focused on delivering a clean and reliable
core experience.

Success for this project will be measured by the ability of a user to complete all core task-management
actions without guidance, the stability of the application across refreshes and sessions, and the clarity
of the overall user experience. The final result should feel like a complete, usable product despite its
deliberately minimal scope.

---

## B. Supplied Activity Spec (the training exercise this project fulfills)

**Overall goal:** Apply Spec-Driven Development via BMAD to build a complete, well-tested, deployable app.
Todo app is the suggested project; alternatives allowed if methodology is used correctly. Deliverable must
be shared in the next training step. Support channel: `#aine-training-support` on Slack.

### Step 1 — Initialize BMAD and Generate Specifications
- Project Brief & PRD refinement (PM persona)
- Architecture design: technical architecture, API contracts, component structure (Architect persona)
- Story creation: well-defined stories with acceptance criteria
- Test strategy: unit / integration / E2E scenarios defined as part of story definitions

### Step 2 — Build the Application (QA integrated from day one)
- **Project Setup:** structure for frontend, backend, tests. Stand up test infra immediately —
  Jest/Vitest (unit), Playwright (E2E); wire test commands into package.json.
- **Backend:** CRUD API for todos with validation + error handling. Write integration tests per endpoint
  as built. Validate API contracts (Postman MCP or similar).
- **Frontend:** todo-management UI with state management. Write component tests as built.
  Use Chrome DevTools MCP to debug/inspect.
- **E2E:** cover all user journeys — create, complete, delete, empty state, error handling (Playwright MCP).

### Step 3 — Containerize with Docker Compose
- **Dockerfiles:** frontend + backend, multi-stage builds, non-root users, health checks.
- **docker-compose.yml:** orchestrate all containers (app + DB if needed), networking, volumes, env config.
- **Health checks:** health endpoints; containers report status; logs via `docker-compose logs`.
- **Environment config:** dev/test via env vars and compose profiles.

### Step 4 — Quality Assurance Activities
- **Test coverage:** analyze gaps; target ≥70% meaningful coverage.
- **Performance testing:** Chrome DevTools MCP; document issues.
- **Accessibility:** Lighthouse / axe-core (automatable via Playwright); WCAG AA.
- **Security review:** review for XSS, injection, etc.; document findings + remediations.

### Deliverables
BMAD artifacts (brief, architecture docs, stories w/ ACs) · working Todo app (FE+BE or CLI) ·
unit+integration+E2E suites · Dockerfiles + docker-compose.yml · QA reports (coverage, a11y, security) ·
documentation of how BMAD guided implementation.

### AI Integration Documentation (maintain throughout)
Agent usage & best prompts · MCP server usage · test-generation help & misses · AI debugging cases ·
limitations encountered / where human expertise was critical.

### Success Criteria (targets)
| Criterion | Target |
|---|---|
| Phase 1–2 deliverables | All activities completed with documented learnings |
| Working application | Todo app fully functional, all CRUD operations |
| Test coverage | ≥70% meaningful code coverage |
| E2E tests | ≥5 passing Playwright tests |
| Docker deployment | Runs via `docker-compose up` |
| Accessibility | Zero critical WCAG violations |
| Documentation | README with setup instructions + AI integration log |

---

## C. User-added feature — three.js "todo in space"

Cosmetic delighter, explicitly for fun and to demonstrate BMAD handling a non-CRUD feature:
- Todo list rendered as if **floating in space**.
- Background: **cubes drifting past like stars** (animated field), via **three.js**.
- Must not compromise the core success criteria (performance budget, accessibility, responsiveness).
  Needs a reduced-motion / fallback consideration for a11y (WCAG) — flag for UX/architecture.
