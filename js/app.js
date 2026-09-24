/* ============================================================
   Dial360 Admin Dashboard — shared prototype JS
   Handles: nav active-state, fake login redirect, account menu,
   tabs, modals, drawers, and other visual-only toggles.
   No data fetching — this is a static mock.
   ============================================================ */
(function () {
  "use strict";

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

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

  /* ---- 3b. Verdict toggles (P/F/N-A/PWD button groups) ----
     Generic click-to-activate for any .colin-verdict button group present
     in a page's static HTML (scorecard.html, calibration.html). Runs once
     at load, so it only wires markup that's already in the DOM — it never
     touches colin-scorecard.html's own buttons, which js/colin.js creates
     dynamically (after this runs) and wires itself, with its own
     verdicts-array + running-score side effects. */
  function wireVerdictToggles() {
    document.querySelectorAll(".colin-verdict").forEach(function (group) {
      // .blind-mark-btn buttons (scorecard.html's blind marking form) get
      // their own dedicated wiring from wireBlindScorecard(), which also
      // records the selection and updates the submit button — skip them
      // here so a click doesn't run both.
      group.querySelectorAll("button:not(.blind-mark-btn)").forEach(function (btn) {
        if (btn.dataset.verdictWired) return; // idempotent — safe to call more than once
        btn.dataset.verdictWired = "1";
        btn.addEventListener("click", function () {
          group.querySelectorAll("button").forEach(function (b) { b.classList.remove("active"); });
          btn.classList.add("active");
        });
      });
    });
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

  /* ---- 9b. Newsfeed business updates (prototype only) ----
     newsfeed.html's "Recent business updates" list is a d360-business-
     updates localStorage array (title, category tag, date, description).
     Manager and Admin get an "Add update" button on the card and
     pencil/trash icons on each item, opening the same modal in add or
     edit mode; everyone else sees a read-only list. */
  var BUSINESS_UPDATES_KEY = "d360-business-updates";
  var businessUpdateEditingId = null;

  function seedBusinessUpdates() {
    if (localStorage.getItem(BUSINESS_UPDATES_KEY)) return;
    saveBusinessUpdates([
      { id: "bu1", title: "New AI wrap-up model rolled out", category: "Product", date: "29 Jun", desc: "Average wrap-up time is now down to ~9s across the team following this week's model upgrade." },
      { id: "bu2", title: "Dial360 shortlisted for CX Awards 2026", category: "Company", date: "27 Jun", desc: "We're a finalist in “Best Use of AI in Customer Service” — winners announced in August." },
      { id: "bu3", title: "Salesforce integration now live", category: "Product", date: "24 Jun", desc: "Interaction history now syncs automatically to linked Salesforce records." },
      { id: "bu4", title: "Office closed — Summer Bank Holiday", category: "HR", date: "20 Jun", desc: "Office closed Monday 25 August. Live coverage continues via the Hub as normal." }
    ]);
  }
  function getBusinessUpdates() {
    try { return JSON.parse(localStorage.getItem(BUSINESS_UPDATES_KEY)) || []; } catch (e) { return []; }
  }
  function saveBusinessUpdates(list) { localStorage.setItem(BUSINESS_UPDATES_KEY, JSON.stringify(list)); }

  function renderBusinessUpdates() {
    var list = document.querySelector("[data-business-updates-list]");
    if (!list) return;
    var updates = getBusinessUpdates();
    list.innerHTML = updates.length ? updates.map(function (u) {
      return (
        '<li>' +
          '<div class="checklist__main">' +
            '<div class="checklist__title">' + u.title + ' <span class="tag" style="margin-left:6px;">' + u.category + '</span></div>' +
            '<div class="checklist__desc">' + u.desc + ' · ' + u.date + '</div>' +
          '</div>' +
          '<div class="row" style="gap:2px;flex:none;" data-roles="admin,manager">' +
            '<button type="button" class="icon-btn" data-edit-business-update="' + u.id + '" title="Edit update" aria-label="Edit ' + u.title + '">' +
              '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>' +
            '</button>' +
            '<button type="button" class="icon-btn" data-delete-business-update="' + u.id + '" title="Delete update" aria-label="Delete ' + u.title + '">' +
              '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>' +
            '</button>' +
          '</div>' +
        '</li>'
      );
    }).join("") : '<li class="muted small">No business updates yet.</li>';
    wireBusinessUpdateRowActions(list);
    applyRole(localStorage.getItem(ROLE_KEY) || "admin", localStorage.getItem(EMPLOYEE_KEY) || "");
  }

  function wireBusinessUpdateRowActions(list) {
    list.querySelectorAll("[data-edit-business-update]").forEach(function (btn) {
      btn.addEventListener("click", function () { openBusinessUpdateModal(btn.getAttribute("data-edit-business-update")); });
    });
    list.querySelectorAll("[data-delete-business-update]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-delete-business-update");
        var u = getBusinessUpdates().filter(function (x) { return x.id === id; })[0];
        if (!u) return;
        if (window.confirm("Delete “" + u.title + "”? This can't be undone in this prototype session.")) {
          saveBusinessUpdates(getBusinessUpdates().filter(function (x) { return x.id !== id; }));
          renderBusinessUpdates();
        }
      });
    });
  }

  function openBusinessUpdateModal(id) {
    businessUpdateEditingId = id || null;
    var titleEl = document.getElementById("business-update-modal-title");
    var u = id ? getBusinessUpdates().filter(function (x) { return x.id === id; })[0] : null;
    if (titleEl) titleEl.textContent = u ? "Edit business update" : "Add business update";
    document.getElementById("business-update-title").value = u ? u.title : "";
    document.getElementById("business-update-category").value = u ? u.category : "Product";
    document.getElementById("business-update-date").value = u ? u.date : "";
    document.getElementById("business-update-desc").value = u ? u.desc : "";
    var modal = document.getElementById("business-update-modal");
    if (modal) modal.classList.add("open");
  }

  function wireBusinessUpdateModal() {
    var addBtn = document.getElementById("add-business-update-btn");
    var saveBtn = document.getElementById("business-update-save");
    if (addBtn) addBtn.addEventListener("click", function () { openBusinessUpdateModal(null); });
    if (!saveBtn) return;
    saveBtn.addEventListener("click", function () {
      var title = document.getElementById("business-update-title").value.trim();
      if (!title) return;
      var category = document.getElementById("business-update-category").value;
      var date = document.getElementById("business-update-date").value.trim() || "Today";
      var desc = document.getElementById("business-update-desc").value.trim();
      var list = getBusinessUpdates();
      if (businessUpdateEditingId) {
        var existing = list.filter(function (x) { return x.id === businessUpdateEditingId; })[0];
        if (existing) { existing.title = title; existing.category = category; existing.date = date; existing.desc = desc; }
      } else {
        list.unshift({ id: "bu" + Date.now(), title: title, category: category, date: date, desc: desc });
      }
      saveBusinessUpdates(list);
      renderBusinessUpdates();
      var modal = document.getElementById("business-update-modal");
      if (modal) modal.classList.remove("open");
      businessUpdateEditingId = null;
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
    logs: ["admin", "manager", "teamlead"],
    "my-performance": ["agent"],
    qa: ["admin", "manager", "trainer"],
    tasks: ["admin", "manager", "teamlead"],
    "my-qa": ["agent"],
    "my-training-development": ["agent"],
    analytics: ["admin", "manager"],
    users: ["admin", "manager"],
    templates: ["admin", "manager", "teamlead", "trainer"],
    simulations: ["admin", "manager", "teamlead", "trainer"],
    "new-simulations": ["admin", "manager", "teamlead", "trainer"],
    "colin-scorecard": ["admin", "manager", "teamlead", "trainer"],
    "training-development": ["admin", "manager", "teamlead", "trainer"],
    "agent-guides": ["admin", "manager", "teamlead", "trainer", "agent"],
    billing: ["admin"],
    settings: ["admin"]
  };
  var NAV_LABELS = {
    newsfeed: "Newsfeed", overview: "Overview", "call-centre-dashboard": "Call Centre Dashboard",
    "scheduled-dialler": "Scheduled Dialler", "scheduled-dialler-upload": "Scheduled Dialler – Upload",
    logs: "Logs",
    "my-performance": "My Performance", qa: "QA Review", tasks: "Tasks",
    "my-qa": "My QA", "my-training-development": "My Training & Development",
    analytics: "Analytics", users: "Users", templates: "Templates",
    simulations: "Customer Simulations", "new-simulations": "New Simulations", "colin-scorecard": "Colin Scorecard",
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
    scopeQaQueueToReviewer();
    refreshBlindState();
    renderAiHumanDiff();
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

  /* Same "which named identity is this role-switch view standing in
     for" pattern as currentTeamLeadName(), but for Trainer — Hannah
     Price is the only trainer seeded, so she's the default whenever
     the generic "Trainer" option (no specific employee) is picked. */
  function currentTrainerName() {
    var role = localStorage.getItem(ROLE_KEY) || "admin";
    var employee = localStorage.getItem(EMPLOYEE_KEY) || "";
    return (role === "trainer" && employee) ? employee : "Hannah Price";
  }

  /* null for Admin/Manager (they see the whole queue — assigning and
     routing calls is their job), otherwise the standing identity for
     whichever reviewer role is currently being viewed as. */
  function currentQaReviewerName() {
    var role = localStorage.getItem(ROLE_KEY) || "admin";
    if (role === "teamlead") return currentTeamLeadName();
    if (role === "trainer") return currentTrainerName();
    return null;
  }

  /* QA Review's flagged queue: a Trainer/Team lead only does the
     marking on calls assigned to them (via the "Assigned reviewer"
     column, or scorecard.html's own "Assign to reviewer" control while
     Needs Review) — everything else is someone else's work and stays
     out of their queue. Gated to data-page="qa" so it never touches
     the same [data-colin-queue] markup this function reads on
     newsfeed.html. */
  function scopeQaQueueToReviewer() {
    if (document.body.getAttribute("data-page") !== "qa") return;
    var tbody = document.querySelector("tbody[data-colin-queue]");
    if (!tbody) return;
    var emptyRow = tbody.querySelector("[data-qa-queue-empty]");
    var reviewer = currentQaReviewerName();
    var visibleCount = 0;
    Array.prototype.forEach.call(tbody.querySelectorAll("tr:not([data-qa-queue-empty])"), function (row) {
      var show = true;
      if (reviewer) {
        var cell = row.querySelector("[data-status-cell]");
        var ref = cell ? cell.getAttribute("data-status-cell") : null;
        show = !!ref && qaAssignedReviewer(ref) === reviewer;
      }
      row.style.display = show ? "" : "none";
      if (show) visibleCount++;
    });
    if (reviewer && !visibleCount) {
      if (!emptyRow) {
        emptyRow = document.createElement("tr");
        emptyRow.setAttribute("data-qa-queue-empty", "");
        emptyRow.innerHTML = '<td colspan="7" class="muted" style="padding:16px;">No calls currently assigned to you for review.</td>';
        tbody.appendChild(emptyRow);
      }
      emptyRow.style.display = "";
    } else if (emptyRow) {
      emptyRow.style.display = "none";
    }
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

    // A submission that clears the auto-QA gate (see qaGatePass above)
    // never appears here at all — it's silently published to the agent.
    // Only ones that failed the gate need a manager to route them.
    submissions.filter(function (r) { return !qaGatePass(r.score / 10, r.operationalScore / 10); })
      .forEach(function (r) {
        var row = document.createElement("tr");
        var scoreColor = r.score >= 70 ? "var(--success)" : r.score >= 50 ? "var(--warning)" : "var(--danger)";
        row.innerHTML =
          '<td class="cell-mono">' + r.ref + ' <span class="tag" title="Marked in QA Colin (SDL)">Colin</span></td>' +
          '<td><span class="cell-user">' + r.agentName + '</span></td>' +
          '<td class="cell-mono">' + fmtShortDate(r.submittedAt) + '</td>' +
          '<td><span class="cell-strong" style="color:' + scoreColor + ';">' + r.score + '/100</span></td>' +
          '<td data-status-cell="' + r.ref + '"></td>' +
          '<td data-assign-cell="' + r.ref + '"></td>' +
          '<td data-roles="admin,manager" data-ai-diff="' + r.ref + '">–</td>';
        tbody.insertBefore(row, tbody.firstChild);
      });
  }

  /* ---- 12c. Blind QA scorecard review (prototype only) ----
     scorecard.html's "Your scorecard" lets a reviewer mark all 20
     Compliance/Operational criteria themselves — the same rubric as
     QA Colin's own evaluation — before seeing anything the AI decided.
     The flagged banner, the AI's own "Evaluation"/"Score breakdown"/
     "Flagged moment" cards, and Reviewer actions all carry
     .blind-reveal.blind-hidden and only reappear once the reviewer
     submits (or immediately for the Agent viewing their own call,
     who isn't doing a fresh review). The comparison is saved to
     d360-blind-reviews, keyed by interaction ref, which also feeds
     the Manager/Admin-only "AI vs Human" column on the QA Review
     queue below. Only the 10 Compliance criteria count toward the
     headline AI/human score (matching QA Colin's own scoring, where
     Operational is tracked separately) — all 20 still show in the
     per-criterion comparison. */
  var BLIND_REVIEWS_KEY = "d360-blind-reviews";
  var CRITERION_LABELS = {
    c1: "Proper greeting and introduction given / Ready for all calls",
    c2: "Applicant or authorised 3rd party provided full name & 2 acceptable forms of identification",
    c3: "Agent did not disclose information to an unauthorised third party",
    c4: "Company’s Confidentiality Agreement maintained",
    c5: "Avoided excessive calling: 4 calls total (includes 1 VM using script)",
    c6: "Payment options explained",
    c7: "Used correct Verbiage with disclosing APR (if applicable)",
    c8: "Entered accurate notes into the system to reflect contents of call",
    c9: "Avoid annoying/harassing consumer",
    c10: "Correct information provided",
    o1: "Knowledge and complete proficiency in the product",
    o2: "Proactivity / All actions completed",
    o3: "Not interrupting/Good vocabulary/No negative language",
    o4: "Empathy & understanding/Using cust name (At least once)",
    o5: "Addressing inquiry/Resolution",
    o6: "Tone of Voice/Rate of speech",
    o7: "Active listening/Reading / Not distracted",
    o8: "Hold Time/Permission to place on hold / check in every 2 mins",
    o9: "Efficiency / Call flow /Unconfident",
    o10: "Summarise / Cust satisfaction / other further assistance"
  };

  function getBlindReviews() {
    try { return JSON.parse(localStorage.getItem(BLIND_REVIEWS_KEY)) || {}; } catch (e) { return {}; }
  }
  function saveBlindReviews(map) { localStorage.setItem(BLIND_REVIEWS_KEY, JSON.stringify(map)); }

  function setBlindRevealed(revealed) {
    document.querySelectorAll(".blind-reveal").forEach(function (el) { el.classList.toggle("blind-hidden", !revealed); });
    document.querySelectorAll(".blind-only").forEach(function (el) { el.classList.toggle("blind-hidden", revealed); });
  }

  /* Per the QA flow: "Scores match" auto-advances status on its own;
     "scores differ" requires the marker to tag every differing line
     'AI Correct' / 'AI Incorrect' with a reason before they can Submit
     for Feedback. An 'AI Incorrect' tag is what makes that line show
     the marker's own mark/comment (instead of the AI's) everywhere the
     agent-facing scorecard renders. */
  function blindReviewDisagreements(review) { return review.perCriterion.filter(function (c) { return !c.agree; }); }
  // "Fully tagged" requires BOTH an AI Correct/Incorrect tag and a
  // non-empty "Why?" reason on every differing line — either one
  // missing blocks Submit for Feedback.
  function blindReviewIncomplete(c) { return !c.verdict || !c.reason || !c.reason.trim(); }
  function firstIncompleteDisagreement(review) {
    return blindReviewDisagreements(review).filter(blindReviewIncomplete)[0];
  }

  var VERDICT_WORDS = { P: "Pass", F: "Fail", NA: "N/A", PWD: "PWD" };
  function verdictChipHtml(v) {
    var cls = v === "P" ? "verdict-chip--p" : v === "F" ? "verdict-chip--f" : v === "PWD" ? "verdict-chip--pwd" : "verdict-chip--na";
    return '<span class="verdict-chip ' + cls + '">' + (VERDICT_WORDS[v] || v || "–") + '</span>';
  }

  function renderBlindComparison(review) {
    var body = document.getElementById("blind-comparison-body");
    if (!body) return;
    var card = document.getElementById("blind-comparison-card");
    if (card) card.classList.remove("blind-hidden");
    var diff = review.humanScore - review.aiScore;
    var diffText = (diff > 0 ? "+" : "") + diff;
    var diffColor = Math.abs(diff) <= 5 ? "success" : Math.abs(diff) <= 15 ? "warning" : "danger";
    var agreeCount = review.perCriterion.filter(function (c) { return c.agree; }).length;
    var disagreements = blindReviewDisagreements(review);
    body.innerHTML =
      '<div class="row" style="justify-content:space-between;align-items:baseline;margin-bottom:14px;">' +
      '<div><div class="small muted">AI score</div><div class="kpi__value" style="font-size:22px;margin:0;">' + review.aiScore + '<span class="muted" style="font-size:14px;">/100</span></div></div>' +
      '<div><div class="small muted">Your score</div><div class="kpi__value" style="font-size:22px;margin:0;">' + review.humanScore + '<span class="muted" style="font-size:14px;">/100</span></div></div>' +
      '<div><div class="small muted">Difference</div><div class="kpi__value" style="font-size:22px;margin:0;color:var(--' + diffColor + ');">' + diffText + '</div></div>' +
      '</div>' +
      '<ul class="checklist" style="margin:0;">' +
      review.perCriterion.map(function (c) {
        var tagged = c.verdict === "ai-correct" ? "AI Correct" : c.verdict === "ai-incorrect" ? "AI Incorrect" : "";
        var rightCol = c.agree
          ? '<span class="pill pill--pass" style="align-self:flex-start;">Agree</span>'
          : '<div class="stack" style="gap:6px;flex:none;">' +
            '<button type="button" class="btn btn--sm ' + (c.verdict === "ai-correct" ? "btn--dark" : "btn--ghost") + '" data-ai-tag="ai-correct" data-criterion="' + c.id + '">AI Correct</button>' +
            '<button type="button" class="btn btn--sm ' + (c.verdict === "ai-incorrect" ? "btn--dark" : "btn--ghost") + '" data-ai-tag="ai-incorrect" data-criterion="' + c.id + '">AI Incorrect</button>' +
            '</div>';
        return '<li data-diff-criterion="' + c.id + '" class="' + (c.agree ? "" : "blind-diff-row--flag") + '" style="flex-direction:column;align-items:stretch;padding:14px 16px;">' +
          '<div class="row" style="justify-content:space-between;align-items:flex-start;gap:16px;">' +
          '<div class="checklist__title" style="flex:1;min-width:170px;">' + CRITERION_LABELS[c.id] + '</div>' +
          '<div class="row" style="gap:20px;align-items:flex-start;flex:none;">' +
          '<div style="text-align:center;"><div class="small muted" style="font-size:10px;font-weight:700;letter-spacing:.05em;margin-bottom:4px;">HUMAN</div>' + verdictChipHtml(c.human) + '</div>' +
          '<div style="text-align:center;"><div class="small muted" style="font-size:10px;font-weight:700;letter-spacing:.05em;margin-bottom:4px;">AUTO</div>' + verdictChipHtml(c.ai) + '</div>' +
          rightCol +
          '</div>' +
          '</div>' +
          '<div class="row" style="gap:20px;margin-top:10px;align-items:flex-start;">' +
          '<div style="flex:1;min-width:160px;"><div class="small muted" style="font-weight:600;margin-bottom:2px;">Reviewer comment</div><div class="small">' + (c.humanComment ? esc(c.humanComment) : "<span class=\"muted\">—</span>") + '</div></div>' +
          '<div style="flex:1;min-width:160px;"><div class="small muted" style="font-weight:600;margin-bottom:2px;">AI comment</div><div class="small">' + (c.aiComment ? esc(c.aiComment) : "<span class=\"muted\">—</span>") + '</div></div>' +
          '</div>' +
          (c.agree ? "" :
            '<textarea class="ai-tag-reason" data-criterion="' + c.id + '" rows="1" placeholder="Why?" style="margin-top:10px;width:100%;font-family:var(--font);font-size:12.5px;border:1px solid var(--border);border-radius:8px;padding:6px 8px;">' + (c.reason ? esc(c.reason) : "") + '</textarea>' +
            (tagged ? '<span class="small muted" style="margin-top:4px;">Tagged: ' + tagged + '</span>' : '')) +
          '</li>';
      }).join("") +
      '</ul>' +
      '<p class="small muted" style="margin-top:12px;">' + agreeCount + ' of ' + review.perCriterion.length + ' criteria matched the AI’s marking.</p>' +
      (disagreements.length && getQaStatus(review.ref) === QA_STATUS.MANUAL_REVIEW ?
        '<button type="button" class="btn btn--primary" id="blind-submit-feedback-btn" style="margin-top:6px;">Submit for Feedback</button>' +
        '<p class="small muted" style="margin-top:6px;" id="blind-submit-feedback-hint">Tag every differing line above and give a reason before submitting.</p>' +
        '<p class="small" style="margin-top:6px;color:var(--danger);font-weight:600;display:none;" id="blind-submit-feedback-error">Tag every differing line "AI Correct" or "AI Incorrect" and fill in why before submitting.</p>'
        : disagreements.length ?
        '<p class="small" style="margin-top:6px;color:var(--success);font-weight:600;">Submitted for feedback.</p>'
        : '<p class="small" style="margin-top:6px;color:var(--success);font-weight:600;">Scores matched — status automatically advanced to Requires Feedback.</p>');

    body.querySelectorAll("[data-ai-tag]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-criterion");
        var tag = btn.getAttribute("data-ai-tag");
        var reviews = getBlindReviews();
        var r = reviews[review.ref];
        if (!r) return;
        var c = r.perCriterion.filter(function (x) { return x.id === id; })[0];
        if (!c) return;
        c.verdict = tag;
        saveBlindReviews(reviews);
        renderBlindComparison(r);
      });
    });
    body.querySelectorAll(".ai-tag-reason").forEach(function (ta) {
      ta.addEventListener("input", function () {
        var id = ta.getAttribute("data-criterion");
        var reviews = getBlindReviews();
        var r = reviews[review.ref];
        if (!r) return;
        var c = r.perCriterion.filter(function (x) { return x.id === id; })[0];
        if (c) { c.reason = ta.value; saveBlindReviews(reviews); }
        // Clear the red incomplete outline live as soon as this line has
        // both a tag and a reason, rather than waiting for the next
        // submit attempt to re-check it.
        var li = ta.closest("[data-diff-criterion]");
        if (li && c && !blindReviewIncomplete(c)) li.classList.remove("blind-diff-row--incomplete");
      });
    });
    var submitFeedbackBtn = document.getElementById("blind-submit-feedback-btn");
    if (submitFeedbackBtn) {
      submitFeedbackBtn.addEventListener("click", function () {
        var reviews = getBlindReviews();
        var r = reviews[review.ref];
        if (!r) return;
        var incomplete = firstIncompleteDisagreement(r);
        var errorEl = document.getElementById("blind-submit-feedback-error");
        if (incomplete) {
          if (errorEl) errorEl.style.display = "";
          var li = body.querySelector('[data-diff-criterion="' + incomplete.id + '"]');
          if (li) {
            li.classList.add("blind-diff-row--incomplete");
            li.scrollIntoView({ behavior: "smooth", block: "center" });
            var target = !incomplete.verdict
              ? li.querySelector("[data-ai-tag]")
              : li.querySelector(".ai-tag-reason");
            if (target) target.focus();
          }
          return;
        }
        if (errorEl) errorEl.style.display = "none";
        setQaStatus(review.ref, QA_STATUS.REQUIRES_FEEDBACK);
        renderScorecardActions();
      });
    }
  }

  function refreshBlindState() {
    var wrap = document.getElementById("scorecard-flow");
    if (!wrap) return;
    var ref = wrap.getAttribute("data-scorecard-ref");
    var role = localStorage.getItem(ROLE_KEY) || "admin";
    var status = getQaStatus(ref);
    var existing = getBlindReviews()[ref];
    // Manager/Admin review the AI's marking directly (that's the job —
    // decide whether to accept it or send it for full human review, see
    // the "AI vs Human" queue column). Agents see their own feedback the
    // same way. Trainer/Team lead — who actually do the blind marking —
    // only get the blank-scorecard form once a manager has routed this
    // call to Manual Review *and* assigned it to them specifically (see
    // scorecard.html's "Assign to reviewer" control and QA Review's
    // "Assigned reviewer" column); otherwise they see a waiting note
    // instead, and once it's past marking the AI result is revealed
    // same as everyone else.
    var autoReveal = role === "agent" || role === "manager" || role === "admin";
    var assignedToMe = autoReveal || qaAssignedReviewer(ref) === currentQaReviewerName();
    var pastMarking = status !== QA_STATUS.NEEDS_REVIEW && status !== QA_STATUS.MANUAL_REVIEW;
    setBlindRevealed(autoReveal || !!existing || pastMarking);
    var blindCard = document.getElementById("blind-scorecard-card");
    var waitingNote = document.getElementById("blind-waiting-note");
    var waitingNoteText = document.getElementById("blind-waiting-note-text");
    var showBlindForm = !autoReveal && !existing && status === QA_STATUS.MANUAL_REVIEW && assignedToMe;
    var showWaiting = !autoReveal && !existing && !pastMarking && !showBlindForm;
    if (blindCard) blindCard.classList.toggle("blind-hidden", !showBlindForm);
    if (waitingNote) waitingNote.classList.toggle("blind-hidden", !showWaiting);
    if (waitingNoteText && showWaiting) {
      waitingNoteText.innerHTML = status === QA_STATUS.NEEDS_REVIEW
        ? "This call is still <strong>Needs Review</strong> — waiting on a Manager/Admin to send it to Manual Review before you can mark it blind."
        : "This call is in <strong>Manual Review</strong>, but it's assigned to someone else — only the assigned reviewer can mark it blind.";
    }
    if (!existing) return;
    var list = document.getElementById("blind-criteria-list");
    if (list) {
      existing.perCriterion.forEach(function (c) {
        var li = list.querySelector('[data-criterion="' + c.id + '"]');
        if (!li) return;
        li.querySelectorAll(".blind-mark-btn").forEach(function (b) {
          b.disabled = true;
          b.classList.toggle("active", b.getAttribute("data-v") === c.human);
        });
      });
    }
    renderBlindComparison(existing);
    applyBlindComparisonVisibility(status);
  }

  function wireBlindScorecard() {
    var wrap = document.getElementById("scorecard-flow");
    if (!wrap) return;
    var ref = wrap.getAttribute("data-scorecard-ref");
    var list = document.getElementById("blind-criteria-list");
    var submitBtn = document.getElementById("blind-scorecard-submit");
    var selections = {};

    function updateSubmitState() {
      if (!submitBtn || !list) return;
      var items = list.querySelectorAll("[data-criterion]");
      submitBtn.disabled = !Array.prototype.every.call(items, function (li) {
        return !!selections[li.getAttribute("data-criterion")];
      });
    }

    if (list) {
      list.querySelectorAll(".blind-mark-btn").forEach(function (btn) {
        btn.addEventListener("click", function () {
          if (btn.disabled) return;
          var li = btn.closest("[data-criterion]");
          selections[li.getAttribute("data-criterion")] = btn.getAttribute("data-v");
          li.querySelectorAll(".blind-mark-btn").forEach(function (b) { b.classList.remove("active"); });
          btn.classList.add("active");
          updateSubmitState();
        });
      });
    }

    if (submitBtn) {
      submitBtn.addEventListener("click", function () {
        if (!list) return;
        // Only the 10 Compliance criteria (ids "c1".."c10") count toward
        // the headline score, one pass = 10 points — same convention as
        // QA Colin's own submitScorecard(). Operational criteria ("o1"..
        // "o10") still show in the per-criterion comparison below but
        // don't add to either score.
        var humanScore = 0, aiScore = 0;
        var perCriterion = [];
        list.querySelectorAll("[data-criterion]").forEach(function (li) {
          var id = li.getAttribute("data-criterion");
          var isCompliance = id.charAt(0) === "c";
          var ai = li.getAttribute("data-ai");
          var human = selections[id];
          if (isCompliance && human === "P") humanScore += 10;
          if (isCompliance && ai === "P") aiScore += 10;
          var humanCommentEl = li.querySelector(".blind-comment-input");
          var aiCommentEl = document.querySelector('#ai-scorecard-reveal [data-criterion="' + id + '"] .colin-comment textarea');
          perCriterion.push({
            id: id, ai: ai, human: human, agree: ai === human,
            humanComment: humanCommentEl ? humanCommentEl.value.trim() : "",
            aiComment: aiCommentEl ? aiCommentEl.value.trim() : ""
          });
        });
        var review = {
          ref: ref, aiScore: aiScore, humanScore: humanScore, perCriterion: perCriterion,
          reviewedAt: new Date().toISOString()
        };
        var reviews = getBlindReviews();
        reviews[ref] = review;
        saveBlindReviews(reviews);

        list.querySelectorAll(".blind-mark-btn").forEach(function (b) { b.disabled = true; });
        list.querySelectorAll(".blind-comment-input").forEach(function (ta) { ta.disabled = true; });
        renderBlindComparison(review);
        setBlindRevealed(true);
        renderAiHumanDiff();
        // "Scores match - Automatically updates status" per the QA flow;
        // otherwise it stays in Manual Review until every differing line
        // is tagged AI Correct/Incorrect and "Submit for Feedback" is
        // clicked (see renderBlindComparison above).
        if (!blindReviewDisagreements(review).length) setQaStatus(ref, QA_STATUS.REQUIRES_FEEDBACK);
        renderScorecardActions();
      });
    }

    refreshBlindState();
  }

  /* Manager/Admin-only "AI vs Human" column on the QA Review queue —
     reads the same d360-blind-reviews store scorecard.html writes to,
     so a Manager can see at a glance whether the AI's score for a
     flagged call lines up with a reviewer's blind mark, or whether
     it's worth sending for full human review. */
  function renderAiHumanDiff() {
    var cells = document.querySelectorAll("[data-ai-diff]");
    if (!cells.length) return;
    var reviews = getBlindReviews();
    cells.forEach(function (cell) {
      var review = reviews[cell.getAttribute("data-ai-diff")];
      if (!review) {
        cell.innerHTML = '<span class="small muted">Not yet reviewed</span>';
        return;
      }
      var diff = review.humanScore - review.aiScore;
      var diffText = (diff > 0 ? "+" : "") + diff;
      var cls = Math.abs(diff) <= 5 ? "success" : Math.abs(diff) <= 15 ? "warning" : "danger";
      var verdict = Math.abs(diff) <= 5 ? "Happy with AI score" : "Recommend human review";
      cell.innerHTML =
        '<div class="small">AI ' + review.aiScore + ' · You ' + review.humanScore + '</div>' +
        '<div class="small" style="color:var(--' + cls + ');font-weight:600;">' + diffText + ' pts · ' + verdict + '</div>';
    });
  }

  /* ---- QA flow (per the QA_flow.pdf handoff) ----
     Every AI-marked scorecard is judged against a fixed gate: Operational
     score must be >=85% AND Compliance must not be a hard 0/10 fail.
     Pass is silent — auto-published read-only to the agent, never enters
     the Flagged for review queue. Anything else is Needs Review and
     lands on qa.html for a manager to route: either straight to
     Requires Feedback (trusting the AI's mark as-is), or to Manual
     Review, where a Trainer/Team lead marks the call blind (see the
     Blind QA scorecard review section above) before the two scorecards
     are compared. From there the flow moves through a feedback session
     with the agent, which either completes outright or — if the agent
     disputes a line — escalates to the marker's line manager to
     Uphold/Override before completing. Status is stored in
     d360-qa-status-overrides, keyed by interaction ref, defaulting to
     "needs-review" for anything not yet touched. */
  var QA_GATE_OPERATIONAL_THRESHOLD = 85;
  function qaGatePass(complianceScore10, operationalScore10) {
    return (operationalScore10 * 10) >= QA_GATE_OPERATIONAL_THRESHOLD && complianceScore10 !== 0;
  }

  var QA_STATUS = {
    NEEDS_REVIEW: "needs-review",
    MANUAL_REVIEW: "manual-review",
    REQUIRES_FEEDBACK: "requires-feedback",
    FEEDBACK_STARTED: "feedback-started",
    DISPUTE_REVIEW: "dispute-review",
    FEEDBACK_COMPLETE: "feedback-complete"
  };
  var QA_STATUS_META = {
    "needs-review": { label: "Needs Review", pill: "pill--flag" },
    "manual-review": { label: "Manual Review", pill: "pill--info" },
    "requires-feedback": { label: "Requires Feedback", pill: "pill--info" },
    "feedback-started": { label: "Feedback Session Started", pill: "pill--info" },
    "dispute-review": { label: "Dispute – Review Required", pill: "pill--flag" },
    "feedback-complete": { label: "Feedback Complete", pill: "pill--pass" }
  };
  var QA_STATUS_OVERRIDES_KEY = "d360-qa-status-overrides";

  function getQaStatusOverrides() {
    try { return JSON.parse(localStorage.getItem(QA_STATUS_OVERRIDES_KEY)) || {}; } catch (e) { return {}; }
  }
  function saveQaStatusOverrides(map) { localStorage.setItem(QA_STATUS_OVERRIDES_KEY, JSON.stringify(map)); }
  function getQaStatus(ref) { return getQaStatusOverrides()[ref] || QA_STATUS.NEEDS_REVIEW; }
  function setQaStatus(ref, status) {
    var overrides = getQaStatusOverrides();
    overrides[ref] = status;
    saveQaStatusOverrides(overrides);
  }

  /* Prototype-only: the 16 static "Flagged for review" rows would
     otherwise all start Needs Review (getQaStatus()'s default), which
     makes the queue look identical regardless of how far the flow has
     actually progressed. Seed a representative spread across the
     other statuses — once, and only if nothing's been saved yet, so it
     never overwrites real interaction (clicking through the flow
     always wins). INT-10477 (the one real worked example every row
     links to) is deliberately left at the default so the main
     walkthrough still starts fresh; scorecard.html's own "Preview
     state" control covers seeing it at other stages. */
  function seedQaStatusOverrides() {
    if (localStorage.getItem(QA_STATUS_OVERRIDES_KEY)) return;
    saveQaStatusOverrides({
      "INT-10448": QA_STATUS.MANUAL_REVIEW,
      "INT-10436": QA_STATUS.REQUIRES_FEEDBACK,
      "INT-10421": QA_STATUS.FEEDBACK_STARTED,
      "INT-10408": QA_STATUS.DISPUTE_REVIEW,
      "INT-10396": QA_STATUS.FEEDBACK_COMPLETE,
      "INT-10381": QA_STATUS.MANUAL_REVIEW,
      "INT-10367": QA_STATUS.REQUIRES_FEEDBACK
    });
  }

  /* Redraws every [data-status-cell] on the QA Review queue with just
     the current status pill — the table is read-only; routing a call
     (Send to Manual Review / Submit for Feedback / Assign to reviewer)
     all happens on scorecard.html's own Reviewer actions card. */
  function applyQaStatusOverrides() {
    document.querySelectorAll("[data-status-cell]").forEach(function (cell) {
      var meta = QA_STATUS_META[getQaStatus(cell.getAttribute("data-status-cell"))];
      cell.innerHTML = '<span class="pill ' + meta.pill + '">' + meta.label + '</span>';
    });
  }

  /* "🏆 100% QA Shoutouts" on the newsfeed — seeded with three examples,
     then a new entry is prepended whenever a scorecard clears the gate
     with a perfect 10/10 on both Compliance and Operational. */
  var QA_SHOUTOUTS_KEY = "d360-qa-shoutouts";
  function getQaShoutouts() {
    try { return JSON.parse(localStorage.getItem(QA_SHOUTOUTS_KEY)) || []; } catch (e) { return []; }
  }
  function saveQaShoutouts(list) { localStorage.setItem(QA_SHOUTOUTS_KEY, JSON.stringify(list)); }
  function seedQaShoutouts() {
    if (localStorage.getItem(QA_SHOUTOUTS_KEY)) return;
    saveQaShoutouts([
      { agentName: "Sophie Clarke", ref: "INT-10529", note: "Perfect DPA, tone and compliance — 2nd perfect score this month!" },
      { agentName: "Grace Thompson", ref: "INT-10522", note: "Textbook complaint handling and escalation." },
      { agentName: "Daniel Okafor", ref: "INT-10517", note: "Flawless DPA verification and a great save. Nice work!" }
    ]);
  }
  function addQaShoutout(agentName, ref, note) {
    var list = getQaShoutouts();
    list.unshift({ agentName: agentName, ref: ref, note: note });
    saveQaShoutouts(list);
  }
  function renderQaShoutouts() {
    var root = document.getElementById("qa-shoutouts-list");
    if (!root) return;
    var list = getQaShoutouts();
    root.innerHTML = list.length ? list.map(function (s) {
      return '<li><span class="avatar avatar--sm">' + userInitials(s.agentName) + '</span>' +
        '<div class="checklist__main"><div class="checklist__title">' + s.agentName + ' <span class="pill pill--pass" style="margin-left:6px;">100%</span></div>' +
        '<div class="checklist__desc">' + s.note + ' (' + s.ref + ')</div></div></li>';
    }).join("") : '<li class="muted small" style="padding:10px 0;">No perfect scores yet this week.</li>';
  }

  /* ---- scorecard.html Reviewer actions — status-driven (prototype only) ----
     Draws whatever action the current QA status calls for into
     #reviewer-actions-body, and the status pill next to the page title.
     Everything from here through "Feedback Complete" happens on this
     one page (the queue only handles the initial Needs Review routing
     decision) — Start Feedback, Agent Happy/Disputes, the dispute
     ticket, and the line manager's Uphold/Override decision. Disputes
     are stored in d360-qa-disputes, keyed by interaction ref. */
  var QA_DISPUTES_KEY = "d360-qa-disputes";
  function getQaDisputes() {
    try { return JSON.parse(localStorage.getItem(QA_DISPUTES_KEY)) || {}; } catch (e) { return {}; }
  }
  function saveQaDisputes(map) { localStorage.setItem(QA_DISPUTES_KEY, JSON.stringify(map)); }

  function scorecardTopFailReasonLabel(ref) {
    var existing = getBlindReviews()[ref];
    var overrideMap = {};
    if (existing) {
      existing.perCriterion.forEach(function (c) {
        if (c.verdict === "ai-incorrect") overrideMap[c.id] = c.human;
      });
    }
    var items = document.querySelectorAll('#blind-criteria-list [data-criterion^="c"]');
    for (var i = 0; i < items.length; i++) {
      var id = items[i].getAttribute("data-criterion");
      var mark = overrideMap[id] || items[i].getAttribute("data-ai");
      if (mark === "F") return CRITERION_LABELS[id];
    }
    return "QA criterion";
  }

  /* The AI's own Compliance/Operational marking, read back in
     #ai-scorecard-reveal, reuses the same clickable .colin-verdict
     buttons and editable .colin-comment textareas as colin-scorecard
     .html's live evaluation form (see wireVerdictToggles()) — editable
     only while the call is in Manual Review (a Manager/Admin looking
     at the AI's original read before deciding how to route it); locked
     read-only both before that (Needs Review — no review has happened
     yet) and after (Requires Feedback onward — see
     applyFinalScorecardMerge(), which is what fills this section's
     marks/comments at that point). */
  function applyAiScorecardReadOnly(readOnly) {
    var reveal = document.getElementById("ai-scorecard-reveal");
    if (!reveal) return;
    reveal.querySelectorAll(".colin-verdict button").forEach(function (btn) { btn.disabled = readOnly; });
    reveal.querySelectorAll(".colin-comment textarea").forEach(function (ta) { ta.disabled = readOnly; });
  }

  /* Once a call has moved past Manual Review, the AI's own reveal
     becomes the single scorecard actually used in the feedback session
     with the agent: each line shows the AI's mark/comment, UNLESS the
     blind reviewer tagged it "AI Incorrect", in which case their own
     mark/comment overrides it (an untagged/no-review line just keeps
     the AI's own read). Only meaningful once status has moved past
     Manual Review — applyAiScorecardReadOnly() locks it at the same
     point, so this is the last content change it'll get. */
  function applyFinalScorecardMerge(ref, status) {
    var reveal = document.getElementById("ai-scorecard-reveal");
    if (!reveal) return;
    var isFinal = status !== QA_STATUS.NEEDS_REVIEW && status !== QA_STATUS.MANUAL_REVIEW;
    if (!isFinal) return;
    var review = getBlindReviews()[ref];
    if (!review) return;
    review.perCriterion.forEach(function (c) {
      var item = reveal.querySelector('[data-criterion="' + c.id + '"]');
      if (!item) return;
      var useHuman = c.verdict === "ai-incorrect";
      var mark = useHuman ? c.human : c.ai;
      item.querySelectorAll(".colin-verdict button").forEach(function (btn) {
        btn.classList.toggle("active", btn.getAttribute("data-v") === mark);
      });
      var ta = item.querySelector(".colin-comment textarea");
      if (ta) ta.value = (useHuman ? c.humanComment : c.aiComment) || "";
    });
  }

  /* "Your review vs AI" stays visible to the reviewer actively tagging
     differences during Manual Review, but once a call moves past that
     — the merged, locked scorecard above is now the record everyone
     else works from — the diff becomes a Manager/Admin-only "Review
     history" of what changed and why, rather than something every
     role keeps seeing. */
  function applyBlindComparisonVisibility(status) {
    var card = document.getElementById("blind-comparison-card");
    if (!card) return;
    var title = document.getElementById("blind-comparison-title");
    if (card.classList.contains("blind-hidden")) return;
    var role = localStorage.getItem(ROLE_KEY) || "admin";
    var isFinal = status !== QA_STATUS.NEEDS_REVIEW && status !== QA_STATUS.MANUAL_REVIEW;
    card.style.display = (!isFinal || role === "admin" || role === "manager") ? "" : "none";
    if (title) title.textContent = isFinal ? "Review history" : "Your review vs AI";
  }

  /* Transient, in-memory only (not persisted): which routing button a
     Manager/Admin has clicked on a Needs Review call, while they still
     have to pick who it goes to before it's confirmed. null shows the
     initial two routing buttons; "manual"/"feedback" shows the
     mandatory reviewer picker + Confirm/Cancel instead. Resets on
     reload, which is fine — an unconfirmed pick was never saved. */
  var qaPendingRoute = null;

  function renderScorecardActions() {
    var wrap = document.getElementById("scorecard-flow");
    if (!wrap) return;
    var ref = wrap.getAttribute("data-scorecard-ref");
    var agentName = wrap.getAttribute("data-agent-name") || "the agent";
    var status = getQaStatus(ref);
    var meta = QA_STATUS_META[status];
    applyFinalScorecardMerge(ref, status);
    applyAiScorecardReadOnly(status !== QA_STATUS.MANUAL_REVIEW);
    applyBlindComparisonVisibility(status);

    var pill = document.getElementById("scorecard-status-pill");
    if (pill) {
      pill.className = "pill " + meta.pill;
      pill.style.verticalAlign = "middle";
      pill.style.marginLeft = "6px";
      pill.textContent = meta.label;
    }

    var body = document.getElementById("reviewer-actions-body");
    if (!body) return;
    var html = "";

    if (status === QA_STATUS.NEEDS_REVIEW) {
      if (!qaPendingRoute) {
        html = '<p class="small muted" style="margin:0 0 12px;">This call missed the auto-QA gate (Operational &lt; 85% or a 0 in Compliance). Route it for full manual marking, or trust the AI\'s mark and send straight to a feedback session.</p>' +
          '<button type="button" class="btn btn--primary" data-action="pick-route-manual" style="width:100%;justify-content:center;margin-bottom:8px;">Send to Manual Review</button>' +
          '<button type="button" class="btn btn--ghost" data-action="pick-route-feedback" style="width:100%;justify-content:center;">Submit for Feedback</button>';
      } else {
        var pendingLabel = qaPendingRoute === "manual" ? "Send to Manual Review" : "Submit for Feedback";
        html = '<p class="small muted" style="margin:0 0 12px;">Choose who this call is assigned to before you ' + pendingLabel.toLowerCase() + '.</p>' +
          '<div class="form-row" style="margin-bottom:12px;">' +
          '<label for="qa-route-reviewer-select">Assign to reviewer</label>' +
          '<select id="qa-route-reviewer-select">' +
          '<option value="" disabled' + (qaAssignedReviewer(ref) ? "" : " selected") + '>Select reviewer…</option>' +
          qaTrainerTeamleadOptionsHtml(qaAssignedReviewer(ref)) +
          '</select>' +
          '</div>' +
          '<button type="button" class="btn btn--primary" id="qa-route-confirm-btn" data-action="confirm-route" style="width:100%;justify-content:center;margin-bottom:8px;"' + (qaAssignedReviewer(ref) ? "" : " disabled") + '>' + pendingLabel + '</button>' +
          '<button type="button" class="btn btn--ghost" data-action="cancel-route" style="width:100%;justify-content:center;">Cancel</button>';
      }
    } else if (status === QA_STATUS.MANUAL_REVIEW) {
      html = '<p class="small muted" style="margin:0;">Manual marking in progress — see the blind scorecard above.</p>';
    } else if (status === QA_STATUS.REQUIRES_FEEDBACK) {
      html = '<p class="small muted" style="margin:0 0 12px;">Ready for a feedback session with ' + agentName + '.</p>' +
        '<button type="button" class="btn btn--primary" data-action="start-feedback" style="width:100%;justify-content:center;">Start Feedback</button>';
    } else if (status === QA_STATUS.FEEDBACK_STARTED) {
      html = '<p class="small muted" style="margin:0 0 12px;">Talk the scorecard through with ' + agentName + ', then record the outcome.</p>' +
        '<button type="button" class="btn btn--primary" data-action="agent-happy" style="width:100%;justify-content:center;margin-bottom:8px;">Agent Happy — Feedback Complete</button>' +
        '<button type="button" class="btn btn--ghost" data-action="agent-disputes" style="width:100%;justify-content:center;">Agent Disputes</button>' +
        '<div id="dispute-form" style="display:none;margin-top:14px;">' +
        '<div class="form-row"><label>Which lines does ' + agentName + ' dispute?</label>' +
        '<div style="max-height:160px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;padding:8px;">' +
        Object.keys(CRITERION_LABELS).map(function (id) {
          return '<label class="row" style="gap:8px;font-size:12.5px;padding:3px 0;"><input type="checkbox" value="' + id + '" class="dispute-line-check" />' + CRITERION_LABELS[id] + '</label>';
        }).join("") +
        '</div></div>' +
        '<div class="form-row"><label for="dispute-reason">Reason</label><textarea id="dispute-reason" rows="3" placeholder="Why is the agent disputing these lines?"></textarea></div>' +
        '<button type="button" class="btn btn--dark" data-action="submit-dispute">Ticket Dispute</button>' +
        '</div>';
    } else if (status === QA_STATUS.DISPUTE_REVIEW) {
      var dispute = getQaDisputes()[ref];
      if (!dispute) {
        html = '<p class="small muted" style="margin:0;">No dispute details found.</p>';
      } else {
        html = '<p class="small muted" style="margin:0 0 4px;">Line manager review — reason given: <em>' + esc(dispute.reason) + '</em></p>' +
          '<div class="stack" style="gap:10px;margin-top:10px;">' +
          dispute.lines.map(function (id) {
            var decision = (dispute.decisions && dispute.decisions[id] && dispute.decisions[id].decision) || "";
            return '<div data-dispute-line="' + id + '" style="border:1px solid var(--border-soft);border-radius:8px;padding:10px;">' +
              '<div class="cell-strong" style="font-size:12.5px;margin-bottom:6px;">' + CRITERION_LABELS[id] + '</div>' +
              '<div class="row" style="gap:8px;">' +
              '<button type="button" class="btn btn--sm ' + (decision === "uphold" ? "btn--dark" : "btn--ghost") + '" data-dispute-decision="uphold" data-line="' + id + '">Uphold</button>' +
              '<button type="button" class="btn btn--sm ' + (decision === "override" ? "btn--dark" : "btn--ghost") + '" data-dispute-decision="override" data-line="' + id + '">Override</button>' +
              '</div>' +
              '<textarea class="dispute-justification" data-line="' + id + '" rows="1" placeholder="Justification" style="margin-top:6px;width:100%;font-family:var(--font);font-size:12.5px;border:1px solid var(--border);border-radius:8px;padding:6px 8px;">' + ((dispute.decisions && dispute.decisions[id] && esc(dispute.decisions[id].justification)) || "") + '</textarea>' +
              '</div>';
          }).join("") +
          '</div>' +
          '<button type="button" class="btn btn--primary" data-action="submit-dispute-decision" style="width:100%;justify-content:center;margin-top:14px;">Submit Decision</button>';
      }
    } else if (status === QA_STATUS.FEEDBACK_COMPLETE) {
      html = '<div class="banner banner--pass" style="padding:14px;"><div>Feedback session completed with ' + agentName + '.</div></div>';
    }

    body.innerHTML = html;
    applyRole(localStorage.getItem(ROLE_KEY) || "admin", localStorage.getItem(EMPLOYEE_KEY) || "");
  }

  function wireScorecardActions() {
    document.addEventListener("click", function (e) {
      var wrap = document.getElementById("scorecard-flow");
      if (!wrap) return;
      var ref = wrap.getAttribute("data-scorecard-ref");
      var agentName = wrap.getAttribute("data-agent-name") || "the agent";

      var pickRouteManual = e.target.closest('[data-action="pick-route-manual"]');
      if (pickRouteManual) { qaPendingRoute = "manual"; renderScorecardActions(); return; }

      var pickRouteFeedback = e.target.closest('[data-action="pick-route-feedback"]');
      if (pickRouteFeedback) { qaPendingRoute = "feedback"; renderScorecardActions(); return; }

      var cancelRoute = e.target.closest('[data-action="cancel-route"]');
      if (cancelRoute) { qaPendingRoute = null; renderScorecardActions(); return; }

      var confirmRoute = e.target.closest('[data-action="confirm-route"]');
      if (confirmRoute) {
        var reviewerSelect = document.getElementById("qa-route-reviewer-select");
        var reviewer = reviewerSelect ? reviewerSelect.value : "";
        if (!reviewer) return; // button is disabled until a reviewer is chosen, but guard anyway
        var assignments = getQaAssignments();
        assignments[ref] = reviewer;
        saveQaAssignments(assignments);
        setQaStatus(ref, qaPendingRoute === "manual" ? QA_STATUS.MANUAL_REVIEW : QA_STATUS.REQUIRES_FEEDBACK);
        qaPendingRoute = null;
        refreshBlindState();
        renderScorecardActions();
        renderQaAssignmentAlert();
        return;
      }

      var startFeedback = e.target.closest('[data-action="start-feedback"]');
      if (startFeedback) {
        setQaStatus(ref, QA_STATUS.FEEDBACK_STARTED);
        renderScorecardActions();
        renderQaFeedbackReadyAlert();
        return;
      }

      var agentHappy = e.target.closest('[data-action="agent-happy"]');
      if (agentHappy) {
        setQaStatus(ref, QA_STATUS.FEEDBACK_COMPLETE);
        var reason = scorecardTopFailReasonLabel(ref);
        if (window.D360 && window.D360.assignTraining) window.D360.assignTraining(agentName, ref, reason);
        renderScorecardActions();
        renderQaFeedbackReadyAlert();
        return;
      }

      var agentDisputes = e.target.closest('[data-action="agent-disputes"]');
      if (agentDisputes) {
        var form = document.getElementById("dispute-form");
        if (form) form.style.display = form.style.display === "none" ? "" : "none";
        return;
      }

      var submitDispute = e.target.closest('[data-action="submit-dispute"]');
      if (submitDispute) {
        var checked = Array.prototype.map.call(document.querySelectorAll(".dispute-line-check:checked"), function (cb) { return cb.value; });
        if (!checked.length) { window.alert("Tick at least one disputed line first."); return; }
        var reasonEl = document.getElementById("dispute-reason");
        var disputes = getQaDisputes();
        disputes[ref] = { lines: checked, reason: reasonEl ? reasonEl.value : "", decisions: {}, raisedAt: new Date().toISOString() };
        saveQaDisputes(disputes);
        setQaStatus(ref, QA_STATUS.DISPUTE_REVIEW);
        renderScorecardActions();
        renderQaDisputeAlert();
        return;
      }

      var decisionBtn = e.target.closest("[data-dispute-decision]");
      if (decisionBtn) {
        var id = decisionBtn.getAttribute("data-line");
        var decision = decisionBtn.getAttribute("data-dispute-decision");
        var disputesMap = getQaDisputes();
        var d = disputesMap[ref];
        if (!d) return;
        d.decisions = d.decisions || {};
        d.decisions[id] = d.decisions[id] || {};
        d.decisions[id].decision = decision;
        saveQaDisputes(disputesMap);
        renderScorecardActions();
        return;
      }

      var submitDecision = e.target.closest('[data-action="submit-dispute-decision"]');
      if (submitDecision) {
        var disputesMap2 = getQaDisputes();
        var d2 = disputesMap2[ref];
        if (!d2 || !d2.lines.every(function (id) { return d2.decisions && d2.decisions[id] && d2.decisions[id].decision; })) {
          window.alert("Decide Uphold or Override on every disputed line first.");
          return;
        }
        saveQaDisputes(disputesMap2);
        setQaStatus(ref, QA_STATUS.REQUIRES_FEEDBACK);
        renderScorecardActions();
        renderQaDisputeAlert();
        return;
      }
    });

    document.addEventListener("input", function (e) {
      var justification = e.target.closest(".dispute-justification");
      if (!justification) return;
      var wrap = document.getElementById("scorecard-flow");
      if (!wrap) return;
      var ref = wrap.getAttribute("data-scorecard-ref");
      var id = justification.getAttribute("data-line");
      var disputesMap = getQaDisputes();
      var d = disputesMap[ref];
      if (!d) return;
      d.decisions = d.decisions || {};
      d.decisions[id] = d.decisions[id] || {};
      d.decisions[id].justification = justification.value;
      saveQaDisputes(disputesMap);
    });

    document.addEventListener("change", function (e) {
      var reviewerSelect = e.target.closest("#qa-route-reviewer-select");
      if (!reviewerSelect) return;
      var confirmBtn = document.getElementById("qa-route-confirm-btn");
      if (confirmBtn) confirmBtn.disabled = !reviewerSelect.value;
    });
  }

  /* Two Newsfeed alerts simulating the portal notifications the QA flow
     calls for: the agent gets a "new feedback ready" pop-up once Start
     Feedback is pressed, and a Manager/Admin (standing in for the
     marker's line manager) gets notified when a dispute needs review.
     This prototype only ever has the one worked example (INT-10477), so
     both just check its current status rather than scanning a roster. */
  function renderQaFeedbackReadyAlert() {
    var card = document.getElementById("qa-feedback-ready-alert");
    if (!card) return;
    card.style.display = getQaStatus("INT-10477") === QA_STATUS.FEEDBACK_STARTED ? "" : "none";
  }
  function renderQaDisputeAlert() {
    var card = document.getElementById("qa-dispute-alert");
    if (!card) return;
    card.style.display = getQaStatus("INT-10477") === QA_STATUS.DISPUTE_REVIEW ? "" : "none";
  }

  /* Prototype testing aid (scorecard.html only) — every "Flagged for
     review" row links through to this same single worked example, so
     this lets whoever's exploring the prototype jump it straight to
     any QA flow stage without having to actually walk the flow each
     time. Not part of the real product surface. */
  function wireQaPreviewState() {
    var select = document.getElementById("qa-preview-state-select");
    var wrap = document.getElementById("scorecard-flow");
    if (!select || !wrap) return;
    var ref = wrap.getAttribute("data-scorecard-ref");
    select.value = getQaStatus(ref);
    select.addEventListener("change", function () {
      setQaStatus(ref, select.value);
      qaPendingRoute = null;
      refreshBlindState();
      renderScorecardActions();
      renderQaFeedbackReadyAlert();
      renderQaDisputeAlert();
    });
  }

  /* Assigning a reviewer to a flagged call (prototype only) ----
     Every flagged row on the QA Review queue — the 16 static ones and
     any Colin-submitted ones — gets a reviewer <select> instead of a
     fixed name, populated from every non-Agent user. Assigning
     "Rob Ashton" (this prototype's single logged-in identity, same
     convention as My QA/My Performance/guide reads) surfaces the call
     on Newsfeed's "Assigned to you for QA review" alert, so a
     reviewer is notified without having to keep checking the queue.
     QA_QUEUE mirrors the static rows' details so that alert can be
     built on newsfeed.html, which never loads qa.html's own DOM. */
  var QA_ASSIGNMENTS_KEY = "d360-qa-assignments";
  var QA_QUEUE = [
    { ref: "INT-10477", customer: "Liam Foster", score: 60, reason: "Tone" },
    { ref: "INT-10461", customer: "Tom Beresford", score: 52, reason: "DPA not completed" },
    { ref: "INT-10454", customer: "Raj Sharma", score: 55, reason: "Compliance phrase missing" },
    { ref: "INT-10448", customer: "Nadia Hussain", score: 58, reason: "DPA not completed" },
    { ref: "INT-10442", customer: "George Hamilton", score: 61, reason: "Tone" },
    { ref: "INT-10436", customer: "Sophie Clarke", score: 63, reason: "Compliance phrase missing" },
    { ref: "INT-10429", customer: "Oliver Grant", score: 64, reason: "DPA not completed" },
    { ref: "INT-10421", customer: "Beatrice Coleman", score: 67, reason: "Tone" },
    { ref: "INT-10415", customer: "William Pearce", score: 69, reason: "Compliance phrase missing" },
    { ref: "INT-10408", customer: "Chloe Sutton", score: 71, reason: "DPA not completed" },
    { ref: "INT-10402", customer: "Yusuf Demir", score: 73, reason: "Tone" },
    { ref: "INT-10396", customer: "Catherine Lowe", score: 75, reason: "Compliance phrase missing" },
    { ref: "INT-10389", customer: "Dominic Reyes", score: 77, reason: "DPA not completed" },
    { ref: "INT-10381", customer: "Eleanor Davies", score: 79, reason: "Tone" },
    { ref: "INT-10374", customer: "Priscilla Adeyemi", score: 82, reason: "Compliance phrase missing" },
    { ref: "INT-10367", customer: "Nathan Cole", score: 84, reason: "DPA not completed" }
  ];
  var QA_ASSIGNMENT_DEFAULTS = {
    "INT-10461": "Priya Nair", "INT-10442": "Rob Ashton", "INT-10421": "Priya Nair",
    "INT-10408": "Rob Ashton", "INT-10396": "Priya Nair", "INT-10381": "Rob Ashton",
    "INT-10374": "Priya Nair", "INT-10448": "Hannah Price", "INT-10436": "Hannah Price",
    "INT-10367": "Priya Nair"
  };

  function getQaAssignments() {
    try { return JSON.parse(localStorage.getItem(QA_ASSIGNMENTS_KEY)) || {}; } catch (e) { return {}; }
  }
  function saveQaAssignments(map) { localStorage.setItem(QA_ASSIGNMENTS_KEY, JSON.stringify(map)); }

  /* An explicit "" (set by picking "— Unassigned —") overrides a
     seeded default; only fall back to the default when nothing has
     been saved for this ref at all. */
  function qaAssignedReviewer(ref) {
    var assignments = getQaAssignments();
    if (Object.prototype.hasOwnProperty.call(assignments, ref)) return assignments[ref];
    return QA_ASSIGNMENT_DEFAULTS[ref] || "";
  }

  /* Same assignment store as the QA Review queue's "Assigned reviewer"
     column (d360-qa-assignments), but narrowed to Trainer/Team lead —
     the roles who actually do the blind marking — for the mandatory
     "Assign to reviewer" picker a Manager/Admin sees when routing a
     Needs Review call. No "— Unassigned —" option: picking who the
     call goes to is a required step before it can be routed. */
  function qaTrainerTeamleadOptionsHtml(selected) {
    var reviewers = getUsers().filter(function (u) { return u.role === "trainer" || u.role === "teamlead"; });
    return reviewers.map(function (u) {
      return '<option value="' + u.name + '"' + (u.name === selected ? " selected" : "") + '>' + u.name + '</option>';
    }).join("");
  }

  /* QA Review's "Assigned reviewer" column is read-only text — actually
     assigning a reviewer happens via scorecard.html's own "Assign to
     reviewer" control while a call is Needs Review, which writes to
     the same d360-qa-assignments store this reads. */
  function renderQaAssignmentCells() {
    document.querySelectorAll("[data-assign-cell]").forEach(function (cell) {
      var reviewer = qaAssignedReviewer(cell.getAttribute("data-assign-cell"));
      cell.innerHTML = reviewer ? esc(reviewer) : '<span class="muted">— Unassigned —</span>';
    });
  }

  /* Newsfeed "Assigned to you for QA review" to-do — visible to the
     same roles as QA Review itself, listing whichever flagged calls
     (built-in or Colin-submitted) are currently assigned to
     CURRENT_AGENT_NAME. */
  function renderQaAssignmentAlert() {
    var card = document.getElementById("qa-assignment-alert");
    if (!card) return;
    var colinSubmissions = [];
    try { colinSubmissions = JSON.parse(localStorage.getItem(COLIN_KEY)) || []; } catch (e) { colinSubmissions = []; }
    var colinEntries = colinSubmissions.map(function (r) {
      return { ref: r.ref, customer: r.customerName, score: r.score, reason: r.topFailReason };
    });
    var mine = QA_QUEUE.concat(colinEntries).filter(function (q) {
      return qaAssignedReviewer(q.ref) === CURRENT_AGENT_NAME;
    });
    if (!mine.length) { card.style.display = "none"; return; }
    card.style.display = "";
    var countEl = card.querySelector("[data-qa-assignment-count]");
    if (countEl) countEl.textContent = mine.length;
    var list = card.querySelector("[data-qa-assignment-list]");
    if (list) {
      list.innerHTML = mine.slice(0, 4).map(function (q) {
        return '<li><div class="checklist__main"><div class="checklist__title">' + q.ref + ' — ' + q.customer + '</div>' +
          '<div class="checklist__desc">Flagged for ' + q.reason + ' · ' + q.score + '/100</div></div>' +
          '<a class="btn btn--sm" href="qa.html">Review</a></li>';
      }).join("");
    }
  }

  /* ---- 12b. QA Calibration sessions (calibration.html) ----
     Multi-reviewer calibration: everyone marks the same call blind, using
     the exact same 20-criterion Compliance/Operational rubric as Colin
     Scorecard/scorecard.html (so a calibration score means the same thing
     everywhere in the app), each tracked through Needs to complete -> In
     progress -> Complete (locked, no further edits once Complete).
     CURRENT_AGENT_NAME is always an implicit reviewer on every session
     (this is a single-seat prototype) — the named "reviewers" list on a
     session is the other people calibrating it, whose marks are seeded
     up front as already Complete (there's no second real user to actually
     submit them). Once every reviewer is Complete, the room can build the
     Overall scorecard together: an agreed P/F/N-A(/PWD) outcome per
     criterion, defaulting to the AI's own read, which the session owner
     can override and then log as the final calibrated result. */
  var CALIBRATION_KEY = "d360-calibration-sessions";
  var CALIBRATION_COMPLIANCE = [
    { key: "c1", label: "Proper greeting and introduction given / Ready for all calls" },
    { key: "c2", label: "Applicant or authorised 3rd party provided full name & 2 acceptable forms of identification" },
    { key: "c3", label: "Agent did not disclose information to an unauthorised third party" },
    { key: "c4", label: "Company’s Confidentiality Agreement maintained" },
    { key: "c5", label: "Avoided excessive calling: 4 calls total (includes 1 VM using script)" },
    { key: "c6", label: "Payment options explained" },
    { key: "c7", label: "Used correct Verbiage with disclosing APR (if applicable)" },
    { key: "c8", label: "Entered accurate notes into the system to reflect contents of call" },
    { key: "c9", label: "Avoid annoying/harassing consumer" },
    { key: "c10", label: "Correct information provided" }
  ];
  var CALIBRATION_OPERATIONAL = [
    { key: "o1", label: "Knowledge and complete proficiency in the product" },
    { key: "o2", label: "Proactivity / All actions completed" },
    { key: "o3", label: "Not interrupting/Good vocabulary/No negative language" },
    { key: "o4", label: "Empathy & understanding/Using cust name (At least once)" },
    { key: "o5", label: "Addressing inquiry/Resolution" },
    { key: "o6", label: "Tone of Voice/Rate of speech" },
    { key: "o7", label: "Active listening/Reading / Not distracted" },
    { key: "o8", label: "Hold Time/Permission to place on hold / check in every 2 mins" },
    { key: "o9", label: "Efficiency / Call flow /Unconfident" },
    { key: "o10", label: "Summarise / Cust satisfaction / other further assistance" }
  ];

  function calibrationRng(seed) {
    var s = 0;
    for (var i = 0; i < String(seed).length; i++) s = (s * 31 + String(seed).charCodeAt(i)) >>> 0;
    return function () {
      s |= 0; s = (s + 0x6D2B79F5) | 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  /* Same 20-item rubric shape as scorecard.html's blind form: 10
     Compliance items (P/F/N-A) + 10 Operational items (P/F/PWD/N-A). */
  function calibrationGenVerdicts(seed) {
    var rng = calibrationRng(seed);
    var out = {};
    CALIBRATION_COMPLIANCE.forEach(function (c) {
      var r = rng();
      out[c.key] = r < 0.72 ? "P" : r < 0.9 ? "F" : "NA";
    });
    CALIBRATION_OPERATIONAL.forEach(function (c) {
      var r = rng();
      out[c.key] = r < 0.68 ? "P" : r < 0.85 ? "F" : r < 0.95 ? "PWD" : "NA";
    });
    return out;
  }
  // Same convention as Colin/scorecard.html: only Compliance passes count
  // toward a score (1 pass = 10 points); Operational is tracked separately
  // as its own X/10 pass count and never folded into the total.
  function calibrationComplianceScore(verdicts) {
    if (!verdicts) return 0;
    return CALIBRATION_COMPLIANCE.filter(function (c) { return verdicts[c.key] === "P"; }).length * 10;
  }
  function calibrationOperationalPasses(verdicts) {
    if (!verdicts) return 0;
    return CALIBRATION_OPERATIONAL.filter(function (c) { return verdicts[c.key] === "P"; }).length;
  }
  function calibrationVerdictPillHtml(v) {
    if (v === "P") return '<span class="pill pill--pass">P</span>';
    if (v === "F") return '<span class="pill pill--fail">F</span>';
    if (v === "PWD") return '<span class="pill pill--flag">PWD</span>';
    return '<span class="pill pill--muted">N/A</span>';
  }

  function getCalibrationSessions() {
    try { return JSON.parse(localStorage.getItem(CALIBRATION_KEY)) || []; } catch (e) { return []; }
  }
  function saveCalibrationSessions(list) { localStorage.setItem(CALIBRATION_KEY, JSON.stringify(list)); }

  function seedCalibrationSessions() {
    if (localStorage.getItem(CALIBRATION_KEY)) return;
    var defs = [
      { id: "CAL-1001", ref: "INT-10471", agent: "Olivia Hughes", customer: "Sam Patel", duration: "5m 18s", reviewers: ["Priya Nair", "Hannah Price", "Charlotte Reid"], ownerIsYou: false, createdLabel: "Today, 09:14", createdAt: Date.now() - 3 * 3600e3 },
      { id: "CAL-1002", ref: "INT-10532", agent: "Daniel Okafor", customer: "Priya Shah", duration: "6m 42s", reviewers: ["Priya Nair", "Hannah Price", "Charlotte Reid"], ownerIsYou: false, createdLabel: "Today, 08:02", createdAt: Date.now() - 4 * 3600e3 },
      { id: "CAL-1003", ref: "INT-10501", agent: "James Whitmore", customer: "Alex Greer", duration: "4m 55s", reviewers: ["Grace Thompson", "Hannah Price", "Charlotte Reid"], ownerIsYou: false, createdLabel: "Yesterday", createdAt: Date.now() - 30 * 3600e3 },
      { id: "CAL-1004", ref: "INT-10488", agent: "Grace Thompson", customer: "Mark Ellison", duration: "8m 05s", reviewers: ["Priya Nair", "Hannah Price", "Charlotte Reid"], ownerIsYou: true, createdLabel: "Yesterday", createdAt: Date.now() - 28 * 3600e3 },
      { id: "CAL-1005", ref: "INT-10422", agent: "Marcus Bennett", customer: "Nina Torres", duration: "7m 11s", reviewers: ["Daniel Okafor", "Grace Thompson"], ownerIsYou: true, createdLabel: "3 days ago", createdAt: Date.now() - 72 * 3600e3 }
    ];
    defs.forEach(function (s) {
      s.aiVerdicts = calibrationGenVerdicts(s.id + "-ai");
      s.reviewerVerdicts = {};
      s.reviewers.forEach(function (name, i) { s.reviewerVerdicts[name] = calibrationGenVerdicts(s.id + "-" + name + "-" + i); });
      s.yourVerdicts = {};
      s.yourSubmitted = false;
      s.agreedOutcome = null;
      s.calibrated = false;
    });
    // The 5th seed session (INT-10422) is a finished example so the
    // Sessions list has at least one "Calibrated" row out of the box.
    defs[4].yourVerdicts = calibrationGenVerdicts("CAL-1005-you");
    defs[4].yourSubmitted = true;
    defs[4].agreedOutcome = Object.assign({}, defs[4].aiVerdicts);
    defs[4].calibrated = true;
    saveCalibrationSessions(defs);
  }

  function calibrationSessionById(id) {
    return getCalibrationSessions().filter(function (s) { return s.id === id; })[0] || null;
  }
  function updateCalibrationSession(session) {
    var list = getCalibrationSessions();
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === session.id) { list[i] = session; break; }
    }
    saveCalibrationSessions(list);
  }
  // Named reviewers are always seeded fully marked (there's no second
  // real user in this prototype to actually put them through the tri-state
  // flow) — only "you" progress through Needs to complete -> In progress
  // -> Complete for real.
  function calibrationYourStatus(session) {
    if (session.yourSubmitted) return "complete";
    if (session.yourVerdicts && Object.keys(session.yourVerdicts).length) return "in-progress";
    return "needs-complete";
  }
  function calibrationReviewerStatusPillHtml(status) {
    if (status === "complete") return '<span class="pill pill--pass">Complete</span>';
    if (status === "in-progress") return '<span class="pill pill--flag">In progress</span>';
    return '<span class="pill pill--muted">Needs to complete</span>';
  }
  function calibrationCompleteCount(session) { return session.reviewers.length + (session.yourSubmitted ? 1 : 0); }
  function calibrationTotalReviewers(session) { return session.reviewers.length + 1; }
  function calibrationStatus(session) {
    if (session.calibrated) return "calibrated";
    if (session.yourSubmitted) return "revealed";
    return calibrationYourStatus(session); // "needs-complete" | "in-progress"
  }
  function calibrationStatusPill(status) {
    if (status === "calibrated") return '<span class="pill pill--pass">Calibrated</span>';
    if (status === "revealed") return '<span class="pill pill--info">Revealed</span>';
    if (status === "in-progress") return '<span class="pill pill--flag">In progress</span>';
    return '<span class="pill pill--muted">Needs to complete</span>';
  }

  function renderCalibrationSessionsTable() {
    var tbody = document.getElementById("calibration-sessions-tbody");
    if (!tbody) return;
    var sessions = getCalibrationSessions().slice().sort(function (a, b) { return b.createdAt - a.createdAt; });
    tbody.innerHTML = sessions.map(function (s) {
      var avatars = s.reviewers.map(function (name) {
        return '<span class="avatar avatar--sm" style="margin-right:-8px;border:2px solid #fff;">' + esc(userInitials(name)) + '</span>';
      }).join("");
      return '<tr class="clickable" data-calibration-row="' + esc(s.id) + '">' +
        '<td class="cell-mono">' + esc(s.ref) + '</td>' +
        '<td>' + esc(s.agent) + '</td>' +
        '<td>' + esc(s.customer) + '</td>' +
        '<td><span class="row">' + avatars + '</span></td>' +
        '<td>' + calibrationCompleteCount(s) + ' of ' + calibrationTotalReviewers(s) + ' complete</td>' +
        '<td>' + calibrationStatusPill(calibrationStatus(s)) + '</td>' +
        '<td>' + esc(s.createdLabel) + '</td>' +
        '</tr>';
    }).join("");
    tbody.querySelectorAll("[data-calibration-row]").forEach(function (row) {
      row.addEventListener("click", function () { calibrationOpenDetail(row.getAttribute("data-calibration-row")); });
    });
  }

  function calibrationShowSessionsList(replace) {
    var listView = document.getElementById("calibration-sessions-view");
    var detailView = document.getElementById("calibration-detail-view");
    if (!listView || !detailView) return;
    detailView.classList.add("blind-hidden");
    listView.classList.remove("blind-hidden");
    renderCalibrationSessionsTable();
    if (history.pushState) history[replace ? "replaceState" : "pushState"](null, "", "calibration.html");
  }

  function calibrationOpenDetail(id, replace) {
    var session = calibrationSessionById(id);
    var listView = document.getElementById("calibration-sessions-view");
    var detailView = document.getElementById("calibration-detail-view");
    if (!session || !listView || !detailView) return;
    listView.classList.add("blind-hidden");
    detailView.classList.remove("blind-hidden");
    if (history.pushState) history[replace ? "replaceState" : "pushState"](null, "", "calibration.html?session=" + encodeURIComponent(id));
    renderCalibrationDetail(session);
  }

  function calibrationReviewerStatusListHtml(session) {
    var rows = '<div class="row" style="justify-content:space-between;padding:9px 0;border-bottom:1px solid var(--border-soft);">' +
      '<span class="cell-user"><span class="avatar avatar--sm">' + esc(userInitials(CURRENT_AGENT_NAME)) + '</span>You</span>' +
      '<span id="calibration-your-status-pill">' + calibrationReviewerStatusPillHtml(calibrationYourStatus(session)) + '</span></div>';
    session.reviewers.forEach(function (name, i) {
      rows += '<div class="row" style="justify-content:space-between;padding:9px 0;' + (i < session.reviewers.length - 1 ? "border-bottom:1px solid var(--border-soft);" : "") + '">' +
        '<span class="cell-user"><span class="avatar avatar--sm">' + esc(userInitials(name)) + '</span>' + esc(name) + '</span>' +
        calibrationReviewerStatusPillHtml("complete") + '</div>';
    });
    return '<div class="card mb-18"><div class="card__head"><h3>Reviewers</h3></div><div class="card__body" style="padding-top:0;">' + rows + '</div></div>';
  }

  function calibrationBlindItemHtml(item, verdictOptions, savedValue) {
    var buttons = verdictOptions.map(function (v) {
      return '<button type="button" class="blind-mark-btn' + (savedValue === v ? " active" : "") + '" data-v="' + v + '">' + (v === "NA" ? "N/A" : v) + '</button>';
    }).join("");
    return '<div class="colin-compliance-item" data-criterion="' + item.key + '">' +
      '<div class="colin-compliance-item__q">' + esc(item.label) + '</div>' +
      '<div class="colin-verdict">' + buttons + '</div>' +
      '</div>';
  }

  function calibrationBlindFormHtml(session) {
    var saved = session.yourVerdicts || {};
    var complianceHtml = CALIBRATION_COMPLIANCE.map(function (c) { return calibrationBlindItemHtml(c, ["P", "F", "NA"], saved[c.key]); }).join("");
    var operationalHtml = CALIBRATION_OPERATIONAL.map(function (c) { return calibrationBlindItemHtml(c, ["P", "F", "PWD", "NA"], saved[c.key]); }).join("");
    return '<div class="card" id="calibration-evaluate-form">' +
      '<div class="card__head"><h3>Your scorecard</h3><span class="tag" title="You won\'t be able to change it after submitting">Mark blind &middot; 20 criteria</span></div>' +
      '<div class="card__body">' +
      '<h4 class="section-title">Compliance <span id="calibration-compliance-count">(' + CALIBRATION_COMPLIANCE.filter(function (c) { return saved[c.key] === "P"; }).length + '/10)</span></h4>' +
      '<div class="colin-checklist-scroll">' + complianceHtml + '</div>' +
      '<h4 class="section-title" style="margin-top:18px;">Operational <span id="calibration-operational-count">(' + CALIBRATION_OPERATIONAL.filter(function (c) { return saved[c.key] === "P"; }).length + '/10)</span></h4>' +
      '<div class="colin-checklist-scroll">' + operationalHtml + '</div>' +
      '<p class="small muted" id="calibration-blind-hint" style="margin:14px 0 0;">Mark all 20 criteria to submit — once submitted, this locks and can\'t be changed.</p>' +
      '<button type="button" class="btn btn--primary" id="calibration-submit-btn" style="margin-top:14px;" disabled>Submit review</button>' +
      '</div></div>';
  }

  function calibrationComparisonTableHtml(session) {
    var ownerIsYou = !!session.ownerIsYou;
    var reviewerCols = session.reviewers;
    var totalCols = 3 + reviewerCols.length; // Criterion + You + reviewers + AI + Agreed outcome
    var head = '<th>Criterion</th>' +
      '<th style="text-align:center;"><span class="cell-user" style="justify-content:center;"><span class="avatar avatar--sm">' + esc(userInitials(CURRENT_AGENT_NAME)) + '</span>You</span></th>' +
      reviewerCols.map(function (name) {
        return '<th style="text-align:center;"><span class="cell-user" style="justify-content:center;"><span class="avatar avatar--sm">' + esc(userInitials(name)) + '</span>' + esc(name) + '</span></th>';
      }).join("") +
      '<th style="text-align:center;">🤖 AI</th>' +
      '<th style="text-align:center;background:var(--info-bg);border-radius:8px 8px 0 0;">Agreed outcome' +
      '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-1px;margin-left:2px;" title="Only the session owner can set this"><rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>' +
      '</th>';

    function sectionRow(label) {
      return '<tr><td colspan="' + totalCols + '" style="background:var(--indigo);color:#fff;font-weight:700;">' + label + '</td></tr>';
    }
    function itemRow(item, verdictOptions) {
      var agreed = session.agreedOutcome ? session.agreedOutcome[item.key] : session.aiVerdicts[item.key];
      function cell(v) {
        var flag = v !== agreed ? '<span class="mismatch-flag show" title="Differs from the agreed outcome">≠ agreed</span>' : '<span class="mismatch-flag" title="Differs from the agreed outcome">≠ agreed</span>';
        return '<td style="text-align:center;">' + calibrationVerdictPillHtml(v) + flag + '</td>';
      }
      var agreedCell;
      if (ownerIsYou) {
        agreedCell = '<td style="text-align:center;background:var(--info-bg);"><div class="colin-verdict" style="justify-content:center;flex-wrap:wrap;" data-agreed-toggle="' + item.key + '">' +
          verdictOptions.map(function (v) { return '<button type="button" data-v="' + v + '"' + (agreed === v ? ' class="active"' : "") + '>' + (v === "NA" ? "N/A" : v) + '</button>'; }).join("") +
          '</div></td>';
      } else {
        agreedCell = '<td style="text-align:center;background:var(--info-bg);">' + calibrationVerdictPillHtml(agreed) + '</td>';
      }
      return '<tr data-criterion-row="' + item.key + '">' +
        '<td>' + esc(item.label) + '</td>' +
        cell(session.yourVerdicts[item.key]) +
        reviewerCols.map(function (name) { return cell(session.reviewerVerdicts[name][item.key]); }).join("") +
        cell(session.aiVerdicts[item.key]) +
        agreedCell +
        '</tr>';
    }

    var rows = sectionRow("Compliance") +
      CALIBRATION_COMPLIANCE.map(function (c) { return itemRow(c, ["P", "F", "NA"]); }).join("") +
      sectionRow("Operational") +
      CALIBRATION_OPERATIONAL.map(function (c) { return itemRow(c, ["P", "F", "PWD", "NA"]); }).join("");

    var totalRows = '<tr><td class="cell-strong">Compliance score</td>' +
      '<td style="text-align:center;" class="cell-strong">' + calibrationComplianceScore(session.yourVerdicts) + '/100</td>' +
      reviewerCols.map(function (name) { return '<td style="text-align:center;" class="cell-strong">' + calibrationComplianceScore(session.reviewerVerdicts[name]) + '/100</td>'; }).join("") +
      '<td style="text-align:center;" class="cell-strong">' + calibrationComplianceScore(session.aiVerdicts) + '/100</td>' +
      '<td style="text-align:center;background:var(--info-bg);" class="cell-strong">' + calibrationComplianceScore(session.agreedOutcome || session.aiVerdicts) + '/100</td>' +
      '</tr>' +
      '<tr><td class="cell-strong">Operational <span class="muted small" style="font-weight:400;">(not part of total)</span></td>' +
      '<td style="text-align:center;" class="cell-strong">' + calibrationOperationalPasses(session.yourVerdicts) + '/10</td>' +
      reviewerCols.map(function (name) { return '<td style="text-align:center;" class="cell-strong">' + calibrationOperationalPasses(session.reviewerVerdicts[name]) + '/10</td>'; }).join("") +
      '<td style="text-align:center;" class="cell-strong">' + calibrationOperationalPasses(session.aiVerdicts) + '/10</td>' +
      '<td style="text-align:center;background:var(--info-bg);" class="cell-strong">' + calibrationOperationalPasses(session.agreedOutcome || session.aiVerdicts) + '/10</td>' +
      '</tr>';

    return { head: head, rows: rows, totalRows: totalRows, totalCols: totalCols };
  }

  function renderCalibrationDetail(session) {
    var body = document.getElementById("calibration-detail-body");
    if (!body) return;
    var status = calibrationStatus(session);
    var html = '<div class="card mb-18"><div class="card__body row" style="justify-content:space-between;flex-wrap:wrap;gap:12px;">' +
      '<div><div class="cell-strong" style="font-size:15px;">' + esc(session.ref) + ' &middot; ' + esc(session.agent) + ' &middot; ' + esc(session.customer) + '</div>' +
      '<div class="muted small" style="margin-top:2px;">Inbound call &middot; ' + esc(session.duration) + ' &middot; ' + esc(session.createdLabel) + '</div></div>' +
      '<span id="calibration-status-pill">' + calibrationStatusPill(status) + '</span>' +
      '</div></div>';

    html += calibrationReviewerStatusListHtml(session);

    if (!session.yourSubmitted) {
      html += '<div class="banner banner--warn mb-18"><span style="font-size:22px;">🙈</span><div>' +
        '<div style="font-size:14.5px;">Your evaluation is hidden from other reviewers until you submit</div>' +
        '<div class="small" style="font-weight:500;margin-top:2px;">' + session.reviewers.length + ' of ' + calibrationTotalReviewers(session) + ' reviewers are already Complete. Once everyone (including you) is Complete, this reveals the Overall scorecard — right here, no separate tab.</div>' +
        '</div></div>';
      html += calibrationBlindFormHtml(session);
    } else {
      html += '<div class="banner banner--pass mb-18"><span style="font-size:22px;">🔓</span><div>' +
        '<div style="font-size:14.5px;">Revealed</div>' +
        '<div class="small" style="font-weight:500;margin-top:2px;">All ' + calibrationTotalReviewers(session) + ' reviewers are Complete, including the AI\'s own read below.</div>' +
        '</div></div>';
      if (session.ownerIsYou && !session.calibrated) {
        html += '<div class="banner banner--warn mb-18"><span style="font-size:22px;">👑</span><div>' +
          '<div style="font-size:14.5px;">You created this session, so you set the Agreed outcome</div>' +
          '<div class="small" style="font-weight:500;margin-top:2px;">Now that everyone\'s submitted their own QA, mark up the Overall scorecard together — pick the correct outcome for every criterion in the column on the right, including ones everyone already agreed on. Anything that differs from it is flagged.</div>' +
          '</div></div>';
      }
      if (session.calibrated) {
        html += '<div class="banner banner--pass mb-18"><span style="font-size:22px;">✅</span><div>' +
          '<div style="font-size:14.5px;">Calibrated outcome logged</div>' +
          '<div class="small" style="font-weight:500;margin-top:2px;">The Agreed outcome column below is this call\'s final calibrated score.</div>' +
          '</div></div>';
      }
      var table = calibrationComparisonTableHtml(session);
      html += '<div class="card mb-18"><div class="card__head"><h3>Overall scorecard</h3><span class="tag">' + calibrationTotalReviewers(session) + ' reviewers &middot; incl. AI</span></div>' +
        '<div class="table-wrap"><table class="data"><thead><tr>' + table.head + '</tr></thead><tbody>' + table.rows + table.totalRows + '</tbody></table></div>';
      if (!session.calibrated) {
        html += '<div class="card__body" style="border-top:1px solid var(--border-soft);">' +
          '<button type="button" class="btn btn--dark" id="calibration-log-outcome-btn"' + (session.ownerIsYou ? "" : " disabled title=\"Only the session owner can log the calibrated outcome\"") + '>Log calibrated outcome</button>' +
          '<span class="muted small" style="margin-left:10px;">Records the Agreed outcome column above as this call\'s final calibrated score.</span></div>';
      }
      html += '</div>';
    }

    body.innerHTML = html;
    wireCalibrationDetailEvents(session);
  }

  function wireCalibrationDetailEvents(session) {
    var list = document.querySelector("#calibration-evaluate-form .card__body");
    var submitBtn = document.getElementById("calibration-submit-btn");
    if (list && submitBtn) {
      var allItems = [].slice.call(list.querySelectorAll("[data-criterion]"));
      function updateSubmitState() {
        submitBtn.disabled = !allItems.every(function (li) {
          return !!(session.yourVerdicts && session.yourVerdicts[li.getAttribute("data-criterion")]);
        });
      }
      list.querySelectorAll(".blind-mark-btn").forEach(function (btn) {
        btn.addEventListener("click", function () {
          if (btn.disabled) return;
          var li = btn.closest("[data-criterion]");
          var key = li.getAttribute("data-criterion");
          session.yourVerdicts = session.yourVerdicts || {};
          session.yourVerdicts[key] = btn.getAttribute("data-v");
          li.querySelectorAll(".blind-mark-btn").forEach(function (b) { b.classList.remove("active"); });
          btn.classList.add("active");
          updateCalibrationSession(session);
          updateSubmitState();
          var complianceCount = document.getElementById("calibration-compliance-count");
          if (complianceCount) complianceCount.textContent = "(" + CALIBRATION_COMPLIANCE.filter(function (c) { return session.yourVerdicts[c.key] === "P"; }).length + "/10)";
          var operationalCount = document.getElementById("calibration-operational-count");
          if (operationalCount) operationalCount.textContent = "(" + CALIBRATION_OPERATIONAL.filter(function (c) { return session.yourVerdicts[c.key] === "P"; }).length + "/10)";
          var statusPillWrap = document.getElementById("calibration-status-pill");
          if (statusPillWrap) statusPillWrap.innerHTML = calibrationStatusPill(calibrationStatus(session));
          var yourStatusPillWrap = document.getElementById("calibration-your-status-pill");
          if (yourStatusPillWrap) yourStatusPillWrap.innerHTML = calibrationReviewerStatusPillHtml(calibrationYourStatus(session));
        });
      });
      submitBtn.addEventListener("click", function () {
        session.yourSubmitted = true;
        if (!session.agreedOutcome) session.agreedOutcome = Object.assign({}, session.aiVerdicts);
        updateCalibrationSession(session);
        renderCalibrationDetail(session);
      });
      updateSubmitState();
    }
    document.querySelectorAll("[data-agreed-toggle]").forEach(function (group) {
      group.querySelectorAll("button").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var key = group.getAttribute("data-agreed-toggle");
          session.agreedOutcome = session.agreedOutcome || {};
          session.agreedOutcome[key] = btn.getAttribute("data-v");
          updateCalibrationSession(session);
          renderCalibrationDetail(session);
        });
      });
    });
    var logBtn = document.getElementById("calibration-log-outcome-btn");
    if (logBtn) {
      logBtn.addEventListener("click", function () {
        if (!session.ownerIsYou) return;
        session.calibrated = true;
        updateCalibrationSession(session);
        renderCalibrationDetail(session);
      });
    }
  }

  function calibrationReviewerPoolHtml() {
    return getUsers().filter(function (u) { return u.role !== "agent" && u.name !== CURRENT_AGENT_NAME; }).map(function (u) {
      return '<label class="row" style="gap:8px;font-weight:500;"><input type="checkbox" value="' + esc(u.name) + '" /> ' + esc(u.name) + '</label>';
    }).join("");
  }

  function wireCalibrationPage() {
    if (!document.getElementById("calibration-sessions-tbody")) return;
    seedCalibrationSessions();
    var newSessionBtn = document.getElementById("calibration-new-session-btn");
    var modal = document.getElementById("calibration-new-session-modal");
    if (newSessionBtn && modal) {
      newSessionBtn.addEventListener("click", function () {
        document.getElementById("cal-new-ref").value = "";
        document.getElementById("cal-new-agent").value = "";
        document.getElementById("cal-new-customer").value = "";
        var pool = document.getElementById("cal-new-reviewers");
        if (pool) pool.innerHTML = calibrationReviewerPoolHtml();
        modal.classList.add("open");
      });
    }
    var createBtn = document.getElementById("cal-new-session-create");
    if (createBtn) {
      createBtn.addEventListener("click", function () {
        var ref = document.getElementById("cal-new-ref").value.trim();
        var agent = document.getElementById("cal-new-agent").value.trim();
        var customer = document.getElementById("cal-new-customer").value.trim();
        if (!agent || !customer) { alert("Enter an agent and customer for this session."); return; }
        var reviewers = Array.prototype.map.call(
          document.querySelectorAll("#cal-new-reviewers input:checked"),
          function (cb) { return cb.value; }
        );
        var sessions = getCalibrationSessions();
        var nextNum = 1001 + sessions.length;
        var id = "CAL-" + nextNum;
        if (!ref) ref = "INT-" + (10600 + sessions.length);
        var session = {
          id: id, ref: ref, agent: agent, customer: customer, duration: "—",
          reviewers: reviewers, ownerIsYou: true,
          createdLabel: "Just now", createdAt: Date.now(),
          aiVerdicts: calibrationGenVerdicts(id + "-ai"),
          reviewerVerdicts: {}, yourVerdicts: {}, yourSubmitted: false,
          agreedOutcome: null, calibrated: false
        };
        reviewers.forEach(function (name, i) { session.reviewerVerdicts[name] = calibrationGenVerdicts(id + "-" + name + "-" + i); });
        sessions.push(session);
        saveCalibrationSessions(sessions);
        modal.classList.remove("open");
        calibrationOpenDetail(id);
      });
    }
    var backBtn = document.getElementById("calibration-back-btn");
    if (backBtn) backBtn.addEventListener("click", calibrationShowSessionsList);

    window.addEventListener("popstate", function () {
      var id = new URLSearchParams(window.location.search).get("session");
      if (id && calibrationSessionById(id)) calibrationOpenDetail(id);
      else calibrationShowSessionsList();
    });

    var initialId = new URLSearchParams(window.location.search).get("session");
    if (initialId && calibrationSessionById(initialId)) calibrationOpenDetail(initialId, true);
    else calibrationShowSessionsList(true);
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

  /* ---- 16. Customer Simulations personas & dial limits (prototype only) ----
     simulations.html's Inbound/Outbound persona cards are backed by a
     d360-sim-personas localStorage list, so each one's "AI agent"
     config (system prompt, voice, conversation controls, and its own
     daily dial limit) can be edited via the Edit Agent modal and
     persists. Dialling is logged in d360-sim-dial-history, an array
     with one entry per calendar day ({date, total, totalDurationSeconds,
     perPersona: {id: count}}), so each card can show how many dials it
     has left today against its own configurable limit (default 10),
     the page-wide "calls dialed today" counter can total every dial
     across all personas, and simulations-stats.html can roll the same
     history up into this-week and all-time figures. */
  var SIM_PERSONAS_KEY = "d360-sim-personas";
  var SIM_DIAL_HISTORY_KEY = "d360-sim-dial-history";
  var SIM_DEFAULT_DAILY_LIMIT = 10;
  var SIM_DAILY_CREDIT_LIMIT = 150;
  var SIM_CALL_SVG = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>';

  function todayKey() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function simDateKey(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function simLastNDates(n) {
    var dates = [];
    for (var i = 0; i < n; i++) {
      var d = new Date();
      d.setDate(d.getDate() - i);
      dates.push(simDateKey(d));
    }
    return dates;
  }
  function simRandomCallDurationSeconds() {
    return 90 + Math.floor(Math.random() * 181);
  }
  function formatDuration(seconds) {
    seconds = Math.round(seconds || 0);
    var m = Math.floor(seconds / 60);
    var s = seconds % 60;
    return m + "m " + String(s).padStart(2, "0") + "s";
  }

  /* ---- Dial history: one entry per calendar day ---- */
  function getSimDialHistory() {
    try { return JSON.parse(localStorage.getItem(SIM_DIAL_HISTORY_KEY)) || []; } catch (e) { return []; }
  }
  function saveSimDialHistory(list) { localStorage.setItem(SIM_DIAL_HISTORY_KEY, JSON.stringify(list)); }
  function getSimDayEntry(date) {
    return getSimDialHistory().filter(function (e) { return e.date === date; })[0] || null;
  }
  function logSimDials(personaId, qty) {
    var history = getSimDialHistory();
    var today = todayKey();
    var entry = history.filter(function (e) { return e.date === today; })[0];
    if (!entry) {
      entry = { date: today, total: 0, totalDurationSeconds: 0, perPersona: {}, perPersonaDuration: {} };
      history.push(entry);
    }
    if (!entry.perPersonaDuration) entry.perPersonaDuration = {};
    entry.total += qty;
    entry.perPersona[personaId] = (entry.perPersona[personaId] || 0) + qty;
    for (var i = 0; i < qty; i++) {
      var duration = simRandomCallDurationSeconds();
      entry.totalDurationSeconds += duration;
      entry.perPersonaDuration[personaId] = (entry.perPersonaDuration[personaId] || 0) + duration;
    }
    saveSimDialHistory(history);
    renderSimDialCount();
  }

  /* ---- Page-wide "dialed today" counter (all personas combined) ---- */
  function getSimDialCount() {
    var entry = getSimDayEntry(todayKey());
    return entry ? entry.total : 0;
  }
  function renderSimDialCount() {
    var count = getSimDialCount();
    document.querySelectorAll("[data-sim-dial-count]").forEach(function (el) { el.textContent = count; });
    renderSimCreditPill();
  }

  /* ---- Shared daily simulation credit (all personas combined) ----
     A simple prototype stand-in for a real usage-based credit balance:
     every dial (across every persona) draws down the same shared pool,
     shown as a "% credit remaining today" pill next to the dial
     counter. Managers and above get a "Request more credit" action;
     it's decorative here, but in the live product would notify Billing. */
  function getSimCreditRemainingPct() {
    return Math.max(0, Math.round((1 - getSimDialCount() / SIM_DAILY_CREDIT_LIMIT) * 100));
  }
  function renderSimCreditPill() {
    var pct = getSimCreditRemainingPct();
    var cls = pct > 50 ? "ok" : pct > 20 ? "warn" : "low";
    document.querySelectorAll("[data-sim-credit-pill]").forEach(function (el) {
      el.classList.remove("ok", "warn", "low");
      el.classList.add(cls);
    });
    document.querySelectorAll("[data-sim-credit-value], [data-request-credit-remaining]").forEach(function (el) {
      el.textContent = pct + "%";
    });
  }

  /* ---- Per-persona daily dial log ---- */
  function getPersonaDialsToday(id) {
    var entry = getSimDayEntry(todayKey());
    return (entry && entry.perPersona[id]) || 0;
  }
  function simRemainingDials(p) {
    return Math.max(0, (p.dailyDialLimit || SIM_DEFAULT_DAILY_LIMIT) - getPersonaDialsToday(p.id));
  }

  /* ---- This-week / all-time aggregates (for simulations-stats.html) ---- */
  function getSimWeekEntries() {
    var dates = simLastNDates(7);
    return getSimDialHistory().filter(function (e) { return dates.indexOf(e.date) !== -1; });
  }
  function getSimWeekTotal() {
    return getSimWeekEntries().reduce(function (sum, e) { return sum + e.total; }, 0);
  }
  function getPersonaDialsThisWeek(id) {
    return getSimWeekEntries().reduce(function (sum, e) { return sum + (e.perPersona[id] || 0); }, 0);
  }
  function getSimAllTimeAvgSeconds() {
    var totalDuration = 0, totalCalls = 0;
    getSimDialHistory().forEach(function (e) { totalDuration += e.totalDurationSeconds; totalCalls += e.total; });
    return totalCalls ? totalDuration / totalCalls : 0;
  }
  function getSimTodayAvgSeconds() {
    var entry = getSimDayEntry(todayKey());
    return (entry && entry.total) ? entry.totalDurationSeconds / entry.total : 0;
  }
  function personaAvgSecondsFromEntries(entries, id) {
    var duration = 0, count = 0;
    entries.forEach(function (e) {
      duration += (e.perPersonaDuration && e.perPersonaDuration[id]) || 0;
      count += (e.perPersona && e.perPersona[id]) || 0;
    });
    return count ? duration / count : 0;
  }
  function getPersonaAvgSecondsToday(id) {
    var entry = getSimDayEntry(todayKey());
    return entry ? personaAvgSecondsFromEntries([entry], id) : 0;
  }
  function getPersonaAvgSecondsAllTime(id) {
    return personaAvgSecondsFromEntries(getSimDialHistory(), id);
  }

  /* ---- Persona data store ---- */
  function getSimPersonas() {
    try { return JSON.parse(localStorage.getItem(SIM_PERSONAS_KEY)) || []; } catch (e) { return []; }
  }
  function saveSimPersonas(list) { localStorage.setItem(SIM_PERSONAS_KEY, JSON.stringify(list)); }

  function simPersonaId() {
    return "agent_" + Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 8);
  }
  function simDefaultSystemPrompt(name) {
    return "Turn-taking rule (must follow strictly): The call has just connected and no one has spoken yet. " +
      "Stay completely silent and produce no output. Do not greet, do not introduce yourself, do not narrate. " +
      "Wait for the agent to speak first. Only after the agent's first line should you respond. If 10 seconds " +
      "pass with no agent speech, you may then speak first with your opening line.\n\nYou are playing the role " +
      "of a customer calling a loan company's support line.\n\nYour name is " + name + ".";
  }
  function makeSimPersona(name, direction, avatarColor, firstMessage, extra) {
    var p = {
      id: simPersonaId(), name: name, direction: direction, avatarColor: avatarColor,
      firstMessage: firstMessage, systemPrompt: simDefaultSystemPrompt(name),
      personality: "Friendly but expects a quick, clear answer; can get slightly impatient if the call drags on.",
      callGoals: "Get a clear, confident answer to your question and understand the next steps before ending the call.",
      behaviouralRules: "Stay in character as the customer throughout the call. Do not mention being an AI or break character. End the call naturally once your question has been answered.",
      tags: "Customer, General", voice: "Laura - Enthusiast, Quirky Attitude",
      eagerness: "Normal", turnModel: "turn_v3", silenceSeconds: 3, maxDurationSeconds: 1200,
      speculativeTurn: true, dailyDialLimit: SIM_DEFAULT_DAILY_LIMIT, connected: false
    };
    if (extra) { for (var k in extra) p[k] = extra[k]; }
    return p;
  }

  function seedSimPersonas() {
    if (localStorage.getItem(SIM_PERSONAS_KEY)) return;
    saveSimPersonas([
      makeSimPersona("Jenny Warner", "inbound", "#1D2E5C", "Hello, I've applied for a loan but not received any funds into my account"),
      makeSimPersona("Matty Spencer", "inbound", "#9C1E6E", "Hi I am looking for more information about your loan"),
      makeSimPersona("Veronica Miller", "inbound", "#16B8A6", "Hello, I'd like to check the balance remaining on my loan"),
      makeSimPersona("Mack Smith", "inbound", "#17181A", "Hello, I had an email advising I had been denied. Why is this?"),
      makeSimPersona("Daisy Johnson", "inbound", "#8A7B1E", "Hello, please can you help me with my loan application?"),
      makeSimPersona("Frankie Williams", "inbound", "#24405C", "I would like to withdraw my loan application"),
      makeSimPersona("Charlie Brown", "inbound", "#2F4F4C", "Hello, I am requesting a statement to be sent and other information"),
      makeSimPersona("Ronald Garcia", "inbound", "#6B5A22", "Hi, can you confirm my next repayment date and amount?"),
      makeSimPersona("Mary Scott", "inbound", "#8C6FC9", "Hello, I checked my credit report and seen you have done a credit search"),
      makeSimPersona("Nancy Davis", "inbound", "#8E2E8A", "I want to reinstate my ACH"),
      makeSimPersona("Ann Wilson", "inbound", "#5C7A99", "Hello, I believe I have a loan with you can you check?", { connected: true }),
      makeSimPersona("Danny Anderson", "inbound", "#3D4FA8", "Hello, I would like to defer my upcoming payment"),
      makeSimPersona("Harriet Martinez", "inbound", "#3FAE58", "hi, asking about my loan"),
      makeSimPersona("Angry Customer", "inbound", "#8B8F5E", "This is the third time I've called about this — I want to speak to a manager now"),
      makeSimPersona("Unhappy Customer", "inbound", "#A9611D", "I've been on hold for twenty minutes, this is ridiculous"),
      makeSimPersona("Confused Customer", "inbound", "#4A7C8C", "I don't understand this letter you've sent me, can you explain it?"),
      makeSimPersona("Interested Prospect", "outbound", "#2E9E5B", "Yes, I'd like to hear more about what you can offer me"),
      makeSimPersona("Skeptical Prospect", "outbound", "#B8860B", "How do I know this isn't a scam call?"),
      makeSimPersona("Busy Executive", "outbound", "#455A64", "I've got two minutes, what do you need?"),
      makeSimPersona("Price Shopper", "outbound", "#8C6FC9", "What's the best rate you can do, I've had other offers"),
      makeSimPersona("Returning Customer", "outbound", "#16B8A6", "I've used you before, what's changed since then?"),
      makeSimPersona("Do Not Call Request", "outbound", "var(--danger)", "Please remove my number, I don't want to be contacted again")
    ]);
  }

  /* Seeds two prior weeks of dial history (never touches today) so
     simulations-stats.html has a meaningful all-time average and a
     "this week" baseline the first time it's viewed. */
  function seedSimDialHistory() {
    if (localStorage.getItem(SIM_DIAL_HISTORY_KEY)) return;
    var personas = getSimPersonas();
    if (!personas.length) return;
    var history = [];
    for (var i = 13; i >= 1; i--) {
      var d = new Date();
      d.setDate(d.getDate() - i);
      var perPersona = {};
      var perPersonaDuration = {};
      var total = 0, totalDurationSeconds = 0;
      personas.forEach(function (p) {
        if (Math.random() < 0.6) {
          var n = 1 + Math.floor(Math.random() * 6);
          perPersona[p.id] = n;
          total += n;
          for (var c = 0; c < n; c++) {
            var duration = simRandomCallDurationSeconds();
            totalDurationSeconds += duration;
            perPersonaDuration[p.id] = (perPersonaDuration[p.id] || 0) + duration;
          }
        }
      });
      history.push({ date: simDateKey(d), total: total, totalDurationSeconds: totalDurationSeconds, perPersona: perPersona, perPersonaDuration: perPersonaDuration });
    }
    saveSimDialHistory(history);
  }

  /* ---- Persona avatars: hand-drawn inline SVG faces, no external images ----
     Deterministically derived from the persona's id, so the same persona
     always gets the same face across re-renders — skin tone, hair colour
     and hair style are picked by hashing the id, while the expression is
     matched to mood keywords in the persona's name (e.g. "Angry Customer"
     gets cross eyebrows), falling back to a neutral/happy split. */
  var SIM_SKIN_TONES = ["#F4C29B", "#E8B084", "#C68863", "#9C6B47", "#6E4A34"];
  var SIM_HAIR_COLORS = ["#241C15", "#4A2E1C", "#8A5A2E", "#C9971F", "#6B6B6E", "#7C4DFF", "#B23A5C"];
  var SIM_HAIR_STYLES = ["short", "long", "spiky", "bob", "bald"];

  function simHash(str) {
    var h = 0;
    for (var i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
    return h;
  }

  function simPersonaExpression(p) {
    var name = (p.name || "").toLowerCase();
    if (name.indexOf("angry") !== -1) return "cross";
    if (name.indexOf("unhappy") !== -1) return "sad";
    if (name.indexOf("confused") !== -1) return "confused";
    if (name.indexOf("do not call") !== -1) return "cross";
    if (name.indexOf("interested") !== -1) return "happy";
    if (name.indexOf("returning") !== -1) return "happy";
    if (name.indexOf("skeptical") !== -1) return "confused";
    if (name.indexOf("busy executive") !== -1) return "cross";
    return (simHash(p.id || p.name || "") % 2 === 0) ? "neutral" : "happy";
  }

  function simAvatarSvg(p) {
    var h = simHash(p.id || p.name || "x");
    var skin = SIM_SKIN_TONES[h % SIM_SKIN_TONES.length];
    var hair = SIM_HAIR_COLORS[Math.floor(h / 5) % SIM_HAIR_COLORS.length];
    var style = SIM_HAIR_STYLES[Math.floor(h / 35) % SIM_HAIR_STYLES.length];
    var expr = simPersonaExpression(p);
    var ink = "#2b2320";

    var earsSvg = '<circle cx="10" cy="26" r="2.4" fill="' + skin + '"/><circle cx="34" cy="26" r="2.4" fill="' + skin + '"/>';
    var faceSvg = '<circle cx="22" cy="25" r="12" fill="' + skin + '"/>';

    var hairDome = '<path d="M9 16c0-8.5 5.8-14 13-14s13 5.5 13 14v1.5H9z" fill="' + hair + '"/>';
    var hairSides = "";
    if (style === "bald") {
      hairDome = "";
    } else if (style === "long") {
      hairSides = '<path d="M8.5 16.5v12c0 1.7 1.4 3 3 3h1.2v-15z" fill="' + hair + '"/>' +
                  '<path d="M35.5 16.5v12c0 1.7-1.4 3-3 3h-1.2v-15z" fill="' + hair + '"/>';
    } else if (style === "bob") {
      hairSides = '<path d="M8.5 16.5c-.6 4.6.2 8.2 2 10.5h1.7v-11z" fill="' + hair + '"/>' +
                  '<path d="M35.5 16.5c.6 4.6-.2 8.2-2 10.5h-1.7v-11z" fill="' + hair + '"/>';
    } else if (style === "spiky") {
      hairDome = "";
      hairSides = '<path d="M9.5 15 11.5 8 14 14 17 6.5 19.5 13.5 22 6 24.5 13.5 27 6.5 30 14 32.5 8 34.5 15" ' +
        'fill="none" stroke="' + hair + '" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>';
    }

    var browsSvg, mouthSvg;
    switch (expr) {
      case "cross":
        browsSvg = '<path d="M14.5 18 20 20.5M29.5 18 24 20.5" stroke="' + ink + '" stroke-width="1.7" stroke-linecap="round"/>';
        mouthSvg = '<path d="M17.5 30h9" stroke="#2b2320" stroke-width="2" stroke-linecap="round"/>';
        break;
      case "sad":
        browsSvg = '<path d="M14.5 19.5 20 18M29.5 19.5 24 18" stroke="' + ink + '" stroke-width="1.7" stroke-linecap="round"/>';
        mouthSvg = '<path d="M17.5 31.5c1.7-2 8.3-2 10 0" stroke="#2b2320" stroke-width="1.8" stroke-linecap="round" fill="none"/>';
        break;
      case "confused":
        browsSvg = '<path d="M14.5 19.5 20 19M24 17 29.5 19.5" stroke="' + ink + '" stroke-width="1.7" stroke-linecap="round"/>';
        mouthSvg = '<path d="M18 29.8c2-1.2 5 1.4 8 0" stroke="#2b2320" stroke-width="1.6" stroke-linecap="round" fill="none"/>';
        break;
      case "happy":
        browsSvg = '<path d="M14.5 19 20 17.5M29.5 19 24 17.5" stroke="' + ink + '" stroke-width="1.7" stroke-linecap="round"/>';
        mouthSvg = '<path d="M17 29c1.8 2.2 8.2 2.2 10 0" stroke="#2b2320" stroke-width="1.8" stroke-linecap="round" fill="none"/>';
        break;
      case "bored":
        browsSvg = '<path d="M14.5 20 20 20M29.5 20 24 20" stroke="' + ink + '" stroke-width="1.7" stroke-linecap="round"/>';
        mouthSvg = '<path d="M18 30.3h8" stroke="#2b2320" stroke-width="1.6" stroke-linecap="round"/>';
        break;
      default:
        browsSvg = '<path d="M14.5 19 20 19M29.5 19 24 19" stroke="' + ink + '" stroke-width="1.7" stroke-linecap="round"/>';
        mouthSvg = '<path d="M18 29.8h8" stroke="#2b2320" stroke-width="1.6" stroke-linecap="round"/>';
    }
    var eyesSvg = (expr === "bored")
      ? '<path d="M15.3 23.8h3.4M25.3 23.8h3.4" stroke="' + ink + '" stroke-width="1.6" stroke-linecap="round"/>'
      : '<circle cx="17" cy="24" r="1.5" fill="' + ink + '"/><circle cx="27" cy="24" r="1.5" fill="' + ink + '"/>';

    return (
      '<svg width="44" height="44" viewBox="0 0 44 44" aria-hidden="true" focusable="false">' +
        earsSvg + faceSvg + hairDome + eyesSvg + browsSvg + mouthSvg + hairSides +
      '</svg>'
    );
  }

  /* ---- Rendering ---- */
  function simPersonaCardHtml(p) {
    var remaining = simRemainingDials(p);
    var exhausted = remaining <= 0;
    var statusHtml = p.connected ? '<div class="sim-card__status"><span class="status-dot online">Connected</span></div>' : "";
    return (
      '<div class="sim-card" data-persona-id="' + p.id + '">' +
        '<div class="sim-card__top">' +
          '<span class="sim-card__avatar" style="background:' + p.avatarColor + ';">' + simAvatarSvg(p) + '</span>' +
          '<div class="sim-card__headline">' +
            '<div class="sim-card__name">' + p.name + '</div>' +
            '<div class="sim-card__quote">“' + p.firstMessage + '”</div>' +
            statusHtml +
          '</div>' +
          '<div class="sim-card__actions" data-roles="admin,manager">' +
            '<button type="button" class="icon-btn sim-edit-btn" data-edit-persona="' + p.id + '" title="Edit agent" aria-label="Edit ' + p.name + '">' +
              '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>' +
            '</button>' +
            '<button type="button" class="icon-btn sim-delete-btn" data-delete-persona="' + p.id + '" title="Delete agent" aria-label="Delete ' + p.name + '">' +
              '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>' +
            '</button>' +
          '</div>' +
        '</div>' +
        '<div class="sim-card__limit' + (exhausted ? " is-exhausted" : "") + '">' +
          '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>' +
          '<strong>' + remaining + '</strong> of ' + (p.dailyDialLimit || SIM_DEFAULT_DAILY_LIMIT) + ' dials left today' +
        '</div>' +
        '<div class="sim-dial-row">' +
          '<div class="sim-dial-group">' +
            '<div class="sim-qty-stepper">' +
              '<button type="button" class="sim-qty-btn" data-qty-dec aria-label="Decrease number of calls">−</button>' +
              '<input type="number" class="sim-qty-input" value="1" min="1" max="20" inputmode="numeric" aria-label="Number of calls to dial" />' +
              '<button type="button" class="sim-qty-btn" data-qty-inc aria-label="Increase number of calls">+</button>' +
            '</div>' +
            '<button type="button" class="sim-call-btn" data-dial-persona-id="' + p.id + '" data-dial-persona="' + p.name + '"' + (exhausted ? " disabled" : "") + '>' +
              SIM_CALL_SVG + 'Dial' +
            '</button>' +
          '</div>' +
          '<button type="button" class="btn btn--ghost icon-btn sim-more-btn" data-roles="admin,manager" aria-label="More options for ' + p.name + '">' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>' +
          '</button>' +
        '</div>' +
      '</div>'
    );
  }

  function renderSimGrid(direction) {
    var container = document.querySelector('[data-sim-grid="' + direction + '"]');
    if (!container) return;
    var list = getSimPersonas().filter(function (p) { return p.direction === direction; });
    container.innerHTML = list.length ? list.map(simPersonaCardHtml).join("") : '<p class="muted" style="padding:16px;">No personas yet.</p>';
    wireSimCardActions(container);
  }
  function renderAllSimGrids() {
    renderSimDialCount();
    renderSimGrid("inbound");
    renderSimGrid("outbound");
    // Every call rebuilds each card's HTML from scratch, including its own
    // [data-roles] edit/delete/more-options controls — re-apply the current
    // role immediately after so those controls don't reappear for a role
    // that shouldn't see them (e.g. dialling as Trainer/Team lead).
    applyRole(localStorage.getItem(ROLE_KEY) || "admin", localStorage.getItem(EMPLOYEE_KEY) || "");
  }

  /* ---- Card interactions: stepper/dial, edit, delete ---- */
  function wireSimCardActions(container) {
    container.querySelectorAll("[data-edit-persona]").forEach(function (btn) {
      btn.addEventListener("click", function () { openEditPersonaModal(btn.getAttribute("data-edit-persona")); });
    });
    container.querySelectorAll("[data-delete-persona]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-delete-persona");
        var p = getSimPersonas().filter(function (x) { return x.id === id; })[0];
        if (!p) return;
        if (window.confirm("Delete " + p.name + "? This can't be undone in this prototype session.")) {
          saveSimPersonas(getSimPersonas().filter(function (x) { return x.id !== id; }));
          renderAllSimGrids();
        }
      });
    });
    container.querySelectorAll(".sim-dial-group").forEach(function (group) {
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
      if (callBtn.disabled) return;

      callBtn.addEventListener("click", function () {
        var id = callBtn.getAttribute("data-dial-persona-id");
        var persona = callBtn.getAttribute("data-dial-persona") || "this persona";
        var p = getSimPersonas().filter(function (x) { return x.id === id; })[0];
        var remaining = p ? simRemainingDials(p) : 20;
        var qty = Math.min(clamp(), Math.max(1, remaining));
        logSimDials(id, qty);
        var textEl = document.getElementById("call-modal-text");
        if (textEl) {
          textEl.textContent = "This would place " + qty + " simulated call" + (qty === 1 ? "" : "s") +
            " to " + persona + " in the live Dial360 Hub, so an agent can rehearse the scenario in real time.";
        }
        var modal = document.getElementById("call-modal");
        if (modal) modal.classList.add("open");
        renderAllSimGrids();
      });
    });
  }

  /* ---- Edit Agent modal ---- */
  var simEditingPersonaId = null;
  function openEditPersonaModal(id) {
    var p = getSimPersonas().filter(function (x) { return x.id === id; })[0];
    if (!p) return;
    simEditingPersonaId = id;
    document.getElementById("edit-persona-id").textContent = p.id;
    document.getElementById("edit-persona-name").value = p.name;
    document.getElementById("edit-persona-first-message").value = p.firstMessage;
    document.getElementById("edit-persona-system-prompt").value = p.systemPrompt;
    document.getElementById("edit-persona-personality").value = p.personality || "";
    document.getElementById("edit-persona-call-goals").value = p.callGoals || "";
    document.getElementById("edit-persona-behavioural-rules").value = p.behaviouralRules || "";
    document.getElementById("edit-persona-tags").value = p.tags;
    document.getElementById("edit-persona-voice").value = p.voice;
    document.getElementById("edit-persona-daily-limit").value = p.dailyDialLimit || SIM_DEFAULT_DAILY_LIMIT;
    document.getElementById("edit-persona-eagerness").value = p.eagerness;
    document.getElementById("edit-persona-turn-model").value = p.turnModel;
    document.getElementById("edit-persona-silence").value = p.silenceSeconds;
    document.getElementById("edit-persona-duration").value = p.maxDurationSeconds;
    document.getElementById("edit-persona-speculative").checked = !!p.speculativeTurn;
    var modal = document.getElementById("edit-persona-modal");
    if (modal) modal.classList.add("open");
  }

  function wireEditPersonaModal() {
    var saveBtn = document.getElementById("edit-persona-save");
    if (!saveBtn) return;
    saveBtn.addEventListener("click", function () {
      if (!simEditingPersonaId) return;
      var list = getSimPersonas();
      var p = list.filter(function (x) { return x.id === simEditingPersonaId; })[0];
      if (!p) return;
      p.name = document.getElementById("edit-persona-name").value.trim() || p.name;
      p.firstMessage = document.getElementById("edit-persona-first-message").value.trim();
      p.systemPrompt = document.getElementById("edit-persona-system-prompt").value;
      p.personality = document.getElementById("edit-persona-personality").value;
      p.callGoals = document.getElementById("edit-persona-call-goals").value;
      p.behaviouralRules = document.getElementById("edit-persona-behavioural-rules").value;
      p.tags = document.getElementById("edit-persona-tags").value.trim();
      p.voice = document.getElementById("edit-persona-voice").value;
      p.dailyDialLimit = Math.max(1, parseInt(document.getElementById("edit-persona-daily-limit").value, 10) || SIM_DEFAULT_DAILY_LIMIT);
      p.eagerness = document.getElementById("edit-persona-eagerness").value;
      p.turnModel = document.getElementById("edit-persona-turn-model").value;
      p.silenceSeconds = parseInt(document.getElementById("edit-persona-silence").value, 10) || 0;
      p.maxDurationSeconds = parseInt(document.getElementById("edit-persona-duration").value, 10) || 0;
      p.speculativeTurn = document.getElementById("edit-persona-speculative").checked;
      saveSimPersonas(list);
      renderAllSimGrids();
      var modal = document.getElementById("edit-persona-modal");
      if (modal) modal.classList.remove("open");
      simEditingPersonaId = null;
    });
  }

  /* ---- Dialling stats page (simulations-stats.html) ---- */
  function renderSimStatsPage() {
    var todayEl = document.querySelector('[data-stat="dials-today"]');
    if (!todayEl) return; // not on the stats page — no-op elsewhere
    todayEl.textContent = getSimDialCount();
    var weekEl = document.querySelector('[data-stat="dials-week"]');
    if (weekEl) weekEl.textContent = getSimWeekTotal();

    var avgToday = getSimTodayAvgSeconds();
    var avgAllTime = getSimAllTimeAvgSeconds();
    var avgTodayEl = document.querySelector('[data-stat="avg-today"]');
    if (avgTodayEl) avgTodayEl.textContent = avgToday ? formatDuration(avgToday) : "—";
    var avgAllTimeEl = document.querySelector('[data-stat="avg-alltime"]');
    if (avgAllTimeEl) avgAllTimeEl.textContent = avgAllTime ? formatDuration(avgAllTime) : "—";

    var deltaEl = document.querySelector('[data-stat="avg-delta"]');
    if (deltaEl) {
      deltaEl.classList.remove("up", "down", "warn");
      if (!avgToday || !avgAllTime) {
        deltaEl.textContent = "No calls dialled yet today";
      } else {
        var pct = ((avgToday - avgAllTime) / avgAllTime) * 100;
        if (pct > 10) {
          deltaEl.classList.add("warn");
          deltaEl.textContent = "▲ " + Math.round(pct) + "% longer than usual";
        } else if (pct < -10) {
          deltaEl.classList.add("up");
          deltaEl.textContent = "▼ " + Math.round(Math.abs(pct)) + "% shorter than usual";
        } else {
          deltaEl.textContent = "About average for today";
        }
      }
    }

    var tbody = document.querySelector("[data-sim-stats-rows]");
    if (tbody) {
      var rows = getSimPersonas().map(function (p) {
        return {
          p: p, today: getPersonaDialsToday(p.id), week: getPersonaDialsThisWeek(p.id),
          avgToday: getPersonaAvgSecondsToday(p.id), avgAllTime: getPersonaAvgSecondsAllTime(p.id)
        };
      }).sort(function (a, b) { return b.week - a.week; });
      tbody.innerHTML = rows.length ? rows.map(function (row) {
        return (
          '<tr>' +
            '<td class="cell-strong">' + row.p.name + '</td>' +
            '<td><span class="tag">' + (row.p.direction === "inbound" ? "Inbound" : "Outbound") + '</span></td>' +
            '<td class="cell-mono">' + row.today + '</td>' +
            '<td class="cell-mono">' + row.week + '</td>' +
            '<td class="cell-mono">' + (row.avgToday ? formatDuration(row.avgToday) : "—") + '</td>' +
            '<td class="cell-mono">' + (row.avgAllTime ? formatDuration(row.avgAllTime) : "—") + '</td>' +
          '</tr>'
        );
      }).join("") : '<tr><td colspan="6" class="muted">No personas yet.</td></tr>';
    }
  }

  /* ---- 17. New Simulations: personality matrix (prototype only) ----
     new-simulations.html lets a reviewer build simulated-call batches by
     toggling on customer x personality combinations in a matrix, then
     "Generate List" bundles every ON cell into a new batch appended to
     the history below. Customers and personalities are each their own
     localStorage list — separate from Customer Simulations' own persona
     records — editable via small modals reached from the pencil icons
     in the matrix. Hovering a customer's name shows a floating tooltip
     (the same pattern analytics.js uses for chart hovers) rather than a
     modal, since it's meant to be glanced at, not dismissed. */
  var MATRIX_CUSTOMERS_KEY = "d360-matrix-customers";
  var MATRIX_PERSONALITIES_KEY = "d360-matrix-personalities";
  var MATRIX_TOGGLES_KEY = "d360-matrix-toggles";
  var MATRIX_BATCHES_KEY = "d360-matrix-batches";
  var MATRIX_PENDING_KEY = "d360-matrix-pending";
  var matrixEditingCustomerId = null;
  var matrixEditingPersonalityId = null;

  function getMatrixCustomers() {
    try { return JSON.parse(localStorage.getItem(MATRIX_CUSTOMERS_KEY)) || []; } catch (e) { return []; }
  }
  function saveMatrixCustomers(list) { localStorage.setItem(MATRIX_CUSTOMERS_KEY, JSON.stringify(list)); }
  function getMatrixPersonalities() {
    try { return JSON.parse(localStorage.getItem(MATRIX_PERSONALITIES_KEY)) || []; } catch (e) { return []; }
  }
  function saveMatrixPersonalities(list) { localStorage.setItem(MATRIX_PERSONALITIES_KEY, JSON.stringify(list)); }
  function getMatrixToggles() {
    try { return JSON.parse(localStorage.getItem(MATRIX_TOGGLES_KEY)) || {}; } catch (e) { return {}; }
  }
  function saveMatrixToggles(map) { localStorage.setItem(MATRIX_TOGGLES_KEY, JSON.stringify(map)); }
  function getMatrixBatches() {
    try { return JSON.parse(localStorage.getItem(MATRIX_BATCHES_KEY)) || []; } catch (e) { return []; }
  }
  function saveMatrixBatches(list) { localStorage.setItem(MATRIX_BATCHES_KEY, JSON.stringify(list)); }
  function matrixToggleKey(customerId, personalityId) { return customerId + "__" + personalityId; }

  /* How many times each customer x personality combination has actually
     been sent (i.e. appears in a d360-matrix-batches entry), today and
     in the last 7 days — shown as a small label under each matrix
     toggle so a reviewer can see at a glance which combinations have
     already gone out without leaving the page. */
  function matrixComboCounts() {
    var today = todayKey();
    var weekDates = simLastNDates(7);
    var counts = {};
    getMatrixBatches().forEach(function (b) {
      var d = new Date(b.createdAt);
      if (isNaN(d.getTime())) return;
      var dateKey = simDateKey(d);
      var isToday = dateKey === today;
      var isThisWeek = weekDates.indexOf(dateKey) !== -1;
      if (!isToday && !isThisWeek) return;
      (b.items || []).forEach(function (it) {
        var key = matrixToggleKey(it.customerId, it.personalityId);
        if (!counts[key]) counts[key] = { today: 0, week: 0 };
        if (isToday) counts[key].today++;
        if (isThisWeek) counts[key].week++;
      });
    });
    return counts;
  }

  /* The list staged between "Generate List" and "Send List" — the
     customer x personality combinations captured off the matrix, plus
     whichever agents have been picked to receive it so far. Cleared
     back to null once sent (or discarded), which is what puts the
     matrix back into its full, editable state. */
  function getMatrixPending() {
    try { return JSON.parse(localStorage.getItem(MATRIX_PENDING_KEY)) || null; } catch (e) { return null; }
  }
  function saveMatrixPending(pending) {
    if (pending) localStorage.setItem(MATRIX_PENDING_KEY, JSON.stringify(pending));
    else localStorage.removeItem(MATRIX_PENDING_KEY);
  }

  function seedMatrixData() {
    if (!localStorage.getItem(MATRIX_CUSTOMERS_KEY)) {
      saveMatrixCustomers([
        { id: "mc1", name: "Charlie Brown", info: "Existing customer since 2023. Requesting a statement and general account information. Prefers a slower, detailed explanation." },
        { id: "mc2", name: "Daisy Johnson", info: "First-time applicant, still mid-application. Not yet familiar with the process — needs clear, patient guidance." },
        { id: "mc3", name: "Frankie Williams", info: "Wants to withdraw an in-progress loan application. Has already decided; agent should confirm and process quickly." },
        { id: "mc4", name: "Jenny Warner", info: "Applied for a loan but funds haven't arrived in her account yet. Wants a clear timeline and reassurance." },
        { id: "mc5", name: "Mack Smith", info: "Recently declined for a loan and wants to understand why. May push back on a vague explanation." },
        { id: "mc6", name: "Veronica Miller", info: "Existing customer checking her remaining loan balance ahead of a renewal decision." }
      ]);
    }
    if (!localStorage.getItem(MATRIX_PERSONALITIES_KEY)) {
      saveMatrixPersonalities([
        { id: "mp1", name: "Happy", details: "Upbeat and satisfied; quick to agree, thank the agent, and wrap up the call positively." },
        { id: "mp2", name: "Sad", details: "Downbeat and subdued in tone; may need extra reassurance and a gentler pace." },
        { id: "mp3", name: "Anxious", details: "Nervous about the outcome; asks clarifying questions repeatedly and seeks confirmation." },
        { id: "mp4", name: "Angry", details: "Frustrated and short-tempered; may raise their voice, interrupt, or push back on answers." },
        { id: "mp5", name: "Chatty", details: "Talkative and prone to going off-topic; enjoys small talk before getting to the point." },
        { id: "mp6", name: "Neutral", details: "Calm, matter-of-fact and straightforward, with no strong emotional signals either way." }
      ]);
    }
  }

  function wireMatrixToggles(tbody) {
    tbody.querySelectorAll("[data-matrix-toggle]").forEach(function (input) {
      input.addEventListener("change", function () {
        var key = input.getAttribute("data-matrix-toggle");
        var toggles = getMatrixToggles();
        if (input.checked) toggles[key] = true; else delete toggles[key];
        saveMatrixToggles(toggles);
      });
    });
    tbody.querySelectorAll("[data-edit-customer]").forEach(function (btn) {
      btn.addEventListener("click", function () { openEditMatrixCustomerModal(btn.getAttribute("data-edit-customer")); });
    });
    tbody.querySelectorAll("[data-customer-info]").forEach(function (el) {
      el.addEventListener("mouseenter", function () {
        var c = getMatrixCustomers().filter(function (x) { return x.id === el.getAttribute("data-customer-info"); })[0];
        showMatrixTooltip((c && c.info) || "No further information yet.");
      });
      el.addEventListener("mousemove", moveMatrixTooltip);
      el.addEventListener("mouseleave", hideMatrixTooltip);
    });
  }

  function showMatrixTooltip(text) {
    var el = document.getElementById("matrix-tooltip");
    if (!el) return;
    el.textContent = text;
    el.classList.add("open");
  }
  function hideMatrixTooltip() {
    var el = document.getElementById("matrix-tooltip");
    if (el) el.classList.remove("open");
  }
  function moveMatrixTooltip(e) {
    var el = document.getElementById("matrix-tooltip");
    if (!el || !el.classList.contains("open")) return;
    el.style.left = (e.clientX + 14) + "px";
    el.style.top = (e.clientY + 14) + "px";
  }

  function renderMatrixTable() {
    var headRow = document.querySelector("[data-matrix-head-row]");
    var tbody = document.querySelector("[data-matrix-rows]");
    if (!tbody) return; // not on this page
    var customers = getMatrixCustomers();
    var personalities = getMatrixPersonalities();
    var toggles = getMatrixToggles();
    var counts = matrixComboCounts();

    if (headRow) {
      headRow.innerHTML = "<th>Customer</th>" + personalities.map(function (p) {
        return (
          '<th>' +
            '<span class="row" style="gap:4px;justify-content:center;">' + p.name +
              '<button type="button" class="icon-btn" data-edit-personality="' + p.id + '" title="Edit personality" aria-label="Edit ' + p.name + '">' +
                '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>' +
              '</button>' +
            '</span>' +
          '</th>'
        );
      }).join("");
      headRow.querySelectorAll("[data-edit-personality]").forEach(function (btn) {
        btn.addEventListener("click", function () { openEditMatrixPersonalityModal(btn.getAttribute("data-edit-personality")); });
      });
    }

    tbody.innerHTML = customers.length ? customers.map(function (c) {
      var cells = personalities.map(function (p) {
        var key = matrixToggleKey(c.id, p.id);
        var combo = counts[key];
        var countsHtml = combo ? '<span class="matrix-cell__counts"><b>' + combo.today + '</b> · ' + combo.week + '</span>' : "";
        return (
          '<td class="matrix-cell">' +
            '<div class="matrix-cell__stack">' +
              '<label class="toggle">' +
                '<input type="checkbox" data-matrix-toggle="' + key + '"' + (toggles[key] ? " checked" : "") + ' aria-label="' + c.name + ' as ' + p.name + '" />' +
                '<span class="track"></span>' +
              '</label>' +
              countsHtml +
            '</div>' +
          '</td>'
        );
      }).join("");
      return (
        '<tr>' +
          '<td>' +
            '<span class="matrix-customer-name" data-customer-info="' + c.id + '">' + c.name + '</span> ' +
            '<button type="button" class="icon-btn" data-edit-customer="' + c.id + '" title="Edit customer" aria-label="Edit ' + c.name + '">' +
              '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>' +
            '</button>' +
          '</td>' + cells +
        '</tr>'
      );
    }).join("") : '<tr><td colspan="' + (personalities.length + 1) + '" class="muted">No customers yet.</td></tr>';

    wireMatrixToggles(tbody);
  }

  function formatMatrixBatchTime(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString(undefined, { day: "numeric", month: "short" }) + ", " +
      d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }

  function renderMatrixHistory() {
    var wrap = document.querySelector("[data-matrix-history]");
    if (!wrap) return;
    var batches = getMatrixBatches();
    var countEl = document.querySelector("[data-matrix-batch-count]");
    if (countEl) countEl.textContent = batches.length + " batch" + (batches.length === 1 ? "" : "es");
    wrap.innerHTML = batches.length ? batches.map(function (b, idx) {
      var num = batches.length - idx;
      return (
        '<div class="matrix-batch">' +
          '<div class="matrix-batch__head">' +
            '<span class="cell-strong">Batch #' + num + '</span>' +
            '<span class="muted small">' + formatMatrixBatchTime(b.createdAt) + ' · ' + b.items.length + ' call' + (b.items.length === 1 ? "" : "s") +
              (b.agentNames && b.agentNames.length ? ' · Sent to ' + b.agentNames.join(", ") : '') +
            '</span>' +
          '</div>' +
          '<div class="matrix-batch__list">' +
            b.items.map(function (it) { return '<span class="tag">' + it.customerName + ' · ' + it.personalityName + '</span>'; }).join("") +
          '</div>' +
        '</div>'
      );
    }).join("") : '<p class="muted small">No batches generated yet.</p>';
  }

  /* Shows/hides the condensed matrix vs. full matrix and the Generated
     List card based on whether a list is currently staged. Re-run after
     every generate / agent pick / discard / send so the two cards and
     the page-head Generate button always match the pending state. */
  function renderMatrixLayout() {
    var layout = document.getElementById("matrix-layout");
    if (!layout) return; // not on this page
    var pending = getMatrixPending();
    var body = document.querySelector("[data-matrix-body]");
    var condensed = document.querySelector("[data-matrix-condensed]");
    var generatedCard = document.getElementById("matrix-generated-card");
    var generateBtn = document.getElementById("matrix-generate-btn");
    layout.classList.toggle("has-generated", !!pending);
    if (body) body.style.display = pending ? "none" : "";
    if (condensed) condensed.style.display = pending ? "" : "none";
    if (generatedCard) generatedCard.style.display = pending ? "" : "none";
    if (generateBtn) generateBtn.style.display = pending ? "none" : "";
    if (pending) renderMatrixGenerated(pending);
  }

  function renderMatrixGenerated(pending) {
    var itemsWrap = document.querySelector("[data-generated-items]");
    if (itemsWrap) {
      itemsWrap.innerHTML = pending.items.map(function (it) {
        return '<span class="tag">' + it.customerName + ' · ' + it.personalityName + '</span>';
      }).join("");
    }
    var agentsWrap = document.querySelector("[data-available-agents]");
    if (agentsWrap) {
      var agents = getUsers().filter(function (u) { return u.role === "agent"; });
      var selected = pending.agentIds || [];
      agentsWrap.innerHTML = agents.length ? '<div class="agent-pick-list">' + agents.map(function (a) {
        var isActive = selected.indexOf(a.id) !== -1;
        return (
          '<button type="button" class="agent-pick' + (isActive ? " active" : "") + '" data-agent-pick="' + a.id + '">' +
            '<span class="cell-user"><span class="avatar avatar--sm">' + userInitials(a.name) + '</span>' + a.name + '</span>' +
            '<svg class="check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg>' +
          '</button>'
        );
      }).join("") + '</div>' : '<p class="muted small">No agents available.</p>';
      agentsWrap.querySelectorAll("[data-agent-pick]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var p = getMatrixPending();
          if (!p) return;
          var id = btn.getAttribute("data-agent-pick");
          p.agentIds = p.agentIds || [];
          var idx = p.agentIds.indexOf(id);
          if (idx === -1) p.agentIds.push(id); else p.agentIds.splice(idx, 1);
          saveMatrixPending(p);
          renderMatrixGenerated(p);
        });
      });
    }
    var sendBtn = document.getElementById("matrix-send-btn");
    if (sendBtn) sendBtn.disabled = !(pending.agentIds && pending.agentIds.length);
  }

  function wireMatrixGenerate() {
    var btn = document.getElementById("matrix-generate-btn");
    if (!btn) return;
    btn.addEventListener("click", function () {
      var toggles = getMatrixToggles();
      var customers = getMatrixCustomers();
      var personalities = getMatrixPersonalities();
      var items = [];
      Object.keys(toggles).forEach(function (key) {
        if (!toggles[key]) return;
        var parts = key.split("__");
        var c = customers.filter(function (x) { return x.id === parts[0]; })[0];
        var p = personalities.filter(function (x) { return x.id === parts[1]; })[0];
        if (c && p) items.push({ customerId: c.id, customerName: c.name, personalityId: p.id, personalityName: p.name });
      });
      if (!items.length) {
        window.alert("Turn on at least one customer × personality combination first.");
        return;
      }
      saveMatrixPending({ items: items, agentIds: [] });
      saveMatrixToggles({});
      renderMatrixTable();
      renderMatrixLayout();
    });
  }

  function wireMatrixDiscard() {
    var btn = document.getElementById("matrix-discard-btn");
    if (!btn) return;
    btn.addEventListener("click", function () {
      saveMatrixPending(null);
      renderMatrixLayout();
    });
  }

  function wireMatrixSend() {
    var btn = document.getElementById("matrix-send-btn");
    if (!btn) return;
    btn.addEventListener("click", function () {
      var pending = getMatrixPending();
      if (!pending || !pending.agentIds || !pending.agentIds.length) return;
      var agents = getUsers();
      var agentNames = pending.agentIds.map(function (id) {
        var a = agents.filter(function (x) { return x.id === id; })[0];
        return a ? a.name : null;
      }).filter(Boolean);
      var batches = getMatrixBatches();
      batches.unshift({
        id: "batch" + Date.now(),
        createdAt: new Date().toISOString(),
        items: pending.items,
        agentIds: pending.agentIds.slice(),
        agentNames: agentNames
      });
      saveMatrixBatches(batches);
      saveMatrixPending(null);
      renderMatrixTable();
      renderMatrixHistory();
      renderMatrixLayout();
    });
  }

  function openEditMatrixCustomerModal(id) {
    var c = getMatrixCustomers().filter(function (x) { return x.id === id; })[0];
    if (!c) return;
    matrixEditingCustomerId = id;
    document.getElementById("matrix-customer-name").value = c.name;
    document.getElementById("matrix-customer-info").value = c.info || "";
    var modal = document.getElementById("edit-matrix-customer-modal");
    if (modal) modal.classList.add("open");
  }
  function wireMatrixCustomerModal() {
    var saveBtn = document.getElementById("matrix-customer-save");
    if (!saveBtn) return;
    saveBtn.addEventListener("click", function () {
      if (!matrixEditingCustomerId) return;
      var list = getMatrixCustomers();
      var c = list.filter(function (x) { return x.id === matrixEditingCustomerId; })[0];
      if (!c) return;
      c.name = document.getElementById("matrix-customer-name").value.trim() || c.name;
      c.info = document.getElementById("matrix-customer-info").value.trim();
      saveMatrixCustomers(list);
      renderMatrixTable();
      var modal = document.getElementById("edit-matrix-customer-modal");
      if (modal) modal.classList.remove("open");
      matrixEditingCustomerId = null;
    });
  }

  function openEditMatrixPersonalityModal(id) {
    var p = getMatrixPersonalities().filter(function (x) { return x.id === id; })[0];
    if (!p) return;
    matrixEditingPersonalityId = id;
    document.getElementById("matrix-personality-name").value = p.name;
    document.getElementById("matrix-personality-details").value = p.details || "";
    var modal = document.getElementById("edit-matrix-personality-modal");
    if (modal) modal.classList.add("open");
  }
  function wireMatrixPersonalityModal() {
    var saveBtn = document.getElementById("matrix-personality-save");
    if (!saveBtn) return;
    saveBtn.addEventListener("click", function () {
      if (!matrixEditingPersonalityId) return;
      var list = getMatrixPersonalities();
      var p = list.filter(function (x) { return x.id === matrixEditingPersonalityId; })[0];
      if (!p) return;
      p.name = document.getElementById("matrix-personality-name").value.trim() || p.name;
      p.details = document.getElementById("matrix-personality-details").value.trim();
      saveMatrixPersonalities(list);
      renderMatrixTable();
      var modal = document.getElementById("edit-matrix-personality-modal");
      if (modal) modal.classList.remove("open");
      matrixEditingPersonalityId = null;
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    setActiveNav();
    wireLogin();
    wireAccountMenu();
    wireVerdictToggles();
    wireTabs();
    wireModals();
    wireEsc();
    wireRowLinks();
    wireTemplateCopy();
    wireRangePickers();
    seedUsers();
    seedQaStatusOverrides();
    seedQaShoutouts();
    renderQaShoutouts();
    renderColinQueue();
    applyQaStatusOverrides();
    wireBlindScorecard();
    renderAiHumanDiff();
    renderScorecardActions();
    wireScorecardActions();
    wireQaPreviewState();
    renderQaFeedbackReadyAlert();
    renderQaDisputeAlert();
    seedBusinessUpdates();
    renderBusinessUpdates();
    wireBusinessUpdateModal();
    seedBannerMessages();
    renderBanner(currentBannerRole());
    wireBannerEditor();
    renderQaAssignmentCells();
    renderQaAssignmentAlert();
    wireCalibrationPage();
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
    seedSimPersonas();
    seedSimDialHistory();
    renderAllSimGrids(); // also re-applies the current role, now that the persona cards exist
    wireEditPersonaModal();
    renderSimStatsPage();
    seedMatrixData();
    renderMatrixTable();
    renderMatrixHistory();
    renderMatrixLayout();
    wireMatrixGenerate();
    wireMatrixDiscard();
    wireMatrixSend();
    wireMatrixCustomerModal();
    wireMatrixPersonalityModal();
  });

  window.D360 = window.D360 || {};
  window.D360.assignTraining = assignTraining;
  window.D360.wireVerdictToggles = wireVerdictToggles;
  window.D360.qaGatePass = qaGatePass;
  window.D360.setQaStatus = setQaStatus;
  window.D360.addQaShoutout = addQaShoutout;
  window.D360.renderQaShoutouts = renderQaShoutouts;
  window.D360.QA_STATUS = QA_STATUS;
})();
