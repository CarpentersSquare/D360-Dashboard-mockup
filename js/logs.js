/* ============================================================
   Dial360 — Logs page (Calls / Live Chats / Emails / SMSs)
   Self-contained: generates synthetic "last 30 days" interaction
   data, wires per-tab search/filter forms, renders paginated
   tables and click-through to the canned detail pages — mirrors
   the pattern used by js/analytics.js for its Activity table.
   ============================================================ */
(function () {
  "use strict";

  var DAY_MS = 24 * 60 * 60 * 1000;
  var NOW = new Date("2026-08-10T15:00:00");

  function rand(min, max) { return min + Math.random() * (max - min); }
  function randInt(min, max) { return Math.floor(rand(min, max + 1)); }
  function pick(list) { return list[randInt(0, list.length - 1)]; }
  function randDateInLast30Days() {
    return new Date(NOW.getTime() - rand(0, 30 * DAY_MS));
  }
  function pad2(n) { return n < 10 ? "0" + n : "" + n; }
  function fmtDateTime(d) {
    var days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return days[d.getDay()] + " " + d.getDate() + " " + months[d.getMonth()] + ", " + pad2(d.getHours()) + ":" + pad2(d.getMinutes());
  }
  function fmtDuration(sec) {
    var m = Math.floor(sec / 60);
    var s = Math.floor(sec % 60);
    return m + ":" + pad2(s);
  }
  function toInputValue(d) {
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()) + "T" + pad2(d.getHours()) + ":" + pad2(d.getMinutes());
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  var AGENTS = ["Priya Nair", "Daniel Okafor", "Grace Thompson", "Marcus Bennett", "Olivia Hughes", "Charlotte Reid", "James Whitmore"];
  var CUSTOMER_NAMES = [
    "Sarah Jenkins", "Tom Harrison", "Margaret Whitfield", "Liam O'Connor", "Aisha Khan", "Ben Fletcher",
    "Chloe Dawson", "Ryan Osei", "Emily Carter", "Nathan Price", "Sophie Grant", "Jake Ellison",
    "Hannah Wells", "Connor Blake", "Amelia Hart", "David Nwosu", "Freya Sutton", "Owen Bishop",
    "Isla Meadows", "Lucas Ferry"
  ];
  var QUERIES = [
    "Change payment due date", "Update contact details", "Dispute a charge", "Cancel subscription",
    "General enquiry", "Request statement", "Technical issue with app", "Complaint about service",
    "Request callback", "Change of address"
  ];
  var EMAIL_SUBJECTS = [
    "Question about my latest statement", "Unable to log in to my account", "Request to update billing details",
    "Complaint re: recent call", "Cancellation request", "Refund query", "Change of address confirmation",
    "Direct debit not taken", "Query about a charge", "Request for account summary"
  ];
  var EMAIL_DOMAINS = ["gmail.com", "outlook.com", "yahoo.co.uk", "hotmail.com", "icloud.com"];
  var SUPPORT_EMAIL = "support@d360.com";
  var D360_SMS_NUMBER = "+44 7000 000000";
  var SMS_BODIES = [
    "Hi, this is D360 — just a reminder that your payment is due in 3 days. Reply STOP to opt out of reminders.",
    "Thanks for your call today. Your reference number is DL-" + randInt(10000, 99999) + ".",
    "We tried to call you today but couldn't get through. Please call us back on 0800 123 4567.",
    "Your payment of £48.20 was received today, thank you.",
    "Your appointment with our team has been confirmed for tomorrow at 10:00."
  ];

  function randomName() { return pick(CUSTOMER_NAMES); }
  function emailFromName(name) {
    var parts = name.toLowerCase().replace(/[^a-z\s]/g, "").split(/\s+/);
    var local = parts[0][0] + "." + parts[parts.length - 1] + randInt(1, 99);
    return local + "@" + pick(EMAIL_DOMAINS);
  }
  function randomUkPhone() {
    return "+44 7" + randInt(100, 999) + " " + randInt(100000, 999999);
  }

  /* ---- Data generation ---- */
  function generateCalls() {
    var rows = [];
    for (var i = 0; i < 56; i++) {
      var abandoned = Math.random() < 0.12;
      var date = randDateInLast30Days();
      rows.push({
        id: "CALL-" + (20000 + i),
        date: date,
        phone: randomUkPhone(),
        direction: Math.random() < 0.7 ? "Inbound" : "Outbound",
        duration: abandoned ? randInt(20, 180) : randInt(60, 900),
        status: abandoned ? "Abandoned" : "Answered"
      });
    }
    rows.sort(function (a, b) { return b.date - a.date; });
    return rows;
  }

  function generateChats() {
    var rows = [];
    for (var i = 0; i < 44; i++) {
      var name = randomName();
      var first = randDateInLast30Days();
      var msgCount = randInt(4, 22);
      var last = new Date(first.getTime() + rand(2, 20) * 60000);
      rows.push({
        id: "CHAT-" + (30000 + i),
        email: emailFromName(name),
        name: name,
        query: pick(QUERIES),
        first: first,
        last: last,
        messages: msgCount
      });
    }
    rows.sort(function (a, b) { return b.first - a.first; });
    return rows;
  }

  function generateEmails() {
    var rows = [];
    for (var i = 0; i < 44; i++) {
      var name = randomName();
      var customerEmail = emailFromName(name);
      var inbound = Math.random() < 0.55;
      rows.push({
        id: "EML-" + (40000 + i),
        date: randDateInLast30Days(),
        to: inbound ? SUPPORT_EMAIL : customerEmail,
        from: inbound ? customerEmail : SUPPORT_EMAIL,
        subject: pick(EMAIL_SUBJECTS)
      });
    }
    rows.sort(function (a, b) { return b.date - a.date; });
    return rows;
  }

  function generateSms() {
    var rows = [];
    for (var i = 0; i < 44; i++) {
      var customerPhone = randomUkPhone();
      var inbound = Math.random() < 0.35;
      rows.push({
        id: "SMS-" + (50000 + i),
        date: randDateInLast30Days(),
        to: inbound ? D360_SMS_NUMBER : customerPhone,
        from: inbound ? customerPhone : D360_SMS_NUMBER,
        body: pick(SMS_BODIES)
      });
    }
    rows.sort(function (a, b) { return b.date - a.date; });
    return rows;
  }

  var DATA = {
    calls: generateCalls(),
    chats: generateChats(),
    emails: generateEmails(),
    sms: generateSms()
  };

  var STATE = {
    calls: { page: 1, pageSize: 10 },
    chats: { page: 1, pageSize: 10 },
    emails: { page: 1, pageSize: 10 },
    sms: { page: 1, pageSize: 10 }
  };

  /* ---- Filtering ---- */
  function parseRange(fromId, toId) {
    var fromEl = document.getElementById(fromId);
    var toEl = document.getElementById(toId);
    var from = fromEl && fromEl.value ? new Date(fromEl.value) : null;
    var to = toEl && toEl.value ? new Date(toEl.value) : null;
    return { from: from, to: to };
  }
  function inRange(date, range) {
    if (range.from && date < range.from) return false;
    if (range.to && date > range.to) return false;
    return true;
  }
  function digitsOnly(s) { return String(s).replace(/\D/g, ""); }

  function filterCalls() {
    var phone = (document.getElementById("calls-phone").value || "").trim();
    var direction = document.getElementById("calls-direction").value;
    var range = parseRange("calls-from", "calls-to");
    var phoneDigits = digitsOnly(phone);

    return DATA.calls.filter(function (r) {
      if (phoneDigits && digitsOnly(r.phone).indexOf(phoneDigits) === -1) return false;
      if (direction !== "All" && r.direction !== direction) return false;
      if (!inRange(r.date, range)) return false;
      return true;
    });
  }

  function filterChats() {
    var search = (document.getElementById("chats-search").value || "").trim().toLowerCase();
    var email = (document.getElementById("chats-email").value || "").trim().toLowerCase();
    var range = parseRange("chats-from", "chats-to");

    return DATA.chats.filter(function (r) {
      if (search && r.name.toLowerCase().indexOf(search) === -1 && r.query.toLowerCase().indexOf(search) === -1) return false;
      if (email && r.email.toLowerCase().indexOf(email) === -1) return false;
      if (!inRange(r.first, range)) return false;
      return true;
    });
  }

  function filterEmails() {
    var search = (document.getElementById("emails-search").value || "").trim().toLowerCase();
    var customer = (document.getElementById("emails-customer").value || "").trim().toLowerCase();
    var range = parseRange("emails-from", "emails-to");

    return DATA.emails.filter(function (r) {
      if (search && r.subject.toLowerCase().indexOf(search) === -1) return false;
      if (customer && r.to.toLowerCase().indexOf(customer) === -1 && r.from.toLowerCase().indexOf(customer) === -1) return false;
      if (!inRange(r.date, range)) return false;
      return true;
    });
  }

  function filterSms() {
    var customer = (document.getElementById("sms-customer").value || "").trim();
    var customerDigits = digitsOnly(customer);
    var range = parseRange("sms-from", "sms-to");

    return DATA.sms.filter(function (r) {
      if (customerDigits && digitsOnly(r.to).indexOf(customerDigits) === -1 && digitsOnly(r.from).indexOf(customerDigits) === -1) return false;
      if (!inRange(r.date, range)) return false;
      return true;
    });
  }

  /* ---- Generic paginated table renderer ---- */
  function renderTable(key, rows, rowHtmlFn) {
    var state = STATE[key];
    var totalPages = Math.max(1, Math.ceil(rows.length / state.pageSize));
    if (state.page > totalPages) state.page = totalPages;
    if (state.page < 1) state.page = 1;
    var startIdx = (state.page - 1) * state.pageSize;
    var pageRows = rows.slice(startIdx, startIdx + state.pageSize);

    var tbody = document.getElementById(key + "-table-body");
    if (tbody) {
      tbody.innerHTML = pageRows.map(rowHtmlFn).join("") ||
        '<tr><td colspan="8" class="muted" style="text-align:center;padding:24px;">No results match your filters.</td></tr>';
    }

    var info = document.getElementById(key + "-page-info");
    if (info) {
      info.textContent = "Showing " + (rows.length ? (startIdx + 1) : 0) + "–" +
        Math.min(startIdx + state.pageSize, rows.length) + " of " + rows.length;
    }

    var pager = document.getElementById(key + "-pager");
    if (pager) {
      var html = '<button type="button" data-act="prev"' + (state.page <= 1 ? " disabled" : "") + ' aria-label="Previous page">‹</button>';
      for (var i = 1; i <= totalPages; i++) {
        html += '<button type="button" class="' + (i === state.page ? "active" : "") + '" data-page="' + i + '"' +
          (i === state.page ? ' aria-current="page"' : "") + ">" + i + "</button>";
      }
      html += '<button type="button" data-act="next"' + (state.page >= totalPages ? " disabled" : "") + ' aria-label="Next page">›</button>';
      pager.innerHTML = html;

      pager.querySelectorAll("button[data-page]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          state.page = +btn.getAttribute("data-page");
          renderTable(key, rows, rowHtmlFn);
        });
      });
      var prevBtn = pager.querySelector('[data-act="prev"]');
      var nextBtn = pager.querySelector('[data-act="next"]');
      if (prevBtn) prevBtn.addEventListener("click", function () {
        if (state.page > 1) { state.page--; renderTable(key, rows, rowHtmlFn); }
      });
      if (nextBtn) nextBtn.addEventListener("click", function () {
        if (state.page < totalPages) { state.page++; renderTable(key, rows, rowHtmlFn); }
      });
    }
  }

  /* ---- Per-tab render ---- */
  function renderCalls() {
    var rows = filterCalls();
    STATE.calls.page = STATE.calls.page || 1;
    renderTable("calls", rows, function (r) {
      var href = r.status === "Answered" ? "log-call.html" : "log-call-abandoned.html";
      var directionPill = r.direction === "Inbound" ? "pill--info" : "pill--muted";
      var statusPill = r.status === "Answered" ? "pill--pass" : "pill--fail";
      return "<tr>" +
        '<td class="cell-mono">' + fmtDateTime(r.date) + "</td>" +
        '<td class="cell-strong">' + escapeHtml(r.phone) + "</td>" +
        '<td><span class="pill ' + directionPill + '">' + r.direction + "</span></td>" +
        '<td class="cell-mono">' + fmtDuration(r.duration) + "</td>" +
        '<td><span class="pill ' + statusPill + '">' + r.status + "</span></td>" +
        '<td class="right"><a href="' + href + '">View</a></td>' +
        "</tr>";
    });
  }

  function renderChats() {
    var rows = filterChats();
    renderTable("chats", rows, function (r) {
      return "<tr>" +
        '<td class="cell-mono">' + fmtDateTime(r.first) + "</td>" +
        '<td>' + escapeHtml(r.email) + "</td>" +
        '<td class="cell-strong">' + escapeHtml(r.name) + "</td>" +
        '<td>' + escapeHtml(r.query) + "</td>" +
        '<td class="cell-mono">' + fmtDateTime(r.last) + "</td>" +
        '<td class="cell-mono">' + r.messages + "</td>" +
        '<td class="right"><a href="log-chat.html">View</a></td>' +
        "</tr>";
    });
  }

  function renderEmails() {
    var rows = filterEmails();
    renderTable("emails", rows, function (r) {
      return "<tr>" +
        '<td class="cell-mono">' + fmtDateTime(r.date) + "</td>" +
        '<td>' + escapeHtml(r.to) + "</td>" +
        '<td>' + escapeHtml(r.from) + "</td>" +
        '<td class="cell-strong">' + escapeHtml(r.subject) + "</td>" +
        '<td class="right"><a href="log-email.html">View</a></td>' +
        "</tr>";
    });
  }

  function renderSms() {
    var rows = filterSms();
    renderTable("sms", rows, function (r) {
      return "<tr>" +
        '<td class="cell-mono">' + fmtDateTime(r.date) + "</td>" +
        '<td class="cell-strong">' + escapeHtml(r.to) + "</td>" +
        '<td class="cell-strong">' + escapeHtml(r.from) + "</td>" +
        '<td class="right"><a href="log-sms.html">View</a></td>' +
        "</tr>";
    });
  }

  /* ---- Wiring ---- */
  function wireFilterForm(prefix, applyFn) {
    var form = document.getElementById(prefix + "-filter-form");
    if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      STATE[prefix].page = 1;
      applyFn();
    });
    form.addEventListener("reset", function () {
      setTimeout(function () { STATE[prefix].page = 1; applyFn(); }, 0);
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    if (!document.getElementById("calls-table-body")) return;
    wireFilterForm("calls", renderCalls);
    wireFilterForm("chats", renderChats);
    wireFilterForm("emails", renderEmails);
    wireFilterForm("sms", renderSms);
    renderCalls();
    renderChats();
    renderEmails();
    renderSms();
  });
})();
