/* ============================================================
   Dial360 Admin Dashboard — shared prototype JS
   Handles: nav active-state, fake login redirect, account menu,
   tabs, modals, drawers, and other visual-only toggles.
   No data fetching — this is a static mock.
   ============================================================ */
(function () {
  "use strict";

  /* ---- 1. Active nav state ----
     Each page sets <body data-page="overview"> (or interactions, qa, ...).
     Nav links carry data-nav="overview". */
  function setActiveNav() {
    var page = document.body.getAttribute("data-page");
    if (page) {
      document.querySelectorAll(".nav-item[data-nav]").forEach(function (el) {
        if (el.getAttribute("data-nav") === page) el.classList.add("active");
      });
    }
    var subpage = document.body.getAttribute("data-subpage");
    if (subpage) {
      document.querySelectorAll(".nav-subitem[data-subnav]").forEach(function (el) {
        if (el.getAttribute("data-subnav") === subpage) el.classList.add("active");
      });
    }
  }

  /* ---- 2. Fake login redirect ----
     login.html form -> always go to the newsfeed, regardless of input. */
  function wireLogin() {
    var form = document.getElementById("login-form");
    if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      window.location.href = "newsfeed.html";
    });
  }

  /* ---- 3. Account dropdown ---- */
  function wireAccountMenu() {
    var btn = document.querySelector(".account__btn");
    var menu = document.querySelector(".account__menu");
    if (!btn || !menu) return;
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      menu.classList.toggle("open");
    });
    document.addEventListener("click", function () { menu.classList.remove("open"); });
    menu.addEventListener("click", function (e) { e.stopPropagation(); });
  }

  /* ---- 4. Tabs ----
     [data-tab="x"] buttons toggle [data-panel="x"] panels within a [data-tabs] group. */
  function wireTabs() {
    document.querySelectorAll("[data-tabs]").forEach(function (group) {
      var tabs = group.querySelectorAll("[data-tab]");
      tabs.forEach(function (tab) {
        tab.addEventListener("click", function () {
          var name = tab.getAttribute("data-tab");
          group.querySelectorAll("[data-tab]").forEach(function (t) { t.classList.remove("active"); });
          group.querySelectorAll("[data-panel]").forEach(function (p) { p.classList.remove("active"); });
          tab.classList.add("active");
          var panel = group.querySelector('[data-panel="' + name + '"]');
          if (panel) panel.classList.add("active");
          if (history.replaceState) history.replaceState(null, "", "#" + name);
        });
      });
      // open tab from hash if present
      var hash = window.location.hash.replace("#", "");
      if (hash) {
        var target = group.querySelector('[data-tab="' + hash + '"]');
        if (target) target.click();
      }
    });
  }

  /* ---- 5. Modals ----
     [data-open-modal="id"] opens, [data-close-modal] / overlay click closes. */
  function wireModals() {
    document.querySelectorAll("[data-open-modal]").forEach(function (trigger) {
      trigger.addEventListener("click", function () {
        var m = document.getElementById(trigger.getAttribute("data-open-modal"));
        if (m) m.classList.add("open");
      });
    });
    document.querySelectorAll(".modal-overlay").forEach(function (overlay) {
      overlay.addEventListener("click", function (e) {
        if (e.target === overlay || e.target.hasAttribute("data-close-modal")) {
          overlay.classList.remove("open");
        }
      });
    });
  }

  /* ---- 6. Drawers ----
     [data-open-drawer="id"] opens; overlay or [data-close-drawer] closes. */
  var AGENT_ROLE_LABELS = {
    admin: "Admin", manager: "Manager", teamlead: "Team lead",
    trainer: "Trainer", agent: "Agent"
  };
  var drawerOpenAgentName = null;

  function wireDrawers() {
    document.querySelectorAll("[data-open-drawer]").forEach(function (trigger) {
      trigger.addEventListener("click", function () {
        var id = trigger.getAttribute("data-open-drawer");
        var d = document.getElementById(id);
        var ov = document.getElementById(id + "-overlay");
        if (d) d.classList.add("open");
        if (ov) ov.classList.add("open");
        // Optional: populate drawer title from trigger data-name
        var name = trigger.getAttribute("data-name");
        if (d && name) {
          var t = d.querySelector("[data-drawer-name]");
          if (t) t.textContent = name;
        }

        // Individual access section (agents.html roster drawer only):
        // shows the clicked agent's actual role and, for Trainers,
        // lets a Manager/Admin grant extra tabs. See "Individual
        // access overrides" in the Role switch section below.
        var agentRole = trigger.getAttribute("data-agent-role");
        var roleTag = d && d.querySelector("[data-drawer-role]");
        if (roleTag && agentRole) roleTag.textContent = AGENT_ROLE_LABELS[agentRole] || agentRole;

        var accessSection = d && d.querySelector("#drawer-access-section");
        if (accessSection) {
          drawerOpenAgentName = name;
          if (agentRole === "trainer" && name) {
            accessSection.style.display = "";
            var granted = (getUserOverrides()[name] || []);
            accessSection.querySelectorAll("[data-access-override]").forEach(function (cb) {
              cb.checked = granted.indexOf(cb.getAttribute("data-access-override")) !== -1;
            });
            var note = accessSection.querySelector("#drawer-access-note");
            if (note) note.style.display = "none";
          } else {
            accessSection.style.display = "none";
          }
        }
      });
    });
    function closeAll() {
      document.querySelectorAll(".drawer.open").forEach(function (d) { d.classList.remove("open"); });
      document.querySelectorAll(".drawer-overlay.open").forEach(function (o) { o.classList.remove("open"); });
    }
    document.querySelectorAll(".drawer-overlay, [data-close-drawer]").forEach(function (el) {
      el.addEventListener("click", closeAll);
    });

    var saveAccessBtn = document.getElementById("drawer-save-access");
    if (saveAccessBtn) {
      saveAccessBtn.addEventListener("click", function () {
        if (!drawerOpenAgentName) return;
        var section = document.getElementById("drawer-access-section");
        var granted = [];
        section.querySelectorAll("[data-access-override]").forEach(function (cb) {
          if (cb.checked) granted.push(cb.getAttribute("data-access-override"));
        });
        var overrides = getUserOverrides();
        if (granted.length) overrides[drawerOpenAgentName] = granted;
        else delete overrides[drawerOpenAgentName];
        saveUserOverrides(overrides);
        refreshEmployeeOptionHints();
        var note = section.querySelector("#drawer-access-note");
        if (note) note.style.display = "block";
      });
    }
  }

  /* ---- 7. Esc closes overlays ---- */
  function wireEsc() {
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        document.querySelectorAll(".modal-overlay.open, .drawer.open, .drawer-overlay.open, .role-switch__menu.open")
          .forEach(function (el) { el.classList.remove("open"); });
      }
    });
  }

  /* ---- 8. Decorative row navigation ----
     tr[data-href] -> navigate on click (drill-downs). */
  function wireRowLinks() {
    document.querySelectorAll("[data-href]").forEach(function (row) {
      row.addEventListener("click", function (e) {
        if (e.target.closest("a, button, input, select, .toggle")) return;
        window.location.href = row.getAttribute("data-href");
      });
    });
  }

  /* ---- 9. Template copy-to-clipboard ----
     .tpl-copy buttons copy their card's body text so agents (who can't
     edit templates) can grab the wording to use elsewhere. */
  function wireTemplateCopy() {
    document.querySelectorAll(".tpl-copy").forEach(function (btn) {
      var originalHTML = btn.innerHTML;
      var resetTimer = null;

      function showResult(label) {
        btn.textContent = label;
        clearTimeout(resetTimer);
        resetTimer = setTimeout(function () { btn.innerHTML = originalHTML; }, 1500);
      }

      btn.addEventListener("click", function () {
        var card = btn.closest(".card");
        var body = card && card.querySelector(".card__body p");
        if (!body) return;
        var text = body.textContent.trim();

        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(
            function () { showResult("Copied ✓"); },
            function () { showResult("Copy failed"); }
          );
        } else {
          var ta = document.createElement("textarea");
          ta.value = text;
          ta.style.position = "fixed";
          ta.style.opacity = "0";
          document.body.appendChild(ta);
          ta.select();
          try {
            document.execCommand("copy");
            showResult("Copied ✓");
          } catch (e) {
            showResult("Copy failed");
          }
          document.body.removeChild(ta);
        }
      });
    });
  }

  /* ---- 10. Rolling announcement banner (prototype only) ----
     Team lead and above can post short messages via the banner's edit
     modal. Team lead messages are scoped to their own team; Manager and
     Admin messages go to everyone. Stored in localStorage so posts
     persist across pages — there is no real backend. */
  var BANNER_KEY = "d360-banner-messages";
  var BANNER_TEAM = "priya"; // the only named team in this prototype's dummy data
  var BANNER_AUDIENCE_LABEL = { all: "All teams", team: "Team Priya" };
  var BANNER_AUTHOR_NAME = { admin: "Rob Ashton", manager: "Rob Ashton", teamlead: "Priya Nair" };
  var bannerIndex = 0;
  var bannerTimer = null;

  function currentBannerRole() {
    return localStorage.getItem(ROLE_KEY) || "admin";
  }

  function seedBannerMessages() {
    if (localStorage.getItem(BANNER_KEY)) return;
    var seed = [
      {
        id: "m1",
        text: "Welcome to the new Dial360 console — check out the Newsfeed for the latest updates.",
        audience: "all", authorRole: "admin", authorName: "Rob Ashton"
      },
      {
        id: "m2",
        text: "Team Priya — great work hitting a 90%+ QA pass rate this week. Coffee's on me Friday.",
        audience: "team", team: BANNER_TEAM, authorRole: "teamlead", authorName: "Priya Nair"
      }
    ];
    localStorage.setItem(BANNER_KEY, JSON.stringify(seed));
  }

  function getBannerMessages() {
    try {
      return JSON.parse(localStorage.getItem(BANNER_KEY)) || [];
    } catch (e) {
      return [];
    }
  }

  function saveBannerMessages(list) {
    localStorage.setItem(BANNER_KEY, JSON.stringify(list));
  }

  function visibleBannerMessages(role) {
    var all = getBannerMessages();
    if (role === "admin" || role === "manager") return all;
    if (role === "trainer") return all.filter(function (m) { return m.audience === "all"; });
    // Team lead + Agent: scoped to this prototype's one named team.
    return all.filter(function (m) { return m.audience === "all" || m.team === BANNER_TEAM; });
  }

  function renderBanner(role) {
    var textEl = document.getElementById("banner-ticker-text");
    var dotsEl = document.getElementById("banner-ticker-dots");
    if (!textEl || !dotsEl) return;

    var messages = visibleBannerMessages(role);
    clearInterval(bannerTimer);
    dotsEl.innerHTML = "";

    if (!messages.length) {
      textEl.textContent = "No announcements right now.";
      return;
    }

    function show(i, immediate) {
      bannerIndex = i;
      if (immediate) {
        textEl.textContent = messages[bannerIndex].text;
      } else {
        textEl.classList.add("is-leaving");
        setTimeout(function () {
          textEl.textContent = messages[bannerIndex].text;
          textEl.classList.remove("is-leaving");
        }, 200);
      }
      dotsEl.querySelectorAll("button").forEach(function (d, idx) {
        d.classList.toggle("active", idx === bannerIndex);
      });
    }

    function resetTimer() {
      clearInterval(bannerTimer);
      if (messages.length <= 1) return;
      bannerTimer = setInterval(function () {
        show((bannerIndex + 1) % messages.length);
      }, 6000);
    }

    messages.forEach(function (m, idx) {
      var dot = document.createElement("button");
      dot.type = "button";
      dot.setAttribute("aria-label", "Show message " + (idx + 1));
      dot.addEventListener("click", function () { show(idx); resetTimer(); });
      dotsEl.appendChild(dot);
    });

    show(0, true);
    resetTimer();
  }

  function renderBannerModalList(role) {
    var list = document.getElementById("banner-msg-list");
    var note = document.getElementById("banner-audience-note");
    if (!list) return;

    if (note) {
      note.innerHTML = role === "teamlead"
        ? "Your message will be shown to <strong>Team Priya</strong> only."
        : "Your message will be shown to <strong>all teams</strong>.";
    }

    var all = getBannerMessages();
    list.innerHTML = "";

    if (!all.length) {
      list.innerHTML = '<div class="banner-empty">No messages posted yet.</div>';
      return;
    }

    all.forEach(function (m) {
      var row = document.createElement("div");
      row.className = "banner-msg-row";
      var textDiv = document.createElement("div");
      textDiv.className = "banner-msg-row__main";
      var textP = document.createElement("div");
      textP.className = "banner-msg-row__text";
      textP.textContent = m.text;
      var metaP = document.createElement("div");
      metaP.className = "banner-msg-row__meta";
      metaP.textContent = BANNER_AUDIENCE_LABEL[m.audience] + " · " + m.authorName;
      textDiv.appendChild(textP);
      textDiv.appendChild(metaP);

      var delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "banner-msg-row__del";
      delBtn.setAttribute("aria-label", "Remove message");
      delBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>';
      delBtn.addEventListener("click", function () {
        saveBannerMessages(getBannerMessages().filter(function (msg) { return msg.id !== m.id; }));
        renderBannerModalList(currentBannerRole());
        renderBanner(currentBannerRole());
      });

      row.appendChild(textDiv);
      row.appendChild(delBtn);
      list.appendChild(row);
    });
  }

  function wireBannerEditor() {
    var editBtn = document.getElementById("banner-ticker-edit");
    var addBtn = document.getElementById("banner-msg-add");
    var input = document.getElementById("banner-msg-input");
    if (editBtn) {
      editBtn.addEventListener("click", function () {
        renderBannerModalList(currentBannerRole());
      });
    }
    if (!addBtn || !input) return;
    addBtn.addEventListener("click", function () {
      var text = input.value.trim();
      if (!text) return;
      var role = currentBannerRole();
      var msg = {
        id: "m" + Date.now(),
        text: text,
        audience: role === "teamlead" ? "team" : "all",
        team: role === "teamlead" ? BANNER_TEAM : undefined,
        authorRole: role,
        authorName: BANNER_AUTHOR_NAME[role] || "Rob Ashton"
      };
      var list = getBannerMessages();
      list.push(msg);
      saveBannerMessages(list);
      input.value = "";
      renderBannerModalList(role);
      renderBanner(role);
    });
  }

  /* ---- 11. Role switch (view-as, prototype only) ----
     Topbar dropdown filters [data-roles] elements (nav items, account
     menu links) to what that role can see, and updates the account
     role label. Persisted in localStorage so it carries across pages.
     No real RBAC enforcement — page content itself is unrestricted.

     Individual access overrides: a Manager/Admin can grant a named
     employee extra tabs beyond their role's default access (see the
     "Individual access" section in an agent's drawer on agents.html).
     Overrides are keyed by employee name and store the [data-nav]
     values of the extra pages granted — e.g. Hannah Price (Trainer)
     might be granted "analytics". The role-switch menu's named
     sub-options (e.g. "Trainer — Hannah Price") apply the role's
     normal permissions *plus* that employee's overrides. */
  var ROLE_KEY = "d360-role";
  var EMPLOYEE_KEY = "d360-role-employee";
  var OVERRIDES_KEY = "d360-user-overrides";
  var ROLE_LABELS = {
    admin: "Admin", manager: "Manager", teamlead: "Team lead",
    trainer: "Trainer", agent: "Agent"
  };
  var OVERRIDE_LABELS = { analytics: "Analytics", interactions: "Interactions", complaints: "Complaints" };

  function getUserOverrides() {
    try { return JSON.parse(localStorage.getItem(OVERRIDES_KEY)) || {}; } catch (e) { return {}; }
  }
  function saveUserOverrides(map) { localStorage.setItem(OVERRIDES_KEY, JSON.stringify(map)); }

  function refreshEmployeeOptionHints() {
    var overrides = getUserOverrides();
    document.querySelectorAll(".role-switch__option[data-employee]").forEach(function (opt) {
      var name = opt.getAttribute("data-employee");
      if (!name) return;
      var hint = opt.querySelector(".role-switch__hint");
      if (!hint) return;
      var extra = (overrides[name] || []).map(function (k) { return OVERRIDE_LABELS[k] || k; });
      hint.textContent = extra.length ? "+ " + extra.join(", ") : "";
    });
  }

  function applyRole(role, employee) {
    employee = employee || "";
    document.querySelectorAll(".role-switch__option").forEach(function (opt) {
      var matches = opt.getAttribute("data-role") === role && (opt.getAttribute("data-employee") || "") === employee;
      opt.classList.toggle("active", matches);
    });
    var label = ROLE_LABELS[role] || ROLE_LABELS.admin;
    var displayLabel = employee ? employee : label;
    document.querySelectorAll(".role-switch__current-role").forEach(function (el) {
      el.textContent = displayLabel;
    });
    var overrides = employee ? (getUserOverrides()[employee] || []) : [];
    document.querySelectorAll("[data-roles]").forEach(function (el) {
      var allowed = el.getAttribute("data-roles").split(",");
      var navKey = el.getAttribute("data-nav");
      var ok = allowed.indexOf(role) !== -1 || (navKey && overrides.indexOf(navKey) !== -1);
      el.style.display = ok ? "" : "none";
    });
    var roleLabel = document.querySelector(".account__role");
    if (roleLabel) roleLabel.textContent = displayLabel;
    refreshEmployeeOptionHints();
    renderBanner(role);
  }

  function wireRoleSwitch() {
    var wrap = document.querySelector(".role-switch");
    if (!wrap) return;
    var trigger = wrap.querySelector(".role-switch__trigger");
    var menu = wrap.querySelector(".role-switch__menu");
    var role = localStorage.getItem(ROLE_KEY) || "admin";
    var employee = localStorage.getItem(EMPLOYEE_KEY) || "";
    applyRole(role, employee);

    trigger.addEventListener("click", function (e) {
      e.stopPropagation();
      menu.classList.toggle("open");
    });
    document.addEventListener("click", function () { menu.classList.remove("open"); });
    menu.addEventListener("click", function (e) { e.stopPropagation(); });

    menu.querySelectorAll(".role-switch__option").forEach(function (opt) {
      opt.addEventListener("click", function () {
        role = opt.getAttribute("data-role");
        employee = opt.getAttribute("data-employee") || "";
        localStorage.setItem(ROLE_KEY, role);
        localStorage.setItem(EMPLOYEE_KEY, employee);
        applyRole(role, employee);
        menu.classList.remove("open");
      });
    });
  }

  /* ---- 12. Colin scorecard queue (prototype only) ----
     colin-scorecard.html stores submitted AI-marked evaluations in
     localStorage (there's no real backend). Any page with a
     [data-colin-queue] tbody — the QA Review flagged table — renders
     them at the top of the queue, tagged "Colin". */
  var COLIN_KEY = "d360-colin-submissions";

  function renderColinQueue() {
    var tbody = document.querySelector("[data-colin-queue]");
    if (!tbody) return;
    var submissions = [];
    try { submissions = JSON.parse(localStorage.getItem(COLIN_KEY)) || []; } catch (e) { submissions = []; }
    if (!submissions.length) return;

    submissions.forEach(function (r) {
      var row = document.createElement("tr");
      var statusPill = r.score >= 70 ? '<span class="pill pill--pass">Resolved</span>' : '<span class="pill pill--flag">Needs review</span>';
      var scoreColor = r.score >= 70 ? "var(--success)" : r.score >= 50 ? "var(--warning)" : "var(--danger)";
      row.innerHTML =
        '<td class="cell-mono">' + r.ref + ' <span class="tag" title="Marked in QA Colin (SDL)">Colin</span></td>' +
        '<td class="cell-strong">' + r.customerName + '</td>' +
        '<td><span class="cell-user">' + r.agentName + '</span></td>' +
        '<td><span class="cell-strong" style="color:' + scoreColor + ';">' + r.score + '/100</span></td>' +
        '<td>' + r.topFailReason + '</td>' +
        '<td>' + statusPill + '</td>' +
        '<td class="muted">Colin (AI-assisted)</td>';
      tbody.insertBefore(row, tbody.firstChild);
    });
  }

  /* ---- 13. Training & Development (prototype only) ----
     Auto-generates a "training package" whenever a scorecard fails a
     tracked criterion: the failure reason is matched to an Agent
     Guide, and a record is stored in localStorage. training-development
     .html (Trainer role and above) lists every open package; the
     agent's own My Performance page lists just theirs, with a "Mark
     as complete" action. Both read/write the same store — there's no
     real backend, so this is how the two views stay in sync. */
  var TRAINING_KEY = "d360-training-packages";
  var GUIDE_MAP = {
    "dpa not completed": { id: "guide-dpa", title: "DPA Verification" },
    "applicant or authorised 3rd party provided full name & 2 acceptable forms of identification": { id: "guide-dpa", title: "DPA Verification" },
    "compliance phrase missing": { id: "guide-dispute-rights", title: "Dispute Rights & Validation Notice" },
    "dispute rights & validation notice provided where required": { id: "guide-dispute-rights", title: "Dispute Rights & Validation Notice" },
    "tone": { id: "guide-tone", title: "Tone & De-escalation" },
    "no threatening, profane or misleading language used": { id: "guide-tone", title: "Tone & De-escalation" },
    "agent did not disclose information to an unauthorised third party": { id: "guide-confidentiality", title: "Confidentiality & Third-Party Disclosure" },
    "company’s confidentiality agreement maintained": { id: "guide-confidentiality", title: "Confidentiality & Third-Party Disclosure" },
    "call recording disclosure given at the start of the call": { id: "guide-call-recording", title: "Call Recording Disclosure" },
    "call outcome documented accurately in system notes": { id: "guide-wrapup", title: "Call Wrap-up Checklist" }
  };

  function guideForReason(reason) {
    if (!reason) return null;
    return GUIDE_MAP[String(reason).trim().toLowerCase()] || null;
  }

  function getTrainingPackages() {
    try { return JSON.parse(localStorage.getItem(TRAINING_KEY)) || []; } catch (e) { return []; }
  }
  function saveTrainingPackages(list) { localStorage.setItem(TRAINING_KEY, JSON.stringify(list)); }

  function seedTrainingPackages() {
    if (localStorage.getItem(TRAINING_KEY)) return;
    saveTrainingPackages([
      { id: "tp1", agentName: "Marcus Bennett", ref: "INT-10477", failReason: "Tone", guideId: "guide-tone", guideTitle: "Tone & De-escalation", status: "not-started", assignedAt: "2026-07-24T09:00:00.000Z" },
      { id: "tp2", agentName: "Daniel Okafor", ref: "INT-10461", failReason: "DPA not completed", guideId: "guide-dpa", guideTitle: "DPA Verification", status: "in-progress", assignedAt: "2026-07-23T09:00:00.000Z" },
      { id: "tp3", agentName: "Hannah Price", ref: "INT-10454", failReason: "Compliance phrase missing", guideId: "guide-dispute-rights", guideTitle: "Dispute Rights & Validation Notice", status: "not-started", assignedAt: "2026-07-22T09:00:00.000Z" },
      { id: "tp4", agentName: "Rob Ashton", ref: "INT-10408", failReason: "DPA not completed", guideId: "guide-dpa", guideTitle: "DPA Verification", status: "not-started", assignedAt: "2026-07-21T09:00:00.000Z" }
    ]);
  }

  /* Called after a scorecard is submitted elsewhere (e.g. colin.js) with
     the agent's name, the interaction ref, and the top failure reason.
     No-ops if the reason has no matching guide, or a package already
     exists for this exact ref + guide. */
  function assignTraining(agentName, ref, failReason) {
    var guide = guideForReason(failReason);
    if (!guide) return null;
    var list = getTrainingPackages();
    var exists = list.some(function (p) { return p.ref === ref && p.guideId === guide.id; });
    if (exists) return null;
    var pkg = {
      id: "tp-" + ref + "-" + guide.id + "-" + Date.now(),
      agentName: agentName, ref: ref, failReason: failReason,
      guideId: guide.id, guideTitle: guide.title,
      status: "not-started", assignedAt: new Date().toISOString()
    };
    list.unshift(pkg);
    saveTrainingPackages(list);
    return pkg;
  }

  function statusLabel(status) {
    return status === "completed" ? "Completed" : status === "in-progress" ? "In progress" : "Not started";
  }
  function statusPillClass(status) {
    return status === "completed" ? "pill--pass" : status === "in-progress" ? "pill--info" : "pill--flag";
  }

  function renderTrainingKpis(list) {
    var openEl = document.getElementById("td-kpi-open");
    var completedEl = document.getElementById("td-kpi-completed");
    var topGuideEl = document.getElementById("td-kpi-top-guide");
    if (!openEl && !completedEl && !topGuideEl) return;

    var open = list.filter(function (p) { return p.status !== "completed"; });
    var completed = list.filter(function (p) { return p.status === "completed"; });
    if (openEl) openEl.textContent = open.length;
    if (completedEl) completedEl.textContent = completed.length;
    if (topGuideEl) {
      var counts = {};
      open.forEach(function (p) { counts[p.guideTitle] = (counts[p.guideTitle] || 0) + 1; });
      var top = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; })[0];
      topGuideEl.textContent = top || "—";
    }
  }

  function renderTrainingQueue() {
    var tbody = document.querySelector("[data-training-queue]");
    var list = getTrainingPackages();
    renderTrainingKpis(list);
    if (!tbody) return;
    tbody.innerHTML = "";
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="muted" style="padding:16px;">No training packages assigned yet.</td></tr>';
      return;
    }
    list.forEach(function (p) {
      var row = document.createElement("tr");
      row.innerHTML =
        '<td class="cell-strong">' + p.agentName + '</td>' +
        '<td class="cell-mono">' + p.ref + '</td>' +
        '<td>' + p.failReason + '</td>' +
        '<td><a href="agent-guides.html?open=' + p.guideId + '">' + p.guideTitle + '</a></td>' +
        '<td><span class="pill ' + statusPillClass(p.status) + '">' + statusLabel(p.status) + '</span></td>' +
        '<td class="muted">' + new Date(p.assignedAt).toLocaleDateString(undefined, { day: "numeric", month: "short" }) + '</td>';
      tbody.appendChild(row);
    });
  }

  function renderMyTraining() {
    var root = document.getElementById("my-training-list");
    if (!root) return;
    var mine = getTrainingPackages().filter(function (p) { return p.agentName === "Rob Ashton"; });
    if (!mine.length) {
      root.innerHTML = '<p class="muted" style="margin:0;">No training assigned right now — nice work.</p>';
      return;
    }
    root.innerHTML = mine.map(function (p) {
      var done = p.status === "completed";
      return '<div data-training-id="' + p.id + '" style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 0;border-bottom:1px solid var(--border-soft);">' +
        '<div>' +
        '<div class="checklist__title">' + p.guideTitle + '</div>' +
        '<div class="checklist__desc">From ' + p.ref + ' — flagged for “' + p.failReason + '”</div>' +
        '</div>' +
        '<div class="row" style="gap:8px;align-items:center;">' +
        '<span class="pill ' + statusPillClass(p.status) + '">' + statusLabel(p.status) + '</span>' +
        '<a class="btn btn--sm" href="agent-guides.html?open=' + p.guideId + '">Read guide</a>' +
        (done ? '' : '<button type="button" class="btn btn--primary btn--sm" data-complete-training="' + p.id + '">Mark complete</button>') +
        '</div></div>';
    }).join("");

    root.querySelectorAll("[data-complete-training]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-complete-training");
        var list = getTrainingPackages();
        list.forEach(function (p) { if (p.id === id) { p.status = "completed"; p.completedAt = new Date().toISOString(); } });
        saveTrainingPackages(list);
        renderMyTraining();
      });
    });
  }

  /* Deep-link support: agent-guides.html?open=guide-xxx auto-opens that
     guide's modal, so links from the training queue / my training list
     land directly on the right guide. */
  function openGuideFromQuery() {
    var params = new URLSearchParams(window.location.search);
    var id = params.get("open");
    if (!id) return;
    var modal = document.getElementById(id);
    if (modal) modal.classList.add("open");
  }

  /* ---- 14. Date-range pickers ----
     A <select data-range-select> with a "Custom range" option reveals a
     sibling [data-range-custom] pair of date inputs when that option is
     chosen. Visual only — no filtering happens in this prototype. */
  function wireRangePickers() {
    document.querySelectorAll("[data-range-select]").forEach(function (select) {
      var custom = select.parentElement.querySelector("[data-range-custom]");
      if (!custom) return;
      function sync() {
        custom.style.display = select.value === "custom" ? "flex" : "none";
      }
      select.addEventListener("change", sync);
      sync();
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    setActiveNav();
    wireLogin();
    wireAccountMenu();
    wireTabs();
    wireModals();
    wireDrawers();
    wireEsc();
    wireRowLinks();
    wireTemplateCopy();
    wireRangePickers();
    renderColinQueue();
    seedBannerMessages();
    renderBanner(currentBannerRole());
    wireBannerEditor();
    wireRoleSwitch();
    seedTrainingPackages();
    renderTrainingQueue();
    renderMyTraining();
    openGuideFromQuery();
  });

  window.D360 = window.D360 || {};
  window.D360.assignTraining = assignTraining;
})();
