# Working in this repo

Dial360 admin console — a static, no-backend HTML clickable prototype. See README.md for the
full stack/flow overview. This file is project-specific guidance for whoever (human or Claude)
adds or edits pages here.

## Every admin page uses the shared app shell — no exceptions

Every page reachable from the sidebar (i.e. everything except `index.html`, `sso.html`, and
`login.html`) MUST use the exact same shell as every other page:

1. `<body data-page="...">` with the page's nav key (matches a `data-nav` on its sidebar link).
2. The `.banner-ticker` rolling announcement bar (copy verbatim from any existing page).
3. A `<div class="app">` containing, in order:
   - `<aside class="sidebar">` — the full, identical sidebar nav from any existing page
     (copy it wholesale; do not build a page-specific nav or omit the sidebar). If the new page
     needs its own nav entry, add a `<a class="nav-item" data-nav="...">` block to **every**
     existing HTML file's sidebar, in the same position, not just the new page.
   - `<header class="topbar">` — the standard search/role-switch/Prototype badge/Launch Hub/
     notifications/account-menu topbar, copied verbatim.
   - `<main class="main">` — this is where the page's actual unique content goes.
4. The standard `banner-modal` and `hub-modal` markup before `</body>`, plus `<script src="js/app.js">`.

**Do not** build a page with its own bespoke header, its own logo/back-link, or no sidebar at
all — even for a "tool" or "wizard"-style page that feels like a separate mini-app (multi-step
flows, drill-downs, etc.). Wrap the tool's own internal chrome (step rails, tabs, wizards) inside
`<main class="main">`, nested under the shared shell — don't replace the shell with it. This has
already happened twice (`simulations.html`, `colin-scorecard.html` were both first built as
standalone pages with no sidebar and had to be retrofitted) — check this before considering any
new page done.

Fastest way to get this right: copy the full `<body>...</body>` of an existing, already-correct
page (e.g. `complaints.html` or `colin-scorecard.html`) as your starting point, then replace only
the `<main class="main">` contents and the `<title>`/`<meta description>`.

## Adding a new nav item

When a new page needs a sidebar entry, the nav-item `<a>` block must be inserted at the same
position in **every** existing HTML page's sidebar (bulk find-and-replace across all files), not
just the new page — every page's sidebar markup is a literal, independent copy (there's no
shared template/include), so a nav item only added to the new page's own sidebar will not show up
when browsing from any other page.

## Other conventions

- `data-roles="admin,manager,teamlead,trainer,agent"` (any subset) on an element hides/shows it
  per the "Viewing as" role switch — see the "What `js/app.js` does" section in README.md. This
  is purely a visual/simulated restriction; there is no real backend or RBAC in this prototype.
- Reuse existing CSS component classes (`.card`, `.kpi`, `.pill`, `.tabs`/`.tab-panel`, `.filterbar`,
  `.table-wrap table.data`, etc.) rather than inventing new one-off styles — check `css/styles.css`
  for something close before adding new rules.
- After adding or restructuring a page, verify with a headless browser (Playwright) that the
  sidebar/banner/topbar render, the correct nav item highlights active, and any existing
  interactive behavior (tabs, modals, wizards) still works — don't rely on a visual read of the
  HTML alone.
- Update the "Pages / routes" table in README.md whenever a page is added.
