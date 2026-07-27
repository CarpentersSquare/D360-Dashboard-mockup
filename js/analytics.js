/* ============================================================
   Dial360 Admin Dashboard — Analytics page interactivity
   Handles: hover tooltips on charts, filter-driven regeneration
   of figures/charts/table (period-aware x-axis), and working
   pagination on the Activity table.

   This is still a static prototype — "Apply filters" regenerates
   plausible pseudo-random data shaped by the chosen period/date
   range rather than querying anything real. The numbers are not
   meant to be meaningful, only the interaction should be.
   ============================================================ */
(function () {
  "use strict";

  if (document.body.getAttribute("data-page") !== "analytics") return;

  /* ============================================================
     0. Small helpers
     ============================================================ */
  function pad2(n) { return (n < 10 ? "0" : "") + n; }
  function rand(min, max) { return min + Math.random() * (max - min); }
  function randInt(min, max) { return Math.floor(rand(min, max + 1)); }
  function setText(id, text) { var el = document.getElementById(id); if (el) el.textContent = text; }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  var TODAY = new Date();
  TODAY.setHours(0, 0, 0, 0);

  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function parseDate(s) {
    var p = s.split("-").map(Number);
    return new Date(p[0], p[1] - 1, p[2]);
  }
  function addDays(d, n) { var r = new Date(d); r.setDate(r.getDate() + n); return r; }
  function startOfWeek(d) {
    var r = new Date(d);
    var day = r.getDay();
    var diff = day === 0 ? -6 : 1 - day; // Monday start
    r.setDate(r.getDate() + diff);
    r.setHours(0, 0, 0, 0);
    return r;
  }
  function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
  function endOfMonth(d) { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }
  function isWeekend(d) { var day = d.getDay(); return day === 0 || day === 6; }
  function fmtShort(d) { return d.getDate() + " " + MONTHS[d.getMonth()]; }
  function fmtMonth(d) {
    return MONTHS[d.getMonth()] + (d.getFullYear() !== TODAY.getFullYear() ? " '" + String(d.getFullYear()).slice(2) : "");
  }
  function fmtDMY(d) { return pad2(d.getDate()) + "/" + pad2(d.getMonth() + 1) + "/" + d.getFullYear(); }

  function fmtHMS(totalSeconds) {
    totalSeconds = Math.max(0, Math.round(totalSeconds));
    var h = Math.floor(totalSeconds / 3600);
    var m = Math.floor((totalSeconds % 3600) / 60);
    var s = totalSeconds % 60;
    return h + ":" + pad2(m) + ":" + pad2(s);
  }
  function fmtMS(totalSeconds) {
    totalSeconds = Math.max(0, Math.round(totalSeconds));
    var m = Math.floor(totalSeconds / 60);
    var s = totalSeconds % 60;
    return m + ":" + pad2(s);
  }
  function fmtHoursMins(sec) {
    var h = Math.floor(sec / 3600);
    var m = Math.round((sec % 3600) / 60);
    if (m === 60) { h++; m = 0; }
    return h + "h " + m + "m";
  }
  function fmtMinSec(sec) {
    sec = Math.round(sec);
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    return m + "m " + pad2(s) + "s";
  }

  function niceMax(v) {
    if (v <= 0) return 10;
    var mag = Math.pow(10, Math.floor(Math.log10(v)));
    var norm = v / mag;
    var niceNorm;
    if (norm <= 1) niceNorm = 1;
    else if (norm <= 2) niceNorm = 2;
    else if (norm <= 2.5) niceNorm = 2.5;
    else if (norm <= 5) niceNorm = 5;
    else niceNorm = 10;
    return niceNorm * mag;
  }

  /* ============================================================
     1. Shared hover tooltip
     ============================================================ */
  var tooltipEl = document.getElementById("chart-tooltip");

  function showTooltip(evt, title, rows) {
    if (!tooltipEl) return;
    var html = '<div class="chart-tooltip__title">' + escapeHtml(title) + "</div>";
    rows.forEach(function (r) {
      html += '<div class="chart-tooltip__row"><span class="chart-tooltip__label"><i style="background:' +
        r.color + '"></i>' + escapeHtml(r.label) + '</span><span class="chart-tooltip__value">' +
        escapeHtml(r.value) + "</span></div>";
    });
    tooltipEl.innerHTML = html;
    tooltipEl.classList.add("open");
    positionTooltip(evt);
  }
  function positionTooltip(evt) {
    if (!tooltipEl || !tooltipEl.classList.contains("open")) return;
    var pad = 16;
    var x = evt.clientX + pad;
    var y = evt.clientY + pad;
    var rect = tooltipEl.getBoundingClientRect();
    if (x + rect.width > window.innerWidth - 8) x = evt.clientX - rect.width - pad;
    if (y + rect.height > window.innerHeight - 8) y = evt.clientY - rect.height - pad;
    tooltipEl.style.left = Math.max(8, x) + "px";
    tooltipEl.style.top = Math.max(8, y) + "px";
  }
  function hideTooltip() { if (tooltipEl) tooltipEl.classList.remove("open"); }

  function wireHit(el, getContent) {
    el.addEventListener("mouseenter", function (e) {
      var c = getContent();
      showTooltip(e, c.title, c.rows);
    });
    el.addEventListener("mousemove", positionTooltip);
    el.addEventListener("mouseleave", hideTooltip);
  }

  /* ============================================================
     2. Filters + date bucketing
     ============================================================ */
  function readFilters(prefix) {
    function val(id) { var el = document.getElementById(id); return el ? el.value : ""; }
    return {
      from: val(prefix + "-from"),
      to: val(prefix + "-to"),
      period: val(prefix + "-period") || "Weekly",
      channel: prefix === "ov" ? val(prefix + "-channel") : "All",
      team: val(prefix + "-team"),
      agent: val(prefix + "-agent")
    };
  }

  // Splits a from/to date range into period-sized buckets with a label.
  function bucketDates(fromStr, toStr, period, opts) {
    opts = opts || {};
    var from = parseDate(fromStr || "2026-06-01");
    var to = parseDate(toStr || "2026-07-27");
    if (to < from) { var t = from; from = to; to = t; }
    var points = [];

    if (period === "Daily") {
      var d = new Date(from);
      while (d <= to) {
        if (!opts.skipWeekends || !isWeekend(d)) {
          points.push({ start: new Date(d), end: new Date(d), label: fmtShort(d) });
        }
        d = addDays(d, 1);
      }
      if (points.length > 40) points = points.slice(points.length - 40);
    } else if (period === "Monthly") {
      var m = startOfMonth(from);
      while (m <= to) {
        points.push({ start: new Date(m), end: endOfMonth(m), label: fmtMonth(m) });
        m = new Date(m.getFullYear(), m.getMonth() + 1, 1);
      }
      if (points.length > 24) points = points.slice(points.length - 24);
    } else { // Weekly
      var w = startOfWeek(from);
      while (w <= to) {
        points.push({ start: new Date(w), end: addDays(w, 6), label: fmtShort(w) });
        w = addDays(w, 7);
      }
      if (points.length > 26) points = points.slice(points.length - 26);
    }

    if (!points.length) points.push({ start: from, end: to, label: fmtShort(from) });
    return points;
  }

  function rangeLabel(points) {
    if (!points.length) return "";
    return points[0].label + " – " + points[points.length - 1].label;
  }

  /* ============================================================
     3. Overview tab — volume/answer-rate chart + AHT/ACW chart
     ============================================================ */
  function generateOverviewSeries(f) {
    var buckets = bucketDates(f.from, f.to, f.period);
    var tier = f.period === "Daily" ? 1 : (f.period === "Monthly" ? 3 : 2);

    return buckets.map(function (b, i) {
      var isLast = i === buckets.length - 1;
      var isPartial = isLast && TODAY >= b.start && TODAY <= b.end;

      var offeredBase = tier === 1 ? rand(260, 340) : (tier === 2 ? rand(1800, 2300) : rand(7800, 9200));
      var answerRate = rand(0.955, 0.985);
      var offered = Math.round(offeredBase);
      var handled = Math.round(offered * answerRate);
      var serviceLevel = rand(86, 95);
      var fcr = rand(78, 88);
      var aht = rand(265, 315);
      var acw = rand(1.2, 3.4);

      if (isPartial) {
        var frac = rand(0.08, 0.22);
        offered = Math.round(offered * frac);
        handled = Math.round(handled * frac);
        serviceLevel = rand(1, 8);
        fcr = rand(1, 6);
      }

      return {
        label: b.label, isPartial: isPartial,
        offered: offered, handled: handled,
        answerRate: offered ? (handled / offered * 100) : 0,
        serviceLevel: serviceLevel, fcr: fcr, aht: aht, acw: acw
      };
    });
  }

  function renderOverviewVolumeChart(points) {
    var svg = document.getElementById("ov-chart-svg");
    if (!svg) return;
    var N = points.length;
    var plotLeft = 78, plotRight = 880, plotTop = 30, plotBottom = 270;
    var spacing = N > 1 ? (plotRight - plotLeft) / (N - 1) : (plotRight - plotLeft);
    var barW = Math.max(3, Math.min(14, spacing * 0.32));
    var xs = points.map(function (p, i) { return N > 1 ? plotLeft + i * spacing : (plotLeft + plotRight) / 2; });

    var maxOffered = Math.max.apply(null, points.map(function (p) { return p.offered; }).concat([1]));
    var axisMax = niceMax(maxOffered * 1.08);
    function yCount(v) { return plotBottom - (v / axisMax) * (plotBottom - plotTop); }
    function yPct(v) { return plotBottom - (Math.max(0, Math.min(100, v)) / 100) * (plotBottom - plotTop); }

    var parts = [];
    parts.push('<g stroke="#EBEBEB" stroke-width="1">');
    for (var g = 0; g <= 5; g++) {
      var y = plotTop + g * (plotBottom - plotTop) / 5;
      parts.push('<line x1="' + (plotLeft - 6) + '" y1="' + y + '" x2="908" y2="' + y + '"' + (g === 5 ? ' stroke="#C7C7C7"' : "") + "/>");
    }
    parts.push("</g>");
    parts.push('<text x="' + plotLeft + '" y="16" font-size="10" fill="#90A4AE">Volume</text>');
    parts.push('<text x="920" y="16" text-anchor="end" font-size="10" fill="#90A4AE">%</text>');
    parts.push('<g fill="#90A4AE" font-size="10" text-anchor="end">');
    for (var g2 = 0; g2 <= 5; g2++) {
      var yv = plotTop + g2 * (plotBottom - plotTop) / 5;
      var val = axisMax - g2 * (axisMax / 5);
      parts.push('<text x="' + (plotLeft - 10) + '" y="' + (yv + 4) + '">' + Math.round(val).toLocaleString() + "</text>");
    }
    parts.push("</g>");
    parts.push('<g fill="#90A4AE" font-size="10" text-anchor="start">');
    for (var g3 = 0; g3 <= 5; g3++) {
      var yv3 = plotTop + g3 * (plotBottom - plotTop) / 5;
      parts.push('<text x="916" y="' + (yv3 + 4) + '">' + (100 - g3 * 20) + "%</text>");
    }
    parts.push("</g>");

    parts.push('<g fill="#C9C8FB">');
    points.forEach(function (p, i) {
      var y2 = yCount(p.offered);
      parts.push('<rect x="' + (xs[i] - barW - 1) + '" y="' + y2 + '" width="' + barW + '" height="' + (plotBottom - y2) + '" rx="2"/>');
    });
    parts.push("</g>");
    parts.push('<g fill="#7976F3">');
    points.forEach(function (p, i) {
      var y3 = yCount(p.handled);
      parts.push('<rect x="' + (xs[i] + 1) + '" y="' + y3 + '" width="' + barW + '" height="' + (plotBottom - y3) + '" rx="2"/>');
    });
    parts.push("</g>");

    function linePts(key, yfn) { return points.map(function (p, i) { return xs[i] + "," + yfn(p[key]); }).join(" "); }
    var lastX = xs[N - 1];
    parts.push('<polyline fill="none" stroke="#F481F1" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" points="' + linePts("answerRate", yPct) + '"/>');
    parts.push('<circle cx="' + lastX + '" cy="' + yPct(points[N - 1].answerRate) + '" r="4" fill="#F481F1"/>');
    parts.push('<polyline fill="none" stroke="#ED6C02" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" points="' + linePts("serviceLevel", yPct) + '"/>');
    parts.push('<circle cx="' + lastX + '" cy="' + yPct(points[N - 1].serviceLevel) + '" r="4" fill="#ED6C02"/>');
    parts.push('<polyline fill="none" stroke="#2E7D32" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" points="' + linePts("fcr", yPct) + '"/>');
    parts.push('<circle cx="' + lastX + '" cy="' + yPct(points[N - 1].fcr) + '" r="4" fill="#2E7D32"/>');

    if (points[N - 1].isPartial) {
      parts.push('<line x1="' + lastX + '" y1="30" x2="' + lastX + '" y2="270" stroke="#90A4AE" stroke-width="1" stroke-dasharray="3 3"/>');
      parts.push('<text x="' + (lastX - 4) + '" y="20" text-anchor="end" font-size="9.5" fill="#90A4AE">Today · partial</text>');
    }

    parts.push('<g fill="#90A4AE" font-size="10" text-anchor="middle">');
    var labelEvery = Math.max(1, Math.ceil(N / 6));
    points.forEach(function (p, i) {
      if (i % labelEvery === 0 || i === N - 1) parts.push('<text x="' + xs[i] + '" y="292">' + escapeHtml(p.label) + "</text>");
    });
    parts.push("</g>");

    points.forEach(function (p, i) {
      var hitW = Math.max(barW * 2 + 6, spacing * 0.9);
      parts.push('<rect class="chart-hit" data-idx="' + i + '" x="' + (xs[i] - hitW / 2) + '" y="30" width="' + hitW + '" height="240"/>');
    });

    svg.innerHTML = parts.join("");
    svg.querySelectorAll(".chart-hit").forEach(function (el) {
      var idx = +el.getAttribute("data-idx");
      var p = points[idx];
      wireHit(el, function () {
        return {
          title: p.label + (p.isPartial ? " (partial)" : ""),
          rows: [
            { label: "Interactions Offered", value: p.offered.toLocaleString(), color: "#C9C8FB" },
            { label: "Interactions Handled", value: p.handled.toLocaleString(), color: "#7976F3" },
            { label: "Answer Rate", value: p.answerRate.toFixed(1) + "%", color: "#F481F1" },
            { label: "Service Level", value: p.serviceLevel.toFixed(1) + "%", color: "#ED6C02" },
            { label: "First Call Resolution", value: p.fcr.toFixed(1) + "%", color: "#2E7D32" }
          ]
        };
      });
    });
  }

  function renderOverviewHandleTimeChart(points) {
    var svg = document.getElementById("ov-aht-chart-svg");
    if (!svg) return;
    var N = points.length;
    var plotLeft = 78, plotRight = 880, plotTop = 30, plotBottom = 270;
    var spacing = N > 1 ? (plotRight - plotLeft) / (N - 1) : (plotRight - plotLeft);
    var xs = points.map(function (p, i) { return N > 1 ? plotLeft + i * spacing : (plotLeft + plotRight) / 2; });
    var AHT_MAX = 360, ACW_MAX = 120;
    function yAht(v) { return plotBottom - (Math.max(0, Math.min(AHT_MAX, v)) / AHT_MAX) * (plotBottom - plotTop); }
    function yAcw(v) { return plotBottom - (Math.max(0, Math.min(ACW_MAX, v)) / ACW_MAX) * (plotBottom - plotTop); }

    var parts = [];
    parts.push('<g stroke="#EBEBEB" stroke-width="1">');
    for (var g = 0; g <= 5; g++) {
      var y = plotTop + g * (plotBottom - plotTop) / 5;
      parts.push('<line x1="' + (plotLeft - 6) + '" y1="' + y + '" x2="908" y2="' + y + '"' + (g === 5 ? ' stroke="#C7C7C7"' : "") + "/>");
    }
    parts.push("</g>");
    parts.push('<text x="' + plotLeft + '" y="16" font-size="10" fill="#90A4AE">AHT (mm:ss)</text>');
    parts.push('<text x="920" y="16" text-anchor="end" font-size="10" fill="#90A4AE">ACW (s)</text>');
    parts.push('<g fill="#90A4AE" font-size="10" text-anchor="end">');
    for (var g2 = 0; g2 <= 5; g2++) {
      var yv = plotTop + g2 * (plotBottom - plotTop) / 5;
      parts.push('<text x="' + (plotLeft - 10) + '" y="' + (yv + 4) + '">' + fmtMS(AHT_MAX - g2 * (AHT_MAX / 5)) + "</text>");
    }
    parts.push("</g>");
    parts.push('<g fill="#90A4AE" font-size="10" text-anchor="start">');
    for (var g3 = 0; g3 <= 5; g3++) {
      var yv3 = plotTop + g3 * (plotBottom - plotTop) / 5;
      parts.push('<text x="916" y="' + (yv3 + 4) + '">' + Math.round(ACW_MAX - g3 * (ACW_MAX / 5)) + "s</text>");
    }
    parts.push("</g>");

    var haloAttrs = ' paint-order="stroke" stroke="#fff" stroke-width="4"';
    var ahtTargetY = yAht(300);
    parts.push('<line x1="' + (plotLeft - 6) + '" y1="' + ahtTargetY + '" x2="908" y2="' + ahtTargetY + '" stroke="#7976F3" stroke-width="1.5" stroke-dasharray="6 5" opacity="0.55"/>');
    parts.push('<text x="908" y="' + (ahtTargetY - 7) + '" text-anchor="end" font-size="10" font-weight="700" fill="#7976F3"' + haloAttrs + '>AHT target · 5:00</text>');
    var acwTargetY = yAcw(90);
    parts.push('<line x1="' + (plotLeft - 6) + '" y1="' + acwTargetY + '" x2="908" y2="' + acwTargetY + '" stroke="#F481F1" stroke-width="1.5" stroke-dasharray="6 5" opacity="0.55"/>');
    parts.push('<text x="' + plotLeft + '" y="' + (acwTargetY - 7) + '" font-size="10" font-weight="700" fill="#F481F1"' + haloAttrs + '>ACW target · 1:30</text>');

    var ahtPts = points.map(function (p, i) { return xs[i] + "," + yAht(p.aht); }).join(" ");
    var acwPts = points.map(function (p, i) { return xs[i] + "," + yAcw(p.acw); }).join(" ");
    parts.push('<polyline fill="none" stroke="#7976F3" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" points="' + ahtPts + '"/>');
    parts.push('<polyline fill="none" stroke="#F481F1" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" points="' + acwPts + '"/>');
    var lastX = xs[N - 1];
    parts.push('<circle cx="' + lastX + '" cy="' + yAht(points[N - 1].aht) + '" r="4" fill="#7976F3"/>');
    parts.push('<circle cx="' + lastX + '" cy="' + yAcw(points[N - 1].acw) + '" r="4" fill="#F481F1"/>');

    // Highlight the gap between ACW's actual value and its 90s target at a representative point
    // (never the very last point, to avoid crowding its endpoint marker/label).
    var midIdx = N <= 1 ? 0 : Math.max(0, Math.min(N - 2, Math.floor(N / 2)));
    var midX = xs[midIdx];
    var midAcwY = yAcw(points[midIdx].acw);
    var gapSeconds = Math.max(0, Math.round(90 - points[midIdx].acw));
    var onRightHalf = midX > (plotLeft + plotRight) / 2;
    var gapLabelX = onRightHalf ? midX - 8 : midX + 8;
    var gapAnchor = onRightHalf ? "end" : "start";
    parts.push('<line x1="' + midX + '" y1="' + acwTargetY + '" x2="' + midX + '" y2="' + midAcwY + '" stroke="#2E7D32" stroke-width="1.5" stroke-dasharray="3 3"/>');
    parts.push('<text x="' + gapLabelX + '" y="' + ((acwTargetY + midAcwY) / 2 - 4) + '" text-anchor="' + gapAnchor + '" font-size="11" font-weight="700" fill="#2E7D32"' + haloAttrs + '>' + gapSeconds + "s under target</text>");
    parts.push('<text x="' + gapLabelX + '" y="' + ((acwTargetY + midAcwY) / 2 + 11) + '" text-anchor="' + gapAnchor + '" font-size="10" fill="#455A64"' + haloAttrs + '>ACW vs 1:30 target</text>');

    parts.push('<g fill="#90A4AE" font-size="10" text-anchor="middle">');
    var labelEvery = Math.max(1, Math.ceil(N / 6));
    points.forEach(function (p, i) {
      if (i % labelEvery === 0 || i === N - 1) parts.push('<text x="' + xs[i] + '" y="292">' + escapeHtml(p.label) + "</text>");
    });
    parts.push("</g>");

    points.forEach(function (p, i) {
      var hitW = Math.max(10, spacing * 0.9);
      parts.push('<rect class="chart-hit" data-idx="' + i + '" x="' + (xs[i] - hitW / 2) + '" y="30" width="' + hitW + '" height="240"/>');
    });

    svg.innerHTML = parts.join("");
    svg.querySelectorAll(".chart-hit").forEach(function (el) {
      var idx = +el.getAttribute("data-idx");
      var p = points[idx];
      wireHit(el, function () {
        return {
          title: p.label,
          rows: [
            { label: "Avg Handle Time", value: fmtMS(p.aht), color: "#7976F3" },
            { label: "After-Call Work", value: p.acw.toFixed(1) + "s", color: "#F481F1" }
          ]
        };
      });
    });
  }

  function updateOverviewKPIs(points) {
    var totalOffered = 0, totalHandled = 0, slSum = 0, fcrSum = 0, count = 0;
    points.forEach(function (p) {
      if (p.isPartial) return;
      totalOffered += p.offered; totalHandled += p.handled;
      slSum += p.serviceLevel; fcrSum += p.fcr; count++;
    });
    if (count === 0) count = 1;
    var answerRate = totalOffered ? (totalHandled / totalOffered * 100) : 0;
    var avgSL = slSum / count, avgFCR = fcrSum / count;

    setText("ov-kpi-offered-value", totalOffered.toLocaleString());
    setText("ov-kpi-handled-value", totalHandled.toLocaleString());
    setText("ov-kpi-answer-value", answerRate.toFixed(1) + "%");
    setText("ov-kpi-service-value", avgSL.toFixed(1) + "%");
    setText("ov-kpi-fcr-value", avgFCR.toFixed(1) + "%");

    setText("ov-kpi-offered-delta", "Across " + points.length + " period" + (points.length === 1 ? "" : "s"));
    setText("ov-kpi-handled-delta", "Across " + points.length + " period" + (points.length === 1 ? "" : "s"));
    setText("ov-kpi-answer-delta", "Handled ÷ offered");
    setText("ov-kpi-service-delta", (avgSL >= 90 ? "▲ above" : "▼ below") + " 90% target");
    setText("ov-kpi-fcr-delta", (avgFCR >= 80 ? "▲ within" : "▼ below") + " target range");
    var slEl = document.getElementById("ov-kpi-service-delta");
    if (slEl) slEl.className = "kpi__delta " + (avgSL >= 90 ? "up" : "down");
    var fcrEl = document.getElementById("ov-kpi-fcr-delta");
    if (fcrEl) fcrEl.className = "kpi__delta " + (avgFCR >= 80 ? "up" : "down");
  }

  function applyOverviewFilters() {
    var f = readFilters("ov");
    var points = generateOverviewSeries(f);
    renderOverviewVolumeChart(points);
    renderOverviewHandleTimeChart(points);
    updateOverviewKPIs(points);
    var tagText = f.period + " · " + rangeLabel(points);
    setText("ov-chart-tag", tagText);
    setText("ov-aht-chart-tag", tagText);
  }

  /* ============================================================
     4. Activity tab — daily/weekly/monthly table + pagination
     ============================================================ */
  function generateActivityRows(f) {
    var buckets = bucketDates(f.from, f.to, f.period, { skipWeekends: f.period === "Daily" });
    return buckets.map(function (b) {
      return {
        label: fmtDMY(b.start),
        ready: rand(6.5 * 3600, 8.5 * 3600),
        notReady: rand(50 * 60, 100 * 60),
        lunch: rand(17 * 60, 30 * 60),
        training: Math.random() < 0.4 ? 0 : rand(2 * 60, 20 * 60),
        brk: rand(17 * 60, 32 * 60),
        meetings: rand(1 * 60, 12 * 60),
        techDiff: Math.random() < 0.55 ? 0 : rand(30, 5 * 60),
        other: rand(5 * 60, 20 * 60)
      };
    });
  }
  function lunchClass(sec) { if (sec <= 27 * 60) return "cell-ok"; if (sec <= 30 * 60) return "cell-warn"; return "cell-bad"; }
  function breakClass(sec) { if (sec <= 24 * 60) return "cell-ok"; if (sec <= 28 * 60) return "cell-warn"; return "cell-bad"; }

  var activityState = { rows: [], page: 1, pageSize: 10, noun: "days" };

  function renderActivityTable() {
    var rows = activityState.rows;
    var pageSize = activityState.pageSize;
    var totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
    if (activityState.page > totalPages) activityState.page = totalPages;
    if (activityState.page < 1) activityState.page = 1;
    var startIdx = (activityState.page - 1) * pageSize;
    var pageRows = rows.slice(startIdx, startIdx + pageSize);

    var tbody = document.getElementById("act-table-body");
    if (tbody) {
      tbody.innerHTML = pageRows.map(function (r) {
        return "<tr>" +
          '<td class="cell-strong">' + escapeHtml(r.label) + "</td>" +
          '<td class="cell-mono">' + fmtHMS(r.ready) + "</td>" +
          '<td class="cell-mono">' + fmtHMS(r.notReady) + "</td>" +
          '<td class="cell-mono ' + lunchClass(r.lunch) + '">' + fmtHMS(r.lunch) + "</td>" +
          '<td class="cell-mono">' + fmtHMS(r.training) + "</td>" +
          '<td class="cell-mono ' + breakClass(r.brk) + '">' + fmtHMS(r.brk) + "</td>" +
          '<td class="cell-mono">' + fmtHMS(r.meetings) + "</td>" +
          '<td class="cell-mono">' + fmtHMS(r.techDiff) + "</td>" +
          '<td class="cell-mono">' + fmtHMS(r.other) + "</td>" +
          "</tr>";
      }).join("");
    }

    setText("act-page-info", "Showing " + (rows.length ? (startIdx + 1) : 0) + "–" +
      Math.min(startIdx + pageSize, rows.length) + " of " + rows.length + " working " + activityState.noun);

    var pager = document.getElementById("act-pager");
    if (pager) {
      var html = '<button type="button" data-act="prev"' + (activityState.page <= 1 ? " disabled" : "") + ' aria-label="Previous page">‹</button>';
      for (var i = 1; i <= totalPages; i++) {
        html += '<button type="button" class="' + (i === activityState.page ? "active" : "") + '" data-page="' + i + '"' +
          (i === activityState.page ? ' aria-current="page"' : "") + ">" + i + "</button>";
      }
      html += '<button type="button" data-act="next"' + (activityState.page >= totalPages ? " disabled" : "") + ' aria-label="Next page">›</button>';
      pager.innerHTML = html;

      pager.querySelectorAll("button[data-page]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          activityState.page = +btn.getAttribute("data-page");
          renderActivityTable();
        });
      });
      var prevBtn = pager.querySelector('[data-act="prev"]');
      var nextBtn = pager.querySelector('[data-act="next"]');
      if (prevBtn) prevBtn.addEventListener("click", function () {
        if (activityState.page > 1) { activityState.page--; renderActivityTable(); }
      });
      if (nextBtn) nextBtn.addEventListener("click", function () {
        if (activityState.page < totalPages) { activityState.page++; renderActivityTable(); }
      });
    }
  }

  function setPolicyPill(id, ok, policyText) {
    var el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = '<span class="pill ' + (ok ? "pill--pass" : "pill--flag") + '">' + (ok ? "On policy" : "Off policy") + "</span> " + policyText;
  }

  function updateActivityKPIs(rows) {
    if (!rows.length) return;
    var sumReady = 0, sumLunch = 0, sumBreak = 0;
    rows.forEach(function (r) { sumReady += r.ready; sumLunch += r.lunch; sumBreak += r.brk; });
    var avgReady = sumReady / rows.length, avgLunch = sumLunch / rows.length, avgBreak = sumBreak / rows.length;

    setText("act-kpi-ready-value", fmtHoursMins(avgReady));
    setText("act-kpi-lunch-value", fmtMinSec(avgLunch));
    setText("act-kpi-break-value", fmtMinSec(avgBreak));
    setPolicyPill("act-kpi-ready-sub", avgReady >= 7.5 * 3600, "Policy min 7h 30m/day");
    setPolicyPill("act-kpi-lunch-sub", avgLunch <= 30 * 60, "Policy max 30 min");
    setPolicyPill("act-kpi-break-sub", avgBreak <= 25 * 60, "Policy max 25 min");
  }

  function applyActivityFilters() {
    var f = readFilters("act");
    activityState.rows = generateActivityRows(f);
    activityState.page = 1;
    activityState.noun = f.period === "Daily" ? "days" : (f.period === "Weekly" ? "weeks" : "months");
    updateActivityKPIs(activityState.rows);
    renderActivityTable();
  }

  /* ============================================================
     5. QA tab — weekly/monthly score trends, fail/ops lists,
        agent comparison
     ============================================================ */
  function generateQAWeeklySeries(f) {
    var buckets = bucketDates(f.from, f.to, "Weekly");
    return buckets.map(function (b) {
      return { label: b.label, compliance: rand(84, 96), operational: rand(82, 92) };
    });
  }
  function generateQAMonthlySeries() {
    var points = [];
    var m = new Date(TODAY.getFullYear(), TODAY.getMonth() - 5, 1);
    for (var i = 0; i < 6; i++) {
      points.push({ label: fmtMonth(m), compliance: rand(86, 95), operational: rand(84, 91) });
      m = new Date(m.getFullYear(), m.getMonth() + 1, 1);
    }
    return points;
  }

  function renderQAScoreChart(svgId, points) {
    var svg = document.getElementById(svgId);
    if (!svg) return;
    var N = points.length;
    var plotLeft = 44, plotRight = 440;
    var spacing = N > 1 ? (plotRight - plotLeft) / (N - 1) : 0;
    var xs = points.map(function (p, i) { return N > 1 ? plotLeft + i * spacing : (plotLeft + plotRight) / 2; });
    function y(v) { v = Math.max(75, Math.min(100, v)); return 220 - (v - 80) * 12; }

    var parts = [];
    parts.push('<g stroke="#EBEBEB" stroke-width="1"><line x1="44" y1="40" x2="440" y2="40"/><line x1="44" y1="100" x2="440" y2="100"/><line x1="44" y1="160" x2="440" y2="160"/><line x1="44" y1="220" x2="440" y2="220"/></g>');
    parts.push('<g fill="#90A4AE" font-size="10" text-anchor="end"><text x="38" y="44">95%</text><text x="38" y="104">90%</text><text x="38" y="164">85%</text><text x="38" y="224">80%</text></g>');
    parts.push('<line x1="44" y1="100" x2="440" y2="100" stroke="#2E7D32" stroke-width="2" stroke-dasharray="6 5"/>');
    var compPts = points.map(function (p, i) { return xs[i] + "," + y(p.compliance); }).join(" ");
    var opPts = points.map(function (p, i) { return xs[i] + "," + y(p.operational); }).join(" ");
    parts.push('<polyline fill="none" stroke="#A177DA" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" points="' + compPts + '"/>');
    parts.push('<circle cx="' + xs[N - 1] + '" cy="' + y(points[N - 1].compliance) + '" r="4" fill="#A177DA"/>');
    parts.push('<polyline fill="none" stroke="#7976F3" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" points="' + opPts + '"/>');
    parts.push('<circle cx="' + xs[N - 1] + '" cy="' + y(points[N - 1].operational) + '" r="4" fill="#7976F3"/>');

    parts.push('<g fill="#90A4AE" font-size="10" text-anchor="middle">');
    var labelEvery = Math.max(1, Math.ceil(N / 5));
    points.forEach(function (p, i) {
      if (i % labelEvery === 0 || i === N - 1) parts.push('<text x="' + xs[i] + '" y="244">' + escapeHtml(p.label) + "</text>");
    });
    parts.push("</g>");

    points.forEach(function (p, i) {
      var hitW = Math.max(8, spacing * 0.9 || 40);
      parts.push('<rect class="chart-hit" data-idx="' + i + '" x="' + (xs[i] - hitW / 2) + '" y="30" width="' + hitW + '" height="200"/>');
    });

    svg.innerHTML = parts.join("");
    svg.querySelectorAll(".chart-hit").forEach(function (el) {
      var idx = +el.getAttribute("data-idx");
      var p = points[idx];
      wireHit(el, function () {
        return {
          title: p.label,
          rows: [
            { label: "Compliance score", value: p.compliance.toFixed(1) + "%", color: "#A177DA" },
            { label: "Operational score", value: p.operational.toFixed(1) + "%", color: "#7976F3" }
          ]
        };
      });
    });
  }

  var FAIL_REASONS = [
    "Confidentiality agreement not read", "Payment options not fully explained", "Correct information not provided",
    "Notes not entered accurately", "Excessive / repeat calling", "Greeting / introduction incomplete"
  ];
  var OPS_QUESTIONS = [
    "Knowledge & complete proficiency", "Proactivity / all actions completed", "Handle time / call flow efficiency",
    "Empathy & understanding", "Tone of voice / rate of speech", "Hold time / permission to place on hold"
  ];
  var AGENTS = [
    { code: "PN", name: "Priya N." }, { code: "DO", name: "Daniel O." }, { code: "GT", name: "Grace T." },
    { code: "OH", name: "Olivia H." }, { code: "CR", name: "Charlotte R." }, { code: "JW", name: "James W." },
    { code: "MB", name: "Marcus B." }, { code: "HP", name: "Hannah P." }
  ];

  function generateFails() {
    var list = FAIL_REASONS.map(function (r) { return { label: r, count: randInt(2, 20) }; });
    list.sort(function (a, b) { return b.count - a.count; });
    return list;
  }
  function generateOps() {
    var list = OPS_QUESTIONS.map(function (r) { return { label: r, score: rand(72, 98) }; });
    list.sort(function (a, b) { return b.score - a.score; });
    return list;
  }
  function generateAgentScores() {
    var list = AGENTS.map(function (a) { return { code: a.code, name: a.name, score: rand(74, 97) }; });
    list.sort(function (a, b) { return b.score - a.score; });
    return list;
  }

  function renderFailsList(list) {
    var el = document.getElementById("qa-fails-list");
    if (!el) return;
    var max = Math.max.apply(null, list.map(function (x) { return x.count; }).concat([1]));
    el.innerHTML = list.map(function (x) {
      var pct = Math.round(x.count / max * 100);
      return "<div><div style=\"display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:6px;\"><span>" +
        escapeHtml(x.label) + '</span><span class="cell-strong">' + x.count + '</span></div><div class="bar bar--danger"><span style="width:' +
        pct + '%"></span></div></div>';
    }).join("");
  }
  function renderOpsList(list) {
    var el = document.getElementById("qa-ops-list");
    if (!el) return;
    el.innerHTML = list.map(function (x) {
      var cls = x.score >= 85 ? "" : " bar--warn";
      var pct = Math.round(x.score);
      return "<div><div style=\"display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:6px;\"><span>" +
        escapeHtml(x.label) + '</span><span class="cell-strong">' + pct + '%</span></div><div class="bar' + cls +
        '"><span style="width:' + pct + '%"></span></div></div>';
    }).join("");
  }

  function tierColor(score) { return score >= 90 ? "url(#qaBarHi)" : (score >= 85 ? "url(#qaBarMid)" : "url(#qaBarLo)"); }
  function tierHex(score) { return score >= 90 ? "#7976F3" : (score >= 85 ? "#A177DA" : "#F481F1"); }

  function renderAgentChart(agents) {
    var svg = document.getElementById("qa-agent-chart-svg");
    if (!svg) return;
    var N = agents.length;
    var plotLeft = 56, plotRight = 916, plotTop = 30, plotBottom = 250;
    var slotW = (plotRight - plotLeft) / N;
    var barW = Math.min(70, slotW * 0.62);
    function y(v) { return plotBottom - (Math.max(0, Math.min(100, v)) / 100) * (plotBottom - plotTop); }

    var parts = [];
    parts.push("<defs>" +
      '<linearGradient id="qaBarHi" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7976F3"/><stop offset="1" stop-color="#A177DA"/></linearGradient>' +
      '<linearGradient id="qaBarMid" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#A177DA"/><stop offset="1" stop-color="#C9A6E6"/></linearGradient>' +
      '<linearGradient id="qaBarLo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F481F1"/><stop offset="1" stop-color="#F8B0F6"/></linearGradient>' +
      "</defs>");
    parts.push('<g stroke="#EBEBEB" stroke-width="1">');
    for (var g = 0; g <= 5; g++) {
      var yy = plotTop + g * (plotBottom - plotTop) / 5;
      parts.push('<line x1="' + plotLeft + '" y1="' + yy + '" x2="' + plotRight + '" y2="' + yy + '"' + (g === 5 ? ' stroke="#C7C7C7"' : "") + "/>");
    }
    parts.push("</g>");
    parts.push('<g fill="#90A4AE" font-size="10" text-anchor="end">');
    for (var g2 = 0; g2 <= 5; g2++) {
      var yv = plotTop + g2 * (plotBottom - plotTop) / 5;
      parts.push('<text x="' + (plotLeft - 6) + '" y="' + (yv + 4) + '">' + (100 - g2 * 20) + "</text>");
    }
    parts.push("</g>");

    var xs = agents.map(function (a, i) { return plotLeft + slotW * i + slotW / 2; });
    agents.forEach(function (a, i) {
      var yTop = y(a.score);
      parts.push('<rect x="' + (xs[i] - barW / 2) + '" y="' + yTop + '" width="' + barW + '" height="' + (plotBottom - yTop) + '" rx="5" fill="' + tierColor(a.score) + '"/>');
    });
    parts.push('<g fill="#263238" font-size="11" font-weight="700" text-anchor="middle">');
    agents.forEach(function (a, i) { parts.push('<text x="' + xs[i] + '" y="' + (y(a.score) - 8) + '">' + Math.round(a.score) + "</text>"); });
    parts.push("</g>");
    parts.push('<g fill="#455A64" font-size="11" font-weight="700" text-anchor="middle">');
    agents.forEach(function (a, i) { parts.push('<text x="' + xs[i] + '" y="270">' + a.code + "</text>"); });
    parts.push("</g>");
    parts.push('<g fill="#90A4AE" font-size="9.5" text-anchor="middle">');
    agents.forEach(function (a, i) { parts.push('<text x="' + xs[i] + '" y="284">' + escapeHtml(a.name) + "</text>"); });
    parts.push("</g>");
    parts.push('<text x="' + plotLeft + '" y="306" font-size="10" fill="#90A4AE">QA score (0–100)</text>');

    agents.forEach(function (a, i) {
      parts.push('<rect class="chart-hit" data-idx="' + i + '" x="' + (xs[i] - slotW / 2) + '" y="' + plotTop + '" width="' + slotW + '" height="' + (plotBottom - plotTop) + '"/>');
    });

    svg.innerHTML = parts.join("");
    svg.querySelectorAll(".chart-hit").forEach(function (el) {
      var idx = +el.getAttribute("data-idx");
      var a = agents[idx];
      wireHit(el, function () {
        return { title: a.name, rows: [{ label: "QA score", value: Math.round(a.score) + "%", color: tierHex(a.score) }] };
      });
    });
  }

  function applyQAFilters() {
    var f = readFilters("qa");
    var weekly = generateQAWeeklySeries(f);
    var monthly = generateQAMonthlySeries();
    renderQAScoreChart("qa-weekly-chart-svg", weekly);
    renderQAScoreChart("qa-monthly-chart-svg", monthly);
    setText("qa-weekly-tag", "Target 90% · " + rangeLabel(weekly));
    renderFailsList(generateFails());
    renderOpsList(generateOps());
    renderAgentChart(generateAgentScores());
  }

  /* ============================================================
     6. Wiring
     ============================================================ */
  function wireFilterForm(prefix, applyFn) {
    var form = document.getElementById(prefix + "-filter-form");
    if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      applyFn();
    });
    form.addEventListener("reset", function () {
      setTimeout(applyFn, 0);
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    wireFilterForm("ov", applyOverviewFilters);
    wireFilterForm("act", applyActivityFilters);
    wireFilterForm("qa", applyQAFilters);
    applyOverviewFilters();
    applyActivityFilters();
    applyQAFilters();
  });
})();
