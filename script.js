/* ========================================
   Countdown to competition launch: June 15, 2026 00:00 UTC
   ======================================== */
(function () {
  const target = new Date('2026-06-15T00:00:00Z').getTime();

  function update() {
    const now = Date.now();
    let diff = target - now;

    if (diff <= 0) {
      const label = document.querySelector('.countdown-target');
      if (label) label.textContent = 'Competition is live!';
      ['cd-days', 'cd-hours', 'cd-mins', 'cd-secs'].forEach(function (id) {
        const el = document.getElementById(id);
        if (el) el.textContent = '0';
      });
      return;
    }

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
    '2026-06-15', '2026-07-19', '2026-09-27',
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
   Hero Airfoil Flow Animation
   NACA 4418 with pre-computed streamlines.
   Particles slide along paths — no stagnation.
   ======================================== */
(function () {
  var canvas = document.getElementById('hero-flow');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');

  var M = 0.04, P = 0.4, T = 0.18;
  var PARTICLE_COUNT = 700;
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
  function resize() {
    var hero = canvas.parentElement;
    var rect = hero.getBoundingClientRect();
    dpr = window.devicePixelRatio || 1;
    rW = rect.width; rH = rect.height;
    canvas.width = rW * dpr;
    canvas.height = rH * dpr;
    canvas.style.width = rW + 'px';
    canvas.style.height = rH + 'px';

    var span = document.querySelector('[data-hero-pde]');
    if (span) {
      var sr = span.getBoundingClientRect();
      var hr = hero.getBoundingClientRect();
      leadX = sr.right - hr.left;
    } else {
      leadX = rW * 0.35;
    }

    chord = rW * 1.1;       /* 2x original — tail well off-screen */
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
  requestAnimationFrame(frame);
})();
