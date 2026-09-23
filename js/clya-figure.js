// =============================================================
// Satyaghosh Maurya — ClyA Pore Assembly Figure
// Side view of a supported lipid bilayer. Soluble Cytolysin A monomers
// bind, diffuse laterally and pair up; dimers are short-lived, and only
// rarely does one lock into a stable nucleus (the lag). A nucleus then
// recruits monomers quickly until the twelve-subunit pore inserts, and
// pores accumulate over time as more nuclei form.
// A caricature of the single-molecule kinetics. Schematic, not to scale.
// No dependencies. Honours reduced motion.
// Mount: <canvas data-figure="clya"> inside a <figure> with optional
// controls [data-clya-reset] and [data-clya-play] and readouts.
// =============================================================

(function () {
  "use strict";

  var nodes = document.querySelectorAll('canvas[data-figure="clya"]');
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
    C.toxin = hexToRgb(cssVar("--acceptor-red", "#cf222e"));
    C.amber = [210, 153, 34];
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
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  var reduceMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  var animOn = false;
  try { animOn = localStorage.getItem("anim") === "on"; } catch (e) {}
  var autoplay = animOn && !reduceMotion;   // figures start paused unless the reader opted in

  var RING = 12;
  // pNuc: chance per contact-frame that two bound monomers pair up.
  // pDiss: chance per frame that a dimer falls apart.
  // pAct: chance per frame that a dimer locks into a stable nucleus.
  var P = { pNuc: 0.015, pDiss: 0.004, pAct: 0.002 };   // pAct raised 2026-09-23 so the first nucleus comes within about ten seconds of a monomer-only start

  function Figure(canvas) {
    var ctx = canvas.getContext("2d");
    var fig = canvas.closest ? canvas.closest("figure") : null;
    function q(sel) { return fig ? fig.querySelector(sel) : null; }
    var btnReset = q("[data-clya-reset]"), btn = q("[data-clya-play]");
    var outPhase = q("[data-clya-out-phase]"), outMax = q("[data-clya-out-max]");
    var outPores = q("[data-clya-out-pores]"), outT = q("[data-clya-out-t]");

    var playing = false, rafId = null, visible = true;
    var W = 0, H = 0, dpr = 1, G = {};
    var sol = [], ents = [], pores = 0, frames = 0, nucleated = false;
    // The cap limits free monomers on the membrane, not subunits in arcs. Counting arc
    // subunits could deadlock the figure: several arcs each short of a ring, the cap
    // reached, no monomer able to bind, and nothing left that could merge.
    var N_SOL = 16, MAX_BOUND = 24;

    function geom() {
      G.glassTop = H - 26;
      G.memBot = G.glassTop - 6;
      G.memTop = G.memBot - 26;
      G.top = 8;
      G.left = 12; G.right = W - 12;
    }
    function fit() {
      dpr = Math.min(window.devicePixelRatio || 1, canvas.clientWidth < 600 ? 1.5 : 2);   // fewer pixels on phones
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      geom();
    }

    function spawnSol(atTop) {
      var maxY = G.memTop - 60;
      return {
        x: G.left + Math.random() * (G.right - G.left),
        y: atTop ? G.top + 6 + Math.random() * 30 : G.top + Math.random() * Math.max(10, maxY - G.top),
        a: Math.random() * Math.PI, spin: (Math.random() - 0.5) * 0.08
      };
    }
    function reset() {
      sol = []; ents = []; pores = 0; frames = 0; nucleated = false;
      for (var i = 0; i < N_SOL; i++) sol.push(spawnSol(false));
    }
    function boundCount() { var c = 0; for (var i = 0; i < ents.length; i++) if (!ents[i].inserted && ents[i].n === 1) c++; return c; }
    function largest() { var m = 0; for (var i = 0; i < ents.length; i++) if (ents[i].n > m) m = ents[i].n; return m; }
    function growingCount() { var c = 0; for (var i = 0; i < ents.length; i++) if (ents[i].act && !ents[i].inserted) c++; return c; }
    function nearestNucleus(x) {
      var best = null, bd = 1e9;
      for (var i = 0; i < ents.length; i++) {
        var e = ents[i];
        if (!e.act || e.inserted) continue;
        var d = Math.abs(e.x - x);
        if (d < bd) { bd = d; best = e; }
      }
      return best;
    }

    function step() {
      frames++;
      var i, j, e;
      // soluble monomers: Brownian motion with a gentle approach to the membrane
      for (i = sol.length - 1; i >= 0; i--) {
        var m = sol[i];
        m.x += 2.4 * gauss(); m.y += 0.6 + 2.4 * gauss(); m.a += m.spin;
        if (m.x < G.left) m.x = 2 * G.left - m.x; else if (m.x > G.right) m.x = 2 * G.right - m.x;
        if (m.y < G.top) m.y = 2 * G.top - m.y;
        if (m.y >= G.memTop - 12) {
          if (boundCount() < MAX_BOUND) {
            ents.push({ n: 1, x: m.x, inserted: false, act: false, age: 0 });
            sol.splice(i, 1);
            sol.push(spawnSol(true));
          } else {
            m.y = G.memTop - 14;
          }
        }
      }
      // membrane-bound species: lateral diffusion, slower for larger oligomers;
      // a stable nucleus recruits monomers that come near it
      for (i = 0; i < ents.length; i++) {
        e = ents[i];
        if (e.inserted) continue;
        if (e.n === 1 && e.age < 60) e.age++;   // the protomer transition, see drawEntity
        var s = 2.6 / Math.sqrt(e.n);
        if (e.n === 1) {
          var nuc = nearestNucleus(e.x);
          if (nuc && Math.abs(e.x - nuc.x) < 160) e.x += 0.7 * (nuc.x > e.x ? 1 : -1);
        }
        e.x += s * gauss();
        if (e.x < G.left + 12) e.x = G.left + 12; else if (e.x > G.right - 12) e.x = G.right - 12;
      }
      // dimers fall apart, or rarely lock into a stable nucleus
      for (i = ents.length - 1; i >= 0; i--) {
        e = ents[i];
        if (e.n !== 2 || e.act) continue;
        var r = Math.random();
        if (r < P.pDiss) {
          ents.splice(i, 1);
          ents.push({ n: 1, x: e.x - 7, inserted: false, act: false, age: 60 });
          ents.push({ n: 1, x: e.x + 7, inserted: false, act: false, age: 60 });
        } else if (r < P.pDiss + P.pAct) {
          e.act = true;
          nucleated = true;
        }
      }
      // encounters: monomers pair up rarely; anything that meets a nucleus joins it
      for (i = 0; i < ents.length; i++) {
        for (j = i + 1; j < ents.length; j++) {
          var a = ents[i], b = ents[j];
          if (a.inserted || b.inserted || a.n + b.n > RING) continue;
          if (a.n === 1 && b.n === 1) {
            if (Math.abs(a.x - b.x) < 6 && Math.random() < P.pNuc) {
              ents.splice(j, 1); ents.splice(i, 1);
              ents.push({ n: 2, x: (a.x + b.x) / 2, inserted: false, act: false });
              i = -1; break;
            }
            continue;
          }
          if (!(a.act || b.act)) continue;
          var reach = 5 + 2.2 * (a.n + b.n);
          if (Math.abs(a.x - b.x) < reach && Math.random() < 0.6) {
            var n = a.n + b.n;
            var merged = { n: n, x: (a.x * a.n + b.x * b.n) / n, inserted: n === RING, act: true };
            if (merged.inserted) pores++;
            ents.splice(j, 1); ents.splice(i, 1); ents.push(merged);
            i = -1; break;
          }
        }
      }
    }

    // ---------- drawing ----------
    function drawMembrane() {
      var mt = G.memTop, mb = G.memBot, x;
      ctx.fillStyle = rgba(C.accent, 0.10); ctx.fillRect(0, G.glassTop, W, H - G.glassTop);
      ctx.fillStyle = rgba(C.muted, 0.10); ctx.fillRect(0, mt + 3, W, mb - mt - 6);
      ctx.strokeStyle = rgba(C.accent, 0.35); ctx.lineWidth = 1;
      for (x = 6; x < W; x += 8) {
        ctx.beginPath(); ctx.moveTo(x, mt + 6); ctx.lineTo(x, mt + 13); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x, mb - 6); ctx.lineTo(x, mb - 13); ctx.stroke();
      }
      ctx.fillStyle = rgba(C.accent, 0.42);
      for (x = 6; x < W; x += 8) {
        ctx.beginPath(); ctx.arc(x, mt + 3, 3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x, mb - 3, 3, 0, Math.PI * 2); ctx.fill();
      }
    }

    function drawSoluble(m) {
      ctx.save();
      ctx.translate(m.x, m.y); ctx.rotate(m.a);
      roundRect(ctx, -2.5, -7, 5, 14, 2.5);
      ctx.fillStyle = rgba(C.toxin, 0.8); ctx.fill();
      ctx.strokeStyle = rgba(C.text, 0.4); ctx.lineWidth = 0.8; ctx.stroke();
      ctx.restore();
    }

    function drawEntity(e) {
      var mt = G.memTop, k;
      if (e.n === 1) {
        // The monomer-to-protomer transition of the painting on this page: the
        // water-soluble form lands lying along the bilayer, then swings upright
        // over about a second as it converts to the membrane-inserted protomer.
        var up = Math.min(1, (e.age === undefined ? 60 : e.age) / 50);
        var ang = (1 - up) * Math.PI / 2;
        ctx.save();
        ctx.translate(e.x, mt - 4); ctx.rotate(ang);
        roundRect(ctx, -3, -12, 6, 24, 3);
        ctx.fillStyle = rgba(C.toxin, 0.85); ctx.fill();
        ctx.strokeStyle = rgba(C.text, 0.45); ctx.lineWidth = 0.8; ctx.stroke();
        ctx.restore();
        return;
      }
      var R = 7 + 1.9 * e.n;
      var hsub = e.inserted ? 40 : 22, wsub = 6;
      if (e.act && !e.inserted) {
        var g = ctx.createRadialGradient(e.x, mt - 8, 2, e.x, mt - 8, R + 16);
        g.addColorStop(0, rgba(C.accent, 0.22)); g.addColorStop(1, rgba(C.accent, 0));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(e.x, mt - 8, R + 16, 0, Math.PI * 2); ctx.fill();
      }
      var items = [];
      for (k = 0; k < e.n; k++) {
        var th = Math.PI / 2 + (k / RING) * 2 * Math.PI;
        items.push({ k: k, x: e.x + R * Math.cos(th), depth: Math.sin(th) });
      }
      items.sort(function (a, b) { return b.depth - a.depth; });   // back first
      if (e.inserted) {
        ctx.fillStyle = rgba(C.bgAlt, 1);
        ctx.fillRect(e.x - R + 5, mt - 1, 2 * R - 10, G.memBot - mt + 2);
      }
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        var front = (1 - it.depth) / 2;
        var yTop = (e.inserted ? mt - 14 : mt - hsub + 4) + (1 - front) * 4;
        roundRect(ctx, it.x - wsub / 2, yTop, wsub, hsub, 3);
        ctx.fillStyle = rgba(C.toxin, 0.55 + 0.4 * front); ctx.fill();
        ctx.strokeStyle = rgba(C.text, 0.3 + 0.2 * front); ctx.lineWidth = 0.8; ctx.stroke();
      }
      if (e.inserted) {
        ctx.fillStyle = rgba(C.text, 0.22);
        ctx.beginPath(); ctx.ellipse(e.x, mt - 12, R - 5, 3.5, 0, 0, Math.PI * 2); ctx.fill();
      }
    }

    function drawLabels() {
      ctx.font = "11px " + C.font; ctx.textBaseline = "alphabetic";
      ctx.textAlign = "left"; ctx.fillStyle = rgba(C.muted, 1);
      ctx.fillText("Soluble ClyA monomers", 10, 18);
      ctx.fillText("Supported lipid bilayer", 10, H - 9);
      ctx.textAlign = "right";
      ctx.fillText("monomer → dimer → nucleus → growing arc → inserted pore", W - 10, 18);
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      drawMembrane();
      for (var i = 0; i < sol.length; i++) drawSoluble(sol[i]);
      var sorted = ents.slice().sort(function (a, b) { return a.n - b.n; });
      for (i = 0; i < sorted.length; i++) drawEntity(sorted[i]);
      drawLabels();
    }

    function updateReadouts() {
      var nmax = largest(), growing = growingCount();
      if (outPhase) {
        outPhase.textContent = growing > 0 ? "growth: monomers add to " + (growing > 1 ? growing + " stable nuclei" : "a stable nucleus")
          : (pores > 0 ? "pores inserted; waiting for the next nucleus" : "lag: dimers form and fall apart");
        outPhase.style.color = growing > 0 ? rgba(C.accent, 1) : (pores > 0 ? rgba(C.donor, 1) : rgba(C.amber, 1));
      }
      if (outMax) outMax.textContent = nmax ? nmax + "-mer" : "–";
      if (outPores) outPores.textContent = String(pores);
      if (outT) outT.textContent = Math.round(frames / 60) + " s";
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
      updateReadouts();
    }
    function setPlaying(p) {
      playing = p;
      if (btn) { btn.textContent = p ? "Pause" : "Play"; btn.classList.toggle("hero-btn-primary", !p); }
      if (p && visible && rafId === null) rafId = requestAnimationFrame(tick);
    }

    refreshColors();
    fit();
    reset();
    // The figure opens on what the experiment opens on: monomers in solution above a
    // clean bilayer. Nothing is pre-assembled; press Play and the whole sequence runs,
    // lag included. (It used to open on a pre-run population of pores, which showed the
    // end of the story before the start.)
    draw();
    updateReadouts();

    // Hooks for tools and tests: advance n steps synchronously, read the state, restart.
    canvas._captureFrame = function (n) { n = n || 2; for (var k = 0; k < n; k++) step(); draw(); updateReadouts(); };
    canvas._state = function () {
      return { frames: frames, soluble: sol.length, bound: boundCount(), largest: largest(),
               pores: pores, nucleated: nucleated, growing: growingCount() };
    };
    canvas._reset = function () { reset(); draw(); updateReadouts(); };

    if (btnReset) btnReset.addEventListener("click", function () { reset(); draw(); updateReadouts(); });
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
