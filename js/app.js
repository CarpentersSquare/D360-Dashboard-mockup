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
  var drawerOpenUserId = null;

  /* Fills the "Additional page access" checkbox list with every nav
     page the user's current role *doesn't* already get by default. */
  function renderAccessOverrideOptions(section, role, name) {
    var listEl = section.querySelector("[data-access-override-list]");
    if (!listEl) return;
    var granted = getUserOverrides()[name] || [];
    var extras = Object.keys(NAV_DEFAULT_ROLES).filter(function (key) {
      return NAV_DEFAULT_ROLES[key].indexOf(role) === -1;
    });
    if (!extras.length) {
      listEl.innerHTML = '<p class="small muted" style="margin:0;">This role already has access to every page.</p>';
      return;
    }
    listEl.innerHTML = extras.map(function (key) {
      var checked = granted.indexOf(key) !== -1 ? " checked" : "";
      return '<label class="row" style="gap:8px;align-items:center;font-size:13.5px;">' +
        '<input type="checkbox" data-access-override="' + key + '"' + checked + ' /> ' + NAV_LABELS[key] + '</label>';
    }).join("");
  }

  /* Binds the open-drawer click behavior to every [data-open-drawer]
     element currently in the page. Called once by wireDrawers() at
     load, and again by renderUsersRoster() after each re-render —
     that tbody is rebuilt from scratch on every add/remove/edit, so
     its rows need fresh listeners each time. */
  function wireDrawerTriggers() {
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

        // User settings sections (users.html roster drawer only): role
        // tag/status, the "Role & team" editor, and "Additional page
        // access" — see the User management section further below.
        var agentRole = trigger.getAttribute("data-agent-role");
        var userId = trigger.getAttribute("data-user-id");
        var roleTag = d && d.querySelector("[data-drawer-role]");
        if (roleTag && agentRole) roleTag.textContent = AGENT_ROLE_LABELS[agentRole] || agentRole;
        var roleSection = d && d.querySelector("#drawer-role-section");
        if (roleSection && userId) {
          drawerOpenUserId = userId;
          var ru = getUsers().filter(function (u) { return u.id === userId; })[0];
          if (ru) {
            var roleSelect = roleSection.querySelector("#drawer-role-select");
            var teamleadRow = roleSection.querySelector("#drawer-teamlead-row");
            var teamleadSelect = roleSection.querySelector("#drawer-teamlead-select");
            if (roleSelect) roleSelect.value = ru.role;
            populateTeamLeadOptions(teamleadSelect, ru.teamLead, ru.id);
            if (teamleadRow) teamleadRow.style.display = ru.role === "agent" ? "" : "none";
          }
          var roleNote = roleSection.querySelector("#drawer-role-note");
          if (roleNote) roleNote.style.display = "none";
        }

        var accessSection = d && d.querySelector("#drawer-access-section");
        if (accessSection) {
          drawerOpenAgentName = name;
          if (agentRole && name) {
            renderAccessOverrideOptions(accessSection, agentRole, name);
          }
          var note = accessSection.querySelector("#drawer-access-note");
          if (note) note.style.display = "none";
        }
      });
    });
  }

  function wireDrawers() {
    wireDrawerTriggers();
    function closeAll() {
      document.querySelectorAll(".drawer.open").forEach(function (d) { d.classList.remove("open"); });
      document.querySelectorAll(".drawer-overlay.open").forEach(function (o) { o.classList.remove("open"); });
    }
    document.querySelectorAll(".drawer-overlay, [data-close-drawer]").forEach(function (el) {
      el.addEventListener("click", closeAll);
    });

    var drawerRoleSelect = document.getElementById("drawer-role-select");
    var drawerTeamleadRow = document.getElementById("drawer-teamlead-row");
    var drawerTeamleadSelect = document.getElementById("drawer-teamlead-select");
    if (drawerRoleSelect) {
      drawerRoleSelect.addEventListener("change", function () {
        populateTeamLeadOptions(drawerTeamleadSelect, drawerTeamleadSelect.value, drawerOpenUserId);
        drawerTeamleadRow.style.display = drawerRoleSelect.value === "agent" ? "" : "none";
      });
    }
    var saveRoleBtn = document.getElementById("drawer-save-role");
    if (saveRoleBtn) {
      saveRoleBtn.addEventListener("click", function () {
        if (!drawerOpenUserId) return;
        var list = getUsers();
        var user = list.filter(function (u) { return u.id === drawerOpenUserId; })[0];
        if (!user) return;
        var previousName = user.name;
        var newRole = drawerRoleSelect.value;
        user.role = newRole;
        user.teamLead = newRole === "agent" ? (drawerTeamleadSelect.value || null) : null;
        if (newRole !== "teamlead") {
          list.forEach(function (u) { if (u.id !== user.id && u.teamLead === previousName) u.teamLead = null; });
        }
        saveUsers(list);
        renderUsersRoster();
        var roleTagEl = document.querySelector("#agent-drawer [data-drawer-role]");
        if (roleTagEl) roleTagEl.textContent = AGENT_ROLE_LABELS[newRole] || newRole;
        var accessSection = document.getElementById("drawer-access-section");
        if (accessSection && user.name) renderAccessOverrideOptions(accessSection, newRole, user.name);
        var roleNote = document.getElementById("drawer-role-note");
        if (roleNote) roleNote.style.display = "block";
      });
    }

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

     Individual access overrides: an Admin/Manager can grant a named
     user access to pages beyond their role's default access (see
     "Additional page access" in a user's drawer on users.html) — e.g.
     a Team lead who doesn't normally see Templates, but should for
     this one person. Overrides are keyed by user name and store the
     [data-nav] values of the extra pages granted. The role-switch
     menu's named sub-options (e.g. "Trainer — Hannah Price") apply the
     role's normal permissions *plus* that person's overrides. */
  var ROLE_KEY = "d360-role";
  var EMPLOYEE_KEY = "d360-role-employee";
  var OVERRIDES_KEY = "d360-user-overrides";
  var ROLE_LABELS = {
    admin: "Admin", manager: "Manager", teamlead: "Team lead",
    trainer: "Trainer", agent: "Agent"
  };

  /* Every individually-toggleable nav page and the roles that get it by
     default — the single source of truth the "Additional page access"
     drawer section and the employee-option hints both read from.
     ("My Team Performance" is a nav-group, not an individual item with
     its own [data-roles], so it isn't offered as a grantable extra.) */
  var NAV_DEFAULT_ROLES = {
    newsfeed: ["admin", "manager", "teamlead", "trainer", "agent"],
    overview: ["admin", "manager"],
    "call-centre-dashboard": ["admin", "manager", "teamlead"],
    "my-performance": ["agent"],
    qa: ["admin", "manager", "trainer"],
    complaints: ["admin", "manager", "teamlead"],
    "my-qa": ["agent"],
    "my-training-development": ["agent"],
    analytics: ["admin", "manager"],
    users: ["admin", "manager"],
    templates: ["admin", "manager", "teamlead", "trainer"],
    simulations: ["admin", "manager", "teamlead", "trainer"],
    "colin-scorecard": ["admin", "manager", "teamlead", "trainer"],
    "training-development": ["admin", "manager", "teamlead", "trainer"],
    "agent-guides": ["admin", "manager", "teamlead", "trainer", "agent"],
    billing: ["admin"],
    settings: ["admin"]
  };
  var NAV_LABELS = {
    newsfeed: "Newsfeed", overview: "Overview", "call-centre-dashboard": "Call Centre Dashboard",
    "my-performance": "My Performance", qa: "QA Review", complaints: "Complaints",
    "my-qa": "My QA", "my-training-development": "My Training & Development",
    analytics: "Analytics", users: "Users", templates: "Templates",
    simulations: "Customer Simulations", "colin-scorecard": "Colin Scorecard",
    "training-development": "Training & Development", "agent-guides": "Agent Guides",
    billing: "Billing", settings: "Settings"
  };

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
      var extra = (overrides[name] || []).map(function (k) { return NAV_LABELS[k] || k; });
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

  var DUE_WINDOW_DAYS = 7;
  function addDays(iso, days) {
    var d = new Date(iso);
    d.setDate(d.getDate() + days);
    return d.toISOString();
  }

  function seedTrainingPackages() {
    if (localStorage.getItem(TRAINING_KEY)) return;
    var seed = [
      { id: "tp1", agentName: "Marcus Bennett", ref: "INT-10477", failReason: "Tone", guideId: "guide-tone", guideTitle: "Tone & De-escalation", status: "not-started", assignedAt: "2026-07-24T09:00:00.000Z" },
      { id: "tp2", agentName: "Daniel Okafor", ref: "INT-10461", failReason: "DPA not completed", guideId: "guide-dpa", guideTitle: "DPA Verification", status: "in-progress", assignedAt: "2026-07-23T09:00:00.000Z" },
      { id: "tp3", agentName: "Hannah Price", ref: "INT-10454", failReason: "Compliance phrase missing", guideId: "guide-dispute-rights", guideTitle: "Dispute Rights & Validation Notice", status: "not-started", assignedAt: "2026-07-22T09:00:00.000Z" },
      { id: "tp4", agentName: "Rob Ashton", ref: "INT-10408", failReason: "DPA not completed", guideId: "guide-dpa", guideTitle: "DPA Verification", status: "not-started", assignedAt: "2026-07-21T09:00:00.000Z" }
    ];
    seed.forEach(function (p) { p.dueAt = addDays(p.assignedAt, DUE_WINDOW_DAYS); });
    saveTrainingPackages(seed);
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
    var assignedAt = new Date().toISOString();
    var pkg = {
      id: "tp-" + ref + "-" + guide.id + "-" + Date.now(),
      agentName: agentName, ref: ref, failReason: failReason,
      guideId: guide.id, guideTitle: guide.title,
      status: "not-started", assignedAt: assignedAt, dueAt: addDays(assignedAt, DUE_WINDOW_DAYS)
    };
    list.unshift(pkg);
    saveTrainingPackages(list);
    return pkg;
  }

  function statusLabel(status) {
    return status === "completed" ? "Signed off" : status === "in-progress" ? "In progress" : "Not started";
  }
  function statusPillClass(status) {
    return status === "completed" ? "pill--pass" : status === "in-progress" ? "pill--info" : "pill--flag";
  }
  function fmtShortDate(iso) {
    return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
  }
  /* Expected-timeframe messaging for the "action by" date: overdue and
     due-today/tomorrow render in warning colours so an agent (or their
     Trainer) can see at a glance what needs attention first. */
  function dueInfo(pkg) {
    if (pkg.status === "completed") {
      return { text: "Signed off " + fmtShortDate(pkg.completedAt || pkg.dueAt), cls: "muted" };
    }
    var days = Math.ceil((new Date(pkg.dueAt) - new Date()) / 86400000);
    if (days < 0) return { text: "Overdue — was due " + fmtShortDate(pkg.dueAt), cls: "danger", urgent: true };
    if (days === 0) return { text: "Action by today", cls: "danger", urgent: true };
    if (days <= 2) return { text: "Action by " + fmtShortDate(pkg.dueAt), cls: "warning", urgent: true };
    return { text: "Action by " + fmtShortDate(pkg.dueAt), cls: "muted" };
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
      tbody.innerHTML = '<tr><td colspan="7" class="muted" style="padding:16px;">No training packages assigned yet.</td></tr>';
      return;
    }
    list.forEach(function (p) {
      var row = document.createElement("tr");
      var due = dueInfo(p);
      row.innerHTML =
        '<td class="cell-strong">' + p.agentName + '</td>' +
        '<td class="cell-mono">' + p.ref + '</td>' +
        '<td>' + p.failReason + '</td>' +
        '<td><a href="agent-guides.html?open=' + p.guideId + '">' + p.guideTitle + '</a></td>' +
        '<td><span class="pill ' + statusPillClass(p.status) + '">' + statusLabel(p.status) + '</span></td>' +
        '<td class="muted">' + fmtShortDate(p.assignedAt) + '</td>' +
        '<td style="color:var(--' + due.cls + ');' + (due.urgent ? 'font-weight:700;' : '') + '">' + due.text + '</td>';
      tbody.appendChild(row);
    });
  }

  function trainingItemRow(p, opts) {
    var done = p.status === "completed";
    var due = dueInfo(p);
    return '<div data-training-id="' + p.id + '" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:12px 0;border-bottom:1px solid var(--border-soft);">' +
      '<div>' +
      '<div class="checklist__title">' + p.guideTitle + '</div>' +
      '<div class="checklist__desc">From ' + p.ref + ' — flagged for “' + p.failReason + '”</div>' +
      '<div class="small" style="margin-top:3px;color:var(--' + due.cls + ');' + (due.urgent ? 'font-weight:700;' : '') + '">' + due.text + '</div>' +
      '</div>' +
      '<div class="row" style="gap:8px;align-items:center;">' +
      '<span class="pill ' + statusPillClass(p.status) + '">' + statusLabel(p.status) + '</span>' +
      (opts && opts.compact ? '' : '<a class="btn btn--sm" href="agent-guides.html?open=' + p.guideId + '">Read guide</a>') +
      (done ? '' : '<button type="button" class="btn btn--primary btn--sm" data-sign-off-training="' + p.id + '">Sign off</button>') +
      '</div></div>';
  }

  function wireSignOffButtons(root, onDone) {
    root.querySelectorAll("[data-sign-off-training]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-sign-off-training");
        var list = getTrainingPackages();
        list.forEach(function (p) { if (p.id === id) { p.status = "completed"; p.completedAt = new Date().toISOString(); } });
        saveTrainingPackages(list);
        onDone();
      });
    });
  }

  /* Full list — my-training-development.html (the Agent's own "My
     Training & Development" tab): every guide assigned to them, with
     the expected action-by date and a Sign off action once read. */
  function renderMyTraining() {
    var root = document.getElementById("my-training-list");
    if (!root) return;
    var mine = getTrainingPackages().filter(function (p) { return p.agentName === "Rob Ashton"; });

    var openEl = document.getElementById("mytd-kpi-open");
    var overdueEl = document.getElementById("mytd-kpi-overdue");
    var signedOffEl = document.getElementById("mytd-kpi-signed-off");
    if (openEl) openEl.textContent = mine.filter(function (p) { return p.status !== "completed"; }).length;
    if (overdueEl) overdueEl.textContent = mine.filter(function (p) { return p.status !== "completed" && new Date(p.dueAt) - new Date() <= 86400000; }).length;
    if (signedOffEl) signedOffEl.textContent = mine.filter(function (p) { return p.status === "completed"; }).length;

    if (!mine.length) {
      root.innerHTML = '<p class="muted" style="margin:0;">No training assigned right now — nice work.</p>';
      return;
    }
    root.innerHTML = mine.map(function (p) { return trainingItemRow(p); }).join("");
    wireSignOffButtons(root, renderMyTraining);
  }

  /* Compact summary — the "My Training & Development" card on
     my-performance.html: just the count + nearest due date, linking
     through to the full my-training-development.html page. */
  function renderMyTrainingSummary() {
    var root = document.getElementById("my-training-summary");
    if (!root) return;
    var mine = getTrainingPackages().filter(function (p) { return p.agentName === "Rob Ashton" && p.status !== "completed"; });
    if (!mine.length) {
      root.innerHTML = '<p class="muted" style="margin:0;">Nothing assigned right now — nice work.</p>';
      return;
    }
    mine.sort(function (a, b) { return new Date(a.dueAt) - new Date(b.dueAt); });
    var next = dueInfo(mine[0]);
    root.innerHTML =
      '<p style="margin:0 0 4px;">You have <strong>' + mine.length + '</strong> guide' + (mine.length === 1 ? "" : "s") + ' to read and sign off.</p>' +
      '<p class="small" style="margin:0;color:var(--' + next.cls + ');' + (next.urgent ? "font-weight:700;" : "") + '">Next: ' + mine[0].guideTitle + ' — ' + next.text + '</p>';
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

  /* ---- 14b. Guide requests (prototype only) ----
     "Request a guide" on agent-guides.html lets anyone (typically an
     Agent) ask for a new process guide on a given subject. Requests
     are stored in localStorage and rendered two places: the "Guide
     requests" queue on agent-guides.html itself (Trainer role and
     above — the guide authors), and a to-do alert card on the
     Newsfeed landing page so Trainers see it the moment they sign in. */
  var GUIDE_REQUESTS_KEY = "d360-guide-requests";

  function getGuideRequests() {
    try { return JSON.parse(localStorage.getItem(GUIDE_REQUESTS_KEY)) || []; } catch (e) { return []; }
  }
  function saveGuideRequests(list) { localStorage.setItem(GUIDE_REQUESTS_KEY, JSON.stringify(list)); }

  function seedGuideRequests() {
    if (localStorage.getItem(GUIDE_REQUESTS_KEY)) return;
    saveGuideRequests([
      {
        id: "gr1", subject: "Handling angry customers on outbound calls",
        details: "We keep getting escalations on outbound collections calls specifically — could use scripted de-escalation lines for that context.",
        requestedBy: "Grace Thompson", requestedAt: "2026-07-25T09:12:00.000Z", status: "pending"
      },
      {
        id: "gr2", subject: "Processing a partial refund",
        details: "Full refunds are covered but not partial/goodwill refunds — several agents have asked.",
        requestedBy: "James Whitmore", requestedAt: "2026-07-27T14:30:00.000Z", status: "pending"
      }
    ]);
  }

  function guideRequestStatusPill(status) {
    if (status === "done") return '<span class="pill pill--pass">Done</span>';
    if (status === "in-progress") return '<span class="pill pill--info">In progress</span>';
    return '<span class="pill pill--flag">Pending</span>';
  }

  function renderGuideRequestsQueue() {
    var tbody = document.querySelector("[data-guide-requests-queue]");
    if (!tbody) return;
    var list = getGuideRequests();
    tbody.innerHTML = "";
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="muted" style="padding:16px;">No guide requests right now.</td></tr>';
      return;
    }
    list.forEach(function (r) {
      var row = document.createElement("tr");
      var nextStatus = r.status === "pending" ? "in-progress" : r.status === "in-progress" ? "done" : null;
      var actionLabel = r.status === "pending" ? "Start" : r.status === "in-progress" ? "Mark done" : "";
      row.innerHTML =
        '<td class="cell-strong">' + r.subject + '</td>' +
        '<td>' + r.requestedBy + '</td>' +
        '<td class="cell-snippet" title="' + (r.details || "").replace(/"/g, "&quot;") + '">' + (r.details || "—") + '</td>' +
        '<td class="muted">' + new Date(r.requestedAt).toLocaleDateString(undefined, { day: "numeric", month: "short" }) + '</td>' +
        '<td>' + guideRequestStatusPill(r.status) + '</td>' +
        '<td>' + (nextStatus ? '<button type="button" class="btn btn--sm" data-advance-request="' + r.id + '">' + actionLabel + '</button>' : "") + '</td>';
      tbody.appendChild(row);
    });

    tbody.querySelectorAll("[data-advance-request]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-advance-request");
        var list2 = getGuideRequests();
        list2.forEach(function (r) {
          if (r.id === id) r.status = r.status === "pending" ? "in-progress" : "done";
        });
        saveGuideRequests(list2);
        renderGuideRequestsQueue();
        renderGuideRequestsAlert();
      });
    });
  }

  function renderGuideRequestsAlert() {
    var card = document.getElementById("guide-requests-alert");
    if (!card) return;
    var pending = getGuideRequests().filter(function (r) { return r.status !== "done"; });
    if (!pending.length) {
      card.style.display = "none";
      return;
    }
    card.style.display = "";
    var countEl = card.querySelector("[data-guide-requests-count]");
    if (countEl) countEl.textContent = pending.length;
    var list = card.querySelector("[data-guide-requests-list]");
    if (list) {
      list.innerHTML = pending.slice(0, 4).map(function (r) {
        return '<li><div class="checklist__main"><div class="checklist__title">' + r.subject + '</div>' +
          '<div class="checklist__desc">Requested by ' + r.requestedBy + ' · ' +
          new Date(r.requestedAt).toLocaleDateString(undefined, { day: "numeric", month: "short" }) + '</div></div>' +
          guideRequestStatusPill(r.status) + '</li>';
      }).join("");
    }
  }

  function wireGuideRequestForm() {
    var submitBtn = document.getElementById("request-guide-submit");
    if (!submitBtn) return;
    submitBtn.addEventListener("click", function () {
      var subjectEl = document.getElementById("request-guide-subject");
      var detailsEl = document.getElementById("request-guide-details");
      var nameEl = document.getElementById("request-guide-name");
      var subject = (subjectEl.value || "").trim();
      if (!subject) { subjectEl.focus(); return; }

      var list = getGuideRequests();
      list.unshift({
        id: "gr" + Date.now(),
        subject: subject,
        details: (detailsEl.value || "").trim(),
        requestedBy: (nameEl.value || "").trim() || "Anonymous agent",
        requestedAt: new Date().toISOString(),
        status: "pending"
      });
      saveGuideRequests(list);
      renderGuideRequestsQueue();

      subjectEl.value = ""; detailsEl.value = ""; nameEl.value = "";
      var modal = document.getElementById("request-guide-modal");
      if (modal) modal.classList.remove("open");
      renderTeamGuideRequests();
    });
  }

  /* ---- 14c. Team lead training view (prototype only) ----
     training-development.html (Team lead role) shows the same
     training-package and guide-request data as the company-wide view
     above, filtered to the team lead's own roster — Team Priya is the
     only named team in this prototype's dummy data. Requests are
     read-only here (Trainers own working them via agent-guides.html);
     team leads just need visibility into what their team has asked for. */
  var TEAM_PRIYA_ROSTER = ["Priya Nair", "Daniel Okafor", "Grace Thompson", "Marcus Bennett", "Olivia Hughes"];

  function renderTeamTraining() {
    var tbody = document.querySelector("[data-training-queue-team]");
    var list = getTrainingPackages().filter(function (p) { return TEAM_PRIYA_ROSTER.indexOf(p.agentName) !== -1; });
    var openEl = document.getElementById("td-kpi-open-team");
    var completedEl = document.getElementById("td-kpi-completed-team");
    var topGuideEl = document.getElementById("td-kpi-top-guide-team");
    if (openEl || completedEl || topGuideEl) {
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
    if (!tbody) return;
    tbody.innerHTML = "";
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="muted" style="padding:16px;">No training packages assigned to your team yet.</td></tr>';
      return;
    }
    list.forEach(function (p) {
      var row = document.createElement("tr");
      var due = dueInfo(p);
      row.innerHTML =
        '<td class="cell-strong">' + p.agentName + '</td>' +
        '<td class="cell-mono">' + p.ref + '</td>' +
        '<td>' + p.failReason + '</td>' +
        '<td><a href="agent-guides.html?open=' + p.guideId + '">' + p.guideTitle + '</a></td>' +
        '<td><span class="pill ' + statusPillClass(p.status) + '">' + statusLabel(p.status) + '</span></td>' +
        '<td class="muted">' + fmtShortDate(p.assignedAt) + '</td>' +
        '<td style="color:var(--' + due.cls + ');' + (due.urgent ? "font-weight:700;" : "") + '">' + due.text + '</td>';
      tbody.appendChild(row);
    });
  }

  function renderTeamGuideRequests() {
    var tbody = document.querySelector("[data-guide-requests-team]");
    if (!tbody) return;
    var list = getGuideRequests().filter(function (r) { return TEAM_PRIYA_ROSTER.indexOf(r.requestedBy) !== -1; });
    tbody.innerHTML = "";
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="muted" style="padding:16px;">No training requests from your team yet.</td></tr>';
      return;
    }
    list.forEach(function (r) {
      var row = document.createElement("tr");
      row.innerHTML =
        '<td class="cell-strong">' + r.subject + '</td>' +
        '<td>' + r.requestedBy + '</td>' +
        '<td class="cell-snippet" title="' + (r.details || "").replace(/"/g, "&quot;") + '">' + (r.details || "—") + '</td>' +
        '<td class="muted">' + fmtShortDate(r.requestedAt) + '</td>' +
        '<td>' + guideRequestStatusPill(r.status) + '</td>';
      tbody.appendChild(row);
    });
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

  /* ---- 15. User management (users.html, prototype only) ----
     users.html lists every account — Admin, Manager, Team lead,
     Trainer and Agent — and lets an Admin/Manager add or remove a
     user, change their role, and assign an agent to a team lead
     (role change and team-lead assignment happen from the roster
     drawer's "Role & team" section — see the Drawers section above).
     Everything lives in localStorage; there's no real backend or
     RBAC. Team lead assignment is stored as the team lead's name on
     the agent's own record (the same "match by name" convention used
     for training packages and banner authorship elsewhere in this
     file). */
  var USERS_KEY = "d360-users";

  function getUsers() {
    try { return JSON.parse(localStorage.getItem(USERS_KEY)) || []; } catch (e) { return []; }
  }
  function saveUsers(list) { localStorage.setItem(USERS_KEY, JSON.stringify(list)); }

  function seedUsers() {
    if (localStorage.getItem(USERS_KEY)) return;
    saveUsers([
      { id: "u1", name: "Rob Ashton", role: "admin", teamLead: null },
      { id: "u2", name: "Priya Nair", role: "teamlead", teamLead: null },
      { id: "u3", name: "Daniel Okafor", role: "agent", teamLead: "Priya Nair" },
      { id: "u4", name: "Grace Thompson", role: "agent", teamLead: "Priya Nair" },
      { id: "u5", name: "Marcus Bennett", role: "agent", teamLead: "Priya Nair" },
      { id: "u6", name: "Olivia Hughes", role: "agent", teamLead: "Priya Nair" },
      { id: "u7", name: "Charlotte Reid", role: "agent", teamLead: null },
      { id: "u8", name: "James Whitmore", role: "agent", teamLead: null },
      { id: "u9", name: "Hannah Price", role: "trainer", teamLead: null }
    ]);
  }

  function userInitials(name) {
    var parts = String(name).trim().split(/\s+/);
    var first = parts[0] ? parts[0][0] : "";
    var last = parts.length > 1 ? parts[parts.length - 1][0] : "";
    return (first + last).toUpperCase();
  }

  function renderUsersKpis(list) {
    var totalEl = document.getElementById("users-kpi-total");
    if (!totalEl) return;
    var breakdownEl = document.getElementById("users-kpi-breakdown");

    var ROLE_ORDER = ["admin", "manager", "teamlead", "trainer", "agent"];
    var ROLE_SINGULAR = { admin: "admin", manager: "manager", teamlead: "team lead", trainer: "trainer", agent: "agent" };
    var counts = {};
    list.forEach(function (u) { counts[u.role] = (counts[u.role] || 0) + 1; });
    totalEl.textContent = list.length;
    var parts = ROLE_ORDER.filter(function (r) { return counts[r]; }).map(function (r) {
      return counts[r] + " " + ROLE_SINGULAR[r] + (counts[r] === 1 ? "" : "s");
    });
    breakdownEl.textContent = parts.length ? parts.join(" · ") : "—";
  }

  /* Builds a team lead <select>'s options from every current Team lead,
     excluding the user being edited (an agent can't be their own lead)
     and preselecting selectedValue if it's still a valid team lead. */
  function populateTeamLeadOptions(selectEl, selectedValue, excludeId) {
    if (!selectEl) return;
    var leads = getUsers().filter(function (u) { return u.role === "teamlead" && u.id !== excludeId; });
    selectEl.innerHTML = '<option value="">— None —</option>' + leads.map(function (u) {
      return '<option value="' + u.name + '"' + (u.name === selectedValue ? " selected" : "") + '>' + u.name + '</option>';
    }).join("");
  }

  function removeUser(id) {
    var list = getUsers();
    var user = list.filter(function (u) { return u.id === id; })[0];
    if (!user) return;
    list = list.filter(function (u) { return u.id !== id; });
    if (user.role === "teamlead") {
      list.forEach(function (u) { if (u.teamLead === user.name) u.teamLead = null; });
    }
    saveUsers(list);
    renderUsersRoster();
  }

  function renderUsersRoster() {
    var tbody = document.querySelector("[data-users-roster]");
    var list = getUsers();
    renderUsersKpis(list);
    if (!tbody) return;
    tbody.innerHTML = "";
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="muted" style="padding:16px;">No users yet.</td></tr>';
      return;
    }
    list.forEach(function (u) {
      var row = document.createElement("tr");
      row.className = "clickable";
      row.setAttribute("data-open-drawer", "agent-drawer");
      row.setAttribute("data-name", u.name);
      row.setAttribute("data-agent-role", u.role);
      row.setAttribute("data-user-id", u.id);
      var teamLeadCell = u.role === "agent" && u.teamLead ? u.teamLead : '<span class="muted">—</span>';
      row.innerHTML =
        '<td><span class="cell-user"><span class="avatar avatar--sm">' + userInitials(u.name) + '</span><span class="cell-strong">' + u.name + '</span></span></td>' +
        '<td><span class="tag">' + (ROLE_LABELS[u.role] || u.role) + '</span></td>' +
        '<td>' + teamLeadCell + '</td>' +
        '<td><button type="button" class="btn btn--sm btn--ghost" data-remove-user="' + u.id + '">Remove</button></td>';
      tbody.appendChild(row);
    });
    tbody.querySelectorAll("[data-remove-user]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var id = btn.getAttribute("data-remove-user");
        var user = getUsers().filter(function (u) { return u.id === id; })[0];
        if (!user) return;
        if (window.confirm("Remove " + user.name + "? This can't be undone in this prototype session.")) removeUser(id);
      });
    });
    wireDrawerTriggers();
  }

  function wireAddUserModal() {
    var roleSelect = document.getElementById("add-user-role");
    var teamleadRow = document.getElementById("add-user-teamlead-row");
    var teamleadSelect = document.getElementById("add-user-teamlead");
    var nameInput = document.getElementById("add-user-name");
    var emailInput = document.getElementById("add-user-email");
    var submitBtn = document.getElementById("add-user-submit");
    if (!roleSelect || !submitBtn) return;

    function sync() {
      populateTeamLeadOptions(teamleadSelect, teamleadSelect.value, null);
      teamleadRow.style.display = roleSelect.value === "agent" ? "" : "none";
    }
    roleSelect.addEventListener("change", sync);
    document.querySelectorAll('[data-open-modal="add-user-modal"]').forEach(function (trigger) {
      trigger.addEventListener("click", sync);
    });
    sync();

    submitBtn.addEventListener("click", function () {
      var name = nameInput.value.trim();
      if (!name) { nameInput.focus(); return; }
      var role = roleSelect.value;
      var list = getUsers();
      list.push({
        id: "u-" + Date.now(),
        name: name,
        role: role,
        teamLead: role === "agent" ? (teamleadSelect.value || null) : null
      });
      saveUsers(list);
      nameInput.value = "";
      if (emailInput) emailInput.value = "";
      roleSelect.value = "agent";
      sync();
      renderUsersRoster();
      var modal = document.getElementById("add-user-modal");
      if (modal) modal.classList.remove("open");
    });
  }

  /* ---- 16. Customer Simulations dial counter (prototype only) ----
     simulations.html: each persona card's Dial button box has a
     quantity stepper (default 1) so a Trainer can send more than one
     simulated call in a click. Every dial adds that quantity to a
     running "calls dialed today" counter shown next to both the
     Inbound and Outbound search boxes — stored in localStorage keyed
     by today's date, so it naturally resets at midnight rather than
     needing an explicit reset. */
  var SIM_DIAL_KEY = "d360-sim-dial-count";

  function todayKey() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function getSimDialCount() {
    try {
      var rec = JSON.parse(localStorage.getItem(SIM_DIAL_KEY));
      if (rec && rec.date === todayKey()) return rec.count;
    } catch (e) { /* fall through to 0 */ }
    return 0;
  }
  function renderSimDialCount() {
    var count = getSimDialCount();
    document.querySelectorAll("[data-sim-dial-count]").forEach(function (el) { el.textContent = count; });
  }
  function addSimDialCount(n) {
    localStorage.setItem(SIM_DIAL_KEY, JSON.stringify({ date: todayKey(), count: getSimDialCount() + n }));
    renderSimDialCount();
  }

  function wireSimCards() {
    renderSimDialCount();
    document.querySelectorAll(".sim-dial-group").forEach(function (group) {
      var input = group.querySelector(".sim-qty-input");
      var decBtn = group.querySelector("[data-qty-dec]");
      var incBtn = group.querySelector("[data-qty-inc]");
      var callBtn = group.querySelector(".sim-call-btn");
      if (!input || !callBtn) return;

      function clamp() {
        var v = parseInt(input.value, 10);
        if (!v || v < 1) v = 1;
        if (v > 20) v = 20;
        input.value = v;
        return v;
      }
      if (decBtn) decBtn.addEventListener("click", function () { input.value = Math.max(1, (parseInt(input.value, 10) || 1) - 1); });
      if (incBtn) incBtn.addEventListener("click", function () { input.value = Math.min(20, (parseInt(input.value, 10) || 1) + 1); });
      input.addEventListener("change", clamp);

      callBtn.addEventListener("click", function () {
        var qty = clamp();
        addSimDialCount(qty);
        var textEl = document.getElementById("call-modal-text");
        if (textEl) {
          var persona = callBtn.getAttribute("data-dial-persona") || "this persona";
          textEl.textContent = "This would place " + qty + " simulated call" + (qty === 1 ? "" : "s") +
            " to " + persona + " in the live Dial360 Hub, so an agent can rehearse the scenario in real time.";
        }
      });
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    setActiveNav();
    wireLogin();
    wireAccountMenu();
    wireTabs();
    wireModals();
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
    renderTeamTraining();
    renderMyTraining();
    renderMyTrainingSummary();
    openGuideFromQuery();
    seedGuideRequests();
    renderGuideRequestsQueue();
    renderGuideRequestsAlert();
    renderTeamGuideRequests();
    wireGuideRequestForm();
    seedUsers();
    renderUsersRoster();
    // wireDrawers() must run after renderUsersRoster() — it wires up
    // every current [data-open-drawer] element, and the roster rows
    // above are built dynamically from localStorage rather than
    // present in the page's static HTML.
    wireDrawers();
    wireAddUserModal();
    wireSimCards();
  });

  window.D360 = window.D360 || {};
  window.D360.assignTraining = assignTraining;
})();
