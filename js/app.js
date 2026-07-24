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
      });
    });
    function closeAll() {
      document.querySelectorAll(".drawer.open").forEach(function (d) { d.classList.remove("open"); });
      document.querySelectorAll(".drawer-overlay.open").forEach(function (o) { o.classList.remove("open"); });
    }
    document.querySelectorAll(".drawer-overlay, [data-close-drawer]").forEach(function (el) {
      el.addEventListener("click", closeAll);
    });
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
     No real RBAC enforcement — page content itself is unrestricted. */
  var ROLE_KEY = "d360-role";
  var ROLE_LABELS = {
    admin: "Admin", manager: "Manager", teamlead: "Team lead",
    trainer: "Trainer", agent: "Agent"
  };

  function applyRole(role) {
    document.querySelectorAll(".role-switch__option").forEach(function (opt) {
      opt.classList.toggle("active", opt.getAttribute("data-role") === role);
    });
    document.querySelectorAll(".role-switch__current-role").forEach(function (el) {
      el.textContent = ROLE_LABELS[role] || ROLE_LABELS.admin;
    });
    document.querySelectorAll("[data-roles]").forEach(function (el) {
      var allowed = el.getAttribute("data-roles").split(",");
      el.style.display = allowed.indexOf(role) === -1 ? "none" : "";
    });
    var roleLabel = document.querySelector(".account__role");
    if (roleLabel) roleLabel.textContent = ROLE_LABELS[role] || ROLE_LABELS.admin;
    renderBanner(role);
  }

  function wireRoleSwitch() {
    var wrap = document.querySelector(".role-switch");
    if (!wrap) return;
    var trigger = wrap.querySelector(".role-switch__trigger");
    var menu = wrap.querySelector(".role-switch__menu");
    var role = localStorage.getItem(ROLE_KEY) || "admin";
    applyRole(role);

    trigger.addEventListener("click", function (e) {
      e.stopPropagation();
      menu.classList.toggle("open");
    });
    document.addEventListener("click", function () { menu.classList.remove("open"); });
    menu.addEventListener("click", function (e) { e.stopPropagation(); });

    menu.querySelectorAll(".role-switch__option").forEach(function (opt) {
      opt.addEventListener("click", function () {
        role = opt.getAttribute("data-role");
        localStorage.setItem(ROLE_KEY, role);
        applyRole(role);
        menu.classList.remove("open");
      });
    });
  }

  /* ---- 12. Date-range pickers ----
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
    seedBannerMessages();
    renderBanner(currentBannerRole());
    wireBannerEditor();
    wireRoleSwitch();
  });
})();
