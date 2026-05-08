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

    function setSplit(pct) {
      split = clamp(pct, 0, 100);
      el.style.setProperty('--rp-split', split.toFixed(1) + '%');
      if (handle) handle.setAttribute('aria-valuenow', String(Math.round(split)));
    }

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
