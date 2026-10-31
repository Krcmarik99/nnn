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

  // ---------- kocky ----------
  const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  function face(el, n) {
    el.innerHTML = Array.from({ length: 9 }, (_, i) => `<i class="${PIPS[n].includes(i) ? 'pip' : ''}"></i>`).join('');
  }

  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let hideTimer = null;

  function rollDice([prod, ev], caption, onLanded) {
    const ov = document.getElementById('diceOverlay');
    const d1 = ov.querySelector('.die.prod');
    const d2 = ov.querySelector('.die.ev');
    const cap = ov.querySelector('.cap');
    clearTimeout(hideTimer);
    ov.hidden = false;
    ov.classList.remove('fade', 'landed', 'ev1', 'ev6');
    ov.classList.add('rolling');
    cap.textContent = caption;
    sound('rattle');
    const spin = setInterval(() => {
      face(d1, 1 + Math.floor(Math.random() * 6));
      face(d2, 1 + Math.floor(Math.random() * 6));
    }, 70);
    const dur = reduced ? 250 : 900;
    let done = false;
    const land = () => {
      if (done) return;
      done = true;
      clearInterval(spin);
      face(d1, prod);
      face(d2, ev);
      ov.classList.remove('rolling');
      ov.classList.add('landed');
      if (ev === 1) ov.classList.add('ev1');
      if (ev === 6) ov.classList.add('ev6');
      cap.textContent = `${caption} · produkcia ${prod}` + (ev === 1 ? ' · ⚡ udalosť!' : ev === 6 ? ' · 🛒 Trhový deň' : '')
        + (prod + ev === 7 ? ' · 🦹 banditi!' : '');
      sound('land');
      onLanded();
      hideTimer = setTimeout(() => {
        ov.classList.add('fade');
        hideTimer = setTimeout(() => { ov.hidden = true; }, 400);
      }, 1500);
    };
    setTimeout(land, dur);
    ov.onclick = () => { if (done) { clearTimeout(hideTimer); ov.hidden = true; } };
  }

  return { sound, rollDice, isMuted: () => muted, setMuted };
})();
