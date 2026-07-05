/* ========================================
   Countdown: auto-rolling multi-phase (UTC).
   Counts down to the first future target; label follows the phase.
   ======================================== */
(function () {
  // Each phase ends 23:59:59 UTC on its last day, so the target is the next
  // day 00:00:00Z. All times are ISO "Z" strings (UTC), never local.
  const phases = [
    { target: '2026-07-05T00:00:00Z', label: 'Competition launches in:' },
    { target: '2026-07-20T00:00:00Z', label: 'Warm-up Phase ends in:' },
    { target: '2026-09-28T00:00:00Z', label: 'Main Development Phase ends in:' },
    { target: '2026-10-26T00:00:00Z', label: 'Final Decision Phase ends in:' }
  ].map(function (p) {
    return { at: new Date(p.target).getTime(), label: p.label };
  });

  function setLabel(text) {
    const label = document.querySelector('.countdown-target');
    if (label) label.textContent = text;
  }

  function update() {
    const now = Date.now();

    let phase = null;
    for (let i = 0; i < phases.length; i++) {
      if (phases[i].at > now) { phase = phases[i]; break; }
    }

    if (!phase) {
      setLabel('Competition concluded.');
      ['cd-days', 'cd-hours', 'cd-mins', 'cd-secs'].forEach(function (id) {
        const el = document.getElementById(id);
        if (el) el.textContent = '0';
      });
      return;
    }

    setLabel(phase.label);
    let diff = phase.at - now;

    const d = Math.floor(diff / 86400000); diff %= 86400000;
    const h = Math.floor(diff / 3600000);  diff %= 3600000;
    const m = Math.floor(diff / 60000);    diff %= 60000;
    const s = Math.floor(diff / 1000);

    const dEl = document.getElementById('cd-days');
    const hEl = document.getElementById('cd-hours');
    const mEl = document.getElementById('cd-mins');
    const sEl = document.getElementById('cd-secs');

    if (dEl) dEl.textContent = d;
    if (hEl) hEl.textContent = String(h).padStart(2, '0');
    if (mEl) mEl.textContent = String(m).padStart(2, '0');
    if (sEl) sEl.textContent = String(s).padStart(2, '0');
  }

  update();
  setInterval(update, 1000);
})();

/* ========================================
   Auto-update timeline dots based on current date
   ======================================== */
(function () {
  var dates = [
    '2026-07-05', '2026-07-19', '2026-09-27',
    '2026-10-25', '2026-11-10', '2026-11-25', '2026-12-06'
  ];
  var dots = document.querySelectorAll('.timeline-dot');
  var now = new Date();

  dates.forEach(function (d, i) {
    var dt = new Date(d + 'T23:59:59Z');
    if (now > dt) {
      dots[i].classList.add('timeline-dot--done');
    } else if (i === 0 || now > new Date(dates[i - 1] + 'T23:59:59Z')) {
      dots[i].classList.add('timeline-dot--active');
    }
  });
})();

/* ========================================
   Mobile nav toggle
   ======================================== */
document.querySelectorAll('.nav-links a').forEach(function (a) {
  a.addEventListener('click', function () {
    document.querySelector('.nav-links').classList.remove('open');
  });
});

/* ========================================
   Hero Real↔Sim compare slider (ported from realpdebench)
   ======================================== */
(function () {
  var elements = document.querySelectorAll('[data-rp-compare]');
  if (!elements.length) return;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  elements.forEach(function (el) {
    var initial = parseFloat(el.dataset.split);
    if (isNaN(initial)) initial = 50;
    var split = clamp(initial, 0, 100);
    var handle = el.querySelector('.rp-compare-handle');

    function setSplit(pct, fromSync) {
      split = clamp(pct, 0, 100);
      el.style.setProperty('--rp-split', split.toFixed(1) + '%');
      if (handle) handle.setAttribute('aria-valuenow', String(Math.round(split)));
      if (!fromSync) {
        var grid = el.closest('.rp-compare-grid');
        if (grid) {
          grid.querySelectorAll('[data-rp-compare]').forEach(function (other) {
            if (other === el || !other._rpSetSplit) return;
            other._rpSetSplit(split, true);
          });
        }
      }
    }
    el._rpSetSplit = setSplit;

    setSplit(split);

    var dragging = false;
    var pointerId = null;

    function fromPointer(e) {
      var rect = el.getBoundingClientRect();
      if (!rect.width) return;
      var x = clamp(e.clientX - rect.left, 0, rect.width);
      setSplit((x / rect.width) * 100);
    }

    el.addEventListener('pointerdown', function (e) {
      if (typeof e.button === 'number' && e.button !== 0) return;
      dragging = true;
      pointerId = e.pointerId;
      try { el.setPointerCapture(pointerId); } catch (err) {}
      fromPointer(e);
    });
    el.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      if (pointerId != null && e.pointerId !== pointerId) return;
      fromPointer(e);
    });
    function endDrag(e) {
      if (!dragging) return;
      if (pointerId != null && e.pointerId !== pointerId) return;
      dragging = false;
      pointerId = null;
    }
    el.addEventListener('pointerup', endDrag);
    el.addEventListener('pointercancel', endDrag);

    if (handle) {
      handle.addEventListener('keydown', function (e) {
        var step = 2;
        if (e.key === 'ArrowLeft')      { e.preventDefault(); setSplit(split - step); }
        else if (e.key === 'ArrowRight'){ e.preventDefault(); setSplit(split + step); }
        else if (e.key === 'Home')      { e.preventDefault(); setSplit(0); }
        else if (e.key === 'End')       { e.preventDefault(); setSplit(100); }
      });
    }
  });
})();

/* ========================================
   Hero Airfoil Flow Animation
   NACA 4418 with pre-computed streamlines.
   Particles slide along paths — no stagnation.
   ======================================== */
(function () {
  var canvas = document.getElementById('hero-flow');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');

  var M = 0.04, P = 0.4, T = 0.18;
  var PARTICLE_COUNT = 1400;
  var TRAIL_LEN = 18;

  var dpr, rW, rH;
  var leadX, chord, centerY;
  var foilUpper = [], foilLower = [];
  var streamlines = [];
  var particles = [];

  /* --- NACA 4418 geometry --- */
  function nacaAt(xn) {
    xn = Math.max(0.0001, Math.min(0.9999, xn));
    var yt = 5 * T * (
      0.2969 * Math.sqrt(xn) - 0.1260 * xn
      - 0.3516 * xn * xn + 0.2843 * xn * xn * xn
      - 0.1015 * xn * xn * xn * xn);
    var yc, dyc;
    if (xn < P) {
      yc = M / (P * P) * (2 * P * xn - xn * xn);
      dyc = 2 * M / (P * P) * (P - xn);
    } else {
      yc = M / ((1 - P) * (1 - P)) * ((1 - 2 * P) + 2 * P * xn - xn * xn);
      dyc = 2 * M / ((1 - P) * (1 - P)) * (P - xn);
    }
    var th = Math.atan(dyc);
    return {
      xu: xn - yt * Math.sin(th), yu: yc + yt * Math.cos(th),
      xl: xn + yt * Math.sin(th), yl: yc - yt * Math.cos(th)
    };
  }

  function buildFoilArrays() {
    foilUpper = []; foilLower = [];
    for (var i = 0; i <= 80; i++) {
      var beta = Math.PI * i / 80;
      var xn = 0.5 * (1 - Math.cos(beta));
      var p = nacaAt(xn);
      foilUpper.push({ x: leadX + p.xu * chord, y: centerY - p.yu * chord });
      foilLower.push({ x: leadX + p.xl * chord, y: centerY - p.yl * chord });
    }
  }

  function isInsideFoil(px, py) {
    var xn = (px - leadX) / chord;
    if (xn < 0 || xn > 1) return false;
    xn = Math.max(0.001, Math.min(0.999, xn));
    var yn = -(py - centerY) / chord;
    var p = nacaAt(xn);
    return yn < p.yu + 0.006 && yn > p.yl - 0.006;
  }

  /* --- Velocity field: cylinder potential flow with circulation ---
     Used only for pre-computing streamlines. */
  function flowVel(px, py) {
    var cx = leadX + chord * 0.33;
    var cy = centerY - chord * 0.008;
    var R = chord * 0.155;
    var dx = px - cx, dy = py - cy;
    var r2 = dx * dx + dy * dy;
    if (r2 < R * R * 0.3) r2 = R * R * 0.3;
    var r4 = r2 * r2, R2 = R * R;

    var vx = 1 - R2 * (dx * dx - dy * dy) / r4;
    var vy = -2 * R2 * dx * dy / r4;

    /* Kutta-like circulation: Gamma = 2*pi*U*R*sin(alpha+beta) */
    var G = 2 * Math.PI * R * 0.7;
    vx += G * dy / (2 * Math.PI * r2);
    vy += -G * dx / (2 * Math.PI * r2);

    /* Clamp speed to avoid singularity jitter */
    var spd = Math.sqrt(vx * vx + vy * vy);
    if (spd > 4) { vx = vx / spd * 4; vy = vy / spd * 4; }
    if (spd < 0.15 && spd > 0.0001) { vx = vx / spd * 0.15; vy = vy / spd * 0.15; }

    return { vx: vx, vy: vy };
  }

  /* --- Pre-compute streamlines by integrating the velocity field --- */
  function computeStreamlines() {
    streamlines = [];
    var numLines = 55;
    var dt = 2.0;

    for (var i = 0; i < numLines; i++) {
      var y0 = -30 + (rH + 60) * (i + 0.5) / numLines;
      var path = [];
      var x = -40, y = y0;

      for (var s = 0; s < 3000; s++) {
        path.push({ x: x, y: y });
        if (x > rW + 80) break;

        var v = flowVel(x, y);
        var spd = Math.sqrt(v.vx * v.vx + v.vy * v.vy);
        if (spd < 0.0001) break;

        /* Step along velocity direction with fixed arc-length */
        x += v.vx / spd * dt;
        y += v.vy / spd * dt;

        /* If we entered the foil, nudge to nearest surface */
        if (isInsideFoil(x, y)) {
          var xn = Math.max(0.001, Math.min(0.999, (x - leadX) / chord));
          var prof = nacaAt(xn);
          var yuPx = centerY - prof.yu * chord;
          var ylPx = centerY - prof.yl * chord;
          y = (Math.abs(y - yuPx) < Math.abs(y - ylPx)) ? yuPx - 3 : ylPx + 3;
        }

        if (y < -80 || y > rH + 80) break;
      }

      if (path.length > 30) streamlines.push(path);
    }
  }

  /* --- Particles: slide along pre-computed streamlines --- */
  function spawnParticle(spread) {
    var li = Math.floor(Math.random() * streamlines.length);
    var line = streamlines[li];
    return {
      line: li,
      pos: spread ? Math.random() * line.length : 0,
      speed: 1.2 + Math.random() * 2.0,
      alpha: 0.25 + Math.random() * 0.35,
      size: 1.4 + Math.random() * 1.6
    };
  }

  function initParticles() {
    particles = [];
    for (var i = 0; i < PARTICLE_COUNT; i++) particles.push(spawnParticle(true));
  }

  /* --- Resize --- */
  function getPageScale() {
    var outer = document.querySelector('.rp-scale-outer');
    if (!outer || !outer.classList.contains('rp-scale-active')) return 1;
    var v = outer.style.getPropertyValue('--rp-page-scale');
    var s = parseFloat(v);
    return (s > 0) ? s : 1;
  }
  function resize() {
    var hero = canvas.parentElement;
    var rect = hero.getBoundingClientRect();
    /* getBoundingClientRect returns visual (post-transform) pixels.
       Divide by page scale so canvas backing store stays in layout space. */
    var pageScale = getPageScale();
    dpr = window.devicePixelRatio || 1;
    rW = rect.width / pageScale;
    rH = rect.height / pageScale;

    /* Canvas covers the full hero; airfoil centerY is pushed below the text block. */
    canvas.style.top = '0';
    canvas.width = rW * dpr;
    canvas.height = rH * dpr;
    canvas.style.width = rW + 'px';
    canvas.style.height = rH + 'px';

    var span = document.querySelector('[data-hero-pde]');
    if (span) {
      var sr = span.getBoundingClientRect();
      var hr = hero.getBoundingClientRect();
      leadX = (sr.right - hr.left) / pageScale;
    } else {
      leadX = rW * 0.35;
    }

    /* Cap chord so the airfoil stops scaling on ultrawide screens.
       Without the cap, chord (and thus foil thickness ∝ chord*0.18) grows
       with viewport width while hero height stays content-driven, so the
       foil eats into the top half on 4K. Streamlines still span full rW
       so particles enter from the true left edge. */
    chord = Math.min(rW * 1.1, 1760);
    centerY = rH * 0.55;    /* shifted down */

    buildFoilArrays();
    computeStreamlines();
    initParticles();
  }

  /* --- Render --- */
  function frame() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rW, rH);

    /* Airfoil: gradient fill, no border */
    ctx.beginPath();
    ctx.moveTo(foilUpper[0].x, foilUpper[0].y);
    for (var i = 1; i < foilUpper.length; i++) ctx.lineTo(foilUpper[i].x, foilUpper[i].y);
    for (var i = foilLower.length - 1; i >= 0; i--) ctx.lineTo(foilLower[i].x, foilLower[i].y);
    ctx.closePath();
    var grad = ctx.createLinearGradient(leadX, centerY - chord * 0.1, leadX + chord * 0.5, centerY + chord * 0.06);
    grad.addColorStop(0, 'rgba(235, 233, 245, 0.55)');
    grad.addColorStop(0.5, 'rgba(216, 212, 230, 0.38)');
    grad.addColorStop(1, 'rgba(216, 212, 230, 0.12)');
    ctx.fillStyle = grad;
    ctx.fill();

    /* Particles along streamlines */
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      var line = streamlines[p.line];
      p.pos += p.speed;

      if (p.pos >= line.length - 1) {
        particles[i] = spawnParticle(false);
        continue;
      }

      /* Interpolate position */
      var idx = Math.floor(p.pos);
      var frac = p.pos - idx;
      var ni = Math.min(idx + 1, line.length - 1);
      var px = line[idx].x + (line[ni].x - line[idx].x) * frac;
      var py = line[idx].y + (line[ni].y - line[idx].y) * frac;

      /* Draw trail along the streamline path */
      var tStart = Math.max(0, idx - TRAIL_LEN);
      if (idx - tStart > 1) {
        ctx.beginPath();
        ctx.moveTo(line[tStart].x, line[tStart].y);
        for (var j = tStart + 1; j <= idx; j++) ctx.lineTo(line[j].x, line[j].y);
        ctx.lineTo(px, py);
        ctx.strokeStyle = 'rgba(52, 205, 163, ' + (p.alpha * 0.6) + ')';
        ctx.lineWidth = p.size;
        ctx.lineCap = 'round';
        ctx.stroke();
      }

      /* Particle head */
      ctx.beginPath();
      ctx.arc(px, py, p.size, 0, 6.2832);
      ctx.fillStyle = 'rgba(52, 205, 163, ' + p.alpha + ')';
      ctx.fill();
    }

    requestAnimationFrame(frame);
  }

  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('rp-scale-changed', resize);
  requestAnimationFrame(frame);
})();


/* ========================================
   Proportional Content Scale (mirrors RealPDEBench)
   Below 768px viewport, lock layout at 768px and visually scale-down via transform.
   Navbar (fixed-position, outside .rp-scale-outer) stays at viewport width.
   ======================================== */
(function () {
  var BASE = 768;
  var outer = document.querySelector('.rp-scale-outer');
  var inner = document.querySelector('.rp-scale-inner');
  if (!outer || !inner) return;

  var raf = null;
  function vwidth() {
    var vv = window.visualViewport;
    if (vv && typeof vv.width === 'number') {
      var s = (typeof vv.scale === 'number' && vv.scale > 0) ? vv.scale : 1;
      return vv.width * s;
    }
    return window.innerWidth || document.documentElement.clientWidth || 0;
  }
  function update() {
    var w = vwidth();
    if (w > 0 && w < BASE) {
      var scale = w / BASE;
      outer.classList.add('rp-scale-active');
      outer.style.setProperty('--rp-page-scale', String(scale));
      var h = inner.scrollHeight || inner.offsetHeight || 0;
      outer.style.height = (h * scale).toFixed(2) + 'px';
    } else {
      outer.classList.remove('rp-scale-active');
      outer.style.removeProperty('--rp-page-scale');
      outer.style.removeProperty('height');
    }
    window.dispatchEvent(new Event('rp-scale-changed'));
  }
  function schedule() {
    if (raf != null) return;
    raf = window.requestAnimationFrame(function () { raf = null; update(); });
  }
  schedule();
  window.addEventListener('resize', schedule);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', schedule);
  if (window.ResizeObserver) new ResizeObserver(schedule).observe(inner);
  window.addEventListener('load', schedule);
})();
