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

## Pages / routes

| File | Screen |
|---|---|
| `index.html` | Overview (landing after login) |
| `login.html` | Facade login — "Sign in" always lands on Overview |
| `interactions.html` | Unified interaction log (call / email / chat) |
| `interaction.html` | Single interaction detail (AI wrap-up, transcript, QA) |
| `qa.html` | Automated QA review queue |
| `scorecard.html` | Single QA scorecard detail |
| `analytics.html` | Reporting & inline-SVG charts |
| `agents.html` | Team / agents (invite modal, detail drawer) |
| `templates.html` | Response template library |
| `billing.html` | Plan, usage & invoices |
| `settings.html` | Account / integrations / numbers / branding / security / roles |

## Structure

```
/
├── *.html                 → one file per primary route (11 pages)
├── assets/                → logo.svg, favicon.svg
├── css/styles.css         → single shared stylesheet (brand tokens + components)
└── js/app.js              → nav active-state, login redirect, tabs, modals, drawers, row links
```

## What `js/app.js` does (visual only)

- Sets the active sidebar item from `<body data-page="…">`.
- Redirects the login form to `index.html` on submit (the only required JS interaction there).
- Toggles the account menu, tabbed panels, modals, drawers, and clickable table rows
  (`tr[data-href]` / `[data-open-modal]` / `[data-open-drawer]`).

No data is fetched or persisted; filters and form controls are decorative.

## Branding

Palette and gradient sampled from dial360.ai — brand indigo `#7976F3` → magenta `#F481F1`,
ink `#263238`, app background `#F5F5F5`. The logo wordmark is self-hosted in `/assets`.

## Out of scope (faked here, for the real build)

Real auth/SSO/2FA, RBAC enforcement, live data & APIs, Twilio telephony, OpenAI AI services,
the live agent workstation, real billing/metering, and a real charting library. See the
project spec for the full handoff notes.
