# Dial360 — Admin Dashboard Clickable Prototype

A **clickable, static HTML mockup** of the Dial360 manager / admin console, built to give
stakeholders a navigable, realistic reference of the full information architecture before the
real product is built.

> ⚠️ **This is a prototype, not a product.** No backend, no real auth, no live data, no RBAC.
> Everything is hard-coded dummy content designed to look plausible. A `Prototype` badge is
> shown on every admin screen so it can't be mistaken for production.

## Live demo (GitHub Pages)

The repo is served as flat HTML from the root, so GitHub Pages lands on **Overview** (`index.html`).
Every page is independently deep-linkable.

## Stack

- Vanilla **HTML5 + CSS + minimal vanilla JS** — no frameworks, no bundler, no build step.
- Charts are **pre-rendered inline SVG** (no charting library, zero runtime dependencies).
- Only optional external resource: the Inter web font from Google Fonts.
- Single shared stylesheet (`css/styles.css`) and one shared script (`js/app.js`) drive every page.

## Flow

`index.html` (marketing homepage) → **Login / Get started** → `sso.html` (mocked SSO) →
`newsfeed.html` (admin console landing page). `login.html` offers an email/password alternative
that also lands on the newsfeed. The top bar carries a **Launch Hub** button — where an agent
would open the live calling workstation (a separate app, deliberately not mocked).

## Pages / routes

| File | Screen |
|---|---|
| `index.html` | Spoofed dial360.ai marketing homepage (Login + Get started) |
| `sso.html` | Mocked single sign-on (email → identity provider → newsfeed) |
| `login.html` | Facade email/password login — also lands on the newsfeed |
| `newsfeed.html` | Company newsfeed — shoutouts, quote of the day, updates, birthdays (landing page after sign-in) |
| `dashboard.html` | Admin Overview |
| `call-centre-dashboard.html` | Live call centre floor view (queue, agent status, service level) |
| `my-performance.html` | An agent's own performance overview (Agent role only) |
| `interactions.html` | Unified interaction log (call / email / chat) — no sidebar tab; reached via "View all interactions" links on Dashboard / My Team Performance / Interaction Stats |
| `interaction.html` | Single interaction detail (AI wrap-up, transcript, QA) |
| `qa.html` | Automated QA review queue |
| `complaints.html` | Customer complaints queue — Raised / In progress / Resolved / Escalated |
| `my-team-performance.html` | A team lead's team performance overview, linking to Interaction Stats and QA Review (Team lead role only) |
| `my-team-interaction-stats.html` | Team lead sub-page — interaction volume by channel and a per-agent breakdown with wrap-up time |
| `my-team-qa.html` | Team lead sub-page ("QA Review") — team QA performance vs other teams |
| `my-team-qa-reviews.html` | Team lead — every scored call for their team, filterable by agent, date range and outcome |
| `my-qa.html` | An agent's own QA scores and coaching feedback (Agent role only) |
| `my-training-development.html` | An agent's own assigned training — guide, expected action-by date, sign off (Agent role only) |
| `scorecard.html` | Single QA scorecard detail |
| `analytics.html` | Reporting & inline-SVG charts |
| `users.html` | Users (Admin/Manager) — add/remove accounts, and per-user drawer settings: change role, assign an agent's team lead, and grant/revoke individual page-access overrides beyond the role's default (e.g. give one Team lead access to Templates) |
| `templates.html` | Response template library |
| `simulations.html` | Customer Simulations — card grid of Inbound/Outbound personas, each with a quote and a Dial button whose call-count stepper (default 1) feeds a shared "dialed today" counter (Trainer role and above) |
| `colin-scorecard.html` | QA Colin (SDL) — pick an agent → an interaction → an AI-marked (AutoQA) scorecard (Trainer role and above) |
| `training-development.html` | Training & Development — auto-generated training packages from QA scorecard failures, matched to an Agent Guide. Admin/Manager/Trainer see the company-wide queue; Team lead sees their own team's packages and a read-only view of their team's training requests |
| `agent-guides.html` | Step-by-step process guides in a clickable-card + modal flowchart format |
| `billing.html` | Plan, usage & invoices |
| `settings.html` | Account / integrations / numbers / branding / security / roles |

## Structure

```
/
├── index.html             → marketing homepage   ├── newsfeed.html   → admin landing page
├── sso.html · login.html  → sign-in              ├── *.html           → other admin routes
├── assets/                → logo.png (real Dial360 wordmark), logo.svg fallback, favicon.svg
├── css/styles.css         → single shared stylesheet (brand tokens + components)
└── js/app.js              → nav active-state, login redirect, tabs, modals, drawers, row links
```

The real Dial360 wordmark is self-hosted at `assets/logo.png` (referenced with an `onerror`
fallback to `assets/logo.svg`).

## What `js/app.js` does (visual only)

- Sets the active sidebar item from `<body data-page="…">`.
- Redirects the login form to `newsfeed.html` on submit; `sso.html` runs its own small step flow.
- Toggles the account menu, tabbed panels, modals, drawers, and clickable table rows
  (`tr[data-href]` / `[data-open-modal]` / `[data-open-drawer]`).

- Drives the **"Viewing as" role switch** in the topbar (Admin / Manager / Team lead / Trainer /
  Agent): filters any `[data-roles]` element to match — sidebar links and account-menu items
  everywhere, plus a few pages that also filter their own content (e.g. `users.html` shows only
  Admin/Manager the full roster — a Team lead's own team roster lives on `my-team-performance.html`
  instead, with a separate KPI row for that scoped view). The role switch also has named sub-options
  under a role (e.g. "Team lead → Priya Nair") that apply that person's individual page-access
  overrides on top of the role's defaults — see `users.html` below. Persists the choice in
  `localStorage` so it carries across pages. Still purely visual, matching this prototype's
  "no real RBAC" stance — nothing is actually access-controlled server-side.

- Drives the **rolling announcement banner** at the top of every admin page: auto-rotates
  through short messages every 6s (with dot navigation), and lets Team lead and above post new
  ones via an "Edit" button. Team lead posts are scoped to their own team ("Team Priya" — the
  one named team in this prototype's dummy data); Manager/Admin posts go to everyone; Trainer and
  Agent can view but not post. Messages persist in `localStorage` alongside the role choice.

- Drives **QA Colin (SDL)** (`colin-scorecard.html`): submitting an AI-marked scorecard stores the
  result in `localStorage`, which `qa.html`'s flagged queue then reads and prepends (tagged
  "Colin") — this prototype's stand-in for the score "moving" into QA Review.

- Drives **Training & Development** (`training-development.html`): a `GUIDE_MAP` matches known QA
  failure reasons (from either `qa.html` or a Colin scorecard) to an Agent Guide and stores an
  assignment in `localStorage`, with a 7-day "action by" date computed from when it was assigned.
  `my-training-development.html` (Agent role only) lists the agent's own assignments — guide link,
  action-by date (colour-coded once due soon or overdue), and a "Sign off" action; `my-performance
  .html` shows a compact summary of the same data. `agent-guides.html` supports a `?open=guide-id`
  deep link so assignment links land straight on the right guide. Team lead sees the same package
  data filtered to their own roster, plus a read-only view of their team's guide requests (the
  "Request a guide" flow on `agent-guides.html`, owned end-to-end by Trainers).

- Drives **user management** (`users.html`, Admin/Manager role): every account lives in a
  `d360-users` localStorage record (name, role, status, stats, and — for Agents — which Team lead
  they report to). Add/Remove act directly on that list; clicking a row opens a settings drawer
  where an Admin/Manager can change the person's role, (re)assign an Agent's Team lead, and grant
  or revoke individual page-access overrides beyond their role's default (stored in
  `d360-user-overrides`, keyed by name) — e.g. letting one specific Team lead see Templates without
  opening it up to Team leads generally.

- Drives the **Customer Simulations dial counter** (`simulations.html`): each persona card's Dial
  button is paired with a quantity stepper (min 1, max 20, default 1) — clicking Dial adds that
  many to a "calls dialed today" counter shown next to both the Inbound and Outbound search boxes,
  stored in `localStorage` keyed by the current date so it resets on its own each new calendar day.

No data is fetched or persisted beyond what's listed above (role switch, banner messages, Colin
submissions, training packages, guide requests, users and their access overrides, the daily dial
counter); filters and
other form controls are otherwise decorative.

## Branding

Palette and gradient sampled from dial360.ai — brand indigo `#7976F3` → magenta `#F481F1`,
ink `#263238`, app background `#F5F5F5`. The logo wordmark is self-hosted in `/assets`.

## Out of scope (faked here, for the real build)

Real auth/SSO/2FA, RBAC enforcement, live data & APIs, Twilio telephony, OpenAI AI services,
the live agent workstation, real billing/metering, and a real charting library. See the
project spec for the full handoff notes.
