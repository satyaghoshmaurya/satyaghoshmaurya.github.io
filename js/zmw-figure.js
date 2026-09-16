// =============================================================
// Satyaghosh Maurya — Zero-Mode Waveguide Figure
// Cross-section of a nanoaperture in an aluminium film on glass.
// Dye-labelled enzymes diffuse freely. Many are in solution, but only
// the one that wanders into the evanescent volume at the aperture
// floor is excited, so it alone is seen. Nothing is tethered; the
// floor is PEG-passivated so nothing sticks.
// Schematic, not to scale. No dependencies. Honours reduced motion.
// Mount: <canvas data-figure="zmw"> ; add data-compact for card size.
// Controls and readouts are looked up inside the enclosing <figure>.
// =============================================================

(function () {
  "use strict";

  var nodes = document.querySelectorAll('canvas[data-figure="zmw"]');
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
    C.muted = hexToRgb(cssVar("--text-muted", "#656d76"));
    C.border = hexToRgb(cssVar("--border", "#d0d7de"));
    C.accent = hexToRgb(cssVar("--accent", "#0969da"));
    C.donor = hexToRgb(cssVar("--donor-green", "#1a7f37"));
    C.acceptor = hexToRgb(cssVar("--acceptor-red", "#cf222e"));
    C.amber = [210, 153, 34];
    C.laser = [30, 180, 90];   // 532 nm excitation, and everything it lights
    C.font = cssVar("--font-body", "sans-serif");
  }

  var spare = null;
  function gauss() {
    if (spare !== null) { var s = spare; spare = null; return s; }
    var u, v, r;
    do { u = Math.random() * 2 - 1; v = Math.random() * 2 - 1; r = u * u + v * v; } while (r === 0 || r >= 1);
    var m = Math.sqrt(-2 * Math.log(r) / r);
    spare = v * m;
    return u * m;
  }
  function poisson(lambda) {
    if (lambda > 30) return Math.max(0, Math.round(lambda + Math.sqrt(lambda) * gauss()));
    var L = Math.exp(-lambda), k = 0, q = 1;
    do { k++; q *= Math.random(); } while (q > L);
    return k - 1;
  }

  var reduceMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  var animOn = false;
  try { animOn = localStorage.getItem("anim") === "on"; } catch (e) {}
  var autoplay = animOn && !reduceMotion;   // figures start paused unless the reader opted in

  // Stylised adenylate kinase (same cartoon as the home-page hero).
  function drawEnzymeCartoon(ctx, cx, cy, s, openness, alpha, E, lite) {
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
    if (!lite) {
      ctx.strokeStyle = rgba(C.text, 0.55);
      ctx.beginPath();
      ctx.moveTo(hLx, hLy); ctx.lineTo(lLx, lLy);
      ctx.moveTo(hRx, hRy); ctx.lineTo(lRx, lRy);
      ctx.stroke();
    }
    ctx.fillStyle = rgba(C.text, 0.16);
    ctx.strokeStyle = rgba(C.text, 0.75);
    ctx.beginPath(); ctx.ellipse(cx, cy + 0.35 * s, 0.58 * s, 0.36 * s, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(lLx, lLy, 0.3 * s, 0.2 * s, -phiL, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(lRx, lRy, 0.3 * s, 0.2 * s, -phiR, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (!lite) {
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = rgba(C.amber, 0.25 + 0.65 * E);
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(dLx, dLy); ctx.lineTo(dRx, dRy); ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.fillStyle = rgba(C.donor, 0.35 + 0.65 * (1 - E));
    ctx.beginPath(); ctx.arc(dLx, dLy, 0.16 * s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = rgba(C.acceptor, 0.35 + 0.65 * E);
    ctx.beginPath(); ctx.arc(dRx, dRy, 0.16 * s, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // Decay length of the excitation intensity inside a circular aperture below
  // cutoff (TE11, cutoff wavelength 1.706 d). The field decays as exp(-z/Lf);
  // the intensity, which is what excites the dye, as exp(-2z/Lf). LAMBDA in nm.
  var LAMBDA = 532;
  function decayLength(dnm) {
    var q = Math.pow(LAMBDA / (1.706 * dnm), 2) - 1;
    if (q <= 0) return 250;
    return 0.5 / ((2 * Math.PI / LAMBDA) * Math.sqrt(q));
  }

  function fmtConc(c) {   // c in nM
    if (c >= 1000) return (c / 1000).toFixed(c >= 10000 ? 0 : 1).replace(/\.0$/, "") + " µM";
    if (c >= 10) return Math.round(c) + " nM";
    return c.toFixed(1).replace(/\.0$/, "") + " nM";
  }
  function fmtVol(zL) {
    if (zL >= 1000) return (zL / 1000).toFixed(2) + " aL";
    return Math.round(zL) + " zL";
  }
  function fmtN(n) {
    if (n < 0.1) return n.toPrecision(2);
    if (n < 10) return n.toFixed(1);
    return Math.round(n).toLocaleString("en-US");
  }

  function Figure(canvas) {
    var ctx = canvas.getContext("2d");
    var compact = canvas.hasAttribute("data-compact");
    var fig = canvas.closest ? canvas.closest("figure") : null;
    function q(sel) { return fig ? fig.querySelector(sel) : null; }
    var slA = q("[data-zmw-aperture]"), slC = q("[data-zmw-conc]"), btn = q("[data-zmw-play]");
    var outA = q("[data-zmw-aperture-val]"), outC = q("[data-zmw-conc-val]");
    var outL = q("[data-zmw-out-l]"), outV = q("[data-zmw-out-v]");
    var outN = q("[data-zmw-out-n]"), outNc = q("[data-zmw-out-nc]");

    var d = 100;            // aperture diameter, nm
    var logc = Math.log10(5);   // log10 of enzyme concentration in nM (default 5 nM)
    var playing = false, rafId = null, visible = true;
    var scale = compact ? 0.62 : 1;
    var W = 0, H = 0, dpr = 1;
    var G = {};
    var mols = [];
    var speed = parseFloat(canvas.getAttribute("data-zmw-speed")) || 1;
    var fscale = parseFloat(canvas.getAttribute("data-font-scale")) || 1;
    // Optional photon trace: donor and acceptor counts per bin from whatever
    // sits in the evanescent volume, so a visit shows as a burst.
    var traceCv = q("[data-zmw-trace]"), tctx = traceCv ? traceCv.getContext("2d") : null;
    var TW = 0, TH = 0;
    var NB = 240, bufD = new Float32Array(NB), bufA = new Float32Array(NB), bhead = 0;
    var PH_MAX = 140, BG = 1.2;  // photons per bin at the floor, so a typical visit fills most of the panel; background per channel

    function conc() { return Math.pow(10, logc); }

    function geom() {
      G.glassH = compact ? 22 : 34;
      G.filmT = Math.round(100 * scale);           // 100 nm aluminium film, same scale as the aperture
      G.glassTop = H - G.glassH;
      G.filmTop = G.glassTop - G.filmT;
      G.cx = W * 0.5;
      G.half = Math.min(d * scale, W * 0.42) / 2;
      G.L = decayLength(d) * scale;                // evanescent intensity decay length, px
      G.r = compact ? 1.8 : 2.4;                   // molecule radius when drawn as a dot
      G.top = 6;
      G.fs = Math.round(Math.max(11, Math.min(15, W / 65)) * fscale);
    }

    function fit() {
      dpr = Math.min(window.devicePixelRatio || 1, canvas.clientWidth < 600 ? 1.5 : 2);   // fewer pixels on phones
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (traceCv) {
        TW = traceCv.clientWidth; TH = traceCv.clientHeight;
        traceCv.width = Math.round(TW * dpr); traceCv.height = Math.round(TH * dpr);
        tctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      geom();
    }

    // Scaled so that at the default 5 nM about one molecule occupies the
    // evanescent volume at any moment.
    function targetCount() {
      var n = Math.round(70 * Math.pow(conc() / 5, 0.6));
      n = Math.max(4, Math.min(180, n));
      return compact ? Math.max(4, Math.round(n * 0.5)) : n;
    }

    function ok(x, y) {
      if (x < G.r || x > W - G.r || y < G.top) return false;
      if (y < G.filmTop) return true;
      if (Math.abs(x - G.cx) > G.half - G.r) return false;
      if (y > G.glassTop - G.r - 2) return false;
      return true;
    }

    function spawn() {
      var m = { x: W / 2, y: G.top + 10, open: Math.random() < 0.5 ? 1 : 0, op: 0 };
      m.op = m.open;
      for (var i = 0; i < 60; i++) {
        var x = G.r + Math.random() * (W - 2 * G.r);
        var y = G.top + Math.random() * (G.glassTop - G.top);
        if (ok(x, y)) { m.x = x; m.y = y; break; }
      }
      return m;
    }

    function syncCount() {
      var keep = [];
      for (var i = 0; i < mols.length; i++) if (ok(mols[i].x, mols[i].y)) keep.push(mols[i]);
      mols = keep;
      var n = targetCount();
      while (mols.length < n) mols.push(spawn());
      if (mols.length > n) mols.length = n;
    }

    function step() {
      var s = (compact ? 2.5 : 3.6) * speed;
      for (var i = 0; i < mols.length; i++) {
        var m = mols[i];
        var nx = m.x + s * gauss(), ny = m.y + s * gauss();
        if (!ok(nx, m.y)) nx = m.x - (nx - m.x);
        if (!ok(nx, m.y)) nx = m.x;
        if (!ok(nx, ny)) ny = m.y - (ny - m.y);
        if (!ok(nx, ny)) ny = m.y;
        m.x = nx; m.y = ny;
        if (Math.random() < 0.012) m.open = m.open ? 0 : 1;
        m.op += (m.open - m.op) * 0.1;
      }
      if (traceCv) {
        var pd = 0, pa = 0;
        for (var j = 0; j < mols.length; j++) {
          var b = field(mols[j].x, mols[j].y);
          // observed brightness falls off faster than the excitation alone: the
          // light collected back out through the aperture decays with height too
          if (b > 0.05) {
            var E = 0.85 - 0.6 * mols[j].op, rate = PH_MAX * Math.min(1, b * b);
            pd += rate * (1 - E); pa += rate * E;
          }
        }
        bufD[bhead] = poisson(pd + BG); bufA[bhead] = poisson(pa + BG);
        bhead = (bhead + 1) % NB;
      }
    }

    // Excitation intensity: evanescent decay from the floor inside the aperture.
    function field(x, y) {
      if (y < G.filmTop || Math.abs(x - G.cx) > G.half) return 0;
      return Math.exp(-(G.glassTop - y) / G.L);
    }

    function drawArrows() {
      var n = 3, span = 2 * G.half + 40 * scale, x0 = G.cx - span / 2;
      ctx.strokeStyle = rgba(C.laser, 0.9); ctx.fillStyle = rgba(C.laser, 0.9); ctx.lineWidth = compact ? 1.6 : 2.6;
      for (var i = 0; i < n; i++) {
        var x = x0 + span * (i + 0.5) / n, y1 = H - 4, y2 = G.glassTop + 5, ah = compact ? 5 : 8;
        ctx.beginPath(); ctx.moveTo(x, y1); ctx.lineTo(x, y2 + ah); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x - ah * 0.8, y2 + ah); ctx.lineTo(x + ah * 0.8, y2 + ah); ctx.lineTo(x, y2); ctx.closePath(); ctx.fill();
      }
    }

    // A short PEG curl growing from (x, y) along the surface normal (nx, ny).
    function curl(x, y, nx, ny, h) {
      var tx = -ny, ty = nx;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + tx * 2 + nx * h * 0.5, y + ty * 2 + ny * h * 0.5, x - tx * 1.5 + nx * h, y - ty * 1.5 + ny * h);
      ctx.stroke();
    }

    // PEG passivation on every surface: film top, aperture walls and floor.
    function drawPassivation() {
      var h = compact ? 3 : 5, sp = compact ? 5 : 7;
      var cx = G.cx, half = G.half, ft = G.filmTop, gt = G.glassTop, x, y;
      ctx.strokeStyle = rgba(C.muted, 0.5); ctx.lineWidth = 1;
      for (x = 4; x <= cx - half - 3; x += sp) curl(x, ft, 0, -1, h);
      for (x = cx + half + 3; x <= W - 4; x += sp) curl(x, ft, 0, -1, h);
      for (y = ft + 5; y <= gt - 5; y += sp) { curl(cx - half, y, 1, 0, h); curl(cx + half, y, -1, 0, h); }
      for (x = cx - half + 4; x <= cx + half - 4; x += sp) curl(x, gt, 0, -1, h);
    }

    // The same enzyme everywhere: small and faded in the dark bulk, larger and
    // fully drawn with lit dyes only where the evanescent field excites it.
    function drawMol(m) {
      var b = field(m.x, m.y);
      var E = 0.85 - 0.6 * m.op;
      var vis = Math.max(0, Math.min(1, (b - 0.03) / 0.2));
      var bb = Math.min(1.3, b);
      var s0 = compact ? 3.5 : 5.5;
      var s = s0 + (compact ? 6 : 9) * Math.min(1, bb);
      if (vis > 0) {
        var R = s * 1.7;
        var g = ctx.createRadialGradient(m.x, m.y, 1, m.x, m.y, R);
        g.addColorStop(0, rgba(C.donor, 0.4 * bb * vis)); g.addColorStop(1, rgba(C.donor, 0));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(m.x, m.y, R, 0, Math.PI * 2); ctx.fill();
      }
      drawEnzymeCartoon(ctx, m.x, m.y, s, m.op, 0.3 + 0.7 * vis, E, vis === 0);
    }

    function drawLabels() {
      var ft = G.filmTop, gt = G.glassTop, cx = G.cx, half = G.half;
      ctx.font = G.fs + "px " + C.font; ctx.textBaseline = "alphabetic";
      ctx.textAlign = "left";
      ctx.strokeStyle = rgba(C.bg, 0.8); ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(14, ft + 3); ctx.lineTo(14, gt - 1);
      ctx.moveTo(11, ft + 3); ctx.lineTo(17, ft + 3);
      ctx.moveTo(11, gt - 1); ctx.lineTo(17, gt - 1);
      ctx.stroke();
      ctx.fillStyle = rgba(C.bg, 0.95); ctx.fillText("Aluminium film, 100 nm", 22, ft + G.filmT / 2 + 4);
      ctx.fillStyle = rgba(C.muted, 1); ctx.fillText("Glass / quartz", 10, H - 12);
      ctx.fillStyle = rgba(C.laser, 1); ctx.textAlign = "right"; ctx.fillText("532 nm excitation", W - 10, H - 12);
      ctx.textAlign = "right"; ctx.fillStyle = rgba(C.muted, 1);
      ctx.fillText("Dye-labelled enzyme, freely diffusing · " + fmtConc(conc()), W - 10, G.fs + 5);
      // aperture dimension line
      var yd = ft - 12;
      ctx.strokeStyle = rgba(C.muted, 0.9); ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - half, yd); ctx.lineTo(cx + half, yd);
      ctx.moveTo(cx - half, yd - 4); ctx.lineTo(cx - half, yd + 4);
      ctx.moveTo(cx + half, yd - 4); ctx.lineTo(cx + half, yd + 4);
      ctx.stroke();
      ctx.textAlign = "center"; ctx.fillStyle = rgba(C.muted, 1);
      ctx.fillText("d = " + d + " nm", cx, yd - 6);
      // decay-length bracket on the film, right of the aperture
      var xb = cx + half + 9, L = G.L;
      ctx.strokeStyle = rgba(C.bg, 0.9);
      ctx.beginPath();
      ctx.moveTo(xb, gt); ctx.lineTo(xb, gt - L);
      ctx.moveTo(xb - 3, gt); ctx.lineTo(xb + 3, gt);
      ctx.moveTo(xb - 3, gt - L); ctx.lineTo(xb + 3, gt - L);
      ctx.stroke();
      ctx.textAlign = "left"; ctx.fillStyle = rgba(C.bg, 0.95);
      ctx.fillText("L ≈ " + Math.round(decayLength(d)) + " nm", xb + 6, gt - Math.max(L / 2, 6) + 4);
      ctx.fillText("observation volume", xb, ft + G.fs + 7);
      ctx.strokeStyle = rgba(C.bg, 0.7);
      ctx.beginPath(); ctx.moveTo(cx + half + 2, ft + 14); ctx.lineTo(xb - 3, ft + 14); ctx.stroke();
      // passivation note on the film, left of the aperture
      ctx.textAlign = "right"; ctx.fillStyle = rgba(C.bg, 0.95);
      ctx.fillText("PEG-2k (~5 nm) on every surface", cx - half - 9, gt - 6);
    }

    // Donor counts upward, acceptor downward from a shared baseline: the
    // classic burst display. Empty while the volume is empty; a burst each
    // time an enzyme wanders through, coloured by its conformation.
    function drawTrace() {
      if (!traceCv) return;
      var c2 = tctx, w = TW, h = TH, fs = Math.max(10, Math.round(G.fs * 0.9));
      var L = Math.round(fs * 3.4), R = 12, T = 8, B = Math.round(fs * 1.9);
      var pw = w - L - R, ph = h - T - B;
      if (pw <= 0 || ph <= 0) return;
      var y0 = T + ph / 2, hh = ph / 2 - 2, YMAX = 100, dx = pw / (NB - 1);
      c2.clearRect(0, 0, w, h);
      c2.strokeStyle = rgba(C.border, 1); c2.lineWidth = 1; c2.strokeRect(L + 0.5, T + 0.5, pw, ph);
      c2.strokeStyle = rgba(C.muted, 0.6); c2.beginPath(); c2.moveTo(L, y0 + 0.5); c2.lineTo(L + pw, y0 + 0.5); c2.stroke();
      function trace(buf, sign, rgb) {
        var j, v, vx, vy;
        c2.beginPath(); c2.moveTo(L, y0);
        for (j = 0; j < NB; j++) {
          v = buf[(bhead + j) % NB];
          vx = L + j * dx; vy = y0 - sign * Math.min(v, YMAX) / YMAX * hh;
          c2.lineTo(vx, vy);
        }
        c2.lineTo(L + pw, y0); c2.closePath();
        c2.fillStyle = rgba(rgb, 0.28); c2.fill();
        c2.beginPath();
        for (j = 0; j < NB; j++) {
          v = buf[(bhead + j) % NB];
          vx = L + j * dx; vy = y0 - sign * Math.min(v, YMAX) / YMAX * hh;
          if (j === 0) c2.moveTo(vx, vy); else c2.lineTo(vx, vy);
        }
        c2.strokeStyle = rgba(rgb, 0.95); c2.lineWidth = 1.2; c2.lineJoin = "round"; c2.stroke();
      }
      trace(bufD, 1, C.donor);
      trace(bufA, -1, C.acceptor);
      c2.font = fs + "px " + C.font; c2.textBaseline = "middle"; c2.textAlign = "right"; c2.fillStyle = rgba(C.muted, 1);
      c2.fillText(String(YMAX), L - 5, T + 4); c2.fillText("0", L - 5, y0); c2.fillText(String(YMAX), L - 5, T + ph - 4);
      c2.save(); c2.translate(fs * 0.9, T + ph / 2); c2.rotate(-Math.PI / 2); c2.textAlign = "center"; c2.fillText("Photons / bin", 0, 0); c2.restore();
      c2.textAlign = "left"; c2.textBaseline = "alphabetic";
      c2.fillStyle = rgba(C.donor, 1); c2.fillText("Donor", L + 7, T + fs + 2);
      c2.fillStyle = rgba(C.acceptor, 1); c2.fillText("Acceptor", L + 7, T + ph - 6);
      c2.fillStyle = rgba(C.muted, 1); c2.textAlign = "center"; c2.fillText("Time \u2192", L + pw / 2, h - 5);
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      var gt = G.glassTop, ft = G.filmTop, cx = G.cx, half = G.half, fT = G.filmT;
      ctx.fillStyle = rgba(C.accent, 0.10); ctx.fillRect(0, gt, W, H - gt);
      var gl = ctx.createLinearGradient(0, H, 0, gt);
      gl.addColorStop(0, rgba(C.laser, 0)); gl.addColorStop(1, rgba(C.laser, 0.45));
      ctx.fillStyle = gl; ctx.fillRect(cx - half - 40 * scale, gt, 2 * half + 80 * scale, H - gt);
      drawArrows();
      var eg = ctx.createLinearGradient(0, gt, 0, ft);
      for (var k = 0; k <= 10; k++) {
        var f = k / 10;
        eg.addColorStop(f, rgba(C.laser, 0.85 * Math.exp(-(f * fT) / G.L)));
      }
      ctx.fillStyle = eg; ctx.fillRect(cx - half, ft, 2 * half, fT);
      var mg = ctx.createLinearGradient(0, ft, 0, gt);
      mg.addColorStop(0, rgba(C.text, 0.62)); mg.addColorStop(1, rgba(C.text, 0.44));
      ctx.fillStyle = mg;
      ctx.fillRect(0, ft, cx - half, fT); ctx.fillRect(cx + half, ft, W - cx - half, fT);
      ctx.fillStyle = rgba(C.text, 0.8);
      ctx.fillRect(0, ft, cx - half, 2); ctx.fillRect(cx + half, ft, W - cx - half, 2);
      drawPassivation();
      for (var i = 0; i < mols.length; i++) drawMol(mols[i]);
      if (!compact) drawLabels();
      drawTrace();
    }

    function updateReadouts() {
      var c = conc();
      var Lnm = decayLength(d);
      var Vnm3 = Math.PI * (d / 2) * (d / 2) * Lnm;
      var N = c * 1e-3 * Vnm3 * 6.022e-7;   // c in nM, V in nm^3
      var Nc = c * 0.602;                   // 1 fL confocal volume
      if (outA) outA.textContent = d + " nm";
      if (outC) outC.textContent = fmtConc(c);
      if (outL) outL.textContent = "≈ " + Math.round(Lnm) + " nm";
      if (outV) outV.textContent = "≈ " + fmtVol(Vnm3 / 1000);
      if (outN) outN.textContent = "≈ " + fmtN(N);
      if (outNc) outNc.textContent = "≈ " + fmtN(Nc);
    }

    var lastFrame = 0, FRAME_MS = 30;   // draw at about 30 fps, two simulation steps per drawn frame
    function tick(now) {
      rafId = null;
      if (!playing || !visible) return;
      rafId = requestAnimationFrame(tick);
      now = now || performance.now();
      if (now - lastFrame < FRAME_MS) return;
      lastFrame = now;
      step(); step();
      draw();
    }
    function setPlaying(p) {
      playing = p;
      if (btn) { btn.textContent = p ? "Pause" : "Play"; btn.classList.toggle("hero-btn-primary", !p); }
      if (p && visible && rafId === null) rafId = requestAnimationFrame(tick);
    }

    refreshColors();
    fit();
    syncCount();
    for (var i = 0; i < NB; i++) step();   // fills the photon trace before anything is shown
    draw();
    updateReadouts();
    // Hook for tools/gif/capture.html: advance n simulation steps and redraw,
    // synchronously, so frames can be captured without the animation clock.
    canvas._captureFrame = function (n) { n = n || 2; for (var k = 0; k < n; k++) step(); draw(); };

    if (slA) slA.addEventListener("input", function () {
      var v = parseFloat(slA.value); if (!isNaN(v)) d = v;
      geom(); syncCount(); updateReadouts(); if (!playing) draw();
    });
    if (slC) slC.addEventListener("input", function () {
      var v = parseFloat(slC.value); if (!isNaN(v)) logc = v;
      syncCount(); updateReadouts(); if (!playing) draw();
    });
    if (btn) btn.addEventListener("click", function () { setPlaying(!playing); });

    setPlaying(autoplay);
    document.addEventListener("anim-toggle", function (e) { setPlaying(!!(e.detail && e.detail.on)); });

    if (window.IntersectionObserver) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        if (visible && playing && rafId === null) rafId = requestAnimationFrame(tick);
      }, { threshold: 0.05 }).observe(canvas);
    }
    if (window.ResizeObserver) {
      var ro = new ResizeObserver(function () { fit(); syncCount(); draw(); });
      ro.observe(canvas); if (traceCv) ro.observe(traceCv);
    } else {
      window.addEventListener("resize", function () { fit(); syncCount(); draw(); });
    }
    if (window.MutationObserver) {
      new MutationObserver(function () { refreshColors(); draw(); })
        .observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    }
  }

  for (var i = 0; i < nodes.length; i++) new Figure(nodes[i]);
})();
