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
    if (!page) return;
    document.querySelectorAll(".nav-item[data-nav]").forEach(function (el) {
      if (el.getAttribute("data-nav") === page) el.classList.add("active");
    });
  }

  /* ---- 2. Fake login redirect ----
     login.html form -> always go to overview, regardless of input. */
  function wireLogin() {
    var form = document.getElementById("login-form");
    if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      window.location.href = "dashboard.html";
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

  /* ---- 10. Role switch (view-as, prototype only) ----
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
    wireRoleSwitch();
  });
})();
