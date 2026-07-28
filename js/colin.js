/* ============================================================
   QA Colin (SDL) — standalone AI-assisted scorecard tool
   Trainer role and above. Drill-down: agents -> interactions -> AI
   marked evaluation. Submitting an evaluation stores it in
   localStorage; app.js reads that store to surface it in the
   shared QA Review queue (qa.html). No backend — everything here
   is generated client-side with a seeded PRNG so the same agent /
   interaction always shows the same data on reload.
   ============================================================ */
(function () {
  "use strict";

  var SUBMIT_KEY = "d360-colin-submissions";

  var AGENTS = [
    { name: "Neave Clare-Smith", email: "neave.clare-smith@dial360.ai" },
    { name: "Thoby Maluga", email: "thoby@creditflowmanager.com" },
    { name: "Hannah Appleton", email: "hannah.appleton@dial360.ai" },
    { name: "John Mtetwa", email: "john.m@creditflowmanager.com" },
    { name: "Amy Cele", email: "amy.c@creditflowmanager.com" },
    { name: "Gift Shozi", email: "gift@creditflowmanager.com" },
    { name: "Pretty Mabanga", email: "pretty@creditflowmanager.com" },
    { name: "Crissy Govender", email: "crissy@creditflowmanager.com" },
    { name: "Sipho Ndlovu", email: "sipho@creditflowmanager.com" },
    { name: "Lindiwe Zulu", email: "lindiwe@creditflowmanager.com" }
  ];

  var COMPLIANCE_ITEMS = [
    "Proper greeting and introduction given / Ready for all calls",
    "Applicant or authorised 3rd party provided full name & 2 acceptable forms of identification",
    "Agent did not disclose information to an unauthorised third party",
    "Company’s Confidentiality Agreement maintained",
    "Avoided excessive calling: 4 calls total (includes 1 VM using script)",
    "Payment options explained",
    "Dispute rights & validation notice provided where required",
    "Call recording disclosure given at the start of the call",
    "No threatening, profane or misleading language used",
    "Call outcome documented accurately in system notes"
  ];

  var CLASSIFICATIONS = ["Pay in Full ACH", "Settlement Offer", "Payment Plan Setup", "Dispute Callback", "Statement Request", "Skip Trace Follow-up"];
  var DISPOSITIONS = ["Customer Contact", "Voicemail Left", "No Answer", "Right Party Contact"];
  var CUSTOMER_NAMES = ["Lucy Hamby", "Marcus Webb", "Diane Castillo", "Trevor Ainsworth", "Priya Deol", "Samuel O'Connor", "Renee Whitfield", "Bradley Nkosi", "Chantelle Ross", "Victor Adeyemi", null, null];
  var DATE_POOL = ["27th Jul 26 5:10pm", "27th Jul 26 9:05pm", "27th Jul 26 6:34pm", "27th Jul 26 6:21pm", "24th Jul 26 4:39pm", "24th Jul 26 3:12pm", "23rd Jul 26 11:47am", "23rd Jul 26 2:03pm"];

  /* ---- Deterministic PRNG (mulberry32) so a given agent/interaction
     always renders the same "AI" data across reloads. ---- */
  function makeRng(seed) {
    return function () {
      seed |= 0;
      seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
  function pad(n, len) { n = String(n); while (n.length < len) n = "0" + n; return n; }

  function refCode(rng) {
    var letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    var out = "";
    for (var i = 0; i < 11; i++) {
      out += rng() < 0.4 ? pick(rng, letters.split("")) : Math.floor(rng() * 10);
    }
    return out;
  }
  function guidLike(rng) {
    var hex = "0123456789abcdef";
    function seg(len) { var s = ""; for (var i = 0; i < len; i++) s += hex[Math.floor(rng() * 16)]; return s; }
    return [seg(8), seg(4), seg(4), seg(4), seg(12)].join("-");
  }
  function phone(rng) {
    var n = "1800";
    for (var i = 0; i < 7; i++) n += Math.floor(rng() * 10);
    return "+" + n;
  }

  /* ---- Interaction generation ---- */
  function buildInteraction(agentIdx, i, ref, guid, when, forceMeta, forceDurationSec) {
    var rng = makeRng(agentIdx * 1000 + i * 37 + 13);
    var durationSec = forceDurationSec || (90 + Math.floor(rng() * 560));
    var customerName = pick(rng, CUSTOMER_NAMES);
    var classificationType = pick(rng, CLASSIFICATIONS);
    var disposition = pick(rng, DISPOSITIONS);
    var contactDetails = phone(rng);

    var verdicts = COMPLIANCE_ITEMS.map(function () {
      var r = rng();
      return r < 0.72 ? "P" : (r < 0.9 ? "F" : "NA");
    });

    var meta = {
      channel: "voice",
      disposition: disposition,
      classificationType: classificationType,
      customerNo: "Not Found",
      customerName: customerName || "Not Found",
      contactDetails: contactDetails
    };
    if (forceMeta) meta = Object.assign(meta, forceMeta);

    var custLabel = customerName || "the customer";
    var summary = "The customer" + (customerName ? ", " + customerName + "," : "") + " called regarding a " +
      classificationType.toLowerCase() + " account. The agent confirmed identity, discussed the account balance " +
      "and outstanding options with " + custLabel + ", and logged the outcome as “" + disposition + "” " +
      "at the end of the call.";

    var transcript = [
      { speaker: "agent", text: "Thanks for calling, this is your agent speaking — can I get your full name and date of birth to bring up the account?" },
      { speaker: "customer", text: customerName ? customerName + " here, happy to confirm my details." : "Sure, one second while I find my account number." },
      { speaker: "agent", text: "Thank you — I can see the account. Let me talk you through the current balance and the options available." },
      { speaker: "customer", text: "Okay, that makes sense. What do I need to do next?" }
    ];

    return {
      ref: ref, guid: guid, when: when, durationSec: durationSec,
      customerName: customerName, meta: meta, summary: summary,
      transcript: transcript, verdicts: verdicts
    };
  }

  function interactionsFor(agentIdx) {
    if (agentIdx === 3) {
      // John Mtetwa — matches the reference scorecard walkthrough.
      var list = [
        buildInteraction(agentIdx, 0, "TPORTDBB5F1", "7969bb85-4b78-4905-9cec-028c606253e4", "27th Jul 26 5:10pm", {
          disposition: "Customer Contact", classificationType: "Pay in Full ACH",
          customerNo: "Not Found", customerName: "Not Found", contactDetails: "+18009050037"
        }, 606),
        buildInteraction(agentIdx, 1, "KJOIN210BA0", "e1093a8b-6221-4dd6-9df0-ea5f59b4743f", "27th Jul 26 9:05pm", null, 598),
        buildInteraction(agentIdx, 2, "JDRIVE8AF46", "bfde2fac-5257-499e-8a48-7359a1f8904e", "27th Jul 26 6:34pm", null, 494),
        buildInteraction(agentIdx, 3, "HTHOM36819B", "15c6f47e-772f-4346-a122-9145c08b809d", "27th Jul 26 6:21pm", null, 377),
        buildInteraction(agentIdx, 4, "JNONC5ED326", "ca0c3304-98c4-4d42-adb9-4818453b1b64", "24th Jul 26 4:39pm", null, 373),
        buildInteraction(agentIdx, 5, "SGIBSAC4FCF", "2a9d9d1c-6b4f-4a3e-9b0e-7b6d8f2a11c3", "24th Jul 26 3:12pm", null, 363)
      ];
      // Overrides so the reference walkthrough's first call reads exactly
      // as the AI wrap-up originally produced it.
      list[0].customerName = null; // matches "Customer Name: Not Found" in the meta panel
      list[0].knownCustomerName = "Lucy Hamby"; // named in the AI summary despite no CRM match
      list[0].summary = "The customer, Lucy Hamby, called to inquire about making a payment for her loan. After " +
        "confirming her identity with her name, date of birth, and last four digits of her Social Security number, " +
        "Lucy expressed difficulty making the payment online and was seeking assistance. The agent informed her " +
        "that the remaining balance was $1,746.70 and offered to process the payment using her checking account. " +
        "Lucy was initially hesitant but eventually agreed to proceed with the payment after ensuring the funds " +
        "and confirming the checking account details. The agent, John, explained the remaining balance, processed " +
        "her payment request, and offered to schedule the payment using her checking account. After clarifying " +
        "some concerns about payment methods, the agent scheduled the payment of $1,746.70 and informed the " +
        "customer of the confirmation she would receive via email.";
      list[0].verdicts = ["P", "P", "P", "P", "NA", "P", "F", "F", "P", "P"];
      list[0].transcript = [
        { speaker: "agent", text: "Thanks for calling, this is John — can I get your full name, date of birth, and the last four digits of your Social Security number?" },
        { speaker: "customer", text: "Sure, it's Lucy Hamby — I've been trying to pay online but I'm having trouble." },
        { speaker: "agent", text: "No problem, I can help with that here. Your remaining balance is $1,746.70 — would you like to pay from your checking account today?" },
        { speaker: "customer", text: "I think so, let me just double check the funds are there... okay, yes, let's go ahead." }
      ];
      return list;
    }
    var n = 5 + (agentIdx % 3);
    var out = [];
    for (var i = 0; i < n; i++) {
      var rng = makeRng(agentIdx * 500 + i * 11 + 3);
      out.push(buildInteraction(agentIdx, i, refCode(rng), guidLike(rng), pick(rng, DATE_POOL)));
    }
    return out;
  }

  function fmtDuration(sec) {
    var m = Math.floor(sec / 60), s = sec % 60;
    return m + " minutes " + pad(s, 1) + " seconds";
  }
  function passCount(verdicts) { return verdicts.filter(function (v) { return v === "P"; }).length; }

  /* ---- App state ---- */
  var state = { step: "agents", agentIdx: null, interactionIdx: null, interactions: [] };

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  function goStep(step) {
    state.step = step;
    $all(".colin-step").forEach(function (el) { el.classList.toggle("active", el.getAttribute("data-step") === step); });
    $all(".colin-rail__btn").forEach(function (btn) {
      var s = btn.getAttribute("data-step");
      btn.classList.toggle("active", s === step);
      var reachable = s === "agents" || (s === "interactions" && state.agentIdx !== null) || (s === "evaluation" && state.interactionIdx !== null);
      btn.classList.toggle("reachable", reachable);
      btn.disabled = !reachable;
    });
    window.scrollTo(0, 0);
  }

  function renderAgents() {
    var root = $("#colin-agents-list");
    if (!root) return;
    root.innerHTML = AGENTS.map(function (a, i) {
      return '<div class="colin-agent-row" data-agent-idx="' + i + '">' +
        '<div class="colin-agent-row__name"><span class="num">' + (i + 1) + '</span>' + esc(a.name) + '</div>' +
        '<div class="colin-agent-row__email">' + esc(a.email) + '</div>' +
        '</div>';
    }).join("");
    $all(".colin-agent-row", root).forEach(function (row) {
      row.addEventListener("click", function () { selectAgent(+row.getAttribute("data-agent-idx")); });
    });
  }

  function selectAgent(idx) {
    state.agentIdx = idx;
    state.interactionIdx = null;
    state.interactions = interactionsFor(idx);
    var agent = AGENTS[idx];
    var card = $("#colin-agent-card");
    if (card) {
      card.innerHTML = '<div class="colin-agent-card__name">' + esc(agent.name) + '</div>' +
        '<div class="colin-agent-card__sub">' + state.interactions.length + ' interactions available</div>';
    }
    renderInteractions();
    goStep("interactions");
  }

  function renderInteractions() {
    var root = $("#colin-interactions-list");
    if (!root) return;
    var q = ($("#colin-customer-filter") || {}).value || "";
    var list = state.interactions.filter(function (it) {
      if (!q) return true;
      return (it.customerName || "").toLowerCase().indexOf(q.toLowerCase()) !== -1 ||
        it.ref.toLowerCase().indexOf(q.toLowerCase()) !== -1;
    });
    if (!list.length) {
      root.innerHTML = '<div class="muted small" style="padding:16px;">No interactions match that filter.</div>';
      return;
    }
    root.innerHTML = list.map(function (it) {
      var origIdx = state.interactions.indexOf(it);
      return '<div class="colin-int-card" data-int-idx="' + origIdx + '">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>' +
        '<div>' +
        '<div class="colin-int-card__ref">External Ref: ' + esc(it.ref) + '</div>' +
        '<div class="colin-int-card__meta">Call Duration: ' + fmtDuration(it.durationSec) + '</div>' +
        '<div class="colin-int-card__meta">' + (it.customerName ? esc(it.customerName) : "no customer name available") + '</div>' +
        '<div class="colin-int-card__guid">' + it.guid + '</div>' +
        '<div class="colin-int-card__meta">' + it.when + '</div>' +
        '</div></div>';
    }).join("");
    $all(".colin-int-card", root).forEach(function (card) {
      card.addEventListener("click", function () { selectInteraction(+card.getAttribute("data-int-idx")); });
    });
  }

  function wireSort() {
    $all(".colin-sort button").forEach(function (btn) {
      btn.addEventListener("click", function () {
        $all(".colin-sort button").forEach(function (b) { b.classList.remove("active"); });
        btn.classList.add("active");
        var by = btn.getAttribute("data-sort");
        state.interactions.sort(function (a, b) {
          if (by === "duration") return b.durationSec - a.durationSec;
          return a.when < b.when ? 1 : -1; // date desc
        });
        renderInteractions();
      });
    });
  }

  function selectInteraction(idx) {
    state.interactionIdx = idx;
    renderEvaluation();
    goStep("evaluation");
  }

  function verdictLabel(v) { return v === "P" ? "Pass" : v === "F" ? "Fail" : "N/A"; }

  function renderEvaluation() {
    var it = state.interactions[state.interactionIdx];
    var agent = AGENTS[state.agentIdx];
    if (!it || !agent) return;

    $("#colin-eval-agent-name").textContent = agent.name;
    $("#colin-eval-meta").innerHTML =
      "Channel: <strong>" + esc(it.meta.channel) + "</strong><br>" +
      "Disposition: <strong>" + esc(it.meta.disposition) + "</strong><br>" +
      "Classification Type: <strong>" + esc(it.meta.classificationType) + "</strong><br>" +
      "Customer No: <strong>" + esc(it.meta.customerNo) + "</strong><br>" +
      "Customer Name: <strong>" + esc(it.meta.customerName) + "</strong><br>" +
      'Contact Details: <a href="tel:' + esc(it.meta.contactDetails) + '">' + esc(it.meta.contactDetails) + "</a>";

    $("#colin-tab-summary").innerHTML = "<p>" + esc(it.summary) + "</p>";
    $("#colin-tab-transcript").innerHTML = '<div class="transcript">' + it.transcript.map(function (t) {
      return '<div class="turn' + (t.speaker === "agent" ? " turn--agent" : "") + '"><div><div class="turn__meta">' +
        (t.speaker === "agent" ? esc(agent.name) : esc(it.customerName || "Customer")) + '</div>' +
        '<div class="turn__bubble">' + esc(t.text) + '</div></div></div>';
    }).join("") + '</div>';
    $("#colin-tab-recordings").innerHTML =
      '<div class="row" style="align-items:center;gap:14px;">' +
      '<button class="btn btn--ghost" type="button"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 3v18l15-9L5 3z"/></svg>Play recording</button>' +
      '<span class="muted small">' + fmtDuration(it.durationSec) + '</span>' +
      '</div><div class="bar mb-18" style="margin-top:14px;max-width:320px;"><span style="width:35%;"></span></div>';
    $("#colin-tab-qa").innerHTML = '<p class="muted">Automated compliance scoring for this call appears in the Interaction Evaluation panel →</p>';

    renderCompliance(it);
    renderAutoQA(it);
  }

  function renderCompliance(it) {
    var root = $("#colin-compliance-list");
    root.innerHTML = COMPLIANCE_ITEMS.map(function (q, i) {
      var v = it.verdicts[i];
      return '<div class="colin-compliance-item" data-item-idx="' + i + '">' +
        '<div class="colin-compliance-item__q">' + esc(q) + '</div>' +
        '<div class="colin-verdict">' +
        ["P", "F", "NA"].map(function (opt) {
          return '<button type="button" data-v="' + opt + '" class="' + (v === opt ? "active" : "") + '">' + (opt === "NA" ? "N/A" : opt) + '</button>';
        }).join("") +
        '</div>' +
        '<div class="colin-comment"><textarea rows="1" placeholder="Comments">' + (it.comments && it.comments[i] ? esc(it.comments[i]) : "") + '</textarea></div>' +
        '</div>';
    }).join("");

    $all(".colin-compliance-item", root).forEach(function (row) {
      var i = +row.getAttribute("data-item-idx");
      $all("button", row).forEach(function (btn) {
        btn.addEventListener("click", function () {
          $all("button", row).forEach(function (b) { b.classList.remove("active"); });
          btn.classList.add("active");
          it_verdicts()[i] = btn.getAttribute("data-v");
          updateScore();
        });
      });
      var ta = $("textarea", row);
      ta.addEventListener("input", function () {
        var it = state.interactions[state.interactionIdx];
        it.comments = it.comments || [];
        it.comments[i] = ta.value;
      });
    });
    function it_verdicts() { return state.interactions[state.interactionIdx].verdicts; }
    updateScore();
  }

  function updateScore() {
    var it = state.interactions[state.interactionIdx];
    var score = passCount(it.verdicts);
    var el = $("#colin-score");
    if (el) el.textContent = "(" + score + "/10)";
  }

  function renderAutoQA(it) {
    var root = $("#colin-tab-autoqa");
    var score = passCount(it.verdicts);
    root.innerHTML = '<p class="muted small" style="margin-top:0;">Suggested by Dial360 AutoQA — confirm or override in the Evaluation tab.</p>' +
      '<ul class="checklist">' + COMPLIANCE_ITEMS.map(function (q, i) {
        var v = it.verdicts[i];
        var pillClass = v === "P" ? "pill--pass" : v === "F" ? "pill--fail" : "pill--muted";
        return '<li><div class="checklist__main"><div class="checklist__title">' + esc(q) + '</div></div><span class="pill ' + pillClass + '">' + verdictLabel(v) + '</span></li>';
      }).join("") + '</ul>' +
      '<div class="row" style="justify-content:space-between;margin-top:10px;"><span class="cell-strong">AutoQA suggested score</span><span class="cell-strong">' + score + '/10</span></div>';
  }

  function topFailReason(it) {
    for (var i = 0; i < it.verdicts.length; i++) {
      if (it.verdicts[i] === "F") return COMPLIANCE_ITEMS[i];
    }
    return "None";
  }

  function submitScorecard() {
    var it = state.interactions[state.interactionIdx];
    var agent = AGENTS[state.agentIdx];
    if (!it || !agent) return;
    var score10 = passCount(it.verdicts);
    var record = {
      id: "colin-" + it.ref + "-" + Date.now(),
      ref: it.ref,
      agentName: agent.name,
      customerName: it.knownCustomerName || it.customerName || "Unknown customer",
      score: score10 * 10,
      topFailReason: topFailReason(it),
      submittedAt: new Date().toISOString()
    };
    var all = [];
    try { all = JSON.parse(localStorage.getItem(SUBMIT_KEY)) || []; } catch (e) { all = []; }
    all = all.filter(function (r) { return r.ref !== it.ref; });
    all.unshift(record);
    localStorage.setItem(SUBMIT_KEY, JSON.stringify(all));

    var trainingNote = "";
    if (window.D360 && window.D360.assignTraining) {
      var pkg = window.D360.assignTraining(agent.name, it.ref, record.topFailReason);
      if (pkg) trainingNote = ' The <a href="agent-guides.html?open=' + pkg.guideId + '">' + pkg.guideTitle + '</a> guide has been assigned to ' + agent.name + ' for training.';
    }

    var note = $("#colin-submit-note");
    if (note) {
      note.style.display = "block";
      note.innerHTML = "Scorecard submitted — " + score10 + "/10 sent to <a href=\"qa.html\">QA Review</a>." + trainingNote;
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    if (!$("#colin-agents-list")) return; // not on this page
    renderAgents();
    wireSort();
    goStep("agents");

    $all(".colin-rail__btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (btn.disabled) return;
        goStep(btn.getAttribute("data-step"));
      });
    });
    var filter = $("#colin-customer-filter");
    if (filter) filter.addEventListener("input", renderInteractions);

    var saveBtn = $("#colin-save-btn");
    if (saveBtn) saveBtn.addEventListener("click", submitScorecard);
  });
})();
