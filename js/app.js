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

  /* ---- 12b. Scorecard "feedback delivered" confirmation (prototype only) ----
     scorecard.html's Reviewer actions panel has a "Confirm feedback
     delivered" button; clicking it flips the status pill next to the
     page title from "Awaiting feedback" to "Feedback Delivered" and
     disables the button so it can't be pressed twice. Stored in
     d360-scorecard-status, keyed by interaction ref, so the confirmed
     state persists across reloads. */
  var SCORECARD_STATUS_KEY = "d360-scorecard-status";

  function getScorecardStatuses() {
    try { return JSON.parse(localStorage.getItem(SCORECARD_STATUS_KEY)) || {}; } catch (e) { return {}; }
  }
  function renderScorecardFeedbackState() {
    var btn = document.getElementById("confirm-feedback-btn");
    if (!btn) return;
    var ref = btn.getAttribute("data-scorecard-ref");
    var delivered = !!getScorecardStatuses()[ref];
    var pill = document.getElementById("scorecard-status-pill");
    var note = document.getElementById("feedback-delivered-note");
    if (delivered) {
      if (pill) { pill.classList.remove("pill--flag"); pill.classList.add("pill--info"); pill.textContent = "Feedback Delivered"; }
      btn.disabled = true;
      btn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg> Feedback delivered';
      if (note) {
        var reviewerName = document.querySelector(".account__name");
        note.style.display = "";
        note.textContent = "Confirmed by " + (reviewerName ? reviewerName.textContent.trim() : "you") + ".";
      }
    }
  }
  function wireScorecardFeedback() {
    var btn = document.getElementById("confirm-feedback-btn");
    if (!btn) return;
    renderScorecardFeedbackState();
    btn.addEventListener("click", function () {
      var ref = btn.getAttribute("data-scorecard-ref");
      var statuses = getScorecardStatuses();
      statuses[ref] = { status: "delivered" };
      localStorage.setItem(SCORECARD_STATUS_KEY, JSON.stringify(statuses));
      renderScorecardFeedbackState();
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
    wireScorecardFeedback();
    seedBusinessUpdates();
    renderBusinessUpdates();
    wireBusinessUpdateModal();
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
    seedSimPersonas();
    seedSimDialHistory();
    renderAllSimGrids(); // also re-applies the current role, now that the persona cards exist
    wireEditPersonaModal();
    renderSimStatsPage();
  });

  window.D360 = window.D360 || {};
  window.D360.assignTraining = assignTraining;
})();
