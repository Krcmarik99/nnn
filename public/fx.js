'use strict';

// Zvuky (syntetizované cez Web Audio – žiadne súbory) a animácia kociek.
const FX = (() => {
  let ctx = null;
  let muted = false;
  try { muted = localStorage.getItem('suostrovie-mute') === '1'; } catch {}

  function ac() {
    if (!ctx) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      ctx = new C();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  // Prehliadače povolia zvuk až po interakcii používateľa.
  for (const ev of ['pointerdown', 'keydown']) document.addEventListener(ev, () => ac(), { passive: true });

  function tone(freq, t, dur, { type = 'sine', vol = 0.18, to = null } = {}) {
    const c = ctx;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  let noiseBuf = null;
  function noise(t, dur, { vol = 0.3, freq = 2500, q = 1.5, kind = 'bandpass' } = {}) {
    const c = ctx;
    if (!noiseBuf) {
      noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const s = c.createBufferSource();
    s.buffer = noiseBuf;
    const f = c.createBiquadFilter();
    f.type = kind;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(c.destination);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.02);
  }

  const knock = (t, f = 170, vol = 0.35) => {
    noise(t, 0.06, { vol: vol * 0.8, freq: 1100, kind: 'lowpass', q: 0.7 });
    tone(f, t, 0.09, { type: 'triangle', vol });
  };

  const SOUNDS = {
    rattle(t) {
      for (let i = 0; i < 10; i++) {
        const tt = t + i * 0.075 + Math.random() * 0.03;
        noise(tt, 0.035, { vol: 0.25 + Math.random() * 0.15, freq: 2200 + Math.random() * 2500, q: 2 });
        if (i % 3 === 0) tone(380 + Math.random() * 200, tt, 0.03, { type: 'triangle', vol: 0.08 });
      }
    },
    land(t) { knock(t, 180); knock(t + 0.1, 150, 0.25); },
    boom(t) {
      noise(t, 0.5, { vol: 0.4, freq: 300, kind: 'lowpass', q: 0.6 });
      tone(90, t, 0.4, { type: 'sine', vol: 0.15, to: 45 });
      for (let i = 0; i < 9; i++) noise(t + 0.25 + Math.random() * 0.6, 0.03, { vol: 0.12, freq: 4000 + Math.random() * 3000, q: 3 });
    },
    tap(t) { knock(t, 240 + Math.random() * 60, 0.18); },
    gain(t) {
      tone(880, t, 0.14, { vol: 0.12 });
      tone(1318, t + 0.09, 0.22, { vol: 0.12 });
    },
    event(t) {
      tone(220, t, 0.7, { type: 'sawtooth', vol: 0.08, to: 90 });
      noise(t, 0.9, { vol: 0.35, freq: 220, kind: 'lowpass', q: 0.5 });
    },
    market(t) {
      [784, 988, 1175, 1568].forEach((f, i) => tone(f, t + i * 0.08, 0.18, { type: 'triangle', vol: 0.12 }));
    },
    turn(t) {
      tone(660, t, 0.18, { vol: 0.12 });
      tone(990, t + 0.14, 0.3, { vol: 0.12 });
    },
    build(t) { knock(t, 130, 0.4); knock(t + 0.13, 120, 0.3); },
    bandits(t) {
      [392, 370, 311, 262].forEach((f, i) => tone(f, t + i * 0.13, 0.22, { type: 'triangle', vol: 0.13 }));
      noise(t + 0.5, 0.35, { vol: 0.2, freq: 600, kind: 'lowpass', q: 0.6 });
    },
    explore(t) {
      noise(t, 0.5, { vol: 0.25, freq: 900, q: 0.8 });
      tone(520, t + 0.15, 0.3, { vol: 0.08, to: 780 });
    },
    army(t) {
      [0, 0.12, 0.24, 0.42].forEach((d, i) => { noise(t + d, 0.08, { vol: 0.35, freq: 180, kind: 'lowpass', q: 0.8 }); tone(i === 3 ? 98 : 82, t + d, 0.12, { type: 'triangle', vol: 0.18 }); });
      tone(523, t + 0.45, 0.25, { type: 'square', vol: 0.05 });
    },
    card(t) {
      noise(t, 0.12, { vol: 0.25, freq: 3000, q: 0.7 });
      tone(700, t + 0.08, 0.12, { type: 'triangle', vol: 0.1, to: 1100 });
    },
    block(t) {
      tone(140, t, 0.18, { type: 'square', vol: 0.06 });
      tone(110, t + 0.16, 0.26, { type: 'square', vol: 0.06 });
      noise(t + 0.05, 0.3, { vol: 0.25, freq: 400, kind: 'lowpass', q: 0.7 });
    },
    coins(t) {
      [0, 0.07, 0.15, 0.24].forEach((d, i) => { tone(2400 + i * 180, t + d, 0.09, { type: 'triangle', vol: 0.07 }); tone(3600 + i * 240, t + d + 0.01, 0.06, { vol: 0.04 }); });
      tone(1500, t + 0.42, 0.25, { type: 'triangle', vol: 0.08 });
    },
    trade(t) { tone(1200, t, 0.06, { vol: 0.1 }); tone(1600, t + 0.07, 0.1, { vol: 0.1 }); },
    chat(t) { tone(1050, t, 0.07, { vol: 0.06 }); },
    win(t) {
      [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, t + i * 0.12, 0.25, { type: 'triangle', vol: 0.14 }));
    },
  };

  function sound(name) {
    if (muted || !SOUNDS[name]) return;
    const c = ac();
    if (!c || c.state !== 'running') return;
    try { SOUNDS[name](c.currentTime + 0.01); } catch {}
  }

  function setMuted(v) {
    muted = v;
    try { localStorage.setItem('suostrovie-mute', v ? '1' : '0'); } catch {}
  }

  // ---------- 3D kocky ----------
  const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  // natočenie kocky tak, aby stena n smerovala k hráčovi
  const ORIENT = { 1: [0, 0], 2: [0, -90], 3: [-90, 0], 4: [90, 0], 5: [0, 90], 6: [0, 180] };
  const VIEW = 'rotateX(-24deg) rotateY(-26deg)';
  const T = (rx, ry, rz) => `${VIEW} rotateZ(${rz}deg) rotateX(${rx}deg) rotateY(${ry}deg)`;

  function buildCube(el) {
    if (el.childElementCount) return;
    el.innerHTML = [1, 2, 3, 4, 5, 6].map(n =>
      `<div class="f f${n}">${Array.from({ length: 9 }, (_, i) => `<i class="${PIPS[n].includes(i) ? 'pip' : ''}"></i>`).join('')}</div>`).join('');
  }

  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let hideTimer = null;
  const DUR = 1250;

  function throwDie(slot, value, delay, dir) {
    const cube = slot.querySelector('.cube');
    const thr = slot.querySelector('.dthrow');
    const sh = slot.querySelector('.dshadow');
    buildCube(cube);
    const [ox, oy] = ORIENT[value];
    const rz = Math.round((Math.random() - 0.5) * 24);
    const end = T(ox + 360 * (2 + Math.floor(Math.random() * 2)), oy + 360 * (2 + Math.floor(Math.random() * 2)), rz + 360);
    if (reduced) { cube.style.transform = end; return; }
    const start = T(Math.random() * 180, Math.random() * 180, Math.random() * 90);
    cube.animate([{ transform: start }, { transform: end }],
      { duration: DUR, delay, easing: 'cubic-bezier(.12,.55,.2,1)', fill: 'both' });
    const fall = 'cubic-bezier(.5,0,1,1)', rise = 'cubic-bezier(0,0,.5,1)';
    const X = v => v * dir;
    // hod s odrazmi (gravitácia: pád zrýchľuje, výskok spomaľuje)
    thr.animate([
      { transform: `translate(${X(-250)}px,-170px)`, easing: fall },
      { transform: `translate(${X(-115)}px,0)`, offset: 0.38, easing: rise },
      { transform: `translate(${X(-52)}px,-48px)`, offset: 0.56, easing: fall },
      { transform: `translate(${X(-19)}px,0)`, offset: 0.72, easing: rise },
      { transform: `translate(${X(-7)}px,-13px)`, offset: 0.83, easing: fall },
      { transform: 'translate(0,0)', offset: 0.93, easing: 'ease-out' },
      { transform: 'translate(0,0)' },
    ], { duration: DUR, delay, fill: 'both' });
    sh.animate([
      { transform: `translate(${X(-250)}px,0) scale(.45)`, opacity: 0.1 },
      { transform: `translate(${X(-115)}px,0) scale(1)`, opacity: 0.65, offset: 0.38 },
      { transform: `translate(${X(-52)}px,0) scale(.72)`, opacity: 0.32, offset: 0.56 },
      { transform: `translate(${X(-19)}px,0) scale(1)`, opacity: 0.65, offset: 0.72 },
      { transform: `translate(${X(-7)}px,0) scale(.9)`, opacity: 0.5, offset: 0.83 },
      { transform: 'translate(0,0) scale(1)', opacity: 0.65, offset: 0.93 },
      { transform: 'translate(0,0) scale(1)', opacity: 0.65 },
    ], { duration: DUR, delay, fill: 'both' });
    // ťuknutia pri dopadoch
    for (const o of [0.38, 0.72, 0.93]) setTimeout(() => sound('tap'), delay + DUR * o);
  }

  function rollDice([prod, ev], caption, onLanded) {
    const ov = document.getElementById('diceOverlay');
    const slots = ov.querySelectorAll('.dslot');
    const cap = ov.querySelector('.cap');
    clearTimeout(hideTimer);
    ov.hidden = false;
    ov.classList.remove('fade', 'landed', 'ev1', 'ev6');
    ov.classList.add('rolling');
    cap.textContent = caption;
    sound('rattle');
    throwDie(slots[0], prod, 0, 1);
    throwDie(slots[1], ev, 80, 1);
    let done = false;
    const land = () => {
      if (done) return;
      done = true;
      ov.classList.remove('rolling');
      ov.classList.add('landed');
      if (ev === 1) ov.classList.add('ev1');
      if (ev === 6) ov.classList.add('ev6');
      cap.textContent = `${caption} · ${prod} + ${ev} = ${prod + ev}` + (ev === 1 ? ' · ⚡ udalosť!' : ev === 6 ? ' · 🛒 Trhový deň' : '')
        + (prod + ev === 7 ? ' · 🦹 banditi!' : '');
      sound('land');
      onLanded();
      hideTimer = setTimeout(() => {
        ov.classList.add('fade');
        hideTimer = setTimeout(() => { ov.hidden = true; }, 400);
      }, 1600);
    };
    setTimeout(land, reduced ? 250 : DUR + 120);
    ov.onclick = () => { if (done) { clearTimeout(hideTimer); ov.hidden = true; } };
  }

  return { sound, rollDice, isMuted: () => muted, setMuted };
})();
