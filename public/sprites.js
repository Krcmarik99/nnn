'use strict';

// Realistické sprity budov a banditu. Kreslia sa na canvas (svetlo zľava zhora,
// tiene, textúry kameňa / dreva / látky) raz pre každú farbu hráča a mapa ich
// používa ako obrázky. Súradnice sú v jednotkách mapy, počiatok = bod ukotvenia.
const SPRITES = (() => {
  try {
    const SCALE = 4; // pixelov na jednotku mapy (ostré aj na displejoch s vysokým rozlíšením)
    const cache = new Map();

    const rgb = h => {
      h = String(h).replace('#', '');
      if (h.length === 3) h = h.split('').map(c => c + c).join('');
      return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
    };
    const css = (c, a = 1) => `rgba(${c.map(v => Math.round(Math.max(0, Math.min(255, v)))).join(',')},${a})`;
    const shade = (c, f) => (f < 1 ? c.map(v => v * f) : c.map(v => v + (255 - v) * (f - 1)));
    let seed = 1;
    const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;

    function toUrl(canvas) {
      const data = atob(canvas.toDataURL('image/png').split(',')[1]);
      const bytes = new Uint8Array(data.length);
      for (let i = 0; i < data.length; i++) bytes[i] = data.charCodeAt(i);
      return URL.createObjectURL(new Blob([bytes], { type: 'image/png' }));
    }

    function make(box, draw) {
      const c = document.createElement('canvas');
      c.width = Math.ceil(box.w * SCALE);
      c.height = Math.ceil(box.h * SCALE);
      const ctx = c.getContext('2d');
      ctx.scale(SCALE, SCALE);
      ctx.translate(-box.x, -box.y);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      seed = 7;
      draw(ctx);
      return toUrl(c);
    }

    // ---------- pomocné kreslenie ----------
    const poly = (ctx, pts) => {
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
    };
    function shadow(ctx, cx, cy, rx, ry, a = 0.5) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(1, ry / rx);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
      g.addColorStop(0, `rgba(0,0,0,${a})`);
      g.addColorStop(0.6, `rgba(0,0,0,${a * 0.55})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, rx, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    function clip(ctx, path, fn) {
      ctx.save();
      path();
      ctx.clip();
      fn();
      ctx.restore();
    }
    // tehly / kamenné bloky
    function bricks(ctx, x0, y0, x1, y1, base, rowH = 2.2) {
      ctx.fillStyle = css(shade(base, 0.55));
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      let row = 0;
      for (let y = y0; y < y1; y += rowH, row++) {
        let x = x0 - (row % 2) * 1.5;
        while (x < x1) {
          const w = 2.4 + rnd() * 1.8;
          ctx.fillStyle = css(shade(base, 0.82 + rnd() * 0.32));
          ctx.fillRect(x + 0.18, y + 0.18, w - 0.36, rowH - 0.36);
          ctx.fillStyle = 'rgba(255,255,255,.12)';
          ctx.fillRect(x + 0.18, y + 0.18, w - 0.36, 0.3);
          x += w;
        }
      }
    }
    // jemná zrnitosť (látka, drevo, kameň)
    function grain(ctx, x0, y0, w, h, n, a = 0.08) {
      for (let i = 0; i < n; i++) {
        ctx.fillStyle = rnd() < 0.5 ? `rgba(0,0,0,${a})` : `rgba(255,255,255,${a * 0.8})`;
        ctx.fillRect(x0 + rnd() * w, y0 + rnd() * h, 0.35 + rnd() * 0.5, 0.25);
      }
    }
    // valcové tieňovanie (svetlo zľava)
    function cylShade(ctx, x0, x1, y0, y1, k = 1) {
      const g = ctx.createLinearGradient(x0, 0, x1, 0);
      g.addColorStop(0, `rgba(0,0,0,${0.35 * k})`);
      g.addColorStop(0.25, `rgba(255,255,255,${0.2 * k})`);
      g.addColorStop(0.5, 'rgba(0,0,0,0)');
      g.addColorStop(1, `rgba(0,0,0,${0.6 * k})`);
      ctx.fillStyle = g;
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    }
    function glow(ctx, x, y, r, color, a = 0.7) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, css(color, a));
      g.addColorStop(1, css(color, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    function flag(ctx, x, y, P, len = 7) {
      ctx.strokeStyle = '#3b2a1a';
      ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.moveTo(x, y + 5); ctx.lineTo(x, y - 1); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y - 1);
      ctx.bezierCurveTo(x + len * 0.35, y - 2.2, x + len * 0.6, y + 0.2, x + len, y - 0.6);
      ctx.lineTo(x + len * 0.92, y + 2.4);
      ctx.bezierCurveTo(x + len * 0.6, y + 3.1, x + len * 0.35, y + 0.9, x, y + 2.2);
      ctx.closePath();
      const g = ctx.createLinearGradient(x, y, x + len, y);
      g.addColorStop(0, css(shade(P, 1.15)));
      g.addColorStop(0.5, css(shade(P, 0.8)));
      g.addColorStop(1, css(shade(P, 1.05)));
      ctx.fillStyle = g;
      ctx.fill();
    }

    // ---------- tábor (stan s ohniskom) ----------
    function drawCamp(ctx, P) {
      shadow(ctx, 4, 10, 19, 4.5, 0.55);
      const A = [-3, -17], B = [9, -20], L = [-15, 9], R = [8, 10], C = [18, 6];
      // bočný svah (v tieni)
      poly(ctx, [A, B, C, R]);
      let g = ctx.createLinearGradient(A[0], A[1], C[0], C[1]);
      g.addColorStop(0, css(shade(P, 0.72)));
      g.addColorStop(1, css(shade(P, 0.42)));
      ctx.fillStyle = g;
      ctx.fill();
      clip(ctx, () => poly(ctx, [A, B, C, R]), () => {
        ctx.strokeStyle = 'rgba(0,0,0,.2)';
        ctx.lineWidth = 0.35;
        for (let t = 0.15; t < 1; t += 0.17) {
          ctx.beginPath();
          ctx.moveTo(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t);
          ctx.lineTo(R[0] + (C[0] - R[0]) * t, R[1] + (C[1] - R[1]) * t);
          ctx.stroke();
        }
        grain(ctx, -4, -21, 24, 32, 220, 0.07);
      });
      // predná stena so vchodom
      poly(ctx, [A, L, R]);
      g = ctx.createLinearGradient(L[0], 0, R[0], 0);
      g.addColorStop(0, css(shade(P, 1.18)));
      g.addColorStop(1, css(shade(P, 0.86)));
      ctx.fillStyle = g;
      ctx.fill();
      clip(ctx, () => poly(ctx, [A, L, R]), () => {
        const v = ctx.createLinearGradient(0, -17, 0, 10);
        v.addColorStop(0, 'rgba(255,255,255,.18)');
        v.addColorStop(1, 'rgba(0,0,0,.18)');
        ctx.fillStyle = v;
        ctx.fillRect(-16, -18, 26, 30);
        ctx.strokeStyle = 'rgba(0,0,0,.13)';
        ctx.lineWidth = 0.3;
        for (let x = -13; x <= 7; x += 3) { ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(x, 10); ctx.stroke(); }
        grain(ctx, -16, -18, 26, 30, 260, 0.07);
      });
      // vchod a odhrnuté chlopne
      poly(ctx, [[-3.3, -7], [-7.6, 9.4], [1.3, 9.8]]);
      g = ctx.createRadialGradient(-3, 6, 0, -3, 6, 10);
      g.addColorStop(0, '#2b1d12');
      g.addColorStop(1, '#090604');
      ctx.fillStyle = g;
      ctx.fill();
      glow(ctx, -3, 8, 4, [255, 170, 80], 0.25);
      poly(ctx, [[-3.3, -7], [-7.6, 9.4], [-10, 6.5]]);
      ctx.fillStyle = css(shade(P, 1.05));
      ctx.fill();
      poly(ctx, [[-3.3, -7], [1.3, 9.8], [3.6, 7]]);
      ctx.fillStyle = css(shade(P, 0.7));
      ctx.fill();
      // obrys
      ctx.strokeStyle = 'rgba(20,12,6,.65)';
      ctx.lineWidth = 0.45;
      poly(ctx, [A, L, R, C, B]);
      ctx.stroke();
      ctx.strokeStyle = css(shade(P, 1.35), 0.8);
      ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.stroke();
      // laná a kolíky
      ctx.strokeStyle = 'rgba(70,50,30,.85)';
      ctx.lineWidth = 0.28;
      ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(-20, 5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(B[0], B[1]); ctx.lineTo(22, 0); ctx.stroke();
      ctx.fillStyle = '#5a3d22';
      ctx.fillRect(-20.4, 4.6, 0.8, 1.4);
      ctx.fillRect(21.6, -0.4, 0.8, 1.4);
      // tyč a vlajka
      ctx.strokeStyle = '#4a3220';
      ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(A[0], A[1] - 2.5); ctx.stroke();
      flag(ctx, B[0], B[1] - 5, P, 7);
      // ohnisko
      const fx = -18.5, fy = 12.5;
      shadow(ctx, fx + 0.6, fy + 0.6, 4.2, 1.6, 0.45);
      for (let i = 0; i < 7; i++) {
        const a = i / 7 * Math.PI * 2;
        ctx.fillStyle = css(shade([130, 128, 124], 0.75 + rnd() * 0.4));
        ctx.beginPath();
        ctx.ellipse(fx + Math.cos(a) * 2.9, fy + Math.sin(a) * 1.2, 0.95, 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = '#4a2f1a';
      ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.moveTo(fx - 2, fy + 0.4); ctx.lineTo(fx + 2, fy - 0.6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(fx - 1.8, fy - 0.6); ctx.lineTo(fx + 1.9, fy + 0.5); ctx.stroke();
      glow(ctx, fx, fy - 1.5, 6.5, [255, 150, 50], 0.45);
      ctx.beginPath();
      ctx.moveTo(fx - 1.5, fy);
      ctx.quadraticCurveTo(fx - 1.6, fy - 2.5, fx, fy - 5);
      ctx.quadraticCurveTo(fx + 1.7, fy - 2.4, fx + 1.4, fy);
      ctx.closePath();
      g = ctx.createLinearGradient(0, fy - 5, 0, fy);
      g.addColorStop(0, '#ffe08a');
      g.addColorStop(0.5, '#ff9a2e');
      g.addColorStop(1, '#d9480f');
      ctx.fillStyle = g;
      ctx.fill();
    }

    // ---------- mesto (kamenný hrad) ----------
    function cone(ctx, cx, top, rr, apex, P) {
      ctx.beginPath();
      ctx.moveTo(cx - rr, top);
      ctx.lineTo(cx, apex);
      ctx.lineTo(cx + rr, top);
      ctx.ellipse(cx, top, rr, rr * 0.32, 0, 0, Math.PI);
      ctx.closePath();
      const g = ctx.createLinearGradient(cx - rr, 0, cx + rr, 0);
      g.addColorStop(0, css(shade(P, 0.85)));
      g.addColorStop(0.3, css(shade(P, 1.2)));
      g.addColorStop(1, css(shade(P, 0.45)));
      ctx.fillStyle = g;
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.strokeStyle = 'rgba(0,0,0,.22)';
      ctx.lineWidth = 0.3;
      for (let y = apex + 2; y < top + 1; y += 1.6) {
        const w = rr * (y - apex) / (top - apex);
        ctx.beginPath();
        ctx.ellipse(cx, y, w, w * 0.32, 0, 0, Math.PI);
        ctx.stroke();
      }
      ctx.restore();
      ctx.strokeStyle = 'rgba(20,10,5,.6)';
      ctx.lineWidth = 0.4;
      ctx.stroke();
    }
    function tower(ctx, cx, r, top, bottom, P) {
      const path = () => {
        ctx.beginPath();
        ctx.moveTo(cx - r, top);
        ctx.lineTo(cx - r, bottom);
        ctx.ellipse(cx, bottom, r, r * 0.32, 0, Math.PI, 0, true);
        ctx.lineTo(cx + r, top);
        ctx.closePath();
      };
      clip(ctx, path, () => {
        bricks(ctx, cx - r - 2, top - 1, cx + r + 2, bottom + 3, [168, 160, 148], 2);
        cylShade(ctx, cx - r, cx + r, top - 1, bottom + 3);
        const ao = ctx.createLinearGradient(0, bottom - 3, 0, bottom + 2);
        ao.addColorStop(0, 'rgba(0,0,0,0)');
        ao.addColorStop(1, 'rgba(0,0,0,.4)');
        ctx.fillStyle = ao;
        ctx.fillRect(cx - r, bottom - 3, r * 2, 6);
      });
      ctx.strokeStyle = 'rgba(30,22,15,.55)';
      ctx.lineWidth = 0.4;
      path();
      ctx.stroke();
      // okno so svetlom
      ctx.fillStyle = '#1a120b';
      ctx.fillRect(cx - 0.9, top + 3, 1.8, 2.8);
      ctx.fillStyle = '#ffcf66';
      ctx.fillRect(cx - 0.6, top + 3.6, 1.2, 2);
      glow(ctx, cx, top + 4.6, 2.6, [255, 200, 90], 0.45);
      cone(ctx, cx, top, r + 1.4, top - 10, P);
    }
    function drawTown(ctx, P) {
      shadow(ctx, 5, 12, 25, 5.5, 0.6);
      // hlavná veža (donjon)
      const kx0 = -8, kx1 = 6, kt = -18, kb = 4;
      poly(ctx, [[kx1, kt], [kx1 + 5, kt - 3], [kx1 + 5, kb - 3], [kx1, kb]]);
      ctx.save(); ctx.clip();
      bricks(ctx, kx1 - 1, kt - 4, kx1 + 6, kb + 1, [150, 143, 132], 2);
      ctx.fillStyle = 'rgba(0,0,0,.42)';
      ctx.fillRect(kx1 - 1, kt - 4, 7, kb - kt + 5);
      ctx.restore();
      clip(ctx, () => { ctx.beginPath(); ctx.rect(kx0, kt, kx1 - kx0, kb - kt); }, () => {
        bricks(ctx, kx0, kt, kx1, kb, [176, 168, 154], 2);
        const g = ctx.createLinearGradient(kx0, 0, kx1, 0);
        g.addColorStop(0, 'rgba(255,255,255,.12)');
        g.addColorStop(1, 'rgba(0,0,0,.15)');
        ctx.fillStyle = g;
        ctx.fillRect(kx0, kt, kx1 - kx0, kb - kt);
      });
      for (const wx of [-4.5, 1.5]) {
        ctx.fillStyle = '#1a120b'; ctx.fillRect(wx, -13, 2, 3.2);
        ctx.fillStyle = '#ffcf66'; ctx.fillRect(wx + 0.35, -12.5, 1.3, 2.3);
        glow(ctx, wx + 1, -11.4, 3, [255, 200, 90], 0.4);
      }
      // strecha donjonu
      const apex = [0.5, -30];
      poly(ctx, [[kx0 - 1, kt], [kx1 + 0.5, kt], apex]);
      let g = ctx.createLinearGradient(kx0, 0, kx1, 0);
      g.addColorStop(0, css(shade(P, 1.2)));
      g.addColorStop(1, css(shade(P, 0.85)));
      ctx.fillStyle = g;
      ctx.fill();
      poly(ctx, [[kx1 + 0.5, kt], [kx1 + 5.5, kt - 3], apex]);
      ctx.fillStyle = css(shade(P, 0.5));
      ctx.fill();
      clip(ctx, () => poly(ctx, [[kx0 - 1, kt], [kx1 + 5.5, kt - 3], apex]), () => {
        ctx.strokeStyle = 'rgba(0,0,0,.2)';
        ctx.lineWidth = 0.3;
        for (let y = -27; y < kt; y += 1.6) { ctx.beginPath(); ctx.moveTo(-10, y); ctx.lineTo(13, y - 1.2); ctx.stroke(); }
      });
      ctx.strokeStyle = 'rgba(20,10,5,.6)';
      ctx.lineWidth = 0.4;
      poly(ctx, [[kx0 - 1, kt], [kx1 + 0.5, kt], [kx1 + 5.5, kt - 3], apex]);
      ctx.stroke();
      flag(ctx, apex[0], apex[1] - 5, P, 8);
      // hradba s cimburím a bránou
      const wx0 = -17, wx1 = 14, wt = -2, wb = 12;
      clip(ctx, () => { ctx.beginPath(); ctx.rect(wx0, wt, wx1 - wx0, wb - wt); }, () => {
        bricks(ctx, wx0, wt, wx1, wb, [182, 173, 158], 2.2);
        const v = ctx.createLinearGradient(0, wt, 0, wb);
        v.addColorStop(0, 'rgba(255,255,255,.1)');
        v.addColorStop(1, 'rgba(0,0,0,.35)');
        ctx.fillStyle = v;
        ctx.fillRect(wx0, wt, wx1 - wx0, wb - wt);
      });
      for (let x = wx0; x < wx1 - 1; x += 3) {
        ctx.fillStyle = css(shade([182, 173, 158], 0.95 + rnd() * 0.1));
        ctx.fillRect(x, wt - 2, 1.8, 2);
        ctx.fillStyle = 'rgba(0,0,0,.25)';
        ctx.fillRect(x + 1.3, wt - 2, 0.5, 2);
      }
      ctx.strokeStyle = 'rgba(30,22,15,.5)';
      ctx.lineWidth = 0.35;
      ctx.strokeRect(wx0, wt, wx1 - wx0, wb - wt);
      // brána
      ctx.beginPath();
      ctx.moveTo(-3.6, wb);
      ctx.lineTo(-3.6, 5);
      ctx.arc(-0.6, 5, 3, Math.PI, 0);
      ctx.lineTo(2.4, wb);
      ctx.closePath();
      g = ctx.createLinearGradient(0, 2, 0, wb);
      g.addColorStop(0, '#120c07');
      g.addColorStop(1, '#3a2614');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = 'rgba(160,120,70,.6)';
      ctx.lineWidth = 0.3;
      for (let x = -2.8; x < 2; x += 1.1) { ctx.beginPath(); ctx.moveTo(x, 3.5); ctx.lineTo(x, wb); ctx.stroke(); }
      for (let y = 5; y < wb; y += 1.6) { ctx.beginPath(); ctx.moveTo(-3.5, y); ctx.lineTo(2.3, y); ctx.stroke(); }
      // nárožné veže
      tower(ctx, -17.5, 4.6, -9, wb + 0.5, P);
      tower(ctx, 15, 4.6, -9, wb + 0.5, P);
    }

    // ---------- maják ----------
    function drawLighthouse(ctx, P) {
      shadow(ctx, 3, 16, 10, 2.8, 0.55);
      // skaly pri päte
      for (const [x, y, r] of [[-6, 15, 2.6], [5, 15.5, 2.2], [-2, 16.4, 2], [7.5, 14, 1.4]]) {
        const g = ctx.createRadialGradient(x - r * 0.4, y - r * 0.5, 0, x, y, r);
        g.addColorStop(0, '#b9b6b0'); g.addColorStop(1, '#55524d');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.65, 0, 0, Math.PI * 2); ctx.fill();
      }
      const path = () => poly(ctx, [[-6, 15], [-3.6, -8], [3.6, -8], [6, 15]]);
      clip(ctx, path, () => {
        ctx.fillStyle = '#f4f1ea';
        ctx.fillRect(-7, -9, 14, 25);
        ctx.fillStyle = css(P);
        ctx.fillRect(-7, 4, 14, 5);
        ctx.fillRect(-7, -4, 14, 4);
        grain(ctx, -7, -9, 14, 25, 160, 0.06);
        cylShade(ctx, -6, 6, -9, 16, 1.1);
      });
      ctx.strokeStyle = 'rgba(20,20,20,.5)';
      ctx.lineWidth = 0.35;
      path();
      ctx.stroke();
      ctx.fillStyle = '#1b1b1b';
      ctx.fillRect(-0.8, 0.5, 1.6, 2.4);
      // ochodza
      ctx.fillStyle = '#2b2b2b';
      ctx.fillRect(-5.2, -10, 10.4, 2);
      ctx.strokeStyle = '#3a3a3a';
      ctx.lineWidth = 0.3;
      for (let x = -5; x <= 5; x += 1.25) { ctx.beginPath(); ctx.moveTo(x, -10); ctx.lineTo(x, -12); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(-5.2, -12); ctx.lineTo(5.2, -12); ctx.stroke();
      // lucerna so svetlom
      glow(ctx, 0, -14, 13, [255, 214, 120], 0.55);
      const lg = ctx.createRadialGradient(-0.6, -14, 0, 0, -14, 4);
      lg.addColorStop(0, '#fffbe0'); lg.addColorStop(1, '#ffbf3a');
      ctx.fillStyle = lg;
      ctx.fillRect(-3, -17, 6, 5.4);
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 0.35;
      ctx.strokeRect(-3, -17, 6, 5.4);
      ctx.beginPath(); ctx.moveTo(-1, -17); ctx.lineTo(-1, -11.6); ctx.moveTo(1, -17); ctx.lineTo(1, -11.6); ctx.stroke();
      // kupola
      ctx.beginPath();
      ctx.moveTo(-3.8, -17);
      ctx.quadraticCurveTo(-3.6, -21.5, 0, -21.8);
      ctx.quadraticCurveTo(3.6, -21.5, 3.8, -17);
      ctx.closePath();
      const dg = ctx.createLinearGradient(-4, 0, 4, 0);
      dg.addColorStop(0, '#5a1f1f'); dg.addColorStop(0.35, '#a33a3a'); dg.addColorStop(1, '#2a0d0d');
      ctx.fillStyle = dg;
      ctx.fill();
      ctx.fillStyle = '#222';
      ctx.fillRect(-0.3, -23.6, 0.6, 2);
    }

    // ---------- prístav (mólo s loďkou) ----------
    function drawPort(ctx, P) {
      // hladina a vlnky
      ctx.fillStyle = 'rgba(40,110,150,.35)';
      ctx.beginPath(); ctx.ellipse(-1, 12, 17, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(210,240,255,.55)';
      ctx.lineWidth = 0.35;
      for (const [x, y, w] of [[-12, 12, 4], [-4, 14, 5], [6, 13, 4], [-8, 9.5, 3]]) {
        ctx.beginPath(); ctx.ellipse(x, y, w, 0.7, 0, Math.PI, 0); ctx.stroke();
      }
      // loďka (za mólom)
      shadow(ctx, -2, 3.5, 11, 2, 0.4);
      ctx.beginPath();
      ctx.moveTo(-13, -1);
      ctx.quadraticCurveTo(-3, 0.5, 8, -2);
      ctx.quadraticCurveTo(6, 3.5, -1, 4);
      ctx.quadraticCurveTo(-10, 3.6, -13, -1);
      ctx.closePath();
      let g = ctx.createLinearGradient(0, -2, 0, 4);
      g.addColorStop(0, '#a87444'); g.addColorStop(1, '#4a2c14');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = 'rgba(40,22,10,.7)';
      ctx.lineWidth = 0.3;
      ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-11.5, 0.7); ctx.quadraticCurveTo(-3, 2, 6.8, 0); ctx.stroke();
      // sťažeň a plachta vo farbe hráča
      ctx.strokeStyle = '#3b2a1a';
      ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.moveTo(-3, 0); ctx.lineTo(-3, -22); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-2.6, -21);
      ctx.quadraticCurveTo(4, -12, 7.5, -3.2);
      ctx.lineTo(-2.6, -2.6);
      ctx.closePath();
      g = ctx.createLinearGradient(-3, -20, 8, -3);
      g.addColorStop(0, css(shade(P, 1.25)));
      g.addColorStop(1, css(shade(P, 0.6)));
      ctx.fillStyle = g;
      ctx.fill();
      ctx.save(); ctx.clip();
      ctx.strokeStyle = 'rgba(0,0,0,.15)';
      ctx.lineWidth = 0.3;
      for (let y = -18; y < -2; y += 3) { ctx.beginPath(); ctx.moveTo(-3, y); ctx.lineTo(9, y + 2); ctx.stroke(); }
      ctx.restore();
      ctx.strokeStyle = 'rgba(30,15,5,.5)';
      ctx.lineWidth = 0.3;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(70,50,30,.8)';
      ctx.lineWidth = 0.22;
      ctx.beginPath(); ctx.moveTo(-3, -21.5); ctx.lineTo(-12.5, -1); ctx.stroke();
      // mólo
      shadow(ctx, 2, 9.5, 15, 2.4, 0.5);
      const deck = [[-14, 4], [12, 2.4], [15, 7], [-11, 8.8]];
      poly(ctx, deck);
      ctx.fillStyle = '#7a5230';
      ctx.fill();
      clip(ctx, () => poly(ctx, deck), () => {
        for (let i = 0; i < 9; i++) {
          const t = i / 9;
          ctx.strokeStyle = i % 2 ? 'rgba(40,22,10,.55)' : 'rgba(40,22,10,.35)';
          ctx.lineWidth = 0.3;
          ctx.beginPath();
          ctx.moveTo(-14 + t * 3 + 0.0, 4 + t * 4.8);
          ctx.lineTo(12 + t * 3, 2.4 + t * 4.6);
          ctx.stroke();
          ctx.fillStyle = `rgba(${150 + rnd() * 40},${100 + rnd() * 30},${55 + rnd() * 20},.35)`;
          ctx.fillRect(-14, 4 + t * 4.8, 30, 0.4);
        }
        grain(ctx, -15, 2, 32, 8, 200, 0.08);
        const v = ctx.createLinearGradient(0, 2, 0, 9);
        v.addColorStop(0, 'rgba(255,230,190,.25)');
        v.addColorStop(1, 'rgba(0,0,0,.2)');
        ctx.fillStyle = v;
        ctx.fillRect(-15, 2, 32, 8);
      });
      // čelná hrana mólа a stĺpy
      poly(ctx, [[-11, 8.8], [15, 7], [15, 8.3], [-11, 10.1]]);
      ctx.fillStyle = '#3e2714';
      ctx.fill();
      for (const x of [-10, -2, 6, 14]) {
        const y = 9.5 - (x + 10) * 0.065;
        const pg = ctx.createLinearGradient(x - 0.8, 0, x + 0.8, 0);
        pg.addColorStop(0, '#6b4524'); pg.addColorStop(1, '#2b180a');
        ctx.fillStyle = pg;
        ctx.fillRect(x - 0.8, y, 1.6, 5);
        ctx.fillStyle = 'rgba(20,60,90,.4)';
        ctx.fillRect(x - 0.8, y + 4, 1.6, 1.2);
      }
      // úväzný stĺpik s lanom
      ctx.fillStyle = '#2b2b2b';
      ctx.fillRect(9.5, 1.2, 1.6, 2.6);
      ctx.fillStyle = '#4a4a4a';
      ctx.beginPath(); ctx.ellipse(10.3, 1.2, 1, 0.4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#c8a46a';
      ctx.lineWidth = 0.35;
      ctx.beginPath(); ctx.moveTo(10.3, 2); ctx.quadraticCurveTo(9, 0, 7.6, -1.6); ctx.stroke();
    }

    // ---------- bandita ----------
    function drawBandit(ctx) {
      shadow(ctx, 3, 13, 13, 3.6, 0.6);
      // plášť
      ctx.beginPath();
      ctx.moveTo(-11, 13);
      ctx.quadraticCurveTo(-12.5, 1, -6, -4.5);
      ctx.quadraticCurveTo(0, -7, 6, -4.5);
      ctx.quadraticCurveTo(12.5, 1, 11, 13);
      ctx.quadraticCurveTo(7, 11.6, 3.5, 13.2);
      ctx.quadraticCurveTo(0, 11.8, -3.5, 13.2);
      ctx.quadraticCurveTo(-7, 11.6, -11, 13);
      ctx.closePath();
      let g = ctx.createLinearGradient(-12, 0, 12, 0);
      g.addColorStop(0, '#4a4d55'); g.addColorStop(0.4, '#2d2f35'); g.addColorStop(1, '#121317');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.save(); ctx.clip();
      ctx.strokeStyle = 'rgba(0,0,0,.45)';
      ctx.lineWidth = 0.5;
      for (const x of [-6, -2, 3, 7]) { ctx.beginPath(); ctx.moveTo(x * 0.5, -3); ctx.quadraticCurveTo(x, 5, x * 1.15, 13); ctx.stroke(); }
      ctx.strokeStyle = 'rgba(255,255,255,.08)';
      for (const x of [-7.5, -3.5]) { ctx.beginPath(); ctx.moveTo(x * 0.5, -2); ctx.quadraticCurveTo(x, 5, x * 1.12, 13); ctx.stroke(); }
      grain(ctx, -12, -6, 24, 20, 200, 0.07);
      ctx.restore();
      // šatka
      ctx.beginPath();
      ctx.moveTo(-5.4, -4.6);
      ctx.quadraticCurveTo(0, -1.4, 5.4, -4.6);
      ctx.lineTo(4.6, -2.3);
      ctx.quadraticCurveTo(0, 0.4, -4.6, -2.3);
      ctx.closePath();
      g = ctx.createLinearGradient(-5, 0, 5, 0);
      g.addColorStop(0, '#c9424f'); g.addColorStop(1, '#6b1620');
      ctx.fillStyle = g;
      ctx.fill();
      // kapucňa
      ctx.beginPath();
      ctx.moveTo(-7.4, -6);
      ctx.quadraticCurveTo(-8, -15.5, 0, -17);
      ctx.quadraticCurveTo(8, -15.5, 7.4, -6);
      ctx.quadraticCurveTo(0, -3.4, -7.4, -6);
      ctx.closePath();
      g = ctx.createLinearGradient(-8, -16, 8, -5);
      g.addColorStop(0, '#5a5e67'); g.addColorStop(0.5, '#33363c'); g.addColorStop(1, '#16171b');
      ctx.fillStyle = g;
      ctx.fill();
      // tvár v tieni
      ctx.beginPath();
      ctx.ellipse(0, -9, 4.4, 4.3, 0, 0, Math.PI * 2);
      g = ctx.createRadialGradient(0, -8, 0, 0, -9, 4.6);
      g.addColorStop(0, '#1d1a18'); g.addColorStop(1, '#050505');
      ctx.fillStyle = g;
      ctx.fill();
      // žiariace oči
      for (const x of [-1.7, 1.7]) {
        glow(ctx, x, -9.6, 2.2, [255, 200, 60], 0.55);
        ctx.fillStyle = '#ffe28a';
        ctx.beginPath(); ctx.ellipse(x, -9.6, 0.75, 0.45, 0, 0, Math.PI * 2); ctx.fill();
      }
      // vrece s korisťou
      ctx.beginPath();
      ctx.moveTo(6.5, 11);
      ctx.quadraticCurveTo(4.5, 6, 8.2, 4.4);
      ctx.quadraticCurveTo(12.2, 6, 11.6, 11);
      ctx.quadraticCurveTo(9, 12.4, 6.5, 11);
      ctx.closePath();
      g = ctx.createRadialGradient(7.8, 6.5, 0, 9, 8, 5);
      g.addColorStop(0, '#b38b55'); g.addColorStop(1, '#5c4122');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = '#3a2814';
      ctx.lineWidth = 0.45;
      ctx.beginPath(); ctx.moveTo(7.4, 4.8); ctx.lineTo(9, 3.4); ctx.lineTo(9.6, 4.8); ctx.stroke();
      ctx.fillStyle = '#ffd34d';
      ctx.beginPath(); ctx.arc(8.6, 4.6, 0.6, 0, Math.PI * 2); ctx.fill();
    }

    const DEFS = {
      camp: { box: { x: -25, y: -28, w: 50, h: 46 }, draw: drawCamp },
      town: { box: { x: -26, y: -40, w: 54, h: 58 }, draw: drawTown },
      lighthouse: { box: { x: -14, y: -28, w: 28, h: 48 }, draw: drawLighthouse },
      port: { box: { x: -19, y: -26, w: 37, h: 44 }, draw: drawPort },
      bandit: { box: { x: -15, y: -20, w: 30, h: 37 }, draw: drawBandit },
    };

    // vráti <image> pre SVG – x, y je bod ukotvenia
    function image(type, x, y, color = '#888888') {
      const d = DEFS[type];
      const key = type + '|' + color;
      if (!cache.has(key)) cache.set(key, make(d.box, ctx => d.draw(ctx, rgb(color))));
      const b = d.box;
      return `<image href="${cache.get(key)}" x="${(x + b.x).toFixed(1)}" y="${(y + b.y).toFixed(1)}" width="${b.w}" height="${b.h}"/>`;
    }

    // test, či canvas funguje
    image('camp', 0, 0, '#e4572e');
    return { image };
  } catch (e) {
    console.warn('Sprity budov sa nepodarilo vytvoriť – použije sa jednoduchá grafika.', e);
    return null;
  }
})();
