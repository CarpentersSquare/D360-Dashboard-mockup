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
| `interactions.html` | Unified interaction log (call / email / chat) |
| `interaction.html` | Single interaction detail (AI wrap-up, transcript, QA) |
| `qa.html` | Automated QA review queue |
| `my-team-qa.html` | A team lead's team QA performance vs other teams (Team lead role only) |
| `my-qa.html` | An agent's own QA scores and coaching feedback (Agent role only) |
| `scorecard.html` | Single QA scorecard detail |
| `analytics.html` | Reporting & inline-SVG charts |
| `agents.html` | Team / agents (invite modal, detail drawer) |
| `templates.html` | Response template library |
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
  everywhere, plus a few pages that also filter their own content (e.g. `agents.html` shows only
  a team lead's allocated team, with a separate KPI row for that scoped view). Persists the
  choice in `localStorage` so it carries across pages. Still purely visual, matching this
  prototype's "no real RBAC" stance — nothing is actually access-controlled server-side.

- Drives the **rolling announcement banner** at the top of every admin page: auto-rotates
  through short messages every 6s (with dot navigation), and lets Team lead and above post new
  ones via an "Edit" button. Team lead posts are scoped to their own team ("Team Priya" — the
  one named team in this prototype's dummy data); Manager/Admin posts go to everyone; Trainer and
  Agent can view but not post. Messages persist in `localStorage` alongside the role choice.

No data is fetched or persisted (aside from the role switch and banner messages above); filters
and other form controls are otherwise decorative.

## Branding

Palette and gradient sampled from dial360.ai — brand indigo `#7976F3` → magenta `#F481F1`,
ink `#263238`, app background `#F5F5F5`. The logo wordmark is self-hosted in `/assets`.

## Out of scope (faked here, for the real build)

Real auth/SSO/2FA, RBAC enforcement, live data & APIs, Twilio telephony, OpenAI AI services,
the live agent workstation, real billing/metering, and a real charting library. See the
project spec for the full handoff notes.
