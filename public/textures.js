'use strict';

// Procedurálne (realistické) textúry polí – vytvoria sa raz pri načítaní stránky
// na canvase a mapa ich používa ako obrázky. Žiadne externé súbory.
const TEXTURES = (() => { try {
  const N = 256; // rozlíšenie textúry v pixeloch (pole má 96 jednotiek)

  const rng = seed => () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;

  // periodický value noise → textúry sa dajú dláždiť bez švov
  function makeNoise(seed) {
    const rnd = rng(seed);
    const vals = new Float32Array(256).map(() => rnd());
    const p = Array.from({ length: 256 }, (_, i) => i);
    for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
    const perm = new Uint8Array(512);
    for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
    const m = (a, per) => ((a % per) + per) % per;
    const v = (x, y, per) => vals[perm[perm[m(x, per) & 255] + (m(y, per) & 255)]];
    return (x, y, per) => {
      const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
      const u = xf * xf * (3 - 2 * xf), w = yf * yf * (3 - 2 * yf);
      const a = v(xi, yi, per), b = v(xi + 1, yi, per), c = v(xi, yi + 1, per), d = v(xi + 1, yi + 1, per);
      return a + (b - a) * u + (c - a) * w + (a - b - c + d) * u * w;
    };
  }
  const fbm = (n, u, v, base, oct = 5) => {
    let s = 0, a = 1, t = 0, per = base;
    for (let o = 0; o < oct; o++) { s += a * n(u * per, v * per, per); t += a; a *= 0.5; per *= 2; }
    return s / t;
  };
  const clamp = (x, a = 0, b = 255) => Math.max(a, Math.min(b, x));
  const mix = (c1, c2, t) => [0, 1, 2].map(i => c1[i] + (c2[i] - c1[i]) * t);
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  function canvas(draw) {
    const c = document.createElement('canvas');
    c.width = c.height = N;
    draw(c.getContext('2d'));
    return c;
  }
  function pixels(ctx, f) {
    const img = ctx.createImageData(N, N);
    const d = img.data;
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const c = f(x / N, y / N, x, y);
        const i = (y * N + x) * 4;
        d[i] = clamp(c[0]); d[i + 1] = clamp(c[1]); d[i + 2] = clamp(c[2]); d[i + 3] = c.length > 3 ? clamp(c[3]) : 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }
  // Tieňovanie reliéfu (svetlo zľava zhora)
  function hillshade(H, k) {
    const L = [-0.55, -0.6, 0.58];
    const S = new Float32Array(N * N);
    const at = (x, y) => H[((y + N) % N) * N + ((x + N) % N)];
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const dx = (at(x + 1, y) - at(x - 1, y)) * k;
        const dy = (at(x, y + 1) - at(x, y - 1)) * k;
        const len = Math.hypot(dx, dy, 1);
        S[y * N + x] = (-dx * L[0] - dy * L[1] + L[2]) / len;
      }
    }
    return S;
  }
  function heights(f) {
    const H = new Float32Array(N * N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) H[y * N + x] = f(x / N, y / N);
    return H;
  }
  // Voronoi – vzdialenosť k najbližšiemu a druhému najbližšiemu bodu (periodicky)
  function voronoi(points) {
    return (x, y) => {
      let d1 = 1e9, d2 = 1e9, idx = 0;
      for (let i = 0; i < points.length; i++) {
        let dx = Math.abs(x - points[i][0]); dx = Math.min(dx, N - dx);
        let dy = Math.abs(y - points[i][1]); dy = Math.min(dy, N - dy);
        const d = Math.hypot(dx, dy);
        if (d < d1) { d2 = d1; d1 = d; idx = i; } else if (d < d2) d2 = d;
      }
      return [d1, d2, idx];
    };
  }

  // ---------- jednotlivé terény ----------
  const T = {};

  T.les = canvas(ctx => {
    const n = makeNoise(11);
    pixels(ctx, (u, v) => {
      const t = fbm(n, u, v, 6);
      const s = fbm(n, u, v, 40, 2);
      return mix([20, 44, 26], [58, 88, 40], t).map(c => c * (0.85 + s * 0.3));
    });
    const r = rng(5);
    const trees = Array.from({ length: 105 }, () => ({ x: r() * N, y: r() * N, r: 7 + r() * 8, h: 95 + r() * 40, l: r() }));
    trees.sort((a, b) => a.y - b.y);
    for (const t of trees) {
      const sh = ctx.createRadialGradient(t.x + 5, t.y + 6, 0, t.x + 5, t.y + 6, t.r * 1.25);
      sh.addColorStop(0, 'rgba(0,0,0,.5)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = sh;
      ctx.beginPath(); ctx.arc(t.x + 5, t.y + 6, t.r * 1.25, 0, Math.PI * 2); ctx.fill();
    }
    for (const t of trees) {
      const g = ctx.createRadialGradient(t.x - t.r * 0.35, t.y - t.r * 0.4, t.r * 0.1, t.x, t.y, t.r);
      g.addColorStop(0, `hsl(${t.h},${42 + t.l * 15}%,${44 + t.l * 10}%)`);
      g.addColorStop(0.55, `hsl(${t.h},40%,${27 + t.l * 6}%)`);
      g.addColorStop(1, `hsl(${t.h + 10},45%,13%)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      // nepravidelný okraj koruny
      for (let a = 0; a <= 12; a++) {
        const ang = a / 12 * Math.PI * 2;
        const rr = t.r * (0.88 + 0.12 * Math.sin(ang * 3 + t.x));
        const px = t.x + Math.cos(ang) * rr, py = t.y + Math.sin(ang) * rr;
        a ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.fill();
      // drobné lístie
      ctx.fillStyle = 'rgba(190,230,150,.18)';
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.arc(t.x - t.r * 0.3 + Math.cos(i * 2.1) * t.r * 0.4, t.y - t.r * 0.3 + Math.sin(i * 2.1) * t.r * 0.35, t.r * 0.18, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  });

  T.bana = canvas(ctx => {
    const n = makeNoise(31);
    const H = heights((u, v) => {
      const r = 1 - Math.abs(2 * fbm(n, u, v, 3, 6) - 1);
      return Math.pow(r, 2.1) * 0.85 + fbm(n, u, v, 4, 4) * 0.15;
    });
    const S = hillshade(H, 38);
    pixels(ctx, (u, v, x, y) => {
      const h = H[y * N + x];
      let c = h < 0.4 ? mix([88, 70, 48], [112, 92, 70], h / 0.4) : mix([112, 92, 70], [138, 130, 120], Math.min(1, (h - 0.4) / 0.4));
      c = mix(c, [232, 236, 242], smooth(0.8, 0.9, h) * 0.85);
      const sh = 0.55 + S[y * N + x] * 0.6;
      return c.map(k => k * sh);
    });
  });

  T.lom = canvas(ctx => {
    const n = makeNoise(21);
    const H = heights((u, v) => {
      const h = fbm(n, u, v, 3, 5);
      const steps = 6;
      const f = h * steps;
      return (Math.floor(f) + smooth(0.75, 1, f % 1)) / steps;
    });
    const S = hillshade(H, 55);
    pixels(ctx, (u, v, x, y) => {
      const h = H[y * N + x];
      const sp = fbm(n, u, v, 48, 2);
      const c = mix([104, 108, 114], [184, 186, 188], h).map(k => k + (sp - 0.5) * 34);
      const sh = 0.55 + S[y * N + x] * 0.6;
      return c.map(k => k * sh);
    });
    const r = rng(9);
    for (let i = 0; i < 16; i++) {
      const w = 12 + r() * 16, h = 8 + r() * 9, x = r() * (N - w), y = r() * (N - h);
      ctx.fillStyle = 'rgba(0,0,0,.35)';
      ctx.fillRect(x + 3, y + 4, w, h);
      const g = ctx.createLinearGradient(x, y, x + w, y + h);
      g.addColorStop(0, '#e2e4e6'); g.addColorStop(1, '#9ea3a9');
      ctx.fillStyle = g;
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = 'rgba(60,64,70,.6)';
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    }
  });

  T.pole = canvas(ctx => {
    const n = makeNoise(61);
    const r = rng(17);
    const pts = Array.from({ length: 12 }, () => [r() * N, r() * N]);
    const crops = [[214, 172, 64], [196, 150, 46], [170, 162, 70], [226, 196, 104], [146, 108, 64], [205, 182, 80], [186, 140, 52]];
    const ang = pts.map(() => r() * Math.PI);
    const vor = voronoi(pts);
    pixels(ctx, (u, v, x, y) => {
      const [d1, d2, i] = vor(x, y);
      const t = fbm(n, u, v, 6, 4);
      if (d2 - d1 < 2.4) return mix([52, 78, 36], [86, 110, 52], t); // medze (živé ploty)
      const a = ang[i];
      const stripe = 0.5 + 0.5 * Math.sin((x * Math.cos(a) + y * Math.sin(a)) * 1.1);
      const shade = 0.82 + stripe * 0.2 + (t - 0.5) * 0.25;
      return crops[i % crops.length].map(c => c * shade);
    });
  });

  T.solnisko = canvas(ctx => {
    const n = makeNoise(41);
    const r = rng(23);
    const vor = voronoi(Array.from({ length: 46 }, () => [r() * N, r() * N]));
    pixels(ctx, (u, v, x, y) => {
      const t = fbm(n, u, v, 5, 5);
      const pool = fbm(n, u + 0.37, v + 0.11, 3, 4);
      if (pool < 0.4) {
        const depth = smooth(0.4, 0.25, pool);
        const c = mix([150, 214, 214], [56, 150, 176], depth);
        return c.map(k => k * (0.95 + t * 0.1));
      }
      const [d1, d2] = vor(x, y);
      let c = mix([214, 222, 226], [246, 248, 249], t);
      if (pool < 0.43) c = mix(c, [255, 255, 255], 0.7); // biely okraj jazierka
      if (d2 - d1 < 1.6) c = mix(c, [150, 164, 172], 0.75); // praskliny v soľnej kôre
      return c;
    });
  });

  function water(seed, deep, shallow, causticGain) {
    return canvas(ctx => {
      const n = makeNoise(seed);
      const n2 = makeNoise(seed + 7);
      pixels(ctx, (u, v) => {
        const t = fbm(n, u, v, 4, 5);
        const c = 1 - Math.abs(fbm(n2, u, v, 6, 3) - 0.5) * 2;
        const caustic = Math.pow(c, 14) * causticGain;
        return mix(deep, shallow, t).map(k => k + caustic);
      });
    });
  }
  T.ocean = water(51, [10, 48, 92], [26, 84, 136], 26);
  T.more = water(57, [24, 98, 140], [58, 142, 168], 34);

  T.caustic = canvas(ctx => {
    const n = makeNoise(71);
    pixels(ctx, (u, v) => {
      const c = 1 - Math.abs(fbm(n, u, v, 5, 3) - 0.5) * 2;
      return [210, 240, 255, Math.pow(c, 16) * 110];
    });
  });

  T.hmla = canvas(ctx => {
    const n = makeNoise(81);
    pixels(ctx, (u, v) => {
      const t = fbm(n, u, v, 3, 6);
      return mix([18, 32, 52], [92, 112, 140], smooth(0.38, 0.78, t));
    });
  });

  T.piesok = canvas(ctx => {
    const n = makeNoise(91);
    pixels(ctx, (u, v) => {
      const t = fbm(n, u, v, 6, 4);
      const s = fbm(n, u, v, 64, 2);
      return mix([200, 174, 122], [232, 212, 160], t).map(k => k + (s - 0.5) * 30);
    });
  });

  // canvas → blob URL (krátky odkaz, aby sa SVG pri každom prekreslení neparsovalo dlho)
  const out = {};
  for (const k in T) {
    const data = atob(T[k].toDataURL('image/png').split(',')[1]);
    const bytes = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i++) bytes[i] = data.charCodeAt(i);
    out[k] = URL.createObjectURL(new Blob([bytes], { type: 'image/png' }));
  }
  return out;
  } catch (e) {
    console.warn('Textúry sa nepodarilo vytvoriť – použijú sa jednoduché farby.', e);
    return null;
  }
})();
