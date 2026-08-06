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
  /* Shared by the initial page-load wiring pass below and by
     renderCustomGuides(), which injects new [data-open-modal]
     triggers/.modal-overlay elements after that pass has already run. */
  function wireModalTrigger(trigger) {
    var onGuidesPage = document.body.getAttribute("data-page") === "agent-guides";
    trigger.addEventListener("click", function () {
      var id = trigger.getAttribute("data-open-modal");
      var m = document.getElementById(id);
      if (m) m.classList.add("open");
      if (onGuidesPage && id.indexOf("guide-") === 0) recordGuideRead(id);
    });
  }
  function wireModalOverlay(overlay) {
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay || e.target.hasAttribute("data-close-modal")) {
        overlay.classList.remove("open");
      }
    });
  }

  function wireModals() {
    document.querySelectorAll("[data-open-modal]").forEach(wireModalTrigger);
    document.querySelectorAll(".modal-overlay").forEach(wireModalOverlay);
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

        var personalSection = d && d.querySelector("#drawer-personal-section");
        if (personalSection && userId) {
          var pu = getUsers().filter(function (u) { return u.id === userId; })[0];
          var birthdayInput = personalSection.querySelector("#drawer-birthday-input");
          if (birthdayInput) birthdayInput.value = (pu && pu.birthday) || "";
          var personalNote = personalSection.querySelector("#drawer-personal-note");
          if (personalNote) personalNote.style.display = "none";
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

    var saveBirthdayBtn = document.getElementById("drawer-save-personal");
    if (saveBirthdayBtn) {
      saveBirthdayBtn.addEventListener("click", function () {
        if (!drawerOpenUserId) return;
        var list = getUsers();
        var user = list.filter(function (u) { return u.id === drawerOpenUserId; })[0];
        if (!user) return;
        var birthdayInput = document.getElementById("drawer-birthday-input");
        user.birthday = (birthdayInput && birthdayInput.value) || null;
        saveUsers(list);
        renderUpcomingBirthdays();
        var personalNote = document.getElementById("drawer-personal-note");
        if (personalNote) personalNote.style.display = "block";
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
    "scheduled-dialler": ["admin", "manager", "teamlead"],
    "scheduled-dialler-upload": ["admin", "manager"],
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
    "scheduled-dialler": "Scheduled Dialler", "scheduled-dialler-upload": "Scheduled Dialler – Upload",
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
    renderMyTeamRoster();
    scopeTeamRowsToLead();
  }

  /* Which team lead's roster the "My Team Performance" pages should
     show. Priya Nair is the only team lead with a named role-switch
     sub-option in this prototype, so she's the default whenever the
     generic "Team lead" option (no specific employee) is picked. */
  function currentTeamLeadName() {
    var role = localStorage.getItem(ROLE_KEY) || "admin";
    var employee = localStorage.getItem(EMPLOYEE_KEY) || "";
    return (role === "teamlead" && employee) ? employee : "Priya Nair";
  }

  /* Every user (agents plus the team lead themself) currently
     assigned to teamLeadName via the Users page's per-agent "Team
     lead" field — the same field Admin/Manager edit from a user's
     drawer. Reassigning an agent there is what moves them on/off
     this list. */
  function teamLeadRosterNames(teamLeadName) {
    var names = getUsers().filter(function (u) { return u.teamLead === teamLeadName; }).map(function (u) { return u.name; });
    names.unshift(teamLeadName);
    return names;
  }

  /* Demo performance figures for My Team Performance's roster table —
     kept separate from d360-users (which is account-settings only,
     see Users page) since these are performance numbers, not account
     data. Anyone assigned to a team lead who isn't in this table
     (e.g. reassigned from elsewhere in the prototype) shows dashes
     rather than a fabricated score. */
  var TEAM_PERFORMANCE_STATS = {
    "Priya Nair": { status: "online", interactions: 98, qaScore: 94, wrapup: "8s" },
    "Daniel Okafor": { status: "online", interactions: 112, qaScore: 88, wrapup: "11s" },
    "Grace Thompson": { status: "online", interactions: 87, qaScore: 95, wrapup: "10s" },
    "Marcus Bennett": { status: "away", interactions: 73, qaScore: 79, wrapup: "15s" },
    "Olivia Hughes": { status: "online", interactions: 104, qaScore: 90, wrapup: "10s" }
  };

  function renderMyTeamKpis(members) {
    var teamEl = document.getElementById("mtp-kpi-team");
    if (!teamEl) return;
    var leads = members.filter(function (u) { return u.role === "teamlead"; }).length;
    var agents = members.length - leads;
    teamEl.textContent = members.length;
    document.getElementById("mtp-kpi-team-sub").textContent =
      leads + " team lead" + (leads === 1 ? "" : "s") + " · " + agents + " agent" + (agents === 1 ? "" : "s");

    var stats = members.map(function (u) { return TEAM_PERFORMANCE_STATS[u.name]; }).filter(Boolean);
    var online = stats.filter(function (s) { return s.status === "online"; }).length;
    var away = stats.filter(function (s) { return s.status === "away"; }).length;
    var offline = stats.filter(function (s) { return s.status === "offline"; }).length;
    document.getElementById("mtp-kpi-online").innerHTML = online + '<span class="muted" style="font-size:18px;">/' + members.length + '</span>';
    document.getElementById("mtp-kpi-online-sub").textContent = away + " away · " + offline + " offline";

    var interactions = stats.map(function (s) { return s.interactions; }).filter(function (v) { return typeof v === "number"; });
    document.getElementById("mtp-kpi-interactions").textContent = interactions.length ? interactions.reduce(function (a, b) { return a + b; }, 0) : "–";

    var qaScores = stats.map(function (s) { return s.qaScore; }).filter(function (v) { return typeof v === "number"; });
    document.getElementById("mtp-kpi-qa").textContent = qaScores.length ? Math.round(qaScores.reduce(function (a, b) { return a + b; }, 0) / qaScores.length) : "–";

    var wrapSecs = stats.map(function (s) { return parseInt(s.wrapup, 10); }).filter(function (v) { return !isNaN(v); });
    document.getElementById("mtp-kpi-wrapup").textContent = wrapSecs.length ? Math.round(wrapSecs.reduce(function (a, b) { return a + b; }, 0) / wrapSecs.length) + "s" : "–";
  }

  function renderMyTeamRoster() {
    var tbody = document.querySelector("[data-team-roster]");
    if (!tbody) return;
    var lead = currentTeamLeadName();
    var names = teamLeadRosterNames(lead);
    var members = getUsers().filter(function (u) { return names.indexOf(u.name) !== -1; });
    members.sort(function (a) { return a.name === lead ? -1 : 0; });
    renderMyTeamKpis(members);
    if (!members.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="muted" style="padding:16px;">No team members assigned yet.</td></tr>';
      return;
    }
    tbody.innerHTML = members.map(function (u) {
      var stats = TEAM_PERFORMANCE_STATS[u.name] || { status: "online", interactions: "–", qaScore: "–", wrapup: "–" };
      var statusLabel = stats.status === "online" ? "Online" : stats.status === "away" ? "Away" : "Offline";
      return '<tr class="clickable" data-open-drawer="agent-drawer" data-name="' + u.name + '">' +
        '<td><span class="cell-user"><span class="avatar avatar--sm">' + userInitials(u.name) + '</span><span class="cell-strong">' + u.name + '</span></span></td>' +
        '<td><span class="tag">' + (ROLE_LABELS[u.role] || u.role) + '</span></td>' +
        '<td><span class="status-dot ' + stats.status + '">' + statusLabel + '</span></td>' +
        '<td class="cell-mono">' + stats.interactions + '</td>' +
        '<td class="cell-mono">' + stats.qaScore + '</td>' +
        '<td class="cell-mono">' + stats.wrapup + '</td>' +
        '</tr>';
    }).join("");
    wireDrawerTriggers();
  }

  /* The other "My Team ..." pages (Interaction Stats, QA Review, All
     scored calls) keep their existing per-interaction demo rows, but
     hide any row for an agent no longer on this team lead's roster —
     gated to data-page="my-team-performance" so it never touches the
     full company roster on users.html. */
  function scopeTeamRowsToLead() {
    if (document.body.getAttribute("data-page") !== "my-team-performance") return;
    var names = teamLeadRosterNames(currentTeamLeadName());
    document.querySelectorAll("table.data tbody tr[data-name]").forEach(function (row) {
      if (row.closest("[data-team-roster]")) return; // already scoped by renderMyTeamRoster()
      row.style.display = names.indexOf(row.getAttribute("data-name")) !== -1 ? "" : "none";
    });
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

  /* Repairs packages saved by an older version of this prototype that
     didn't set dueAt (or set it from a bad assignedAt) — without this,
     those packages render "Action by Invalid Date" forever, since
     dueAt is only ever computed once, at assignment time. */
  function getTrainingPackages() {
    var list;
    try { list = JSON.parse(localStorage.getItem(TRAINING_KEY)) || []; } catch (e) { return []; }
    var repaired = false;
    list.forEach(function (p) {
      if (!p.dueAt || isNaN(new Date(p.dueAt).getTime())) {
        p.dueAt = addDays(p.assignedAt && !isNaN(new Date(p.assignedAt).getTime()) ? p.assignedAt : new Date().toISOString(), DUE_WINDOW_DAYS);
        repaired = true;
      }
    });
    if (repaired) saveTrainingPackages(list);
    return list;
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
    var canSignOff = !!p.readAt;
    return '<div data-training-id="' + p.id + '" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:12px 0;border-bottom:1px solid var(--border-soft);">' +
      '<div>' +
      '<div class="checklist__title">' + p.guideTitle + '</div>' +
      '<div class="checklist__desc">From ' + p.ref + ' — flagged for “' + p.failReason + '”</div>' +
      '<div class="small" style="margin-top:3px;color:var(--' + due.cls + ');' + (due.urgent ? 'font-weight:700;' : '') + '">' + due.text + '</div>' +
      '</div>' +
      '<div class="row" style="gap:8px;align-items:center;">' +
      '<span class="pill ' + statusPillClass(p.status) + '">' + statusLabel(p.status) + '</span>' +
      (opts && opts.compact ? '' : '<a class="btn btn--sm" href="agent-guides.html?open=' + p.guideId + '&mine=1">Read guide</a>') +
      (done ? '' : canSignOff
        ? '<button type="button" class="btn btn--primary btn--sm" data-sign-off-training="' + p.id + '">Sign off</button>'
        : (opts && opts.compact ? '' : '<span class="small muted">Read the guide to unlock sign-off</span>')) +
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

  /* ---- 13b. Guide read acknowledgments (prototype only) ----
     Records every time the current agent (always "Rob Ashton" in this
     single-user prototype, same convention as My QA / My Performance)
     opens a guide on agent-guides.html — both a running history for
     Trainers/Admins/Managers ("Guide read history" on Training &
     Development) and the gate that unlocks Sign off on a matching
     open training package: trainingItemRow() only shows Sign off once
     p.readAt is set. */
  var GUIDE_READS_KEY = "d360-guide-reads";
  var CURRENT_AGENT_NAME = "Rob Ashton";

  function getGuideReads() {
    try { return JSON.parse(localStorage.getItem(GUIDE_READS_KEY)) || []; } catch (e) { return []; }
  }
  function saveGuideReads(list) { localStorage.setItem(GUIDE_READS_KEY, JSON.stringify(list)); }

  function recordGuideRead(guideId) {
    var titleEl = document.getElementById(guideId + "-title");
    var title = titleEl ? titleEl.textContent : guideId;
    var readAt = new Date().toISOString();

    var reads = getGuideReads();
    reads.unshift({ agentName: CURRENT_AGENT_NAME, guideId: guideId, guideTitle: title, readAt: readAt });
    saveGuideReads(reads);

    var packages = getTrainingPackages();
    var changed = false;
    packages.forEach(function (p) {
      if (p.agentName === CURRENT_AGENT_NAME && p.guideId === guideId && p.status !== "completed" && !p.readAt) {
        p.readAt = readAt;
        changed = true;
      }
    });
    if (changed) saveTrainingPackages(packages);
    renderGuideReadHistory();
  }

  /* Trainer/Admin/Manager-facing log — training-development.html's
     "Guide read history" card. Most recent acknowledgment first. */
  function renderGuideReadHistory() {
    var tbody = document.querySelector("[data-guide-read-history]");
    if (!tbody) return;
    var reads = getGuideReads();
    if (!reads.length) {
      tbody.innerHTML = '<tr><td colspan="3" class="muted" style="padding:16px;">No guides have been read yet.</td></tr>';
      return;
    }
    tbody.innerHTML = reads.map(function (r) {
      return '<tr>' +
        '<td class="cell-strong">' + r.agentName + '</td>' +
        '<td><a href="agent-guides.html?open=' + r.guideId + '">' + r.guideTitle + '</a></td>' +
        '<td class="muted">' + new Date(r.readAt).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) + '</td>' +
        '</tr>';
    }).join("");
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
    // &mine=1 only appears on the agent's own "Read guide" links (My
    // Training & Development) — the Trainer queue's guide-title link
    // omits it, since a Trainer opening a guide to review it isn't the
    // agent acknowledging they've read it.
    if (params.get("mine") === "1") recordGuideRead(id);
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

  /* ---- 14d. Guide management: add/edit/remove (Admin/Manager/Trainer) ----
     The 9 built-in guides stay real static HTML — title, tags,
     description, "Updated" date, and their bespoke step-by-step modal.
     Editing one only layers a title/category/tags/description/updated
     override on top (applyGuideOverrides()), plus an optional
     plain-text body that replaces the modal's content if the admin
     chooses to fill it in — the rich step-by-step markup is never
     duplicated into JS. Guides created via "Add a guide" are fully
     custom instead: stored whole in d360-guides-custom and rendered
     (card + modal) from scratch by renderCustomGuides(). Removing
     either kind just adds its id to a shared "removed" list. */
  var GUIDE_OVERRIDES_KEY = "d360-guide-overrides";
  var GUIDE_REMOVED_KEY = "d360-guide-removed";
  var CUSTOM_GUIDES_KEY = "d360-guides-custom";
  var guideFormEditingId = null;

  function getGuideOverrides() {
    try { return JSON.parse(localStorage.getItem(GUIDE_OVERRIDES_KEY)) || {}; } catch (e) { return {}; }
  }
  function saveGuideOverrides(map) { localStorage.setItem(GUIDE_OVERRIDES_KEY, JSON.stringify(map)); }

  function getGuideRemoved() {
    try { return JSON.parse(localStorage.getItem(GUIDE_REMOVED_KEY)) || []; } catch (e) { return []; }
  }
  function saveGuideRemoved(list) { localStorage.setItem(GUIDE_REMOVED_KEY, JSON.stringify(list)); }

  function getCustomGuides() {
    try { return JSON.parse(localStorage.getItem(CUSTOM_GUIDES_KEY)) || []; } catch (e) { return []; }
  }
  function saveCustomGuides(list) { localStorage.setItem(CUSTOM_GUIDES_KEY, JSON.stringify(list)); }

  function fmtGuideDate(iso) {
    return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
  }

  function guideBodyHtml(bodyText) {
    var lines = String(bodyText || "").split("\n").map(function (l) { return l.trim(); }).filter(Boolean);
    return lines.length ? lines.map(function (l) { return "<p>" + l + "</p>"; }).join("") : "";
  }

  function guideCategoryGrid(category) {
    var heading = Array.prototype.filter.call(document.querySelectorAll(".section-title"), function (h) {
      return h.textContent.trim() === category;
    })[0];
    return heading ? heading.nextElementSibling : null;
  }

  function categoryOfGuideCard(card) {
    var grid = card.parentElement;
    var heading = grid && grid.previousElementSibling;
    return (heading && heading.classList.contains("section-title")) ? heading.textContent.trim() : "Compliance & Verification";
  }

  /* Re-applies every saved override on top of the static guide cards —
     called once at load, and again after every edit. */
  function applyGuideOverrides() {
    var overrides = getGuideOverrides();
    Object.keys(overrides).forEach(function (id) {
      var card = document.querySelector('[data-guide-card="' + id + '"]');
      if (!card) return;
      var o = overrides[id];
      var titleEl = card.querySelector(".card__head h3");
      if (titleEl && o.title) titleEl.textContent = o.title;
      var tagsRow = card.querySelector(".card__body .row");
      if (tagsRow && o.tags) tagsRow.innerHTML = o.tags.map(function (t) { return '<span class="tag">' + t + "</span>"; }).join("");
      var descEl = card.querySelector(".card__body p");
      if (descEl && o.description) descEl.textContent = o.description;
      var updatedEl = card.querySelector(".card__foot .small.muted");
      if (updatedEl && o.updatedAt) updatedEl.textContent = "Updated " + fmtGuideDate(o.updatedAt);

      var modalTitleEl = document.getElementById(id + "-title");
      if (modalTitleEl && o.title) modalTitleEl.textContent = o.title;
      if (o.bodyText) {
        var modal = document.getElementById(id);
        var modalBody = modal && modal.querySelector(".modal__body");
        if (modalBody) modalBody.innerHTML = guideBodyHtml(o.bodyText);
      }

      if (o.category) {
        var grid = guideCategoryGrid(o.category);
        if (grid && card.parentElement !== grid) grid.appendChild(card);
      }
    });
  }

  function applyGuideRemovals() {
    getGuideRemoved().forEach(function (id) {
      var card = document.querySelector('[data-guide-card="' + id + '"]');
      if (card) card.style.display = "none";
    });
  }

  function guideCardHtml(g) {
    return '<div class="card" data-guide-card="' + g.id + '">' +
      '<div class="card__head"><h3>' + g.title + "</h3></div>" +
      '<div class="card__body">' +
      '<div class="row" style="gap:6px;margin-bottom:12px;">' + (g.tags || []).map(function (t) { return '<span class="tag">' + t + "</span>"; }).join("") + "</div>" +
      '<p class="muted" style="margin:0;">' + (g.description || "") + "</p>" +
      "</div>" +
      '<div class="card__foot row" style="justify-content:space-between;align-items:center;">' +
      '<span class="small muted">Updated ' + fmtGuideDate(g.updatedAt) + "</span>" +
      '<button class="btn btn--primary btn--sm" type="button" data-open-modal="' + g.id + '">Open guide</button>' +
      '<span class="row" style="gap:6px;" data-roles="admin,manager,trainer">' +
      '<button class="btn btn--ghost btn--sm" type="button" data-edit-guide="' + g.id + '">Edit</button>' +
      '<button class="btn btn--ghost btn--sm" type="button" data-remove-guide="' + g.id + '">Remove</button>' +
      "</span></div></div>";
  }

  function guideModalHtml(g) {
    var body = guideBodyHtml(g.bodyText) || '<p class="muted">No details added for this guide yet.</p>';
    return '<div class="modal-overlay" id="' + g.id + '">' +
      '<div class="modal modal--guide" role="dialog" aria-modal="true" aria-labelledby="' + g.id + '-title">' +
      '<div class="modal__head"><h3 id="' + g.id + '-title">' + g.title + "</h3>" +
      '<button class="icon-btn" data-close-modal aria-label="Close">×</button></div>' +
      '<div class="modal__body">' + body + "</div>" +
      '<div class="modal__foot"><button class="btn" data-close-modal>Close</button></div>' +
      "</div></div>";
  }

  /* Rebuilds every custom (admin-added) guide's card + modal from
     scratch — simplest way to keep them in sync after an add/edit/
     remove, since there are only ever a handful in this prototype. */
  function renderCustomGuides() {
    var modalsContainer = document.getElementById("custom-guide-modals");
    if (!modalsContainer) return;
    document.querySelectorAll('[data-guide-card^="guide-custom-"]').forEach(function (el) { el.remove(); });
    modalsContainer.innerHTML = "";

    var removed = getGuideRemoved();
    var guides = getCustomGuides().filter(function (g) { return removed.indexOf(g.id) === -1; });
    guides.forEach(function (g) {
      var grid = guideCategoryGrid(g.category);
      if (grid) grid.insertAdjacentHTML("beforeend", guideCardHtml(g));
      modalsContainer.insertAdjacentHTML("beforeend", guideModalHtml(g));
    });
    document.querySelectorAll('[data-guide-card^="guide-custom-"] [data-open-modal]').forEach(wireModalTrigger);
    modalsContainer.querySelectorAll(".modal-overlay").forEach(wireModalOverlay);
  }

  function wireGuideManagement() {
    var modal = document.getElementById("add-guide-modal");
    if (!modal) return;

    var titleInput = document.getElementById("guide-form-title");
    var categorySelect = document.getElementById("guide-form-category");
    var tagsInput = document.getElementById("guide-form-tags");
    var descInput = document.getElementById("guide-form-description");
    var bodyInput = document.getElementById("guide-form-body");
    var modalTitleEl = document.getElementById("add-guide-modal-title");
    var bodyNote = document.getElementById("guide-form-body-note");

    function resetForm() {
      guideFormEditingId = null;
      titleInput.value = "";
      categorySelect.value = "Compliance & Verification";
      tagsInput.value = "";
      descInput.value = "";
      bodyInput.value = "";
      modalTitleEl.textContent = "Add a guide";
      bodyNote.textContent = 'Optional — one paragraph per line.';
    }

    document.querySelectorAll('.page-head [data-open-modal="add-guide-modal"]').forEach(function (btn) {
      btn.addEventListener("click", resetForm);
    });

    document.addEventListener("click", function (e) {
      var editBtn = e.target.closest("[data-edit-guide]");
      if (editBtn) {
        var id = editBtn.getAttribute("data-edit-guide");
        guideFormEditingId = id;
        var custom = getCustomGuides().filter(function (g) { return g.id === id; })[0];
        if (custom) {
          titleInput.value = custom.title;
          categorySelect.value = custom.category;
          tagsInput.value = (custom.tags || []).join(", ");
          descInput.value = custom.description || "";
          bodyInput.value = custom.bodyText || "";
          bodyNote.textContent = "One paragraph per line.";
        } else {
          var card = document.querySelector('[data-guide-card="' + id + '"]');
          var o = getGuideOverrides()[id] || {};
          var cardTags = card ? Array.prototype.map.call(card.querySelectorAll(".card__body .row .tag"), function (t) { return t.textContent; }) : [];
          titleInput.value = o.title || (card ? card.querySelector(".card__head h3").textContent.trim() : id);
          categorySelect.value = o.category || (card ? categoryOfGuideCard(card) : "Compliance & Verification");
          tagsInput.value = (o.tags || cardTags).join(", ");
          descInput.value = o.description || (card ? card.querySelector(".card__body p").textContent.trim() : "");
          bodyInput.value = o.bodyText || "";
          bodyNote.textContent = 'Leave blank to keep this guide\'s current step-by-step content — filling it in replaces "Open guide" with plain text.';
        }
        modalTitleEl.textContent = "Edit guide";
        modal.classList.add("open");
        return;
      }

      var removeBtn = e.target.closest("[data-remove-guide]");
      if (removeBtn) {
        var rid = removeBtn.getAttribute("data-remove-guide");
        var card2 = document.querySelector('[data-guide-card="' + rid + '"]');
        var name = card2 ? card2.querySelector(".card__head h3").textContent.trim() : rid;
        if (window.confirm('Remove "' + name + '"? This can\'t be undone in this prototype session.')) {
          var removedList = getGuideRemoved();
          if (removedList.indexOf(rid) === -1) removedList.push(rid);
          saveGuideRemoved(removedList);
          applyGuideRemovals();
          renderCustomGuides();
        }
      }
    });

    document.getElementById("guide-form-submit").addEventListener("click", function () {
      var title = titleInput.value.trim();
      if (!title) { titleInput.focus(); return; }
      var category = categorySelect.value;
      var tags = tagsInput.value.split(",").map(function (t) { return t.trim(); }).filter(Boolean);
      var description = descInput.value.trim();
      var bodyText = bodyInput.value.trim();
      var now = new Date().toISOString();

      if (guideFormEditingId) {
        var custom = getCustomGuides().filter(function (g) { return g.id === guideFormEditingId; })[0];
        if (custom) {
          custom.title = title; custom.category = category; custom.tags = tags;
          custom.description = description; custom.updatedAt = now;
          if (bodyText) custom.bodyText = bodyText;
          saveCustomGuides(getCustomGuides().map(function (g) { return g.id === custom.id ? custom : g; }));
        } else {
          var overrides = getGuideOverrides();
          var existing = overrides[guideFormEditingId] || {};
          overrides[guideFormEditingId] = {
            title: title, category: category, tags: tags, description: description,
            updatedAt: now, bodyText: bodyText || existing.bodyText
          };
          saveGuideOverrides(overrides);
          applyGuideOverrides();
        }
      } else {
        var list = getCustomGuides();
        list.unshift({
          id: "guide-custom-" + Date.now(),
          title: title, category: category, tags: tags, description: description,
          updatedAt: now, bodyText: bodyText
        });
        saveCustomGuides(list);
      }
      renderCustomGuides();
      modal.classList.remove("open");
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
      { id: "u2", name: "Priya Nair", role: "teamlead", teamLead: null, birthday: "1990-07-02" },
      { id: "u3", name: "Daniel Okafor", role: "agent", teamLead: "Priya Nair" },
      { id: "u4", name: "Grace Thompson", role: "agent", teamLead: "Priya Nair" },
      { id: "u5", name: "Marcus Bennett", role: "agent", teamLead: "Priya Nair", birthday: "1990-07-09" },
      { id: "u6", name: "Olivia Hughes", role: "agent", teamLead: "Priya Nair", birthday: "1990-07-15" },
      { id: "u7", name: "Charlotte Reid", role: "agent", teamLead: null, birthday: "1990-07-22" },
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

  /* This year's (or next year's, if it's already passed) occurrence of
     a "YYYY-MM-DD" birthday string — the stored year is just whatever
     the date picker needed, it's never shown or used for age. */
  function nextBirthdayOccurrence(iso) {
    var parts = iso.split("-");
    var month = parseInt(parts[1], 10) - 1;
    var day = parseInt(parts[2], 10);
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var next = new Date(today.getFullYear(), month, day);
    if (next < today) next = new Date(today.getFullYear() + 1, month, day);
    return next;
  }

  /* Newsfeed's "Upcoming birthdays" card — reads whatever's been typed
     into each user's Personal details on users.html, rather than a
     fixed list, so it always reflects the current roster. */
  function renderUpcomingBirthdays() {
    var listEl = document.querySelector("[data-birthdays-list]");
    if (!listEl) return;
    var withBirthday = getUsers().filter(function (u) { return u.birthday; });
    withBirthday.forEach(function (u) { u._next = nextBirthdayOccurrence(u.birthday); });
    withBirthday.sort(function (a, b) { return a._next - b._next; });
    var upcoming = withBirthday.slice(0, 5);
    if (!upcoming.length) {
      listEl.innerHTML = '<li class="muted small">No birthdays on file yet — add one from a user\'s profile on the Users page.</li>';
      return;
    }
    listEl.innerHTML = upcoming.map(function (u) {
      return '<li><span class="avatar avatar--sm">' + userInitials(u.name) + '</span>' +
        '<div class="checklist__main"><div class="checklist__title">' + u.name + '</div>' +
        '<div class="checklist__desc">' + u._next.toLocaleDateString(undefined, { day: "numeric", month: "short" }) + '</div></div></li>';
    }).join("");
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

  /* Scheduled Dialler's Agents page — the "Not available" worker list
     mirrors the Users roster exactly (same people, plain names) rather
     than a separate hardcoded list, so editing Users keeps this page
     in sync. Skills are illustrative Twilio worker attributes with no
     backing data of their own, so they're assigned by rotating a fixed
     list rather than stored per user. */
  var DIALLER_SKILLS = ["Collections", "Sales", "Email Support", "Complaints", "Technical Support"];
  function renderDiallerAgents() {
    var tbody = document.getElementById("dialler-agents-body");
    if (!tbody) return;
    var list = getUsers();
    document.querySelectorAll("#dialler-agents-count").forEach(function (el) { el.textContent = list.length; });
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="2" class="muted" style="text-align:center;padding:22px;">None.</td></tr>';
      return;
    }
    tbody.innerHTML = list.map(function (u, i) {
      var skill = DIALLER_SKILLS[i % DIALLER_SKILLS.length];
      return '<tr>' +
        '<td><span class="cell-user"><span class="avatar avatar--sm">' + userInitials(u.name) + '</span><span class="cell-strong">' + u.name + '</span></span></td>' +
        '<td><span class="pill pill--info">' + skill + '</span></td>' +
        '</tr>';
    }).join("");
  }

  function wireAddUserModal() {
    var roleSelect = document.getElementById("add-user-role");
    var teamleadRow = document.getElementById("add-user-teamlead-row");
    var teamleadSelect = document.getElementById("add-user-teamlead");
    var nameInput = document.getElementById("add-user-name");
    var emailInput = document.getElementById("add-user-email");
    var birthdayInput = document.getElementById("add-user-birthday");
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
        teamLead: role === "agent" ? (teamleadSelect.value || null) : null,
        birthday: (birthdayInput && birthdayInput.value) || null
      });
      saveUsers(list);
      nameInput.value = "";
      if (emailInput) emailInput.value = "";
      if (birthdayInput) birthdayInput.value = "";
      roleSelect.value = "agent";
      sync();
      renderUsersRoster();
      renderUpcomingBirthdays();
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
    seedUsers();
    renderDiallerAgents();
    renderUpcomingBirthdays();
    wireRoleSwitch();
    seedTrainingPackages();
    renderTrainingQueue();
    renderGuideReadHistory();
    renderTeamTraining();
    renderMyTraining();
    renderMyTrainingSummary();
    applyGuideOverrides();
    applyGuideRemovals();
    renderCustomGuides();
    wireGuideManagement();
    openGuideFromQuery();
    seedGuideRequests();
    renderGuideRequestsQueue();
    renderGuideRequestsAlert();
    renderTeamGuideRequests();
    wireGuideRequestForm();
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
