// =============================================================
// Satyaghosh Maurya — Timescales figure
// A logarithmic time axis from a bond vibration to a pore assembling,
// with what all-atom simulation can reach, what an ordinary confocal
// smFRET measurement can resolve, and what the plasmon-enhanced
// measurement in a waveguide resolves.
//
// The slider sets the detected photon rate during a burst. Time
// resolution is taken as the time needed to collect enough photons to
// call a state, so it moves as one over the rate: raise the rate and
// the measurement window slides left, into the window a simulation can
// produce. The shaded strip is the stretch of time that used to lie
// between the two.
//
// Static drawing, no animation loop. Redraws on resize and on a theme
// change. No dependencies.
// Mount: <canvas data-figure="timescales"> inside a <figure> holding
// [data-ts-rate] and the readouts [data-ts-rate-val], [data-ts-out-res],
// [data-ts-out-gap].
// =============================================================

(function () {
  "use strict";

  var nodes = document.querySelectorAll('canvas[data-figure="timescales"]');
  if (!nodes.length) return;

  function cssVar(name, fallback) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }
  function hexToRgb(h) {
    h = String(h).replace("#", "");
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return isNaN(n) ? [128, 128, 128] : [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgba(rgb, a) { return "rgba(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + "," + a + ")"; }

  var C = {};
  function refreshColors() {
    C.text = hexToRgb(cssVar("--text", "#1f2328"));
    C.bg = hexToRgb(cssVar("--bg", "#ffffff"));
    C.bgAlt = hexToRgb(cssVar("--bg-alt", "#f6f8fa"));
    C.muted = hexToRgb(cssVar("--text-muted", "#656d76"));
    C.border = hexToRgb(cssVar("--border", "#d0d7de"));
    C.accent = hexToRgb(cssVar("--accent", "#0969da"));
    C.green = hexToRgb(cssVar("--donor-green", "#1a7f37"));
    C.font = cssVar("--font-body", "sans-serif");
    C.amber = [210, 153, 34];
  }

  // ---- the science, all of it in one place -------------------------------
  // Order-of-magnitude ranges, in seconds. These are textbook figures for the
  // processes, except the transition path, which is what we measure.
  var EVENTS = [
    { lo: 5e-15, hi: 2e-14, label: "bond vibrates" },
    { lo: 5e-13, hi: 3e-12, label: "water reorganises" },
    { lo: 5e-11, hi: 5e-10, label: "side chain turns" },
    { lo: 1e-9,  hi: 5e-9,  label: "fluorescence lifetime" },
    { lo: 1e-7,  hi: 1e-6,  label: "loop closes" },
    { lo: 1e-6,  hi: 1e-5,  label: "transition path", key: true },
    { lo: 1e-5,  hi: 1e-3,  label: "domain opens and shuts" },
    { lo: 1e-3,  hi: 1e-1,  label: "enzyme turns over" },
    { lo: 1e0,   hi: 1e2,   label: "pore assembles" }
  ];

  var ROWS = ["All-atom simulation", "Confocal smFRET", "Plasmonic waveguide"];

  var TP_LO = 1e-6, TP_HI = 1e-5;   // the transition path: the event we are after
  var MD_STEP = 1e-15;      // the integration step of an all-atom simulation
  var MD_ROUTINE = 1e-5;    // a trajectory reachable on ordinary hardware
  var MD_SPECIAL = 1e-3;    // specialised hardware and enhanced sampling
  var CONFOCAL_RATE = 5e4;  // photons per second during a burst, ordinary confocal
  var N_PHOTONS = 25;       // photons needed before a state can be called
  var T0 = 1e-15, T1 = 1e2; // axis limits

  function resolution(rate) { return N_PHOTONS / rate; }

  function fmtTime(t) {
    if (t >= 1) return t.toFixed(t < 10 ? 1 : 0) + " s";
    if (t >= 1e-3) return Math.round(t * 1e3) + " ms";
    if (t >= 1e-6) return (t * 1e6 < 10 ? (t * 1e6).toFixed(1) : String(Math.round(t * 1e6))) + " µs";
    if (t >= 1e-9) return Math.round(t * 1e9) + " ns";
    if (t >= 1e-12) return Math.round(t * 1e12) + " ps";
    return Math.round(t * 1e15) + " fs";
  }
  function fmtRate(r) {
    if (r >= 1e6) return (r / 1e6).toFixed(r < 1e7 ? 1 : 0) + " MHz";
    return Math.round(r / 1e3) + " kHz";
  }

  function Figure(canvas) {
    var ctx = canvas.getContext("2d");
    if (!ctx) return;
    var fig = canvas.closest("figure") || document;
    var slider = fig.querySelector("[data-ts-rate]");
    var outRate = fig.querySelector("[data-ts-rate-val]");
    var outRes = fig.querySelector("[data-ts-out-res]");
    var outGap = fig.querySelector("[data-ts-out-gap]");

    var rate = 3.0e6;
    if (slider) {
      var v0 = parseFloat(slider.value);
      if (!isNaN(v0)) rate = Math.pow(10, v0);
    }

    var W = 0, H = 0, dpr = 1, G = {};

    function fit() {
      dpr = Math.min(window.devicePixelRatio || 1, canvas.clientWidth < 600 ? 1.5 : 2);
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      G.fs = Math.round(Math.max(9.5, Math.min(13, W / 62)));
      G.narrow = W < 580;
      G.right = W - 10;

      // the left gutter is as wide as the longest row label, never guessed
      ctx.font = G.fs + "px " + C.font;
      var widest = 0;
      for (var r = 0; r < ROWS.length; r++) {
        widest = Math.max(widest, ctx.measureText(ROWS[r]).width);
      }
      G.left = G.narrow ? 8 : Math.min(W * 0.32, Math.ceil(widest) + 16);
      G.pw = G.right - G.left;

      // three staggered levels of event labels at the top, then the bars,
      // spaced to fill whatever height the canvas has
      G.evTop = 6;
      G.evStep = G.fs + 9;
      G.evH = 3 * G.evStep;
      G.barTop = G.evTop + G.evH + (G.narrow ? 14 : 10);
      G.axisY = H - (2 * G.fs + 14);
      var room = Math.max(60, G.axisY - G.barTop - 4);
      G.barGap = room / 3;
      G.barH = Math.max(12, Math.min(24, G.barGap - (G.narrow ? 19 : 12)));
    }

    function x(t) {
      var a = Math.log10(t), lo = Math.log10(T0), hi = Math.log10(T1);
      return G.left + G.pw * (a - lo) / (hi - lo);
    }

    function roundRect(x0, y0, w, h, r) {
      r = Math.min(r, h / 2, w / 2);
      ctx.beginPath();
      ctx.moveTo(x0 + r, y0);
      ctx.lineTo(x0 + w - r, y0); ctx.quadraticCurveTo(x0 + w, y0, x0 + w, y0 + r);
      ctx.lineTo(x0 + w, y0 + h - r); ctx.quadraticCurveTo(x0 + w, y0 + h, x0 + w - r, y0 + h);
      ctx.lineTo(x0 + r, y0 + h); ctx.quadraticCurveTo(x0, y0 + h, x0, y0 + h - r);
      ctx.lineTo(x0, y0 + r); ctx.quadraticCurveTo(x0, y0, x0 + r, y0);
      ctx.closePath();
    }

    function bar(t0, t1, y, fill, stroke, dashed) {
      var x0 = Math.max(G.left, x(t0)), x1 = Math.min(G.right, x(t1));
      if (x1 <= x0) return;
      roundRect(x0, y, x1 - x0, G.barH, 3);
      ctx.fillStyle = fill; ctx.fill();
      if (stroke) {
        ctx.save();
        if (dashed) ctx.setLineDash([4, 3]);
        ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke();
        ctx.restore();
      }
    }

    function rowLabel(text, y, colour) {
      ctx.fillStyle = colour;
      ctx.font = (G.narrow ? "600 " : "") + G.fs + "px " + C.font;
      if (G.narrow) {
        ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
        ctx.fillText(text, G.left, y - 5);
      } else {
        ctx.textAlign = "right"; ctx.textBaseline = "middle";
        ctx.fillText(text, G.left - 10, y + G.barH / 2);
      }
    }

    function draw() {
      var res = resolution(rate);
      var confocal = resolution(CONFOCAL_RATE);

      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = rgba(C.bg, 1);
      ctx.fillRect(0, 0, W, H);

      // ---- the one shaded region is the event we are after, the transition
      // path. It sits inside what a simulation can produce; the question the
      // slider asks is whether the measurement reaches it too.
      var ax0 = x(TP_LO), ax1 = x(TP_HI);
      ctx.fillStyle = rgba(C.amber, 0.16);
      ctx.fillRect(ax0, G.barTop - 7, ax1 - ax0, G.axisY - G.barTop + 7);
      ctx.save();
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = rgba(C.amber, 0.75); ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(ax0 + 0.5, G.barTop - 7); ctx.lineTo(ax0 + 0.5, G.axisY);
      ctx.moveTo(ax1 - 0.5, G.barTop - 7); ctx.lineTo(ax1 - 0.5, G.axisY);
      ctx.stroke();
      ctx.restore();

      // ---- events along the top, staggered over three levels
      ctx.textBaseline = "alphabetic";
      for (var i = 0; i < EVENTS.length; i++) {
        var e = EVENTS[i];
        var lvl = i % 3;
        var y = G.evTop + lvl * G.evStep + G.fs;
        var ex0 = x(e.lo), ex1 = x(e.hi), mid = (ex0 + ex1) / 2;
        var col = e.key ? C.amber : C.muted;

        ctx.strokeStyle = rgba(col, e.key ? 1 : 0.75);
        ctx.lineWidth = e.key ? 2.4 : 1.6;
        ctx.beginPath();
        ctx.moveTo(ex0, y + 4); ctx.lineTo(ex1, y + 4);
        ctx.stroke();
        // a hairline down to the bars, so the eye can carry the time across
        ctx.save();
        ctx.setLineDash([2, 3]);
        ctx.strokeStyle = rgba(col, e.key ? 0.55 : 0.22); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(mid, y + 5); ctx.lineTo(mid, G.barTop - 7); ctx.stroke();
        ctx.restore();

        ctx.font = (e.key ? "600 " : "") + (G.fs - 0.5) + "px " + C.font;
        ctx.fillStyle = rgba(e.key ? C.text : C.muted, 1);
        var label = e.label;
        var tw = ctx.measureText(label).width;
        var tx = Math.min(G.right - tw, Math.max(G.narrow ? 2 : G.left - 40, mid - tw / 2));
        ctx.textAlign = "left";
        ctx.fillText(label, tx, y);
      }

      // ---- the three bars
      var y1 = G.barTop, y2 = y1 + G.barGap, y3 = y2 + G.barGap;

      // all-atom simulation
      bar(MD_STEP, MD_ROUTINE, y1, rgba(C.accent, 0.30), rgba(C.accent, 0.85));
      bar(MD_ROUTINE, MD_SPECIAL, y1, rgba(C.accent, 0.12), rgba(C.accent, 0.5), true);
      rowLabel(ROWS[0], y1, rgba(C.text, 0.9));

      // ordinary confocal smFRET
      bar(confocal, T1, y2, rgba(C.muted, 0.22), rgba(C.muted, 0.7));
      rowLabel(ROWS[1], y2, rgba(C.text, 0.9));

      // this measurement
      bar(res, T1, y3, rgba(C.green, 0.28), rgba(C.green, 0.9));
      rowLabel(ROWS[2], y3, rgba(C.text, 0.9));

      // the moving edge, marked
      var rx = x(res);
      ctx.strokeStyle = rgba(C.green, 1); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(rx, y3 - 4); ctx.lineTo(rx, y3 + G.barH + 4); ctx.stroke();
      ctx.font = "600 " + (G.fs - 0.5) + "px " + C.font;
      ctx.fillStyle = rgba(C.green, 1);
      ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
      var rlab = fmtTime(res);
      var rw = ctx.measureText(rlab).width;
      ctx.fillText(rlab, Math.min(G.right - rw, rx + 5), y3 - 6);

      // does the measurement reach the event?
      if (!G.narrow) {
        var reaches = res <= TP_HI;
        ctx.font = "600 " + (G.fs - 1) + "px " + C.font;
        ctx.fillStyle = rgba(reaches ? C.green : C.muted, 1);
        ctx.textAlign = "center"; ctx.textBaseline = "bottom";
        ctx.fillText(reaches ? "reached" : "out of reach", (ax0 + ax1) / 2, G.axisY - 4);
      }

      // ---- axis
      ctx.strokeStyle = rgba(C.border, 1); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(G.left, G.axisY + 0.5); ctx.lineTo(G.right, G.axisY + 0.5); ctx.stroke();

      var decades = [[1e-15, "fs"], [1e-12, "ps"], [1e-9, "ns"], [1e-6, "µs"], [1e-3, "ms"], [1e0, "s"]];
      ctx.textAlign = "center"; ctx.textBaseline = "top";
      for (var d = 0; d < decades.length; d++) {
        var dx = x(decades[d][0]);
        ctx.strokeStyle = rgba(C.border, 1);
        ctx.beginPath(); ctx.moveTo(dx + 0.5, G.axisY); ctx.lineTo(dx + 0.5, G.axisY + 5); ctx.stroke();
        ctx.fillStyle = rgba(C.text, 0.75);
        ctx.font = G.fs + "px " + C.font;
        ctx.fillText(decades[d][1], dx, G.axisY + 7);
      }
      // minor ticks every decade
      for (var p = -15; p <= 2; p++) {
        if (p % 3 === 0) continue;
        var mx = x(Math.pow(10, p));
        ctx.strokeStyle = rgba(C.border, 0.8);
        ctx.beginPath(); ctx.moveTo(mx + 0.5, G.axisY); ctx.lineTo(mx + 0.5, G.axisY + 3); ctx.stroke();
      }
      ctx.fillStyle = rgba(C.muted, 1);
      ctx.font = G.fs + "px " + C.font;
      ctx.textAlign = "right";
      ctx.fillText("time", G.right, G.axisY + 7 + G.fs + 3);
    }

    function updateReadouts() {
      var res = resolution(rate);
      if (outRate) outRate.textContent = fmtRate(rate);
      if (outRes) outRes.textContent = "≈ " + fmtTime(res);
      if (outGap) {
        outGap.textContent = res <= TP_HI ? "yes, resolved" : "no, too slow";
      }
    }

    refreshColors();
    fit();
    draw();
    updateReadouts();

    if (slider) {
      slider.addEventListener("input", function () {
        var v = parseFloat(slider.value);
        if (!isNaN(v)) { rate = Math.pow(10, v); updateReadouts(); draw(); }
      });
    }

    if (window.ResizeObserver) {
      new ResizeObserver(function () { fit(); draw(); }).observe(canvas);
    } else {
      window.addEventListener("resize", function () { fit(); draw(); });
    }
    if (window.MutationObserver) {
      new MutationObserver(function () { refreshColors(); draw(); })
        .observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    }

    canvas._state = function () {
      var r = resolution(rate);
      return { rate: rate, res: r, reachesTransitionPath: r <= TP_HI, left: G.left };
    };
  }

  for (var i = 0; i < nodes.length; i++) new Figure(nodes[i]);
})();
