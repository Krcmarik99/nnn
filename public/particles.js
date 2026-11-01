'use strict';

// Fyzikálne častice na celoobrazovkovom plátne: prach, dym, iskry, striekance,
// ohňostroj a konfety. Každá častica má rýchlosť, gravitáciu, odpor vzduchu a život.
const PFX = (() => {
  const reduced = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let cv = null, ctx = null, dpr = 1, running = false, last = 0;
  const parts = [];
  const sprites = new Map();

  function ensure() {
    if (cv) return true;
    try {
      cv = document.createElement('canvas');
      cv.id = 'pfx';
      document.body.appendChild(cv);
      ctx = cv.getContext('2d');
      resize();
      window.addEventListener('resize', resize);
      return true;
    } catch { cv = null; return false; }
  }
  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = innerWidth * dpr;
    cv.height = innerHeight * dpr;
  }
  // mäkká guľa (radiálny prechod) – predkreslená pre každú farbu
  function soft(color) {
    if (sprites.has(color)) return sprites.get(color);
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, color);
    gr.addColorStop(0.45, color.replace(/[\d.]+\)$/, m => (parseFloat(m) * 0.55) + ')'));
    gr.addColorStop(1, color.replace(/[\d.]+\)$/, '0)'));
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    sprites.set(color, c);
    return c;
  }
  const R = (a, b) => a + Math.random() * (b - a);
  // '#rrggbb' → 'rgba(r,g,b,1)' (mäkké častice potrebujú rgba)
  const rgba = c => {
    if (!c || c[0] !== '#') return c;
    const h = c.length === 4 ? c.slice(1).split('').map(x => x + x).join('') : c.slice(1);
    return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},1)`;
  };

  function add(p) {
    if (!ensure()) return;
    parts.push(Object.assign({ vx: 0, vy: 0, g: 0, drag: 0, age: 0, life: 1, size: 4, grow: 0, rot: 0, vr: 0, a0: 1, delay: 0 }, p));
    if (!running) { running = true; last = performance.now(); requestAnimationFrame(loop); }
  }

  function loop(t) {
    const dt = Math.min(0.05, (t - last) / 1000);
    last = t;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      if (p.delay > 0) { p.delay -= dt; continue; }
      p.age += dt;
      if (p.age >= p.life) {
        if (p.onDeath) p.onDeath(p);
        parts.splice(i, 1);
        continue;
      }
      const k = Math.pow(1 - p.drag, dt * 60);
      p.vx *= k; p.vy *= k;
      p.vy += p.g * dt;
      if (p.flutter) p.vx += Math.sin(p.age * p.flutter + p.ph) * 40 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.rot += p.vr * dt;
      if (p.trail) { p.hist.push([p.x, p.y]); if (p.hist.length > p.trail) p.hist.shift(); }
      const life = p.age / p.life;
      const alpha = p.a0 * (p.fadeIn ? Math.min(1, p.age / p.fadeIn) : 1) * (1 - Math.pow(life, p.fadePow || 1.6));
      const size = p.size + p.grow * p.age;
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.globalCompositeOperation = p.add ? 'lighter' : 'source-over';
      if (p.kind === 'soft') {
        ctx.drawImage(soft(p.color), p.x - size, p.y - size, size * 2, size * 2);
      } else if (p.kind === 'spark') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.w || 1.6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        if (p.hist && p.hist.length > 1) { ctx.moveTo(p.hist[0][0], p.hist[0][1]); for (const h of p.hist) ctx.lineTo(h[0], h[1]); }
        else { ctx.moveTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03); ctx.lineTo(p.x, p.y); }
        ctx.stroke();
      } else if (p.kind === 'confetti') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.scale(1, Math.cos(p.age * p.spin));
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    if (parts.length) requestAnimationFrame(loop);
    else { running = false; ctx.clearRect(0, 0, innerWidth, innerHeight); }
  }

  // ---------- efekty ----------
  // prach pri dopade stavby (mäkké obláčiky + drobné kamienky)
  function dust(x, y, s = 1, delay = 0, tint = '190,170,130') {
    if (reduced()) return;
    for (let i = 0; i < 16; i++) {
      const a = R(Math.PI * 0.05, Math.PI * 0.95);
      const sp = R(40, 120) * s;
      add({ kind: 'soft', x: x + R(-6, 6) * s, y: y + R(-2, 2), vx: Math.cos(a) * sp * (Math.random() < 0.5 ? -1 : 1), vy: -Math.sin(a) * sp * 0.35,
        drag: 0.07, g: -8, size: R(4, 7) * s, grow: R(14, 26) * s, life: R(0.8, 1.4), a0: 0.55, color: `rgba(${tint},0.75)`, delay });
    }
    for (let i = 0; i < 10; i++) {
      add({ kind: 'dot', x, y: y - 2, vx: R(-90, 90) * s, vy: R(-160, -60) * s, g: 520, drag: 0.01, size: R(0.8, 1.8) * s,
        life: R(0.4, 0.7), color: 'rgba(90,70,50,1)', delay, fadePow: 4 });
    }
  }
  // dym stúpajúci nahor
  function smoke(x, y, s = 1, delay = 0) {
    if (reduced()) return;
    for (let i = 0; i < 10; i++) {
      add({ kind: 'soft', x: x + R(-5, 5), y, vx: R(-15, 15), vy: R(-45, -20) * s, drag: 0.02, g: -10,
        size: R(5, 8) * s, grow: R(14, 24) * s, life: R(1.2, 2), a0: 0.4, color: 'rgba(70,70,75,0.8)', delay: delay + i * 0.04, fadeIn: 0.2 });
    }
  }
  // iskry s gravitáciou (zlaté)
  function sparks(x, y, s = 1, delay = 0, color = '255,214,110') {
    if (reduced()) return;
    for (let i = 0; i < 26; i++) {
      const a = R(-Math.PI * 0.95, -Math.PI * 0.05);
      const sp = R(120, 280) * s;
      add({ kind: 'spark', add: true, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 420, drag: 0.03,
        life: R(0.5, 0.95), color: `rgba(${color},1)`, w: R(1, 2), delay, fadePow: 2 });
    }
    add({ kind: 'soft', add: true, x, y, size: 10 * s, grow: 120 * s, life: 0.35, a0: 0.7, color: `rgba(${color},0.9)`, delay });
  }
  // striekance vody
  function splash(x, y, s = 1, delay = 0) {
    if (reduced()) return;
    for (let i = 0; i < 24; i++) {
      add({ kind: 'dot', x: x + R(-6, 6), y, vx: R(-80, 80) * s, vy: R(-230, -90) * s, g: 620, drag: 0.01,
        size: R(1, 2.4) * s, life: R(0.5, 0.9), color: `rgba(${R(170, 220) | 0},${R(225, 245) | 0},255,1)`, delay, fadePow: 3 });
    }
    for (let i = 0; i < 6; i++) {
      add({ kind: 'soft', x: x + R(-10, 10), y, vx: R(-20, 20), vy: R(-10, 0), size: 5 * s, grow: 30 * s, life: 0.8, a0: 0.45, color: 'rgba(220,240,255,0.8)', delay });
    }
  }
  // ohňostroj: raketa vyletí a vybuchne
  function firework(x, y, color, onBoom) {
    if (reduced()) return;
    color = rgba(color);
    const sx = x + R(-60, 60), sy = innerHeight + 10;
    const T = R(0.9, 1.25);
    // y = sy + vy·T + ½·g·T²  →  vy = (y − sy)/T − ½·g·T
    add({ kind: 'spark', add: true, x: sx, y: sy, vx: (x - sx) / T, vy: (y - sy) / T - 80 * T, g: 160, drag: 0,
      life: T, color: 'rgba(255,230,180,1)', w: 2, trail: 8, hist: [], fadePow: 8,
      onDeath: p => {
        if (onBoom) onBoom();
        const n = 70;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + R(-0.05, 0.05);
          const sp = R(140, 260);
          add({ kind: 'spark', add: true, x: p.x, y: p.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 110, drag: 0.035,
            life: R(1.1, 1.8), color, w: R(1.4, 2.4), trail: 5, hist: [], fadePow: 2.2 });
        }
        for (let i = 0; i < 24; i++) {
          add({ kind: 'dot', add: true, x: p.x, y: p.y, vx: R(-120, 120), vy: R(-120, 120), g: 60, drag: 0.04,
            size: R(0.8, 1.6), life: R(1.4, 2.2), color: 'rgba(255,250,230,1)', fadePow: 1.2, twinkle: true });
        }
        add({ kind: 'soft', add: true, x: p.x, y: p.y, size: 20, grow: 260, life: 0.45, a0: 0.55, color });
      } });
  }
  // konfety padajúce zhora
  function confetti(n = 140, colors = ['#f2c14e', '#e4572e', '#2e86de', '#3bb273', '#9b5de5', '#ffffff']) {
    if (reduced()) return;
    for (let i = 0; i < n; i++) {
      add({ kind: 'confetti', x: R(0, innerWidth), y: R(-120, -10), vx: R(-40, 40), vy: R(60, 160), g: 60, drag: 0.02,
        size: R(7, 12), rot: R(0, 6), vr: R(-6, 6), spin: R(4, 10), flutter: R(2, 5), ph: R(0, 6),
        life: R(3.5, 5.5), color: colors[i % colors.length], delay: R(0, 1.2), fadePow: 6 });
    }
  }
  function clear() { parts.length = 0; }

  return { dust, smoke, sparks, splash, firework, confetti, clear };
})();
