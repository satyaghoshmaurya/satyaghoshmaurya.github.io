// =============================================================
// Satyaghosh Maurya — Interactive Hero
// A Brownian walker on a two-well folding landscape (overdamped
// Langevin dynamics) with a synchronized, simulated smFRET trace.
// Representational only, not data. No dependencies.
// Honours prefers-reduced-motion (renders one static frame).
// =============================================================

(function () {
  "use strict";

  var root = document.getElementById("landscapeHero");
  var cvL = document.getElementById("landscapeCanvas");
  var cvT = document.getElementById("traceCanvas");
  if (!root || !cvL || !cvT) return;

  var ctxL = cvL.getContext("2d");
  var ctxT = cvT.getContext("2d");
  var outE = document.getElementById("heroReadoutE");
  var outState = document.getElementById("heroReadoutState");
  var outN = document.getElementById("heroReadoutN");
  var outTP = document.getElementById("heroReadoutTP");
  var btnPlay = document.getElementById("heroPlay");
  var slider = document.getElementById("heroTemp");
  var sliderVal = document.getElementById("heroTempVal");
  var hint = document.getElementById("heroHint");
  var fscale = parseFloat(root.getAttribute("data-font-scale")) || 1;
  var FS = 11;   // label size, set from the canvas width in fit()

  // ---------- Model ----------
  // U(x) = (x^2 - 1)^2 - EPS*x : wells near x = -1 (open conformation, dyes
  // far apart, low FRET) and x = +1 (closed, high FRET); barrier near x = 0.
  // The cartoon is adenylate kinase: a core domain and two lobes that close.
  // Overdamped Langevin, gamma = 1:  dx = -dU/dx dt + sqrt(2 kT dt) N(0,1)
  var EPS = 0.12;
  var DT = 0.004;
  var SUBSTEPS = 9;
  var XCLAMP = 1.7;              // narrowed below, once the panel edges are known
  var TP_HALF_WIDTH = 0.5;      // |x| below this counts as "on the transition path"
  var kT = 0.40;
  var x = 1.0;

  function U(v) { var q = v * v - 1; return q * q - EPS * v; }
  function dU(v) { return 4 * v * (v * v - 1) - EPS; }
  var barrierHeight = U(0) - U(1);

  var spare = null;
  function gauss() {
    if (spare !== null) { var s = spare; spare = null; return s; }
    var u, v, r;
    do { u = Math.random() * 2 - 1; v = Math.random() * 2 - 1; r = u * u + v * v; } while (r === 0 || r >= 1);
    var m = Math.sqrt(-2 * Math.log(r) / r);
    spare = v * m;
    return u * m;
  }

  function stepPhysics() {
    var s = Math.sqrt(2 * kT * DT);
    for (var i = 0; i < SUBSTEPS; i++) {
      x += -dU(x) * DT + s * gauss();
      if (x > XCLAMP) x = XCLAMP; else if (x < -XCLAMP) x = -XCLAMP;
    }
  }

  // FRET: inter-dye distance R/R0 varies linearly with x so that
  // E is about 0.85 in the folded well and about 0.25 in the unfolded well.
  function fretE(v) { var r = 0.975 - 0.226 * v; return 1 / (1 + Math.pow(r, 6)); }

  function poisson(lambda) {
    var L = Math.exp(-lambda), k = 0, p = 1;
    do { k++; p *= Math.random(); } while (p > L);
    return k - 1;
  }

  // ---------- Trace buffers (ring) ----------
  var N = 720;
  var bufE = new Float32Array(N), bufD = new Float32Array(N), bufA = new Float32Array(N);
  // bufTP: 0 = in a well, 1 = on the barrier (outcome not yet known),
  //        2 = confirmed transition path (left one well, arrived in the other)
  var bufTP = new Uint8Array(N);
  var head = 0, filled = 0;
  var I0 = 42, BG = 2, IMAX = 80;
  var crossings = 0, well = 1, excursion = 0, lastTP = 0;
  var trail = [], TRAIL = 40;

  function sample() {
    var E = fretE(x);
    var IA = poisson(I0 * E + BG);
    var ID = poisson(I0 * (1 - E) + BG);
    var onBarrier = Math.abs(x) < TP_HALF_WIDTH;
    bufE[head] = (IA + ID) > 0 ? IA / (IA + ID) : 0.5;
    bufD[head] = ID;
    bufA[head] = IA;
    bufTP[head] = onBarrier ? 1 : 0;
    head = (head + 1) % N;
    if (filled < N) filled++;

    // Resolve barrier excursions: a completed crossing becomes a transition
    // path (2); a return to the same well is a failed attempt and is cleared.
    if (onBarrier) {
      if (excursion < N) excursion++;
    } else {
      var nowWell = x > 0 ? 1 : -1;
      if (excursion > 0) {
        var code = nowWell !== well ? 2 : 0;
        for (var q = 1; q <= excursion; q++) {
          var qi = (head - 1 - q + N) % N;
          if (bufTP[qi] === 1) bufTP[qi] = code;
        }
        if (nowWell !== well) { crossings++; lastTP = excursion; }
        excursion = 0;
      }
      well = nowWell;
    }

    trail.push(x);
    if (trail.length > TRAIL) trail.shift();
    return E;
  }

  // ---------- Colours from CSS variables (theme-aware) ----------
  var C = {}, FONT = "sans-serif";
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
  // Particle colour follows FRET efficiency along a green -> amber -> red hue
  // sweep (donor-like at low E, acceptor-like at high E) without muddy mid-tones.
  function fretColor(E, a) { return "hsla(" + Math.round(130 * (1 - E)) + ",68%,46%," + a + ")"; }
  function refreshColors() {
    C.text = hexToRgb(cssVar("--text", "#e6edf3"));
    C.muted = hexToRgb(cssVar("--text-muted", "#8b949e"));
    C.border = hexToRgb(cssVar("--border", "#30363d"));
    C.accent = hexToRgb(cssVar("--accent", "#58a6ff"));
    C.donor = hexToRgb(cssVar("--donor-green", "#3fb950"));
    C.acceptor = hexToRgb(cssVar("--acceptor-red", "#f85149"));
    C.amber = hexToRgb("#d29922");
    FONT = cssVar("--font-body", "sans-serif");
  }

  // ---------- Sizing ----------
  var dpr = 1, WL = 0, HL = 0, WT = 0, HT = 0;
  function fit() {
    dpr = Math.min(window.devicePixelRatio || 1, cvL.clientWidth < 600 ? 1.5 : 2);   // fewer pixels on phones
    WL = cvL.clientWidth; HL = cvL.clientHeight;
    WT = cvT.clientWidth; HT = cvT.clientHeight;
    FS = Math.round(Math.max(11, Math.min(15, WL / 60)) * fscale);
    cvL.width = Math.round(WL * dpr); cvL.height = Math.round(HL * dpr);
    cvT.width = Math.round(WT * dpr); cvT.height = Math.round(HT * dpr);
    ctxL.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctxT.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // ---------- Landscape panel ----------
  // The horizontal limits are the two points where the potential reaches the top of
  // the panel, so both walls rise to the frame edge. Fixed limits clipped the steeper
  // left wall flat against the ceiling, which read as the energy levelling off (or
  // falling) on the open side: wrong, since U keeps rising there.
  var YL = -0.32, YH = 2.45;
  function panelEdge(outside, inside) {   // bisection on U(v) = YH
    for (var k = 0; k < 60; k++) {
      var m = (outside + inside) / 2;
      if ((U(outside) - YH) * (U(m) - YH) <= 0) inside = m; else outside = m;
    }
    return (outside + inside) / 2;
  }
  var XL = panelEdge(-2.2, -1.2), XR = panelEdge(2.2, 1.2);
  // keep the walker inside the drawn frame, whichever wall is nearer
  XCLAMP = Math.min(XCLAMP, XR - 0.02, -XL - 0.02);
  function drawLandscape(E) {
    var ctx = ctxL, w = WL, h = HL;
    var L = Math.round(FS * 3.6), R = 14, T = 22, B = Math.round(FS * 2.7);
    var pw = w - L - R, ph = h - T - B;
    if (pw <= 0 || ph <= 0) return;
    function sx(v) { return L + (v - XL) / (XR - XL) * pw; }
    function sy(u) { return T + (1 - (u - YL) / (YH - YL)) * ph; }
    ctx.clearRect(0, 0, w, h);

    // transition region
    ctx.fillStyle = rgba(C.amber, 0.09);
    ctx.fillRect(sx(-TP_HALF_WIDTH), T, sx(TP_HALF_WIDTH) - sx(-TP_HALF_WIDTH), ph);

    // landscape fill and stroke
    var STEPS = 160, i, v, yy;
    ctx.beginPath();
    ctx.moveTo(sx(XL), sy(YL));
    for (i = 0; i <= STEPS; i++) { v = XL + (XR - XL) * i / STEPS; ctx.lineTo(sx(v), sy(Math.min(U(v), YH))); }
    ctx.lineTo(sx(XR), sy(YL));
    ctx.closePath();
    ctx.fillStyle = rgba(C.accent, 0.08);
    ctx.fill();
    ctx.beginPath();
    for (i = 0; i <= STEPS; i++) {
      v = XL + (XR - XL) * i / STEPS; yy = sy(Math.min(U(v), YH));
      if (i === 0) ctx.moveTo(sx(v), yy); else ctx.lineTo(sx(v), yy);
    }
    ctx.strokeStyle = rgba(C.text, 0.85); ctx.lineWidth = 1.8; ctx.lineJoin = "round"; ctx.stroke();

    // axes
    ctx.strokeStyle = rgba(C.border, 1); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(L + 0.5, T); ctx.lineTo(L + 0.5, T + ph + 0.5); ctx.lineTo(L + pw, T + ph + 0.5); ctx.stroke();

    // labels
    ctx.fillStyle = rgba(C.muted, 1); ctx.font = FS + "px " + FONT; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    ctx.fillText("Open", sx(-1), T + ph + FS + 4);
    ctx.fillText("Closed", sx(1), T + ph + FS + 4);
    ctx.fillText("Reaction coordinate", L + pw / 2, h - 5);
    ctx.font = (FS + 2) + "px " + FONT; ctx.fillText("‡", sx(0), sy(U(0)) - 8);
    ctx.save(); ctx.translate(FS, T + ph / 2); ctx.rotate(-Math.PI / 2); ctx.font = FS + "px " + FONT; ctx.fillText("Free energy", 0, 0); ctx.restore();

    // thermal-energy scale bar beside the folded well
    var kx = sx(1.42), ky0 = sy(U(1)), ky1 = sy(U(1) + kT);
    ctx.strokeStyle = rgba(C.muted, 0.9); ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(kx, ky0); ctx.lineTo(kx, ky1);
    ctx.moveTo(kx - 3, ky0); ctx.lineTo(kx + 3, ky0);
    ctx.moveTo(kx - 3, ky1); ctx.lineTo(kx + 3, ky1);
    ctx.stroke();
    ctx.font = (FS - 1) + "px " + FONT; ctx.textAlign = "left"; ctx.fillStyle = rgba(C.muted, 1);
    ctx.fillText("kBT", kx + 6, (ky0 + ky1) / 2 + 3);

    // trail
    for (i = 0; i < trail.length; i++) {
      var tv = trail[i], ta = (i + 1) / trail.length;
      ctx.fillStyle = fretColor(fretE(tv), 0.28 * ta);
      ctx.beginPath(); ctx.arc(sx(tv), sy(U(tv)), 2.2, 0, Math.PI * 2); ctx.fill();
    }

    // reference conformations floating above each well
    drawMolecule(ctx, sx(-1), sy(U(-1)) - 98, 21, 1, 0.34, fretE(-1));
    drawMolecule(ctx, sx(1), sy(U(1)) - 98, 21, 0, 0.34, fretE(1));

    // the enzyme itself rides the landscape and changes shape with x
    var px = sx(x), py = sy(U(x));
    var g = ctx.createRadialGradient(px, py, 2, px, py, 26);
    g.addColorStop(0, fretColor(E, 0.35)); g.addColorStop(1, fretColor(E, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, 26, 0, Math.PI * 2); ctx.fill();
    var ms = 31;
    drawMolecule(ctx, px, py - 0.71 * ms - 2, ms, Math.max(0, Math.min(1, (1 - x) / 2)), 1, E);
  }

  // Stylised adenylate kinase: a core domain and two lobes (NMP-binding and LID)
  // that hinge inward as the enzyme closes. openness 1 = open, 0 = closed.
  // Donor dye on the left lobe, acceptor on the right; their separation tracks x.
  function drawMolecule(ctx, cx, cy, s, openness, alpha, E) {
    var phiL = (75 + 75 * openness) * Math.PI / 180;
    var phiR = (105 - 75 * openness) * Math.PI / 180;
    var hLx = cx - 0.32 * s, hLy = cy + 0.05 * s;
    var hRx = cx + 0.32 * s, hRy = cy + 0.05 * s;
    var R = 0.5 * s, Rt = 0.78 * s;
    var lLx = hLx + R * Math.cos(phiL), lLy = hLy - R * Math.sin(phiL);
    var lRx = hRx + R * Math.cos(phiR), lRy = hRy - R * Math.sin(phiR);
    var dLx = hLx + Rt * Math.cos(phiL), dLy = hLy - Rt * Math.sin(phiL);
    var dRx = hRx + Rt * Math.cos(phiR), dRy = hRy - Rt * Math.sin(phiR);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 1.1;
    // hinges
    ctx.strokeStyle = rgba(C.text, 0.55);
    ctx.beginPath();
    ctx.moveTo(hLx, hLy); ctx.lineTo(lLx, lLy);
    ctx.moveTo(hRx, hRy); ctx.lineTo(lRx, lRy);
    ctx.stroke();
    // core domain and lobes
    ctx.fillStyle = rgba(C.text, 0.16);
    ctx.strokeStyle = rgba(C.text, 0.75);
    ctx.beginPath(); ctx.ellipse(cx, cy + 0.35 * s, 0.58 * s, 0.36 * s, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(lLx, lLy, 0.3 * s, 0.2 * s, -phiL, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(lRx, lRy, 0.3 * s, 0.2 * s, -phiR, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // FRET coupling between the dyes
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = rgba(C.amber, 0.25 + 0.65 * E);
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(dLx, dLy); ctx.lineTo(dRx, dRy); ctx.stroke();
    ctx.setLineDash([]);
    // dyes
    ctx.fillStyle = rgba(C.donor, 0.35 + 0.65 * (1 - E));
    ctx.beginPath(); ctx.arc(dLx, dLy, 0.16 * s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = rgba(C.acceptor, 0.35 + 0.65 * E);
    ctx.beginPath(); ctx.arc(dRx, dRy, 0.16 * s, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // ---------- Trace panel ----------
  function drawTrace() {
    var ctx = ctxT, w = WT, h = HT;
    var L = Math.round(FS * 3.6), R = 14, T = 12, B = FS * 2, GAP = 10;
    var pw = w - L - R, inner = h - T - B - GAP;
    if (pw <= 0 || inner <= 0) return;
    var hI = Math.round(inner * 0.42), hE = inner - hI;
    var yI = T, yE = T + hI + GAP;
    ctx.clearRect(0, 0, w, h);
    var n = filled, dx = pw / (N - 1);
    var x0 = L + (N - n) * dx;
    var k, idx;

    // amber bands: confirmed transition paths strong, unresolved barrier time faint
    function bands(code, alpha) {
      ctx.fillStyle = rgba(C.amber, alpha);
      var runStart = -1;
      for (var m = 0; m <= n; m++) {
        var on = m < n && bufTP[(head - n + m + N) % N] === code;
        if (on && runStart < 0) runStart = m;
        if (!on && runStart >= 0) { ctx.fillRect(x0 + runStart * dx, T, (m - runStart) * dx, h - T - B); runStart = -1; }
      }
    }
    bands(2, 0.18);
    bands(1, 0.06);

    // panel frames
    ctx.strokeStyle = rgba(C.border, 1); ctx.lineWidth = 1;
    ctx.strokeRect(L + 0.5, yI + 0.5, pw, hI);
    ctx.strokeRect(L + 0.5, yE + 0.5, pw, hE);

    function polyline(buf, y0, hh, vmax, rgb, lw) {
      ctx.beginPath();
      for (var j = 0; j < n; j++) {
        idx = (head - n + j + N) % N;
        var vx = x0 + j * dx, vy = y0 + hh - Math.min(buf[idx], vmax) / vmax * hh;
        if (j === 0) ctx.moveTo(vx, vy); else ctx.lineTo(vx, vy);
      }
      ctx.strokeStyle = rgba(rgb, 0.95); ctx.lineWidth = lw; ctx.lineJoin = "round"; ctx.stroke();
    }
    polyline(bufD, yI, hI, IMAX, C.donor, 1.1);
    polyline(bufA, yI, hI, IMAX, C.acceptor, 1.1);

    ctx.strokeStyle = rgba(C.border, 0.9); ctx.setLineDash([3, 4]);
    ctx.beginPath(); ctx.moveTo(L, yE + hE / 2 + 0.5); ctx.lineTo(L + pw, yE + hE / 2 + 0.5); ctx.stroke();
    ctx.setLineDash([]);
    polyline(bufE, yE, hE, 1, C.accent, 1.4);

    // labels
    ctx.fillStyle = rgba(C.muted, 1); ctx.font = (FS - 1) + "px " + FONT; ctx.textAlign = "right"; ctx.textBaseline = "middle";
    ctx.fillText("1", L - 5, yE + 1);
    ctx.fillText("0.5", L - 5, yE + hE / 2);
    ctx.fillText("0", L - 5, yE + hE);
    ctx.save(); ctx.translate(FS, yE + hE / 2); ctx.rotate(-Math.PI / 2); ctx.textAlign = "center"; ctx.fillText("FRET efficiency", 0, 0); ctx.restore();
    ctx.save(); ctx.translate(FS, yI + hI / 2); ctx.rotate(-Math.PI / 2); ctx.textAlign = "center"; ctx.fillText("Photons", 0, 0); ctx.restore();
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    ctx.fillStyle = rgba(C.donor, 1); ctx.fillText("Donor", L + 6, yI + FS);
    var dw = ctx.measureText("Donor").width;
    ctx.fillStyle = rgba(C.acceptor, 1); ctx.fillText("Acceptor", L + 6 + dw + 8, yI + FS);
    ctx.fillStyle = rgba(C.muted, 1); ctx.textAlign = "center"; ctx.fillText("Time →", L + pw / 2, h - 6);
  }

  // ---------- Readouts ----------
  function updateReadouts(E) {
    if (outE) outE.textContent = E.toFixed(2);
    if (outState) {
      var onBarrier = Math.abs(x) < TP_HALF_WIDTH;
      outState.textContent = onBarrier ? "On the barrier" : (x > 0 ? "Closed" : "Open");
      outState.style.color = onBarrier ? rgba(C.amber, 1) : fretColor(E, 1);
    }
    if (outN) outN.textContent = String(crossings);
    if (outTP) outTP.textContent = lastTP > 0 ? lastTP + " bins" : "–";
  }
  function updateSliderLabel() {
    if (sliderVal) sliderVal.textContent = "ΔG‡ ≈ " + (barrierHeight / kT).toFixed(1) + " kBT";
  }

  // ---------- Loop ----------
  var playing = false, rafId = null, lastE = fretE(x), visible = true, lastFrame = 0, FRAME_MS = 30;
  function render() { drawLandscape(lastE); drawTrace(); updateReadouts(lastE); }
  function tick(now) {
    rafId = null;
    if (!playing || !visible) return;
    rafId = requestAnimationFrame(tick);
    now = now || performance.now();
    if (now - lastFrame < FRAME_MS) return;   // about 30 fps, two physics steps per drawn frame
    lastFrame = now;
    stepPhysics(); lastE = sample();
    stepPhysics(); lastE = sample();
    render();
  }
  function setPlaying(p) {
    playing = p;
    if (btnPlay) { btnPlay.textContent = p ? "Pause" : "Play"; btnPlay.classList.toggle("hero-btn-primary", !p); }
    if (hint) hint.hidden = p;
    if (p && visible && rafId === null) rafId = requestAnimationFrame(tick);
  }
  function prefill(count) { for (var i = 0; i < count; i++) { stepPhysics(); lastE = sample(); } }
  // Hook for tools/gif/capture.html: n ticks of physics (two steps each, as on
  // screen) and one render, synchronously, without the animation clock.
  cvL._captureFrame = function (n) {
    n = n || 1;
    for (var k = 0; k < n; k++) { stepPhysics(); lastE = sample(); stepPhysics(); lastE = sample(); }
    render();
  };

  // ---------- Wire up ----------
  refreshColors();
  fit();
  if (slider) {
    slider.value = String(kT);
    slider.addEventListener("input", function () {
      var v = parseFloat(slider.value);
      if (!isNaN(v) && v > 0) kT = v;
      updateSliderLabel();
      if (!playing) render();
    });
  }
  updateSliderLabel();
  if (btnPlay) btnPlay.addEventListener("click", function () { setPlaying(!playing); });

  var reduceMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  var animOn = false;
  try { animOn = localStorage.getItem("anim") === "on"; } catch (e) {}
  var autoplay = animOn && !reduceMotion;   // figures start paused unless the reader opted in
  prefill(N);   // a full trace is visible even while paused
  render();
  setPlaying(autoplay);

  if (window.IntersectionObserver) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (visible && playing && rafId === null) rafId = requestAnimationFrame(tick);
    }, { threshold: 0.05 }).observe(root);
  }
  document.addEventListener("anim-toggle", function (e) { setPlaying(!!(e.detail && e.detail.on)); });
  if (window.ResizeObserver) {
    new ResizeObserver(function () { fit(); render(); }).observe(root);
  } else {
    window.addEventListener("resize", function () { fit(); render(); });
  }
  if (window.MutationObserver) {
    new MutationObserver(function () { refreshColors(); render(); })
      .observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  }
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden && playing && rafId === null) rafId = requestAnimationFrame(tick);
  });
})();
