// ======================================================
// PREMIUM GALAXY BACKGROUND
// Deep space dots — nebula clouds, twinkling, mouse repulsion
// ======================================================
(function initGalaxy() {
  const canvas = document.getElementById('dotCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let W, H, count = 0;
  let mx = -9999, my = -9999;

  // ── Layer 1: Static deep-space stars (tiny, many) ──
  // ── Layer 2: Grid dots with wave + interaction ─────
  // ── Layer 3: Nebula soft glow clouds ───────────────
  // ── Layer 4: Rare shooting stars ──────────────────

  // Color palette — galaxy blue/purple/white
  const PALETTE = [
    [124, 156, 255],  // blue
    [124, 156, 255],  // blue (weighted)
    [124, 156, 255],  // blue
    [170, 120, 255],  // purple
    [200, 215, 255],  // cool white
    [255, 200, 130],  // rare warm gold
  ];

  // ── Deep background stars (fixed, not animated) ────
  let bgStars = [];
  function buildBgStars() {
    bgStars = [];
    const count = Math.floor((W * H) / 4800);
    for (let i = 0; i < count; i++) {
      bgStars.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: Math.random() < 0.05 ? Math.random() * 0.9 + 0.5 : Math.random() * 0.35 + 0.08,
        alpha: Math.random() * 0.65 + 0.12,
        twinkleSpeed: Math.random() * 0.015 + 0.005,
        twinklePhase: Math.random() * Math.PI * 2,
        color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
      });
    }
  }

  // ── Interactive grid dots ──────────────────────────
  const COLS = 30, ROWS = 18;
  let dots = [];
  function buildDots() {
    dots = [];
    const gapX = W / (COLS - 1);
    const gapY = H / (ROWS - 1);
    for (let iy = 0; iy < ROWS; iy++) {
      for (let ix = 0; ix < COLS; ix++) {
        const colorIdx = Math.floor(Math.random() * PALETTE.length);
        const isAccent = Math.random() < 0.07;
        dots.push({
          bx: ix * gapX, by: iy * gapY,
          ix, iy, ox: 0, oy: 0,
          color: PALETTE[colorIdx],
          baseSize: isAccent ? 2.4 : (Math.random() < 0.25 ? 0.45 : 1.1),
          isAccent,
          phase: Math.random() * Math.PI * 2,
          twinkle: Math.random() * Math.PI * 2,
          twinkleSpeed: Math.random() * 0.02 + 0.008,
        });
      }
    }
  }

  // ── Nebula clouds (soft radial blobs) ─────────────
  let nebulae = [];
  function buildNebulae() {
    nebulae = [];
    const count = 4;
    for (let i = 0; i < count; i++) {
      nebulae.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: Math.random() * 160 + 100,
        color: Math.random() < 0.5 ? [124,156,255] : [170,120,255],
        alpha: Math.random() * 0.016 + 0.006,
        driftX: (Math.random() - 0.5) * 0.10,
        driftY: (Math.random() - 0.5) * 0.05,
      });
    }
  }

  // ── Shooting stars ─────────────────────────────────
  let shooters = [];
  function maybeAddShooter() {
    if (Math.random() < 0.003 && shooters.length < 3) {
      const startX = Math.random() * W * 0.7;
      const startY = Math.random() * H * 0.4;
      shooters.push({
        x: startX, y: startY,
        vx: Math.random() * 8 + 5,
        vy: Math.random() * 4 + 2,
        life: 1.0,
        decay: Math.random() * 0.018 + 0.012,
        len: Math.random() * 90 + 60,
      });
    }
  }

  // ── Build everything ───────────────────────────────
  function resize() {
    const dpr = window.devicePixelRatio || 1;
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width  = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildBgStars();
    buildDots();
    buildNebulae();
  }

  document.addEventListener('mousemove', (e) => { mx = e.clientX; my = e.clientY; });
  document.addEventListener('mouseleave', () => { mx = -9999; my = -9999; });

  function draw() {
    ctx.clearRect(0, 0, W, H);

    // ── Draw nebula clouds ──────────────────────────
    nebulae.forEach(n => {
      n.x += n.driftX; n.y += n.driftY;
      if (n.x < -n.r) n.x = W + n.r;
      if (n.x > W + n.r) n.x = -n.r;
      if (n.y < -n.r) n.y = H + n.r;
      if (n.y > H + n.r) n.y = -n.r;

      const grd = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
      grd.addColorStop(0, `rgba(${n.color[0]},${n.color[1]},${n.color[2]},${n.alpha.toFixed(3)})`);
      grd.addColorStop(0.5, `rgba(${n.color[0]},${n.color[1]},${n.color[2]},${(n.alpha*0.4).toFixed(3)})`);
      grd.addColorStop(1, `rgba(${n.color[0]},${n.color[1]},${n.color[2]},0)`);
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fillStyle = grd;
      ctx.fill();
    });

    // ── Draw background stars (twinkle) ────────────
    bgStars.forEach(s => {
      s.twinklePhase += s.twinkleSpeed;
      const tw = 0.6 + Math.sin(s.twinklePhase) * 0.4;
      const a = s.alpha * tw;
      const [r, g, b] = s.color;

      // Bigger stars get a glow
      if (s.r > 0.6) {
        const grd = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 2.8);
        grd.addColorStop(0, `rgba(${r},${g},${b},${(a * 0.6).toFixed(3)})`);
        grd.addColorStop(0.4, `rgba(${r},${g},${b},${(a * 0.2).toFixed(3)})`);
        grd.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r * 2.8, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r},${g},${b},${a.toFixed(3)})`;
      ctx.fill();
    });

    // ── Draw shooting stars ─────────────────────────
    maybeAddShooter();
    shooters = shooters.filter(s => s.life > 0);
    shooters.forEach(s => {
      const tailX = s.x - s.vx * (s.len / 12);
      const tailY = s.y - s.vy * (s.len / 12);
      const grd = ctx.createLinearGradient(s.x, s.y, tailX, tailY);
      grd.addColorStop(0, `rgba(200,215,255,${(s.life * 0.9).toFixed(2)})`);
      grd.addColorStop(0.3, `rgba(124,156,255,${(s.life * 0.4).toFixed(2)})`);
      grd.addColorStop(1, `rgba(124,156,255,0)`);
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(tailX, tailY);
      ctx.strokeStyle = grd;
      ctx.lineWidth = s.life * 1.5;
      ctx.stroke();
      s.x += s.vx; s.y += s.vy;
      s.life -= s.decay;
    });

    // ── Draw interactive grid dots ──────────────────
    const RADIUS = 170;
    dots.forEach(dot => {
      dot.twinkle += dot.twinkleSpeed;
      const waveY = Math.sin((dot.ix * 0.28) + count + dot.phase) * 11 +
                    Math.sin((dot.iy * 0.45) + count * 0.7) * 7;
      const waveX = Math.sin((dot.iy * 0.20) + count * 0.5 + dot.phase) * 4;

      // Mouse repulsion
      const dx = dot.bx - mx, dy = (dot.by + waveY) - my;
      const dist = Math.sqrt(dx * dx + dy * dy);
      let pushX = 0, pushY = 0;
      if (dist < RADIUS && dist > 0) {
        const force = Math.pow(1 - dist / RADIUS, 1.6);
        const angle = Math.atan2(dy, dx);
        pushX = Math.cos(angle) * force * 58;
        pushY = Math.sin(angle) * force * 58;
      }
      dot.ox += (pushX - dot.ox) * 0.10;
      dot.oy += (pushY - dot.oy) * 0.10;

      const x = dot.bx + waveX + dot.ox;
      const y = dot.by + waveY + dot.oy;

      // Twinkle + pulse size
      const twinkle = 0.7 + Math.sin(dot.twinkle) * 0.3;
      const pulse   = 1 + Math.sin((dot.ix + dot.iy) * 0.5 + count * 1.2 + dot.phase) * 0.22;
      const size    = dot.baseSize * pulse * twinkle;

      // Opacity — radial fade + mouse boost
      const cx2 = (dot.bx / W) - 0.5, cy2 = (dot.by / H) - 0.5;
      const fromCenter = Math.sqrt(cx2*cx2 + cy2*cy2);
      const baseAlpha  = Math.max(0.04, 0.38 - fromCenter * 0.72);
      const mBoost     = dist < RADIUS ? Math.pow(1 - dist / RADIUS, 1.5) * 0.6 : 0;
      const alpha      = Math.min(0.92, baseAlpha + mBoost);

      const [r, g, b] = dot.color;

      // Glow halo on accent dots + mouse-near
      if (dot.isAccent || mBoost > 0.08) {
        const gr = dot.isAccent ? 4 : 3;
        const ga = dot.isAccent ? 0.16 : mBoost * 0.28;
        const grd = ctx.createRadialGradient(x, y, 0, x, y, size * gr);
        grd.addColorStop(0, `rgba(${r},${g},${b},${ga.toFixed(3)})`);
        grd.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.beginPath();
        ctx.arc(x, y, size * gr, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(x, y, Math.max(0.3, size), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r},${g},${b},${alpha.toFixed(2)})`;
      ctx.fill();
    });

    count += 0.013;
    requestAnimationFrame(draw);
  }

  window.addEventListener('resize', resize);
  resize();
  draw();
})();

// ===== Year =====
const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = new Date().getFullYear();

document.addEventListener("DOMContentLoaded", () => {

  // ===== Neural Network Canvas (Hero) =====
  (function initHeroCanvas() {
    const canvas = document.getElementById("hero-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    let W, H;
    const N = 55;
    const CONNECT = 130;
    const particles = [];

    const resize = () => {
      const rect = canvas.parentElement.getBoundingClientRect();
      W = canvas.width = rect.width;
      H = canvas.height = rect.height;
  };
    window.addEventListener("resize", resize);
    resize();
  
    class Dot {
      constructor() { this.reset(true); }
      reset(random) {
        this.x = random ? Math.random() * W : (Math.random() > .5 ? 0 : W);
        this.y = random ? Math.random() * H : Math.random() * H;
        this.vx = (Math.random() - .5) * .45;
        this.vy = (Math.random() - .5) * .45;
        this.r = Math.random() * 1.8 + .8;
        // Alternate between orange, blue, purple
        const palette = [
          "rgba(124,156,255,",
          "rgba(255,148,90,",
          "rgba(170,120,255,"
        ];
        this.color = palette[Math.floor(Math.random() * palette.length)];
      }
      update() {
        this.x += this.vx;
        this.y += this.vy;
        if (this.x < -20 || this.x > W + 20 || this.y < -20 || this.y > H + 20) this.reset(false);
      }
    }

    for (let i = 0; i < N; i++) particles.push(new Dot());

    let raf;
    const draw = () => {
      ctx.clearRect(0, 0, W, H);

      // connections
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < CONNECT) {
            const a = (1 - d / CONNECT) * .18;
            ctx.strokeStyle = `rgba(124,156,255,${a})`;
            ctx.lineWidth = .8;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      // dots
      particles.forEach(p => {
        p.update();
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color + ".50)";
        ctx.fill();
      });

      raf = requestAnimationFrame(draw);
    };
    draw();
  })();

  // ===== Scroll Reveal =====
  const revealTargets = document.querySelectorAll(
    ".hero-text, .stage, .section, .cap-premium-section, .project-grid, .slider, .logo-box, .contact"
  );
  revealTargets.forEach(el => el.classList.add("reveal"));
  const revealIO = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add("in");
      } else {
        e.target.classList.remove("in");
      }
    });
  }, { threshold: 0.10 });
  revealTargets.forEach(el => revealIO.observe(el));

  // ===== Slot Machine Ticker Counters =====
  const statNums = document.querySelectorAll(".stat-num[data-target]");

  function runSlotTicker(el, target) {
    const SPIN_MS   = 1400;  // total duration
    const SETTLE_MS = 300;   // time to hold on target
    let frame;

    // Phase 1: rapid random spin
    const startSpin = performance.now();
    const spinDur = SPIN_MS * 0.65;

    // Phase 2: slow deceleration toward target
    const decelDur = SPIN_MS * 0.35;

    const numbers = Array.from({ length: 10 }, (_, i) => i);

    function spin(now) {
      const elapsed = now - startSpin;

      if (elapsed < spinDur) {
        // Fast random cycling
        const rnd = Math.floor(Math.random() * 10);
        el.textContent = rnd;
        el.style.transform = `translateY(${(Math.random() - 0.5) * 4}px)`;
        el.style.filter = `blur(${0.5 + Math.random()}px)`;
        frame = requestAnimationFrame(spin);

      } else if (elapsed < SPIN_MS) {
        // Decelerate — interpolate toward target
        const t = (elapsed - spinDur) / decelDur;
        const eased = 1 - Math.pow(1 - t, 4); // ease-out quart
        // Show values near target
        const range = Math.max(1, Math.round((1 - eased) * 7));
        const offset = Math.floor((Math.random() - 0.5) * range);
        const shown = Math.max(0, Math.min(9, target + offset));
        el.textContent = shown;
        el.style.transform = `translateY(${(1 - eased) * 3}px)`;
        el.style.filter = `blur(${(1 - eased) * 0.8}px)`;
        frame = requestAnimationFrame(spin);

      } else {
        // Snap to target with glow flash
        el.textContent = target;
        el.style.transform = 'translateY(0)';
        el.style.filter = 'none';

        // Landing glow pulse
        el.style.textShadow = '0 0 24px rgba(124,156,255,0.9), 0 0 8px rgba(255,148,90,0.6)';
        el.style.transition = 'text-shadow 0.5s ease';
        setTimeout(() => {
          el.style.textShadow = '';
        }, 500);
      }
    }

    frame = requestAnimationFrame(spin);
  }

  const tickerIO = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const target = parseInt(el.getAttribute("data-target"), 10);
      runSlotTicker(el, target);
      tickerIO.unobserve(el);
    });
  }, { threshold: 0.6 });
  statNums.forEach(el => tickerIO.observe(el));

  // ===== Premium 3D Tilt =====
  const tiltEls = document.querySelectorAll("[data-tilt]");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  tiltEls.forEach((el) => {
    let bounds = null;
    const onMove = (e) => {
      if (reducedMotion) return;
      if (!bounds) bounds = el.getBoundingClientRect();
      const x = e.clientX - bounds.left;
      const y = e.clientY - bounds.top;
      const cx = bounds.width / 2, cy = bounds.height / 2;
      const rx = ((y - cy) / cy) * -6;
      const ry = ((x - cx) / cx) * 6;
      el.style.transition = "transform 40ms linear";
      el.style.transform = `translateY(-6px) rotateX(${rx}deg) rotateY(${ry}deg)`;
    };
    const onLeave = () => {
      el.style.transition = "transform 260ms ease";
      el.style.transform = "translateY(0) rotateX(0) rotateY(0)";
      bounds = null;
    };
    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
  });


// ======================================================
// DYNAMIC INTERACTIVE UPGRADES
// ======================================================

// ===== SCROLL PROGRESS BAR =====
(function initScrollProgress() {
  const bar = document.getElementById("scrollProgress");
  if (!bar) return;
  window.addEventListener("scroll", () => {
    const scrollTop = window.scrollY;
    const docH = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.width = (scrollTop / docH * 100) + "%";
  }, { passive: true });
})();

// ===== CUSTOM CURSOR =====
(function initCursor() {
  const dot  = document.getElementById("cursorDot");
  const ring = document.getElementById("cursorRing");
  if (!dot || !ring) return;
  if (window.matchMedia("(pointer: coarse)").matches) {
    dot.style.display = "none";
    ring.style.display = "none";
    return;
  }

  let mouseX = 0, mouseY = 0;
  let ringX = 0, ringY = 0;
  let raf;

  document.addEventListener("mousemove", (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    dot.style.left = mouseX + "px";
    dot.style.top  = mouseY + "px";
  });

  const animateRing = () => {
    ringX += (mouseX - ringX) * 0.14;
    ringY += (mouseY - ringY) * 0.14;
    ring.style.left = ringX + "px";
    ring.style.top  = ringY + "px";
    raf = requestAnimationFrame(animateRing);
  };
  animateRing();

  // Hover state on interactive elements
  const interactives = document.querySelectorAll("a, button, [data-tilt], .tcard, .cap-item");
  interactives.forEach(el => {
    el.addEventListener("mouseenter", () => ring.classList.add("hovering"));
    el.addEventListener("mouseleave", () => ring.classList.remove("hovering"));
  });

  document.addEventListener("mousedown", () => ring.classList.add("clicking"));
  document.addEventListener("mouseup",   () => ring.classList.remove("clicking"));
})();

// ===== MOUSE SPOTLIGHT =====
(function initMouseSpotlight() {
  const spotlight = document.getElementById("mouseSpotlight");
  if (!spotlight) return;
  if (window.matchMedia("(pointer: coarse)").matches) return;

  let x = window.innerWidth / 2;
  let y = window.innerHeight / 2;
  let spX = x, spY = y;

  document.addEventListener("mousemove", (e) => {
    x = e.clientX; y = e.clientY;
  });

  const animate = () => {
    spX += (x - spX) * 0.08;
    spY += (y - spY) * 0.08;
    spotlight.style.left = spX + "px";
    spotlight.style.top  = spY + "px";
    requestAnimationFrame(animate);
  };
  animate();
})();

// ===== MAGNETIC BUTTONS =====
(function initMagneticButtons() {
  const magnets = document.querySelectorAll(".magnetic");
  if (window.matchMedia("(pointer: coarse)").matches) return;

  magnets.forEach(btn => {
    btn.addEventListener("mousemove", (e) => {
      const rect = btn.getBoundingClientRect();
      const cx = rect.left + rect.width  / 2;
      const cy = rect.top  + rect.height / 2;
      const dx = (e.clientX - cx) * 0.35;
      const dy = (e.clientY - cy) * 0.35;
      btn.style.transform = `translate(${dx}px, ${dy}px)`;
    });
    btn.addEventListener("mouseleave", () => {
      btn.style.transform = "translate(0, 0)";
    });
  });
})();

// ===== TEXT SCRAMBLE on H2s =====
(function initScramble() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%&";

  class Scrambler {
    constructor(el) {
      this.el = el;
      this.original = el.textContent;
      this.running = false;
      this.interval = null;
    }
    run() {
      if (this.running) return;
      this.running = true;
      let iter = 0;
      const orig = this.original;
      clearInterval(this.interval);
      this.interval = setInterval(() => {
        this.el.textContent = orig
          .split("")
          .map((ch, i) => {
            if (ch === " ") return " ";
            if (i < iter) return orig[i];
            return chars[Math.floor(Math.random() * chars.length)];
          })
          .join("");
        iter += 0.6;
        if (iter >= orig.length) {
          clearInterval(this.interval);
          this.el.textContent = orig;
          this.running = false;
        }
      }, 28);
    }
    reset() {
      this.running = false;
      clearInterval(this.interval);
    }
  }

  const scrambleEls = document.querySelectorAll(".scramble-text");
  const scramblers = Array.from(scrambleEls).map(el => new Scrambler(el));

  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const idx = Array.from(scrambleEls).indexOf(entry.target);
      if (entry.isIntersecting) {
        if (scramblers[idx]) scramblers[idx].run();
      } else {
        // Reset when out of view so it fires again on re-scroll
        if (scramblers[idx]) scramblers[idx].reset();
      }
    });
  }, { threshold: 0.5 });

  scrambleEls.forEach(el => io.observe(el));
})();

// ===== SECTION MOUSE GLOW =====
(function initSectionGlow() {
  const sections = document.querySelectorAll(".section");
  sections.forEach(sec => {
    sec.addEventListener("mousemove", (e) => {
      const rect = sec.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width  * 100).toFixed(1) + "%";
      const y = ((e.clientY - rect.top)  / rect.height * 100).toFixed(1) + "%";
      sec.style.setProperty("--mouse-x", x);
      sec.style.setProperty("--mouse-y", y);
    });
  });
})();


// ======================================================
// TEAM — Staggered Grid + Hover Sync + Flip on Click
// ======================================================
(function initTeam() {
  const photoWraps = Array.from(document.querySelectorAll('.team-photo-wrap'));
  const nameRows   = Array.from(document.querySelectorAll('.team-name-row'));
  const photoGrid  = document.querySelector('.team-photo-grid');
  const nameList   = document.querySelector('.team-name-list');
  if (!photoWraps.length || !nameRows.length) return;

  const prefersTouch = window.matchMedia('(hover: none), (pointer: coarse)').matches;
  let activeMember = null;
  let activeFlipped = null;

  function setActiveMember(memberId) {
    activeMember = memberId || null;

    photoWraps.forEach(w => {
      const isMatch = !!memberId && w.dataset.member === memberId;
      w.classList.toggle('is-hovered', isMatch && !prefersTouch);
      w.classList.toggle('is-active', isMatch);
    });

    nameRows.forEach(r => {
      const isMatch = !!memberId && r.dataset.member === memberId;
      r.classList.toggle('is-hovered', isMatch && !prefersTouch);
      r.classList.toggle('is-active', isMatch);
    });

    const hasState = !!memberId;
    photoGrid && photoGrid.classList.toggle('has-hover', hasState);
    nameList  && nameList.classList.toggle('has-hover', hasState);
  }

  function clearSelection() {
    activeMember = null;
    activeFlipped = null;
    photoWraps.forEach(w => {
      w.classList.remove('is-hovered', 'is-active', 'is-flipped');
    });
    nameRows.forEach(r => {
      r.classList.remove('is-hovered', 'is-active');
    });
    photoGrid && photoGrid.classList.remove('has-hover');
    nameList  && nameList.classList.remove('has-hover');
  }

  function flipMember(memberId) {
    const wrap = photoWraps.find(w => w.dataset.member === memberId);
    if (!wrap) return;

    const alreadyFlipped = wrap.classList.contains('is-flipped');

    photoWraps.forEach(w => {
      if (w !== wrap) w.classList.remove('is-flipped');
    });

    if (alreadyFlipped) {
      wrap.classList.remove('is-flipped');
      activeFlipped = null;
    } else {
      wrap.classList.add('is-flipped');
      activeFlipped = wrap;
    }

    setActiveMember(memberId);
  }

  function handleMemberTap(memberId) {
    if (!memberId) return;
    if (activeMember === memberId && activeFlipped && activeFlipped.dataset.member === memberId) {
      const wrap = photoWraps.find(w => w.dataset.member === memberId);
      wrap && wrap.classList.remove('is-flipped');
      activeFlipped = null;
      setActiveMember(memberId);
      return;
    }
    flipMember(memberId);
  }

  photoWraps.forEach(wrap => {
    wrap.addEventListener('mouseenter', () => {
      if (prefersTouch) return;
      if (activeFlipped && activeFlipped !== wrap) return;
      setActiveMember(wrap.dataset.member);
    });

    wrap.addEventListener('mouseleave', () => {
      if (prefersTouch) return;
      if (activeFlipped) {
        setActiveMember(activeFlipped.dataset.member);
      } else {
        clearSelection();
      }
    });

    wrap.addEventListener('click', () => handleMemberTap(wrap.dataset.member));
  });

  nameRows.forEach(row => {
    row.addEventListener('mouseenter', () => {
      if (prefersTouch) return;
      if (activeFlipped) return;
      setActiveMember(row.dataset.member);
    });

    row.addEventListener('mouseleave', () => {
      if (prefersTouch) return;
      if (activeFlipped) {
        setActiveMember(activeFlipped.dataset.member);
      } else {
        clearSelection();
      }
    });

    row.addEventListener('click', () => handleMemberTap(row.dataset.member));
  });

  document.addEventListener('click', (event) => {
    const insideTeam = event.target.closest('.team-photo-wrap, .team-name-row');
    if (!insideTeam && prefersTouch) {
      clearSelection();
    }
  });
})();


// ======================================================
// CAPABILITIES — tap to flip on touch devices
// ======================================================
(function initCapabilityCards() {
  const cards = Array.from(document.querySelectorAll('.cap-flip-wrap'));
  if (!cards.length) return;

  const prefersTouch = window.matchMedia('(hover: none), (pointer: coarse)').matches;
  if (!prefersTouch) return;

  cards.forEach(card => {
    card.addEventListener('click', () => {
      const isFlipped = card.classList.contains('is-flipped');
      cards.forEach(other => {
        if (other !== card) other.classList.remove('is-flipped');
      });
      card.classList.toggle('is-flipped', !isFlipped);
    });
  });

  document.addEventListener('click', (event) => {
    if (!event.target.closest('.cap-flip-wrap')) {
      cards.forEach(card => card.classList.remove('is-flipped'));
    }
  });
})();


// ======================================================
// ORBITAL PROJECT — Radial rotating nodes around MindEcho
// ======================================================
(function initOrbital() {
  const stage   = document.getElementById('orbitalStage');
  const panel   = document.getElementById('orbitalPanel');
  const pClose  = document.getElementById('orbitalPanelClose');
  const pTitle  = document.getElementById('orbitalPanelTitle');
  const pDesc   = document.getElementById('orbitalPanelDesc');
  const pStatus = document.getElementById('orbitalPanelStatus');
  const pTags   = document.getElementById('orbitalPanelTags');
  if (!stage) return;

  // ── Node data ──────────────────────────────────────
  const NODES = [
    {
      id: 0,
      label: 'Core Idea',
      icon: '🧠',
      color: 'blue',
      status: 'Non-diagnostic',
      title: 'Early Pattern Insights — Not a Diagnosis',
      desc: 'MindEcho translates attention and behaviour signals into structured, easy-to-read insights for schools and parents — never replacing clinical judgement, always supporting it.',
      tags: ['Ethics First', 'Privacy-First', 'Non-diagnostic'],
      energy: 100
    },
    {
      id: 1,
      label: 'Eye Tracking',
      icon: '👁️',
      color: 'purple',
      status: 'Computer Vision',
      title: 'Attention Analysis with Gaze Patterns',
      desc: 'Real-time gaze tracking surfaces fixation duration, saccadic movement, and distraction frequency — visualised as clean timelines rather than raw signals.',
      tags: ['OpenCV', 'MediaPipe', '45% weight'],
      energy: 45
    },
    {
      id: 2,
      label: 'Body Movement',
      icon: '🤸',
      color: 'orange',
      status: 'Computer Vision',
      title: 'Behaviour Signals Captured in Real-Time',
      desc: 'Frame-differencing computer vision detects restlessness cues — posture shifts, fidgeting, engagement breaks — without any wearables or invasive hardware.',
      tags: ['Frame Differencing', 'CV Pipeline', '20% weight'],
      energy: 20
    },
    {
      id: 3,
      label: 'Speech NLP',
      icon: '🎙️',
      color: 'pink',
      status: 'NLP',
      title: 'Speech Analysis & Linguistic Signals',
      desc: 'Natural language processing analyses speech pace, coherence, and response structure to surface behavioural patterns that correlate with attention profiles.',
      tags: ['NLP', 'Audio Processing', '35% weight'],
      energy: 35
    },
    {
      id: 4,
      label: 'ML Models',
      icon: '⚡',
      color: 'blue',
      status: 'AI Engine',
      title: 'Model Comparisons to Choose the Best Fit',
      desc: 'GRU, Random Forest, and XGBoost are evaluated head-to-head using Accuracy, Precision, Recall, and F1 — the best performer is selected for stability and interpretability.',
      tags: ['GRU', 'XGBoost', 'Random Forest', 'F1 Score'],
      energy: 85
    },
    {
      id: 5,
      label: 'Scoring',
      icon: '🎯',
      color: 'purple',
      status: 'Assessment Engine',
      title: 'Weighted Confidence Scoring System',
      desc: 'A confidence gate requires at least two modules to reach Medium+ before any High or Medium classification is issued — making results reliable, not reactive.',
      tags: ['Confidence Gate', 'Weighted Scoring', 'Eye 45% · Speech 35% · Body 20%'],
      energy: 90
    },
  ];

  const N = NODES.length;
  let rotationAngle = 0;
  let autoRotate = true;
  let activeId = -1;
  let raf;

  // ── Get orbit radius responsively ──────────────────
  function getRadius() {
    return window.innerWidth < 700 ? 150 : 210;
  }

  // ── Build node DOM elements ────────────────────────
  const nodeEls = [];
  const connEls = [];

  NODES.forEach((node, i) => {
    // Node
    const el = document.createElement('div');
    el.className = 'orb-node';
    el.dataset.color = node.color;
    el.innerHTML = `
      <div class="orb-node-btn">${node.icon}</div>
      <span class="orb-node-label">${node.label}</span>
    `;
    el.addEventListener('click', (e) => { e.stopPropagation(); toggleNode(i); });
    stage.appendChild(el);
    nodeEls.push(el);

    // Connector line
    const conn = document.createElement('div');
    conn.className = 'orb-connector';
    stage.appendChild(conn);
    connEls.push(conn);
  });

  // ── Position calculation ───────────────────────────
  function positionNodes() {
    const cx = stage.offsetWidth  / 2;
    const cy = stage.offsetHeight / 2;
    const R  = getRadius();

    NODES.forEach((_, i) => {
      const angleDeg = (i / N) * 360 + rotationAngle;
      const rad = (angleDeg * Math.PI) / 180;

      const x = cx + R * Math.cos(rad);
      const y = cy + R * Math.sin(rad);

      const el   = nodeEls[i];
      const conn = connEls[i];

      // Node — offset by half its size (~23px btn / 2 + label)
      el.style.left = (x - 23) + 'px';
      el.style.top  = (y - 23) + 'px';

      // Depth cue
      const depth = (1 + Math.sin(rad)) / 2; // 0..1
      el.style.opacity  = activeId === i ? '1' : (0.45 + 0.55 * depth).toFixed(2);
      el.style.zIndex   = Math.round(5 + 10 * depth);
      el.style.transform = `scale(${(0.82 + 0.18 * depth).toFixed(3)})`;

      // Connector line from center to node
      const dx = x - cx;
      const dy = y - cy;
      const len = Math.sqrt(dx*dx + dy*dy) - 55; // stop before logo
      const angle = Math.atan2(dy, dx) * 180 / Math.PI;
      conn.style.left   = cx + 'px';
      conn.style.top    = cy + 'px';
      conn.style.width  = len + 'px';
      conn.style.transform = `rotate(${angle}deg)`;
      conn.classList.toggle('is-active', activeId === i);
    });
  }

  // ── Rotation loop ──────────────────────────────────
  function tick() {
    if (autoRotate) rotationAngle = (rotationAngle + 0.18) % 360;
    positionNodes();
    raf = requestAnimationFrame(tick);
  }
  tick();

  // ── Toggle node ────────────────────────────────────
  function toggleNode(i) {
    if (activeId === i) {
      closePanel();
      return;
    }
    activeId = i;
    autoRotate = false;
    stage.classList.add('has-active');
    nodeEls.forEach((el, idx) => el.classList.toggle('is-active', idx === i));

    // Snap node to top (270deg)
    const targetAngle = 270 - (i / N) * 360;
    rotationAngle = ((targetAngle % 360) + 360) % 360;

    openPanel(NODES[i]);
  }

  function openPanel(node) {
    pTitle.textContent  = node.title;
    pDesc.textContent   = node.desc;
    pStatus.textContent = node.status;
    pTags.innerHTML = node.tags.map(t => `<span class="orbital-panel-tag">${t}</span>`).join('');
    panel.classList.add('is-open');
  }

  function closePanel() {
    activeId = -1;
    autoRotate = true;
    stage.classList.remove('has-active');
    nodeEls.forEach(el => el.classList.remove('is-active'));
    panel.classList.remove('is-open');
  }

  pClose && pClose.addEventListener('click', closePanel);
  stage.addEventListener('click', (e) => {
    if (e.target === stage) closePanel();
  });

})();
});
// ======================================================
// SPLINE WATERMARK REMOVAL — shadow DOM access
// ======================================================
(function removeSplineWatermark() {
  function tryHide() {
    const viewer = document.querySelector('.hero-spline');
    if (!viewer) return;
    // Try shadow DOM
    const shadow = viewer.shadowRoot;
    if (shadow) {
      // Target all possible watermark selectors
      const selectors = ['#logo', '.logo', 'a[href*="spline"]', '[class*="logo"]', '[id*="logo"]', 'a[target="_blank"]'];
      selectors.forEach(sel => {
        shadow.querySelectorAll(sel).forEach(el => {
          el.style.cssText = 'display:none!important;opacity:0!important;pointer-events:none!important;';
        });
      });
    }
  }
  // Try at multiple points — Spline loads async
  [500, 1500, 3000, 5000].forEach(ms => setTimeout(tryHide, ms));
})();

// ======================================================
// BUTTON RIPPLE — premium ink-drop on click
// ======================================================
(function initRipple() {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.button, .pill');
    if (!btn) return;

    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 1.8;
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top  - size / 2;

    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    ripple.style.cssText = `
      width: ${size}px;
      height: ${size}px;
      left: ${x}px;
      top: ${y}px;
    `;

    btn.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove());
  });
})();

// ======================================================
// MOBILE NAV — hamburger toggle
// ======================================================
(function initMobileNav() {
  const hamburger = document.getElementById('navHamburger');
  const nav       = document.querySelector('.global-nav');
  const links     = document.querySelectorAll('.global-links a');
  if (!hamburger || !nav) return;

  hamburger.addEventListener('click', () => {
    nav.classList.toggle('nav-open');
    // Animate hamburger → X
    const spans = hamburger.querySelectorAll('span');
    const isOpen = nav.classList.contains('nav-open');
    document.body.style.overflow = isOpen ? 'hidden' : '';
    spans[0].style.transform = isOpen ? 'translateY(7px) rotate(45deg)' : '';
    spans[1].style.opacity   = isOpen ? '0' : '1';
    spans[2].style.transform = isOpen ? 'translateY(-7px) rotate(-45deg)' : '';
  });

  // Close on link click
  links.forEach(link => {
    link.addEventListener('click', () => {
      nav.classList.remove('nav-open');
      document.body.style.overflow = '';
      hamburger.querySelectorAll('span').forEach(s => { s.style.transform = ''; s.style.opacity = ''; });
    });
  });
})();

window.addEventListener('resize', () => {
  if (window.innerWidth > 768) {
    const nav = document.querySelector('.global-nav');
    const hamburger = document.getElementById('navHamburger');
    nav && nav.classList.remove('nav-open');
    document.body.style.overflow = '';
    hamburger?.querySelectorAll('span').forEach(s => {
      s.style.transform = '';
      s.style.opacity = '';
    });
  }
});
