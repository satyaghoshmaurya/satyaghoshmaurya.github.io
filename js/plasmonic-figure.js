// =============================================================
// Satyaghosh Maurya — Plasmonic Nanorod Figure
// Two confocal volumes side by side. Left: free dye-labelled enzymes
// diffuse through the focus and give modest photon bursts. Right: the
// same enzyme rides a PEGylated gold nanorod (biotin–streptavidin
// bridge), and the rod's plasmon resonance makes each passage far
// brighter. Both traces share one photon scale.
// Schematic, not to scale. No dependencies. Honours reduced motion.
// Mount: <canvas data-figure="plasmonic"> inside a <figure> that holds
// the controls ([data-pl-enh], [data-pl-play]) and readouts.
// =============================================================

(function () {
  "use strict";

  var nodes = document.querySelectorAll('canvas[data-figure="plasmonic"]');
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
    C.donor = hexToRgb(cssVar("--donor-green", "#1a7f37"));
    C.acceptor = hexToRgb(cssVar("--acceptor-red", "#cf222e"));
    C.amber = [210, 153, 34];
    C.gold = [217, 164, 46];
    C.goldLight = [240, 200, 90];
    C.goldDark = [150, 108, 20];
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
  function noisy(lambda) {
    if (lambda < 30) {
      var L = Math.exp(-lambda), k = 0, p = 1;
      do { k++; p *= Math.random(); } while (p > L);
      return k - 1;
    }
    return Math.max(0, Math.round(lambda + Math.sqrt(lambda) * gauss()));
  }

  var reduceMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  var animOn = false;
  try { animOn = localStorage.getItem("anim") === "on"; } catch (e) {}
  var autoplay = animOn && !reduceMotion;   // figures start paused unless the reader opted in

  function drawEnzymeCartoon(ctx, cx, cy, s, openness, alpha, E) {
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
    ctx.lineWidth = 1;
    ctx.strokeStyle = rgba(C.text, 0.55);
    ctx.beginPath();
    ctx.moveTo(hLx, hLy); ctx.lineTo(lLx, lLy);
    ctx.moveTo(hRx, hRy); ctx.lineTo(lRx, lRy);
    ctx.stroke();
    ctx.fillStyle = rgba(C.text, 0.16);
    ctx.strokeStyle = rgba(C.text, 0.75);
    ctx.beginPath(); ctx.ellipse(cx, cy + 0.35 * s, 0.58 * s, 0.36 * s, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(lLx, lLy, 0.3 * s, 0.2 * s, -phiL, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(lRx, lRy, 0.3 * s, 0.2 * s, -phiR, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = rgba(C.donor, 0.35 + 0.65 * (1 - E));
    ctx.beginPath(); ctx.arc(dLx, dLy, 0.17 * s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = rgba(C.acceptor, 0.35 + 0.65 * E);
    ctx.beginPath(); ctx.arc(dRx, dRy, 0.17 * s, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function drawRodBody(ctx, x, y, w, h) {
    var gr = ctx.createLinearGradient(0, y, 0, y + h);
    gr.addColorStop(0, rgba(C.goldLight, 1)); gr.addColorStop(0.5, rgba(C.gold, 1)); gr.addColorStop(1, rgba(C.goldDark, 1));
    roundRect(ctx, x, y, w, h, h / 2);
    ctx.fillStyle = gr; ctx.fill();
    ctx.strokeStyle = rgba(C.goldDark, 0.9); ctx.lineWidth = 1; ctx.stroke();
  }

  function drawBrush(ctx, x0, x1, y, h, dir, stepX) {
    ctx.strokeStyle = rgba(C.muted, 0.6); ctx.lineWidth = 1;
    for (var x = x0; x <= x1; x += stepX) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + 1.5, y + dir * h * 0.5, x - 1.2, y + dir * h);
      ctx.stroke();
    }
  }

  function Figure(canvas) {
    var ctx = canvas.getContext("2d");
    var fig = canvas.closest ? canvas.closest("figure") : null;
    function q(sel) { return fig ? fig.querySelector(sel) : null; }
    var slE = q("[data-pl-enh]"), btn = q("[data-pl-play]");
    var outE = q("[data-pl-enh-val]"), outFree = q("[data-pl-out-free]"), outRod = q("[data-pl-out-rod]");

    var enh = 15;
    var A_FREE = 25, BG = 3, NB = 420;
    var playing = false, rafId = null, visible = true;
    var W = 0, H = 0, dpr = 1;
    var P = [];

    function makePanel(rod) {
      // few molecules, as in a real single-molecule confocal experiment, so bursts are distinct;
      // the rod conjugate is larger and diffuses more slowly
      return { rod: rod, n: rod ? 7 : 11, sig: rod ? 2.6 : 3.8, parts: [],
               bufD: new Float32Array(NB), bufA: new Float32Array(NB), head: 0, filled: 0 };
    }

    function panelGeom() {
      var pad = 10, gap = 18;
      var pw = (W - 2 * pad - gap) / 2;
      var legendTop = 24, legendH = 40, sceneTop = legendTop + legendH + 6;
      var traceH = 92, traceGap = 30, bottom = 18;
      var sceneBot = H - bottom - traceH - traceGap;
      for (var i = 0; i < 2; i++) {
        var p = P[i];
        p.x0 = pad + i * (pw + gap); p.x1 = p.x0 + pw;
        p.legendTop = legendTop; p.legendH = legendH;
        p.top = sceneTop; p.bot = sceneBot;
        p.cx = (p.x0 + p.x1) / 2; p.cy = (sceneTop + sceneBot) / 2 + 6;
        p.rx = 22; p.ry = Math.min(46, (sceneBot - sceneTop) * 0.3);
        p.tTop = H - bottom - traceH; p.tBot = H - bottom;
      }
    }

    function spawn(p) {
      var pad = 8;
      return {
        x: p.x0 + pad + Math.random() * (p.x1 - p.x0 - 2 * pad),
        y: p.top + pad + Math.random() * (p.bot - p.top - 2 * pad),
        open: Math.random() < 0.5 ? 1 : 0, op: 0,
        ang: Math.random() * Math.PI, spin: (Math.random() - 0.5) * 0.02
      };
    }

    function initPanels() {
      P = [makePanel(false), makePanel(true)];
      panelGeom();
      for (var i = 0; i < 2; i++) {
        var p = P[i];
        p.parts = [];
        for (var k = 0; k < p.n; k++) { var m = spawn(p); m.op = m.open; p.parts.push(m); }
      }
    }

    function fit() {
      dpr = Math.min(window.devicePixelRatio || 1, canvas.clientWidth < 600 ? 1.5 : 2);   // fewer pixels on phones
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!P.length) initPanels(); else panelGeom();
      for (var i = 0; i < 2; i++) {
        var p = P[i];
        for (var k = 0; k < p.parts.length; k++) {
          var m = p.parts[k];
          m.x = Math.min(p.x1 - 8, Math.max(p.x0 + 8, m.x));
          m.y = Math.min(p.bot - 8, Math.max(p.top + 8, m.y));
        }
      }
    }

    function psf(p, x, y) {
      var dx = (x - p.cx) / p.rx, dy = (y - p.cy) / p.ry;
      return Math.exp(-0.5 * (dx * dx + dy * dy));
    }

    function step() {
      for (var i = 0; i < 2; i++) {
        var p = P[i], sigD = 0, sigA = 0;
        for (var k = 0; k < p.parts.length; k++) {
          var m = p.parts[k];
          var nx = m.x + p.sig * gauss(), ny = m.y + p.sig * gauss();
          if (nx < p.x0 + 8 || nx > p.x1 - 8) nx = m.x - (nx - m.x);
          if (ny < p.top + 8 || ny > p.bot - 8) ny = m.y - (ny - m.y);
          m.x = nx; m.y = ny;
          if (Math.random() < 0.012) m.open = m.open ? 0 : 1;
          m.op += (m.open - m.op) * 0.1;
          if (p.rod) m.ang += m.spin;
          var b = psf(p, m.x, m.y), w = b * b;   // detected signal falls off faster than the drawn glow
          var E = 0.85 - 0.6 * m.op;              // FRET efficiency follows the enzyme's conformation
          sigA += w * E; sigD += w * (1 - E);
        }
        var gain = A_FREE * (p.rod ? enh : 1);
        p.bufD[p.head] = noisy(BG / 2 + gain * sigD);
        p.bufA[p.head] = noisy(BG / 2 + gain * sigA);
        p.head = (p.head + 1) % NB;
        if (p.filled < NB) p.filled++;
      }
    }

    function drawBeam(p) {
      var wTop = Math.min(64, (p.x1 - p.x0) * 0.2), wWaist = p.rx * 0.85;
      var g = ctx.createLinearGradient(0, p.top, 0, p.bot);
      g.addColorStop(0, rgba(C.accent, 0.05)); g.addColorStop(0.5, rgba(C.accent, 0.2)); g.addColorStop(1, rgba(C.accent, 0.07));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(p.cx - wTop, p.top); ctx.lineTo(p.cx - wWaist, p.cy); ctx.lineTo(p.cx - wTop, p.bot);
      ctx.lineTo(p.cx + wTop, p.bot); ctx.lineTo(p.cx + wWaist, p.cy); ctx.lineTo(p.cx + wTop, p.top);
      ctx.closePath(); ctx.fill();
      var rg = ctx.createRadialGradient(p.cx, p.cy, 1, p.cx, p.cy, p.ry);
      rg.addColorStop(0, rgba(C.accent, 0.35)); rg.addColorStop(1, rgba(C.accent, 0));
      ctx.fillStyle = rg;
      ctx.save(); ctx.translate(p.cx, p.cy); ctx.scale(p.rx / p.ry, 1); ctx.translate(-p.cx, -p.cy);
      ctx.beginPath(); ctx.arc(p.cx, p.cy, p.ry, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      ctx.setLineDash([3, 3]); ctx.strokeStyle = rgba(C.muted, 0.7); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(p.cx, p.cy, p.rx, p.ry, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      // excitation arrow at the bottom of the scene
      ctx.strokeStyle = rgba(C.accent, 0.85); ctx.fillStyle = rgba(C.accent, 0.85); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(p.cx, p.bot - 2); ctx.lineTo(p.cx, p.bot - 14); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(p.cx - 4, p.bot - 13); ctx.lineTo(p.cx + 4, p.bot - 13); ctx.lineTo(p.cx, p.bot - 19); ctx.closePath(); ctx.fill();
    }

    function drawFree(m, b) {
      var E = 0.85 - 0.6 * m.op;
      if (b > 0.08) {
        var bb = Math.min(1, b);
        var s = 6 + 5 * bb, R = s * 1.8;
        var g = ctx.createRadialGradient(m.x, m.y, 1, m.x, m.y, R);
        g.addColorStop(0, rgba(C.donor, 0.45 * bb)); g.addColorStop(1, rgba(C.donor, 0));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(m.x, m.y, R, 0, Math.PI * 2); ctx.fill();
        drawEnzymeCartoon(ctx, m.x, m.y, s, m.op, Math.min(1, 0.4 + bb), E);
      } else {
        ctx.fillStyle = rgba(C.muted, 0.55);
        ctx.beginPath(); ctx.arc(m.x, m.y, 2.4, 0, Math.PI * 2); ctx.fill();
      }
    }

    function drawConjugate(m, b) {
      var w = 20, h = 7, E = 0.85 - 0.6 * m.op;
      var bb = Math.min(1, b);
      ctx.save();
      ctx.translate(m.x, m.y); ctx.rotate(m.ang);
      if (b > 0.05) {
        var boost = 1 + 0.6 * Math.log(enh) / Math.log(10);
        var R = (6 + 16 * bb) * boost;
        var tips = [-w / 2, w / 2];
        for (var t = 0; t < 2; t++) {
          var g = ctx.createRadialGradient(tips[t], 0, 1, tips[t], 0, R);
          g.addColorStop(0, rgba(C.amber, 0.7 * bb)); g.addColorStop(1, rgba(C.amber, 0));
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(tips[t], 0, R, 0, Math.PI * 2); ctx.fill();
        }
        var ge = ctx.createRadialGradient(w / 2 + 9, 0, 1, w / 2 + 9, 0, R * 0.9);
        ge.addColorStop(0, rgba(C.donor, 0.55 * bb)); ge.addColorStop(1, rgba(C.donor, 0));
        ctx.fillStyle = ge; ctx.beginPath(); ctx.arc(w / 2 + 9, 0, R * 0.9, 0, Math.PI * 2); ctx.fill();
      }
      drawRodBody(ctx, -w / 2, -h / 2, w, h);
      ctx.strokeStyle = rgba(C.text, 0.6); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2 + 4, 0); ctx.stroke();
      ctx.fillStyle = rgba(C.text, 0.3); ctx.fillRect(w / 2 + 3, -1.5, 3, 3);
      drawEnzymeCartoon(ctx, w / 2 + 10, 0, 6, m.op, 1, E);
      ctx.restore();
    }

    // Donor and acceptor photon traces, as in the home-page hero, on one shared scale.
    function drawTrace(p, ymax) {
      var x0 = p.x0 + 34, x1 = p.x1 - 6, y0 = p.tTop, y1 = p.tBot;
      var pw = x1 - x0, ph = y1 - y0;
      ctx.strokeStyle = rgba(C.border, 1); ctx.lineWidth = 1;
      ctx.strokeRect(x0 + 0.5, y0 + 0.5, pw, ph);
      var n = p.filled, dx = pw / (NB - 1), xs = x0 + (NB - n) * dx;
      function line(buf, rgb) {
        ctx.beginPath();
        for (var k = 0; k < n; k++) {
          var idx = (p.head - n + k + NB) % NB;
          var yy = y1 - Math.max(1.5, Math.min(1, buf[idx] / ymax) * ph);
          if (k === 0) ctx.moveTo(xs, yy); else ctx.lineTo(xs + k * dx, yy);
        }
        ctx.strokeStyle = rgba(rgb, 0.95); ctx.lineWidth = 1.1; ctx.lineJoin = "round"; ctx.stroke();
      }
      line(p.bufD, C.donor);
      line(p.bufA, C.acceptor);
      ctx.font = "10px " + C.font; ctx.fillStyle = rgba(C.muted, 1); ctx.textBaseline = "middle"; ctx.textAlign = "right";
      ctx.fillText(Math.round(ymax).toLocaleString("en-US"), x0 - 4, y0 + 4);
      ctx.fillText("0", x0 - 4, y1 - 1);
      ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
      ctx.fillStyle = rgba(C.muted, 1); ctx.fillText("Photons per bin", x0 + 5, y0 - 5);
      ctx.textAlign = "right";
      ctx.fillStyle = rgba(C.acceptor, 1); ctx.fillText("Acceptor", x1 - 2, y0 - 5);
      var wA = ctx.measureText("Acceptor").width;
      ctx.fillStyle = rgba(C.donor, 1); ctx.fillText("Donor", x1 - 2 - wA - 10, y0 - 5);
      ctx.fillStyle = rgba(C.muted, 1); ctx.textAlign = "center";
      ctx.fillText("Time →", x0 + pw / 2, y1 + 13);
    }

    // Legend strip between the panel title and the scene: what is diffusing.
    function drawLegend(p, rod) {
      var ly = p.legendTop + p.legendH / 2;
      var x = p.x0 + 10;
      ctx.font = "10px " + C.font; ctx.fillStyle = rgba(C.muted, 1); ctx.textAlign = "left"; ctx.textBaseline = "middle";
      if (!rod) {
        drawEnzymeCartoon(ctx, x + 10, ly - 1, 11, 0.6, 1, 0.5);
        ctx.fillText("dye-labelled enzyme, free in solution", x + 30, ly);
        return;
      }
      var rw = 46, rh = 12, rx = x, ry = ly - rh / 2;
      drawBrush(ctx, rx + 5, rx + rw - 5, ry, 4, -1, 5);
      drawBrush(ctx, rx + 5, rx + rw - 5, ry + rh, 4, 1, 5);
      drawRodBody(ctx, rx, ry, rw, rh);
      var tx = rx + rw, ty = ly;
      ctx.fillStyle = rgba(C.amber, 0.95);
      ctx.beginPath(); ctx.arc(tx + 4, ty, 1.8, 0, Math.PI * 2); ctx.fill();
      roundRect(ctx, tx + 6.5, ty - 4, 8, 8, 2);
      ctx.fillStyle = rgba(C.text, 0.22); ctx.fill(); ctx.strokeStyle = rgba(C.text, 0.6); ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = rgba(C.amber, 0.95);
      ctx.beginPath(); ctx.arc(tx + 17, ty, 1.8, 0, Math.PI * 2); ctx.fill();
      drawEnzymeCartoon(ctx, tx + 29, ty - 1, 11, 0.6, 1, 0.5);
      ctx.fillStyle = rgba(C.muted, 1); ctx.textAlign = "left"; ctx.textBaseline = "middle";
      ctx.fillText("same enzyme on a PEGylated gold nanorod", tx + 46, ly - 6);
      ctx.fillText("biotin–streptavidin bridge, dyes ~10 nm from the metal", tx + 46, ly + 7);
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      // headroom above the brighter channel of a single conjugate burst so the traces never clip
      var ymax = (BG + A_FREE * enh) * 1.35 + 20;
      var titles = ["Free enzyme through a confocal volume", "Enzyme on a gold nanorod, same volume"];
      for (var i = 0; i < 2; i++) {
        var p = P[i];
        ctx.strokeStyle = rgba(C.border, 1); ctx.lineWidth = 1;
        ctx.strokeRect(p.x0 + 0.5, p.top + 0.5, p.x1 - p.x0, p.bot - p.top);
        drawBeam(p);
        for (var k = 0; k < p.parts.length; k++) {
          var m = p.parts[k], b = psf(p, m.x, m.y);
          if (p.rod) drawConjugate(m, b); else drawFree(m, b);
        }
        ctx.font = "11px " + C.font; ctx.fillStyle = rgba(C.text, 0.9); ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
        ctx.fillText(titles[i], p.cx, p.legendTop - 8);
        drawLegend(p, p.rod);
        ctx.font = "10px " + C.font; ctx.fillStyle = rgba(C.muted, 1); ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
        ctx.fillText(i === 0 ? "focal volume ≈ 1 fL" : "same focus", p.cx + p.rx + 8, p.cy + 3);
        drawTrace(p, ymax);
      }
    }

    function updateReadouts() {
      if (outE) outE.textContent = enh + "×";
      if (outFree) outFree.textContent = "≈ " + A_FREE + " photons";
      if (outRod) outRod.textContent = "≈ " + Math.round(A_FREE * enh).toLocaleString("en-US") + " photons";
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
    // prefill the traces, and make sure one passage per panel is in view at load
    for (var i = 0; i < NB - 140; i++) step();
    for (var j = 0; j < 2; j++) {
      var m0 = P[j].parts[0];
      m0.x = P[j].cx + (j ? -5 : 4); m0.y = P[j].cy - 12;
    }
    for (i = 0; i < 140; i++) step();
    draw();
    updateReadouts();

    if (slE) slE.addEventListener("input", function () {
      var v = parseFloat(slE.value); if (!isNaN(v) && v > 0) enh = v;
      updateReadouts(); if (!playing) draw();
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
      new ResizeObserver(function () { fit(); draw(); }).observe(canvas);
    } else {
      window.addEventListener("resize", function () { fit(); draw(); });
    }
    if (window.MutationObserver) {
      new MutationObserver(function () { refreshColors(); draw(); })
        .observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    }
  }

  for (var i = 0; i < nodes.length; i++) new Figure(nodes[i]);
})();
