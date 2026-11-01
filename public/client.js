'use strict';

const RES = ['drevo', 'kamen', 'ruda', 'obilie', 'sol'];
const RES_NAMES = { drevo: 'Drevo', kamen: 'Kameň', ruda: 'Ruda', obilie: 'Obilie', sol: 'Soľ' };
const RES_ICON = { drevo: '🪵', kamen: '🪨', ruda: '⛏️', obilie: '🌾', sol: '🧂' };
const wheatGrains = Array.from({ length: 4 }, (_, i) => {
  const y = 5 + i * 3.4;
  return `<ellipse cx="9.8" cy="${y}" rx="2" ry="2.9" transform="rotate(-25 9.8 ${y})" fill="#f4d35e" stroke="#a87a16" stroke-width=".6"/>`
    + `<ellipse cx="14.2" cy="${y}" rx="2" ry="2.9" transform="rotate(25 14.2 ${y})" fill="#e0b13a" stroke="#a87a16" stroke-width=".6"/>`;
}).join('');
const RES_SVG = {
  drevo: '<svg viewBox="0 0 24 24"><rect x="1.5" y="8" width="17" height="9" rx="4.5" fill="#8d5a2b" stroke="#4a2c12" stroke-width=".8"/><path d="M4 10.6h11M4 14.4h10" stroke="#6b4220" stroke-width="1"/><ellipse cx="18.5" cy="12.5" rx="3.8" ry="4.6" fill="#e3b778" stroke="#4a2c12" stroke-width=".8"/><ellipse cx="18.5" cy="12.5" rx="1.9" ry="2.4" fill="none" stroke="#b07a3e" stroke-width=".9"/><path d="M7 8.2l1.6-3.4 1.6 3.4z" fill="#52b788"/></svg>',
  kamen: '<svg viewBox="0 0 24 24"><path d="M2.5 19l2-8.5 6.5-5.5 7.5 2 4 7.5-2.5 4.5z" fill="#7d8896" stroke="#343a40" stroke-width=".9"/><path d="M4.5 10.5l6.5-5.5 7.5 2-5.5 4.5z" fill="#d6dce3"/><path d="M13 11.5l5.5-4.5 4 7.5-2.5 4.5z" fill="#5c6672"/></svg>',
  ruda: '<svg viewBox="0 0 24 24"><path d="M1.5 21l4.5-9.5 6-3 7 3 3.5 9.5z" fill="#6b4a32" stroke="#2b1a0e" stroke-width=".9"/><path d="M8.5 15l3.5-8 3.5 8-3.5 4z" fill="#8fe3ff" stroke="#1d6fa5" stroke-width=".9"/><path d="M12 7l3.5 8-3.5 4z" fill="#3fa9de"/><path d="M16.5 17l2-4 2 4-2 2z" fill="#8fe3ff" stroke="#1d6fa5" stroke-width=".7"/></svg>',
  obilie: `<svg viewBox="0 0 24 24"><path d="M12 23V7" stroke="#9a6b1f" stroke-width="1.6" stroke-linecap="round"/><path d="M12 18l-4 -3M12 20l4 -3" stroke="#9a6b1f" stroke-width="1.2" stroke-linecap="round"/>${wheatGrains}<ellipse cx="12" cy="3.4" rx="1.8" ry="2.6" fill="#f4d35e" stroke="#a87a16" stroke-width=".6"/></svg>`,
  sol: '<svg viewBox="0 0 24 24"><path d="M2.5 20.5q9.5-17 19 0z" fill="#ffffff" stroke="#7d97a8" stroke-width=".9"/><path d="M12 7.5q6.5 4.5 9.5 13h-7z" fill="#d6e4ec"/><path d="M6.5 10.5l2-2 2 2-2 2z" fill="#fff" stroke="#7d97a8" stroke-width=".7"/><path d="M15.5 5.5l1.6-1.6 1.6 1.6-1.6 1.6z" fill="#fff" stroke="#7d97a8" stroke-width=".7"/></svg>',
};
const icon = (r, size = 16) => `<span class="ri" style="width:${size}px;height:${size}px">${RES_SVG[r]}</span>`;
const TERRAIN = {
  les: { name: 'Les', color: '#3f8a52', res: 'drevo' },
  lom: { name: 'Lom', color: '#97a2b0', res: 'kamen' },
  bana: { name: 'Baňa', color: '#80522f', res: 'ruda' },
  pole: { name: 'Pole', color: '#e4b84e', res: 'obilie' },
  solnisko: { name: 'Soľnisko', color: '#d3e2eb', res: 'sol' },
  more: { name: 'More', color: '#3577b5' },
};
const COSTS = {
  port: { drevo: 2, ruda: 1, obilie: 1 },
  bridge: { drevo: 2, kamen: 1 },
  camp: { drevo: 1, kamen: 1, obilie: 1 },
  town: { ruda: 2, obilie: 2, sol: 1 },
  lighthouse: { kamen: 2, drevo: 1, sol: 1 },
  explore: { drevo: 1, obilie: 1 },
};
const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
const LEVEL_NAMES = { easy: '😊 Ľahká', normal: '🙂 Stredná', hard: '😈 Ťažká' };
const BRIDGE_SEGS = 8;      // počet „dosiek“ pri animácii stavby
const PLANK_START = 380;    // ms – dosky sa začnú klásť, keď sa vynorí pilier
const PLANK_STEP = 85;      // ms medzi doskami
const DIE = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

const RULES = `
<p><b>Cieľ:</b> ako prvý dosiahni stanovený počet bodov (štandardne 12) počas svojho ťahu.</p>
<ul>
<li><b>Mapa:</b> šesťuholníkové súostrovie. Stred je odkrytý, vonkajší okruh je zahalený v hmle a treba ho objaviť.</li>
<li><b>Príprava:</b> hráči postupne (tam a späť) položia 2 tábory na ľubovoľnú voľnú odkrytú pevninu. Za každý dostanú 1 surovinu z jej políčka.</li>
<li><b>Hod:</b> na začiatku ťahu hodíš dvoma klasickými kockami – bielou a fialovou – a čísla sa <b>sčítajú</b> (2–12).
  Každá stavba na poli so súčtom kociek dá majiteľovi surovinu (tábor 1, mesto 2). Polia majú čísla 2–12 okrem 7;
  bodky pod číslom ukazujú, ako často padá (6 a 8 najčastejšie, 2 a 12 najzriedkavejšie).</li>
<li><b>Fialová kocka</b> navyše určuje udalosť: 1 = ťahá sa karta udalosti (Búrka, Hojnosť, Piráti, Obchodná loď, Sucho, Nález). 6 = Trhový deň – meníš s bankou 2:1.</li>
<li><b>Stavby</b> zaberajú celé políčko (jedna stavba na políčko):
  <ul>
  <li>⛺ <b>Tábor</b> (drevo, kameň, obilie) – 1 bod. Musí susediť s tvojou stavbou. Max. 6.</li>
  <li>🏰 <b>Mesto</b> (2 ruda, 2 obilie, soľ) – vylepší tábor, 2 body a dvojitá produkcia. Max. 4.</li>
  <li>🗼 <b>Maják</b> (2 kameň, drevo, soľ) – na pobrežnej stavbe, 1 bod, výmena s bankou 3:1 a ochrana pred pirátmi. Max. 3.</li>
  </ul></li>
<li>🌉 <b>Most</b> (2 drevo, kameň) – staviaš ho na odkryté <b>morské pole</b> vedľa svojej stavby alebo mosta. Od mosta môžeš stavať tábory a robiť výpravy na druhom brehu a most je súčasťou tvojej <b>cesty</b>. Body nedáva. Max. 4.</li>
<li>⚓ <b>Prístav</b> (2 drevo, ruda, obilie) – na pobrežnej stavbe, 1 bod. Max. 2. S bankou meníš <b>2:1 surovinu poľa, na ktorom prístav stojí</b>. Hráči s prístavom si môžu posielať <b>námorné ponuky kedykoľvek</b>, aj mimo svojho ťahu. Ponuka platí jedno celé kolo a prijať ju môže len hráč s prístavom.</li>
<li>⚔️ <b>Vojaci</b> (ruda, obilie): kto má najviac vojakov (aspoň 3), má <b>Najväčšie vojsko</b> a <b>+2 body</b>. Titul prevezme len hráč s väčším vojskom. Aspoň 2 vojaci chránia pred pirátmi. S aspoň 1 vojakom môžeš raz za ťah <b>vyhnať banditov</b> zo svojho poľa späť do hôr. Tvoji vojaci stoja ako posádka pri tvojej hlavnej stavbe (meste, inak tábore).</li>
<li>🛤️ <b>Najdlhšia cesta</b>: tvoje stavby na susedných poliach tvoria cestu. Kto má najdlhšiu reťaz stavieb za sebou (aspoň 4), získa <b>+2 body</b>. Titul prevezme len hráč s dlhšou cestou.</li>
<li>🎴 <b>Rozvojové karty</b> (obilie, ruda, soľ): kúpiš náhodnú kartu z balíčka. Zahrať ju môžeš po hode, najskôr v ďalšom ťahu, a len jednu za ťah. Karty: 🗺️ Mapa pokladu, 🛒 Kupec, 🌾 Bohatá úroda, 🔨 Stavitelia, 🏴‍☠️ Pašeráci, 📜 Kráľovská listina, 🧭 Lodný kompas.</li>
<li>🧭 <b>Výprava</b> (drevo, obilie): odkry zahalené políčko vedľa svojej stavby. Ak je to pevnina, dostaneš 1 jej surovinu. Kto má najviac objavov (aspoň 3), je <b>Veľký objaviteľ</b> (+2 body).</li>
<li>🦹 <b>Banditi</b> začínajú v horách (na baníckom poli). Keď je súčet oboch kociek <b>7</b>, hráč na ťahu ich môže presunúť na ľubovoľnú odkrytú pevninu (alebo nechať na mieste). Pole s banditmi nič neprodukuje.</li>
<li>📜 <b>Zákazky:</b> tri sú vždy vyložené. Odovzdaj požadované suroviny a získaj 1–2 body.</li>
<li>🤝 <b>Obchod:</b> s bankou 4:1 (s majákom 3:1, v Trhový deň 2:1), alebo navrhni výmenu ostatným hráčom – ktokoľvek ju môže prijať.</li>
</ul>`;

// ---------- stav ----------
let ws = null;
let S = null; // stav hry
let mode = null; // 'place' | 'camp' | 'town' | 'lighthouse' | 'explore'
let session = null;
try { session = JSON.parse(localStorage.getItem('suostrovie') || 'null'); } catch {}
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const chatLines = [];

function saveSession(v) {
  session = v;
  try { v ? localStorage.setItem('suostrovie', JSON.stringify(v)) : localStorage.removeItem('suostrovie'); } catch {}
}

function toast(msg, info) {
  const t = $('toast');
  t.textContent = msg;
  t.className = info ? 'info' : '';
  t.hidden = false;
  clearTimeout(toast.tm);
  toast.tm = setTimeout(() => { t.hidden = true; }, 3500);
}

function show(screen) {
  for (const s of ['home', 'lobby', 'game']) $(s).hidden = s !== screen;
  // ilustrácia a mapa zdieľajú SVG definície (id) – ilustrácia smie existovať len na úvode
  if (typeof renderHero === 'function') {
    if (screen === 'home') renderHero();
    else if ($('hero')) $('hero').innerHTML = '';
  }
}

// ---------- spojenie ----------
function connect() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}`);
  ws.onopen = () => {
    if (session) send({ t: 'rejoin', code: session.code, token: session.token });
  };
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.t === 'joined') {
      saveSession({ code: m.code, token: m.token });
      history.replaceState(null, '', '?party=' + m.code);
    } else if (m.t === 'state') {
      onState(m.state);
    } else if (m.t === 'error') {
      toast(m.msg);
    } else if (m.t === 'chat') {
      chatLines.push(m);
      if (!S || !me() || me().name !== m.name) FX.sound('chat');
      if (chatLines.length > 50) chatLines.shift();
      renderLog();
    } else if (m.t === 'rejoinFailed' || m.t === 'left') {
      saveSession(null);
      S = null;
      history.replaceState(null, '', location.pathname);
      show('home');
    }
  };
  ws.onclose = () => setTimeout(connect, 1500);
}

// ---------- stav, zvuky a animácie ----------
let rolling = false;
let pendingState = null;
let freshRoll = false;

function onState(next) {
  if (rolling) { pendingState = next; return; }
  const prev = S;
  const r = next.lastRoll;
  const isNewRoll = r && prev && prev.phase !== 'lobby' && (!prev.lastRoll || prev.lastRoll.n !== r.n);
  if (isNewRoll) {
    rolling = true;
    pendingState = next;
    const who = next.players.find(p => p.id === r.by);
    FX.rollDice(r.dice, r.by === next.me ? 'Hádžeš ty' : `Hádže ${who ? who.name : '…'}`, () => {
      rolling = false;
      const st = pendingState;
      pendingState = null;
      applyState(st, prev, true);
    });
    return;
  }
  applyState(next, prev, false);
}

function applyState(next, prev, afterRoll) {
  S = next;
  if (S.phase === 'play' && S.current !== S.me && mode) mode = null;
  freshRoll = afterRoll;
  render();
  freshRoll = false;
  // animácia obchodu (aj pri prvom stave si len zapamätáme posledný obchod)
  const lt = S.lastTrade;
  if (!prev || lastTradeN === null) lastTradeN = lt ? lt.n : 0;
  else if (lt && lt.n !== lastTradeN) { lastTradeN = lt.n; animateTrade(lt); }
  const lc = S.lastCard, lb = S.lastCardBuy;
  if (!prev || lastCardN === null) { lastCardN = lc ? lc.n : 0; lastBuyN = lb ? lb.n : 0; }
  else {
    if (lb && lb.n !== lastBuyN) { lastBuyN = lb.n; animateCardBuy(lb); }
    if (lc && lc.n !== lastCardN) { lastCardN = lc.n; animateCardPlay(lc); }
  }
  if (!prev || prev.phase === 'lobby' && S.phase === 'lobby') return;
  const cards = st => { const p = st.players.find(x => x.id === st.me); return p ? p.cards : 0; };
  const sum = (st, f) => st.players.reduce((a, p) => a + (p[f] || 0), 0);
  if (S.phase === 'ended' && prev.phase !== 'ended') return celebrate();
  if (afterRoll) {
    const d = S.lastRoll.dice[1];
    // banditi zablokovali produkciu?
    const bh = S.bandits && S.hexes.find(h => h.k === S.bandits);
    if (bh && bh.building && bh.num === S.lastRoll.dice[0] + S.lastRoll.dice[1]) {
      anims.block = { kind: 'block', t0: performance.now() };
      renderBoard();
      setTimeout(() => FX.sound('block'), 250);
    }
    if (S.lastRoll.dice[0] + d === 7) { FX.sound('bandits'); banditAlarm(); }
    else if (d === 1) FX.sound('event');
    else if (d === 6) FX.sound('market');
    if (cards(S) > cards(prev)) setTimeout(() => FX.sound('gain'), d === 1 || d === 6 ? 450 : 150);
  } else if (prev.phase !== 'lobby') {
    if (sum(S, 'camps') + sum(S, 'towns') * 2 + sum(S, 'lighthouses') > sum(prev, 'camps') + sum(prev, 'towns') * 2 + sum(prev, 'lighthouses')) FX.sound('build');
    else if (sum(S, 'discoveries') > sum(prev, 'discoveries')) FX.sound('explore');
    else if (prev.bandits && S.bandits !== prev.bandits) FX.sound('bandits');

    if (S.log.at(-1) !== prev.log.at(-1) && / hrá kartu | kupuje rozvojovú kartu/.test(S.log.at(-1))) FX.sound('card');
    if (S.log.at(-1) !== prev.log.at(-1) && /vyháňajú banditov/.test(S.log.at(-1))) FX.sound('army');
  }
  const myTurnNow = st => st.current === st.me && (st.phase === 'play' || st.phase === 'setup');
  if (myTurnNow(S) && !myTurnNow(prev)) setTimeout(() => FX.sound('turn'), afterRoll ? 600 : 0);
}

const muteBtn = $('btnMute');
const syncMute = () => { muteBtn.textContent = FX.isMuted() ? '🔇' : '🔊'; muteBtn.title = FX.isMuted() ? 'Zapnúť zvuk' : 'Vypnúť zvuk'; };
muteBtn.onclick = () => { FX.setMuted(!FX.isMuted()); syncMute(); if (!FX.isMuted()) FX.sound('turn'); };
syncMute();

function send(m) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(m));
  else toast('Pripájam sa k serveru…');
}
const act = action => send({ t: 'act', action });

// ---------- úvod ----------
$('rulesText').innerHTML = RULES;
$('rulesText2').innerHTML = RULES;
const params = new URLSearchParams(location.search);
if (params.get('party')) $('code').value = params.get('party');
try { $('name').value = localStorage.getItem('suostrovie-name') || ''; } catch {}

function myName() {
  const n = $('name').value.trim();
  if (!n) { toast('Zadaj svoje meno.'); return null; }
  try { localStorage.setItem('suostrovie-name', n); } catch {}
  return n;
}
$('btnCreate').onclick = () => { const n = myName(); if (n) send({ t: 'create', name: n }); };
$('btnJoin').onclick = () => {
  const n = myName();
  const c = $('code').value.trim().toUpperCase();
  if (!c) return toast('Zadaj kód párty.');
  if (n) send({ t: 'join', code: c, name: n });
};
$('btnAddBot').onclick = () => {
  try { localStorage.setItem('suostrovie-botlevel', $('botLevel').value); } catch {}
  send({ t: 'addBot', level: $('botLevel').value });
};
try { const l = localStorage.getItem('suostrovie-botlevel'); if (l) $('botLevel').value = l; } catch {}
$('btnStart').onclick = () => send({ t: 'start', target: $('target').value });
$('btnLeave').onclick = () => send({ t: 'leave' });
$('btnCopy').onclick = () => {
  $('shareLink').select();
  navigator.clipboard?.writeText($('shareLink').value).then(() => toast('Odkaz skopírovaný.', true), () => {});
};
$('chatForm').onsubmit = e => {
  e.preventDefault();
  const v = $('chatInput').value.trim();
  if (v) send({ t: 'chat', text: v });
  $('chatInput').value = '';
};

// ---------- vykresľovanie ----------
function render() {
  if (!S) return show('home');
  if (S.phase === 'lobby') return renderLobby();
  show('game');
  renderStatus();
  renderBoard();
  renderPlayers();
  renderMine();
  renderCards();
  renderActions();
  renderTrade();
  renderContracts();
  renderLog();
}

function renderLobby() {
  prevMyRes = null;
  show('lobby');
  $('lobbyCode').textContent = S.code;
  $('shareLink').value = `${location.origin}${location.pathname}?party=${S.code}`;
  $('lobbyPlayers').innerHTML = S.players.map(p =>
    `<li class="${p.online ? '' : 'off'}"><span class="dot" style="background:${p.color}"></span>${esc(p.name)}
     ${p.id === S.host ? '<small class="muted">(zakladateľ)</small>' : ''}${p.id === S.me ? ' <small class="muted">(ty)</small>' : ''}
     ${p.bot ? (S.host === S.me
        ? `<select class="lvl" data-lvl="${p.id}">${Object.entries(LEVEL_NAMES).map(([k, v]) => `<option value="${k}" ${p.level === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
           <button class="ghost small" data-rmbot="${p.id}" title="Odobrať">✕</button>`
        : `<small class="muted lvlTag">${LEVEL_NAMES[p.level] || ''}</small>`) : ''}</li>`).join('');
  $('lobbyPlayers').querySelectorAll('[data-lvl]').forEach(sel => { sel.onchange = () => send({ t: 'botLevel', pid: sel.dataset.lvl, level: sel.value }); });
  $('lobbyPlayers').querySelectorAll('[data-rmbot]').forEach(b => { b.onclick = () => send({ t: 'removeBot', pid: b.dataset.rmbot }); });
  const host = S.host === S.me;
  $('btnAddBot').disabled = S.players.length >= 5;
  $('hostControls').hidden = !host;
  $('waitHost').hidden = host;
  $('btnStart').disabled = S.players.length < 2;
  $('btnStart').textContent = S.players.length < 2 ? 'Pridaj hráča alebo AI…' : 'Spustiť hru';
}

const me = () => S.players.find(p => p.id === S.me);
const pl = id => S.players.find(p => p.id === id);
const myTurn = () => S.current === S.me && (S.phase === 'setup' || S.phase === 'play');
const canPay = cost => RES.every(r => me().res[r] >= (cost[r] || 0));
const costStr = c => RES.filter(r => c[r]).map(r => `<span class="cst">${c[r] > 1 ? c[r] : ''}${icon(r, 14)}</span>`).join('');

function renderStatus() {
  const st = $('status');
  const cur = pl(S.current);
  let txt;
  if (S.phase === 'ended') {
    txt = `🏆 Vyhral(a) ${esc(pl(S.winner).name)}!`;
  } else if (S.phase === 'setup') {
    txt = myTurn() ? `Príprava (kolo ${S.setupRound}/2): klikni na voľnú pevninu a polož tábor.` : `Príprava: ${esc(cur.name)} kladie tábor…`;
  } else {
    const dice = S.dice ? ` · 🎲 ${DIE[S.dice[0]]} ${S.dice[0]} + ${DIE[S.dice[1]]} ${S.dice[1]} = <b>${S.dice[0] + S.dice[1]}</b>` : '';
    txt = (myTurn() ? (S.rolled ? 'Tvoj ťah' : 'Tvoj ťah – hoď kockami!') : `Na ťahu: ${esc(cur.name)}`) + dice
      + (S.market ? ' · 🛒 Trhový deň' : '');
  }
  if (S.pendingBandits && S.phase === 'play') {
    txt += myTurn()
      ? ` <br><b>🦹 Súčet 7! Ťukni na pole, kam presunieš banditov.</b> <a href="#" id="stayBandits">Nechať na mieste</a>`
      : ` <br><small>🦹 ${esc(cur.name)} presúva banditov…</small>`;
  } else if (mode && myTurn()) txt += ` <br><small>Vyber políčko na mape (${modeName(mode)}). <a href="#" id="cancelMode">Zrušiť</a></small>`;
  st.innerHTML = txt + (S.lastEvent ? `<div class="event">⚡ <b>${esc(S.lastEvent.name)}:</b> ${esc(S.lastEvent.text)}</div>` : '');
  st.className = 'status' + (myTurn() ? ' mine' : '');
  const sb = $('stayBandits');
  if (sb) sb.onclick = e => { e.preventDefault(); act({ type: 'moveBandits', hex: null }); };
  const c = $('cancelMode');
  if (c) c.onclick = e => { e.preventDefault(); mode = null; render(); };
}

function modeName(m) {
  if (m && m.startsWith('card:')) {
    const c = (me().devCards || []).find(x => x.id === m.slice(5));
    const d = c && cardDef(c.type);
    return d ? d.name : 'karta';
  }
  return { place: 'tábor', camp: 'tábor', town: 'mesto', lighthouse: 'maják', port: 'prístav', bridge: 'most', explore: 'výprava' }[m];
}

function hexMap() {
  const m = {};
  for (const h of S.hexes) m[h.q + ',' + h.r] = h;
  return m;
}

function validHexes() {
  if (!myTurn()) return new Set();
  const m = hexMap();
  const nbrs = h => DIRS.map(([a, b]) => m[(h.q + a) + ',' + (h.r + b)]).filter(Boolean);
  const own = h => h.building && h.building.owner === S.me;
  const adjOwn = h => nbrs(h).some(n => own(n) || n.bridge === S.me); // stavby aj mosty
  const land = h => h.revealed && h.terrain !== 'more';
  const out = new Set();
  const m2 = S.phase === 'setup' ? 'place' : S.pendingBandits ? 'bandits' : mode;
  for (const h of S.hexes) {
    let ok = false;
    if (m2 === 'place') ok = land(h) && !h.building;
    else if (m2 === 'camp') ok = land(h) && !h.building && adjOwn(h);
    else if (m2 === 'town') ok = own(h) && h.building.type === 'camp';
    else if (m2 === 'lighthouse') ok = own(h) && !h.lighthouse && h.coastal;
    else if (m2 === 'bridge') ok = h.revealed && h.terrain === 'more' && !h.bridge && adjOwn(h);
    else if (m2 === 'port') ok = own(h) && !h.port && h.coastal;
    else if (m2 && m2.startsWith('card:')) {
      const c = (me().devCards || []).find(x => x.id === m2.slice(5));
      const t = c && cardDef(c.type).target;
      if (t === 'hidden') ok = !h.revealed;
      else if (t === 'camp') ok = land(h) && !h.building && adjOwn(h);
    }
    else if (m2 === 'explore') ok = !h.revealed && adjOwn(h);
    else if (m2 === 'bandits') ok = land(h) && h.k !== S.bandits;
    if (ok) out.add(h.k);
  }
  return out;
}

// ---------- grafika polí ----------
const HEX_R = 46;
const hexPts = (x, y, r = HEX_R) => Array.from({ length: 6 }, (_, i) => {
  const a = Math.PI / 180 * (60 * i - 30);
  return `${(x + r * Math.cos(a)).toFixed(1)},${(y + r * Math.sin(a)).toFixed(1)}`;
}).join(' ');

function pine(x, y, s = 1) {
  return `<g transform="translate(${x},${y}) scale(${s})">
    <ellipse cx="2" cy="12" rx="9" ry="2.5" fill="#0003"/>
    <rect x="-1.6" y="5" width="3.2" height="7" fill="#5b3a1e"/>
    <path d="M0,-6 L12,8 L-12,8Z" fill="#1b4332"/><path d="M0,-6 L0,8 L-12,8Z" fill="#40916c"/>
    <path d="M0,-17 L9,1 L-9,1Z" fill="#1b4332"/><path d="M0,-17 L0,1 L-9,1Z" fill="#52b788"/>
  </g>`;
}
function rock(x, y, s = 1) {
  return `<g transform="translate(${x},${y}) scale(${s})">
    <ellipse cx="1" cy="7" rx="12" ry="2.5" fill="#0003"/>
    <path d="M-10,6 L-12,-2 L-5,-9 L5,-10 L12,-3 L10,6Z" fill="#6c757d" stroke="#343a40" stroke-width="1"/>
    <path d="M-12,-2 L-5,-9 L5,-10 L12,-3 L2,-1Z" fill="#ced4da"/>
    <path d="M2,-1 L12,-3 L10,6 L3,6Z" fill="#495057"/>
  </g>`;
}
function wheat(x, y, s = 1) {
  let g = `<g transform="translate(${x},${y}) scale(${s})" stroke="#8a5a14" stroke-width="1">`;
  for (const [dx, rot] of [[-4, -12], [0, 0], [4, 12]]) {
    g += `<g transform="translate(${dx},0) rotate(${rot})"><line x1="0" y1="8" x2="0" y2="-6"/>`;
    for (let i = 0; i < 3; i++) g += `<ellipse cx="-1.6" cy="${-8 + i * 3.5}" rx="1.6" ry="2.4" fill="#f4d35e"/><ellipse cx="1.6" cy="${-8 + i * 3.5}" rx="1.6" ry="2.4" fill="#e0b13a"/>`;
    g += '</g>';
  }
  return g + '</g>';
}
function saltPile(x, y, s = 1) {
  return `<g transform="translate(${x},${y}) scale(${s})">
    <ellipse cx="1" cy="6" rx="11" ry="2.5" fill="#0002"/>
    <path d="M-10,6 Q0,-14 10,6Z" fill="#ffffff" stroke="#8fa9b8" stroke-width="1"/>
    <path d="M0,-4 Q6,0 10,6 L3,6Z" fill="#d6e4ec"/>
  </g>`;
}
function wave(x, y, s = 1) {
  return `<g transform="translate(${x},${y}) scale(${s})"><path class="wv" d="M-12,0 q4,-5 8,0 t8,0 t8,0" fill="none" stroke="#bde0fe" stroke-width="2" stroke-linecap="round" opacity=".75"/></g>`;
}
function cloud(x, y, s = 1, c = '#2f4a6a') {
  return `<g transform="translate(${x},${y}) scale(${s})"><g class="cl" fill="${c}">
    <circle cx="-8" cy="2" r="7"/><circle cx="0" cy="-3" r="9"/><circle cx="9" cy="2" r="7"/><rect x="-15" y="2" width="31" height="7" rx="3.5"/></g></g>`;
}

// Vzory s realistickými textúrami (public/textures.js)
function texturePatterns() {
  if (!TEXTURES) return '';
  const pat = (id, url, size, x = 0, y = 0) => `<pattern id="tx-${id}" patternUnits="userSpaceOnUse" x="${x}" y="${y}" width="${size}" height="${size}">
    <image href="${url}" width="${size}" height="${size}" preserveAspectRatio="none"/></pattern>`;
  return ['les', 'lom', 'bana', 'pole', 'solnisko', 'more', 'hmla'].map(k => pat(k, TEXTURES[k], 96, -48, -48)).join('')
    + (TEXTURES.cshadow ? pat('cshadow', TEXTURES.cshadow, 320) : '')
    + pat('ocean', TEXTURES.ocean, 140) + pat('caustic', TEXTURES.caustic, 120) + pat('piesok', TEXTURES.piesok, 70);
}

const TILE_DEFS = (() => {
  const grad = (id, a, b) => `<radialGradient id="${id}" cx="40%" cy="30%" r="80%"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></radialGradient>`;
  const tile = (id, body) => `<g id="${id}" clip-path="url(#hexclip)">${body}<polygon points="${hexPts(0, 0)}" fill="url(#g-light)"/><polygon points="${hexPts(0, 0)}" fill="url(#g-ao)"/></g>`;
  const base = id => `<polygon points="${hexPts(0, 0)}" fill="url(#${TEXTURES && TEXTURES[id] ? 'tx' : 'g'}-${id})"/>`;
  const dots = (c, n, seed) => {
    let out = '', v = seed;
    for (let i = 0; i < n; i++) {
      v = (v * 9301 + 49297) % 233280;
      const a = v / 233280 * Math.PI * 2;
      v = (v * 9301 + 49297) % 233280;
      const d = 18 + v / 233280 * 24;
      out += `<circle cx="${(Math.cos(a) * d).toFixed(1)}" cy="${(Math.sin(a) * d).toFixed(1)}" r="1.4" fill="${c}"/>`;
    }
    return out;
  };
  return `<defs>
    <clipPath id="hexclip"><polygon points="${hexPts(0, 0)}"/></clipPath>
    ${Array.from({ length: BRIDGE_SEGS }, (_, i) => `<clipPath id="bseg${i}"><rect x="${(-2 + i * 6.2).toFixed(1)}" y="-14" width="6.45" height="28"/></clipPath>`).join('')}
    ${grad('g-les', '#5aa469', '#245c3b')}
    ${grad('g-lom', '#b8c1cc', '#6b7785')}
    ${grad('g-bana', '#a8714a', '#5a3620')}
    ${grad('g-pole', '#f6d77a', '#c9952a')}
    ${grad('g-solnisko', '#f4f9fc', '#a9c3d3')}
    ${grad('g-more', '#4f9bd9', '#1b4f86')}
    ${grad('g-hmla', '#273d58', '#131f30')}
    <radialGradient id="g-ao" cx="50%" cy="50%" r="55%"><stop offset=".72" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".34"/></radialGradient>
    <linearGradient id="g-earth" x1="0" y1="0" x2="0" y2="1"><stop offset=".55" stop-color="#7a5636"/><stop offset=".8" stop-color="#4f3520"/><stop offset="1" stop-color="#22160b"/></linearGradient>
    <radialGradient id="g-sun" cx="22%" cy="16%" r="60%"><stop offset="0" stop-color="#fff6d8" stop-opacity=".22"/><stop offset=".5" stop-color="#fff6d8" stop-opacity=".05"/><stop offset="1" stop-color="#fff6d8" stop-opacity="0"/></radialGradient>
    <linearGradient id="g-light" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/>
      <stop offset=".7" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".3"/></linearGradient>
    <linearGradient id="g-ocean" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1f6aa8"/><stop offset="1" stop-color="#0c3157"/></linearGradient>
    <radialGradient id="g-token" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#fffdf5"/><stop offset="1" stop-color="#e3d2a6"/></radialGradient>
    <radialGradient id="g-token-hot" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#ffd38a"/><stop offset="1" stop-color="#e98a1c"/></radialGradient>
    <radialGradient id="g-vignette" cx="50%" cy="50%" r="72%"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".45"/></radialGradient>
    <radialGradient id="g-glow"><stop offset="0" stop-color="#ffe680" stop-opacity=".9"/><stop offset="1" stop-color="#ffe680" stop-opacity="0"/></radialGradient>
    <filter id="f-shadow" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#000" flood-opacity=".45"/></filter>
    <pattern id="p-furrow" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(-30)">
      <rect width="8" height="3" fill="#b9831f" opacity=".35"/></pattern>

    ${texturePatterns()}

    ${tile('t-les', base('les'))}

    ${tile('t-lom', base('lom'))}

    ${tile('t-bana', base('bana')
      + '<g transform="translate(-24,20)"><path d="M-12,12 L-12,0 Q0,-14 12,0 L12,12Z" fill="#0d0805"/>'
      + '<path d="M-13,12 L-13,-1 Q0,-16 13,-1 L13,12" fill="none" stroke="#6b4423" stroke-width="3.2"/>'
      + '<path d="M-13,12 L-13,-1 Q0,-16 13,-1" fill="none" stroke="#a87444" stroke-width="1.2"/></g>'
      + '<path d="M-12,33 L34,33 M-12,37 L34,37" stroke="#2e1d10" stroke-width="1.4"/>'
      + '<path d="M-8,33 v4 M0,33 v4 M8,33 v4 M16,33 v4 M24,33 v4" stroke="#5a3b22" stroke-width="1.6"/>'
      + '<g transform="translate(20,28)"><path d="M-8,-6 L8,-6 L6,2 L-6,2Z" fill="#6d5442" stroke="#2e1d10" stroke-width=".8"/>'
      + '<path d="M-7,-6 q2,-4 5,-2 q3,-3 6,0 q3,-1 3,2Z" fill="#5d6f80"/><path d="M-3,-8 l2,-2 2,2 -2,1Z" fill="#8fe3ff"/>'
      + '<circle cx="-4" cy="3.5" r="2.2" fill="#222"/><circle cx="4" cy="3.5" r="2.2" fill="#222"/></g>')}

    ${tile('t-pole', base('pole'))}

    ${tile('t-solnisko', base('solnisko') + saltPile(-26, 18, 0.9) + saltPile(-14, 24, 0.7))}

    ${tile('t-more', base('more')
      + `<rect class="shimmer" x="-80" y="-80" width="160" height="160" fill="${TEXTURES ? 'url(#tx-caustic)' : 'none'}" opacity=".45"/>`)}

    ${tile('t-hmla', base('hmla')
      + '<text x="0" y="9" text-anchor="middle" font-size="22" font-weight="700" fill="#c8d6e6" fill-opacity=".35">?</text>')}
  </defs>`;
})();

function campSvg(x, y, c) {
  if (typeof SPRITES !== 'undefined' && SPRITES) return SPRITES.image('camp', x, y, c);
  return `<g transform="translate(${x},${y})">
    <ellipse cx="1" cy="10" rx="16" ry="3.5" fill="#0006"/>
    <path d="M-14,10 L0,-10 L14,10Z" fill="${c}" stroke="#111" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M0,-10 L14,10 L5,10Z" fill="#0003"/>
    <path d="M-3.5,10 L0,1 L3.5,10Z" fill="#1a1a1a"/>
    <line x1="0" y1="-10" x2="0" y2="-19" stroke="#111" stroke-width="1.5"/>
    <path d="M0,-19 L9,-16 L0,-13Z" fill="${c}" stroke="#111" stroke-width="1"/>
  </g>`;
}
function townSvg(x, y, c) {
  if (typeof SPRITES !== 'undefined' && SPRITES) return SPRITES.image('town', x, y, c);
  const crenel = (bx, by, w) => Array.from({ length: Math.floor(w / 4) }, (_, i) => i % 2 ? '' : `<rect x="${bx + i * 4}" y="${by - 3}" width="4" height="3"/>`).join('');
  return `<g transform="translate(${x},${y})" stroke="#111" stroke-width="1.3" fill="${c}">
    <ellipse cx="1" cy="12" rx="21" ry="3.5" fill="#0006" stroke="none"/>
    <rect x="-12" y="-4" width="24" height="16"/>
    <rect x="-20" y="-12" width="10" height="24"/><rect x="10" y="-12" width="10" height="24"/>
    ${crenel(-20, -12, 12)}${crenel(10, -12, 12)}${crenel(-12, -4, 25)}
    <rect x="10" y="-12" width="10" height="24" fill="#0003" stroke="none"/>
    <path d="M-4,12 L-4,4 Q0,-1 4,4 L4,12Z" fill="#1a1a1a"/>
    <rect x="-17" y="-6" width="3" height="5" fill="#1a1a1a" stroke="none"/><rect x="14" y="-6" width="3" height="5" fill="#1a1a1a" stroke="none"/>
    <line x1="0" y1="-4" x2="0" y2="-16"/><path d="M0,-16 L9,-13 L0,-10Z"/>
  </g>`;
}
function portSvg(x, y, c) {
  if (typeof SPRITES !== 'undefined' && SPRITES) return SPRITES.image('port', x, y, c);
  return `<g transform="translate(${x},${y})" stroke="#111" stroke-width="1">
    <ellipse cx="1" cy="12" rx="12" ry="2.8" fill="#0006" stroke="none"/>
    <rect x="-12" y="4" width="24" height="5" rx="1" fill="#8d5a2b"/>
    <path d="M-9,9 v5 M-2,9 v5 M5,9 v5" stroke="#5b3a1e" stroke-width="2"/>
    <g fill="none" stroke="${c}" stroke-width="2.6" stroke-linecap="round">
      <path d="M0,-11 V3"/><path d="M-5,-6 H5"/><path d="M-7,-1 Q0,7 7,-1"/>
    </g>
    <g fill="none" stroke="#111" stroke-width=".8"><circle cx="0" cy="-13" r="2.6"/></g>
    <circle cx="0" cy="-13" r="1.8" fill="none" stroke="${c}" stroke-width="1.6"/>
  </g>`;
}

function lighthouseSvg(x, y, c) {
  if (typeof SPRITES !== 'undefined' && SPRITES) return SPRITES.image('lighthouse', x, y, c);
  return `<g transform="translate(${x},${y})" stroke="#111" stroke-width="1">
    <circle cx="0" cy="-14" r="13" fill="url(#g-glow)" stroke="none"/>
    <ellipse cx="1" cy="16" rx="8" ry="2.5" fill="#0006" stroke="none"/>
    <path d="M-6,16 L-3.5,-8 L3.5,-8 L6,16Z" fill="#fdfdfd"/>
    <path d="M-5.4,10 L5.4,10 L4.9,5 L-4.9,5Z M-4.3,0 L4.3,0 L3.9,-4 L-3.9,-4Z" fill="${c}"/>
    <rect x="-4.5" y="-14" width="9" height="6" fill="#ffd166"/>
    <path d="M-6,-14 L0,-20 L6,-14Z" fill="#333"/>
  </g>`;
}

let lastBandits;
// Poplach pri súčte 7: nápis nad mapou a otras mapy
function banditAlarm() {
  const area = document.querySelector('.boardArea');
  if (!area) return;
  document.querySelectorAll('.banditAlarm').forEach(e => e.remove());
  const cur = pl(S.current);
  const el = document.createElement('div');
  el.className = 'banditAlarm';
  el.innerHTML = `<div class="ba-title">🦹 BANDITI!</div><div class="ba-sub">${S.current === S.me
    ? 'Ťukni na pole, kam ich pošleš' : esc(cur ? cur.name : '') + ' presúva banditov'}</div>`;
  area.appendChild(el);
  setTimeout(() => el.remove(), 2300);
  if (!reducedMotion()) {
    area.classList.remove('shake'); void area.offsetWidth; area.classList.add('shake');
    setTimeout(() => area.classList.remove('shake'), 700);
  }
}

function banditSvg(x, y, leap, waiting) {
  const cls = leap ? ' anim leap' : waiting ? ' wait' : '';
  if (typeof SPRITES !== 'undefined' && SPRITES) {
    return `<g class="bandit${cls}" transform="translate(${x},${y})"${leap ? ` style="${leap}"` : ''}>${SPRITES.image('bandit', 0, 0)}</g>`;
  }
  return `<g class="bandit${cls}" transform="translate(${x},${y})"${leap ? ` style="${leap}"` : ''}>
    <ellipse cx="1" cy="13" rx="12" ry="3.2" fill="#0008"/>
    <path d="M-11,13 Q-11,-1 0,-5 Q11,-1 11,13Z" fill="#2b2d31" stroke="#000" stroke-width="1.3"/>
    <path d="M0,-5 Q11,-1 11,13 L4,13 Q5,2 0,-5Z" fill="#0004"/>
    <circle cx="0" cy="-9" r="7.5" fill="#3a3d42" stroke="#000" stroke-width="1.3"/>
    <ellipse cx="0" cy="-7.5" rx="4.6" ry="4.2" fill="#121315"/>
    <circle cx="-1.8" cy="-8.4" r="1.1" fill="#ffcc33"/><circle cx="1.8" cy="-8.4" r="1.1" fill="#ffcc33"/>
    <path d="M-5,-5.2 Q0,-2.2 5,-5.2 L4,-3 Q0,-0.8 -4,-3Z" fill="#b23a48"/>
    <circle cx="9" cy="8" r="4" fill="#8d6e3f" stroke="#000" stroke-width="1"/>
    <path d="M7.4,5 l1.6,-2 l1.6,2" fill="none" stroke="#000" stroke-width="1"/>
  </g>`;
}

// Cesty: spojnice medzi susednými stavbami toho istého hráča; najdlhšia cesta je zvýraznená
// ---------- animácie stavania ----------
const ANIM_MS = 1600;            // ako dlho sa nová stavba považuje za „čerstvú“
let boardSnap = null;            // stav stavieb pri poslednom vykreslení
let soldierSnap = null, armySnap = null;
const MARCH_MS = 1150;           // ako dlho vojak pochoduje k posádke
const MARCH_FROM = [-78, 30];    // odkiaľ prichádza (relatívne k posádke)

// hlavná stavba hráča (mesto, inak prvý tábor) – pri nej stojí posádka
function capitalHex(pid) {
  const own = S.hexes.filter(h => h.building && h.building.owner === pid);
  return own.find(h => h.building.type === 'town') || own[0] || null;
}
const GARRISON = [-27, -16];     // poloha posádky voči stredu poľa
const G_SCALE = 0.92;

function garrisonSvg(pos) {
  if (typeof SPRITES === 'undefined' || !SPRITES) return '';
  let out = '';
  for (const p of S.players) {
    const n = p.soldiers || 0;
    const h = n && capitalHex(p.id);
    if (!h) continue;
    const [x, y] = pos(h);
    const gx = x + GARRISON[0], gy = y + GARRISON[1];
    const a = animOf('sold:' + p.id);
    const fig = (dx, dy, cls = '') => `<g transform="translate(${dx},${dy})">${cls}${SPRITES.image('soldier', 0, 0, p.color)}${cls ? '</g></g>' : ''}</g>`;
    let g = '';
    // zadní vojaci najprv, predný (najnovší) posledný
    if (n >= 3) g += fig(7, -3);
    if (n >= 2) g += fig(-7, -3);
    g += a ? fig(0, 0, `<g class="anim march" style="${a.style};--mx:${MARCH_FROM[0]}px;--my:${MARCH_FROM[1]}px"><g class="bob">`) : fig(0, 0);
    if (n >= 2) {
      g += `<g class="${a ? 'anim gbadge' : ''}"${a ? ` style="${a.style}"` : ''}><circle cx="9" cy="-26" r="6.2" fill="#0d1a2a" stroke="${p.color}" stroke-width="1.6"/>
        <text x="9" y="-23.4" text-anchor="middle" font-size="7.5" font-weight="800" fill="#fff" font-family="Nunito, sans-serif">${n}</text></g>`;
    }
    out += `<g transform="translate(${gx},${gy}) scale(${G_SCALE})">${g}</g>`;
    if (a) {
      // príchod: zlatý kruh a +1 ⚔️
      out += `<g class="anim" style="${a.style}"><circle class="ring" cx="${gx}" cy="${gy - 10}" r="14" fill="none" stroke="#ffd166" stroke-width="2.5"
          style="animation-delay:calc(var(--t) + ${MARCH_MS}ms)"/>
        <text class="floatvp" x="${gx}" y="${gy - 30}" text-anchor="middle" font-size="14" font-weight="800" fill="${p.color}" stroke="#0b1520"
          stroke-width="3.5" paint-order="stroke" style="animation-delay:calc(var(--t) + ${MARCH_MS}ms)">+1 ⚔️</text></g>`;
    }
  }
  return out;
}
let edgeSnap = null;             // spojnice (cesty) pri poslednom vykreslení
const anims = {};                // kľúč → { kind, t0 }
const pendingFx = [];            // časticové efekty, ktoré sa spustia po vykreslení mapy

// bod mapy (jednotky SVG) → bod obrazovky
function svgToScreen(x, y) {
  const svg = $('board');
  const m = svg && svg.getScreenCTM();
  if (!m) return null;
  const pt = svg.createSVGPoint();
  pt.x = x; pt.y = y;
  const p = pt.matrixTransform(m);
  return { x: p.x, y: p.y, s: Math.max(0.5, Math.min(1.6, m.a)) };
}

function runPendingFx(pos) {
  if (typeof PFX === 'undefined') { pendingFx.length = 0; return; }
  while (pendingFx.length) {
    const e = pendingFx.shift();
    if (e.kind === 'recruit') {
      const h = capitalHex(e.pid);
      if (!h) continue;
      const [x, y] = pos(h);
      const gx = x + GARRISON[0], gy = y + GARRISON[1];
      // prach pod nohami počas pochodu
      for (let i = 0; i <= 4; i++) {
        const f = i / 4;
        const q = svgToScreen(gx + MARCH_FROM[0] * G_SCALE * (1 - f), gy + MARCH_FROM[1] * G_SCALE * (1 - f));
        if (q) PFX.dust(q.x, q.y, q.s * 0.35, f * MARCH_MS / 1000, '170,150,115');
      }
      const end = svgToScreen(gx, gy - 10);
      if (end) PFX.sparks(end.x, end.y, end.s * 0.6, MARCH_MS / 1000);
      if (e.title && end) setTimeout(() => floatText({ x: end.x, y: end.y - 30 }, '🎖️ Najväčšie vojsko!', '#ffd166'), MARCH_MS + 300);
      FX.sound('march');
      continue;
    }
    if (e.kind === 'bandit') {
      const p = svgToScreen(e.x, e.y - 8), o = svgToScreen(e.ox, e.oy - 8);
      if (p) PFX.dust(p.x, p.y, p.s * 0.9, 0.6, '110,105,100');
      if (o) PFX.smoke(o.x, o.y, o.s * 0.8, 0.05);
      continue;
    }
    const h = S.hexes.find(x => x.k === e.k);
    if (!h) continue;
    const [x, y] = pos(h);
    const at = (dx, dy) => svgToScreen(x + dx, y + dy);
    let p;
    switch (e.kind) {
      case 'new': p = at(0, 36); if (p) PFX.dust(p.x, p.y, p.s, 0.33); break;
      case 'up': p = at(0, 22); if (p) { PFX.sparks(p.x, p.y, p.s, 0.25); PFX.smoke(p.x, p.y + 10, p.s, 0.1); PFX.dust(p.x, p.y + 14, p.s, 0.4); } break;
      case 'lh': p = at(27, 28); if (p) PFX.dust(p.x, p.y, p.s * 0.8, 0.45, '200,200,200'); break;
      case 'port': p = at(-27, 26); if (p) PFX.splash(p.x, p.y, p.s, 0.3); break;
      case 'bridge': {
        p = at(0, 0);
        if (p) PFX.splash(p.x, p.y, p.s, 0.05); // pilier sa vynorí
        for (const d of bridgeDirs(h)) {
          const ang = DIR_ANGLES[d] * Math.PI / 180;
          for (let i = 0; i < BRIDGE_SEGS; i += 2) {
            const dist = 2 + i * 6.2 + 3;
            const q = at(Math.cos(ang) * dist, Math.sin(ang) * dist);
            if (!q) continue;
            const t = (PLANK_START + i * PLANK_STEP + 180) / 1000;
            PFX.splash(q.x, q.y, q.s * 0.45, t);
            PFX.dust(q.x, q.y, q.s * 0.35, t, '150,105,60'); // triesky a piliny
          }
        }
        FX.sound('hammer');
      } break;
      case 'reveal': p = at(0, 0); if (p) PFX.sparks(p.x, p.y, p.s * 0.8, 0.15); break;
    }
  }
}

function trackBuildAnims() {
  const now = performance.now();
  const snap = {};
  for (const h of S.hexes) {
    snap[h.k] = { b: h.building ? h.building.type : '', L: !!h.lighthouse, P: !!h.port, R: !!h.revealed, B: !!h.bridge };
  }
  if (boardSnap) {
    for (const h of S.hexes) {
      const prev = boardSnap[h.k] || { b: '', L: false, P: false };
      const cur = snap[h.k];
      if (cur.b && !prev.b) { anims[h.k + ':b'] = { kind: 'new', t0: now }; pendingFx.push({ k: h.k, kind: 'new' }); }
      else if (cur.b === 'town' && prev.b === 'camp') { anims[h.k + ':b'] = { kind: 'up', t0: now }; pendingFx.push({ k: h.k, kind: 'up' }); }
      if (cur.L && !prev.L) { anims[h.k + ':L'] = { kind: 'lh', t0: now }; pendingFx.push({ k: h.k, kind: 'lh' }); }
      if (cur.P && !prev.P) { anims[h.k + ':P'] = { kind: 'port', t0: now }; pendingFx.push({ k: h.k, kind: 'port' }); }
      if (cur.B && prev.B === false) { anims[h.k + ':B'] = { kind: 'bridge', t0: now }; pendingFx.push({ k: h.k, kind: 'bridge' }); }
      if (cur.R && prev.R === false) { anims[h.k + ':r'] = { kind: 'reveal', t0: now }; pendingFx.push({ k: h.k, kind: 'reveal' }); }
    }
  }
  boardSnap = snap;
  // nový vojak → pochod k posádke
  const sold = {};
  for (const p of S.players) sold[p.id] = p.soldiers || 0;
  if (soldierSnap) {
    for (const p of S.players) {
      if ((sold[p.id] || 0) > (soldierSnap[p.id] || 0)) {
        anims['sold:' + p.id] = { kind: 'march', t0: now };
        pendingFx.push({ kind: 'recruit', pid: p.id, title: S.armyHolder === p.id && armySnap !== p.id });
      }
    }
  }
  soldierSnap = sold;
  armySnap = S.armyHolder || null;
  for (const k in anims) if (now - anims[k].t0 > ANIM_MS) delete anims[k];
}

// Atribúty pre animovaný prvok: záporné oneskorenie, aby prekreslenie animáciu nereštartovalo
function animOf(key) {
  const a = anims[key];
  if (!a) return null;
  return { kind: a.kind, style: `--t:-${Math.round(performance.now() - a.t0)}ms` };
}

function dustSvg(x, y, color = '#d9c7a0') {
  return Array.from({ length: 8 }, (_, i) => {
    const ang = Math.PI * (0.05 + 0.9 * i / 7);
    const dx = (Math.cos(ang) * 22).toFixed(1), dy = (-Math.sin(ang) * 9 - 2).toFixed(1);
    return `<circle class="dust" cx="${x}" cy="${y}" r="${3 + (i % 3)}" fill="${color}" style="--dx:${-dx}px;--dy:${dy}px"/>`;
  }).join('');
}

function buildFxSvg(x, y, kind, color, vp) {
  let fx = '';
  const hasPfx = typeof PFX !== 'undefined';
  if (kind === 'new' && !hasPfx) fx += dustSvg(x, y + 36);
  if (kind === 'up') {
    fx += `<circle class="ring" cx="${x}" cy="${y + 26}" r="22" fill="none" stroke="#ffd166" stroke-width="3"/>`;
    fx += Array.from({ length: 6 }, (_, i) => {
      const a = i / 6 * Math.PI * 2;
      return `<path class="spark" d="M${x},${y + 22} l0,-5" stroke="#fff3b0" stroke-width="2" stroke-linecap="round"
        style="--dx:${(Math.cos(a) * 26).toFixed(1)}px;--dy:${(Math.sin(a) * 18).toFixed(1)}px"/>`;
    }).join('');
  }
  if (kind === 'lh') {
    if (!hasPfx) fx += dustSvg(x + 27, y + 28, '#cfd6dc');
    fx += `<circle class="beam" cx="${x + 27}" cy="${y - 2}" r="16" fill="url(#g-glow)"/>`;
  }
  if (kind === 'port') {
    fx += [0, 1, 2].map(i => `<ellipse class="ripple" cx="${x - 27}" cy="${y + 26}" rx="10" ry="3.5" fill="none"
      stroke="#cfeaff" stroke-width="1.5" style="animation-delay:calc(var(--t) + ${i * 220}ms)"/>`).join('');
  }
  if (vp) {
    const tx = kind === 'lh' ? x + 27 : kind === 'port' ? x - 27 : x;
    const ty = kind === 'lh' || kind === 'port' ? y - 6 : y - 24;
    fx += `<text class="floatvp" x="${tx}" y="${ty}" text-anchor="middle" font-size="16" font-weight="800"
      fill="${color}" stroke="#0b1520" stroke-width="3.5" paint-order="stroke">+${vp}</text>`;
  }
  return fx;
}

function roadsSvg(pos) {
  const m = hexMap();
  const path = S.roadPath || [];
  const onPath = new Set(path.slice(1).map((k, i) => [path[i], k].sort().join('|')));
  let low = '', high = '';
  const now = performance.now();
  const edges = new Set();
  const owner = h => (h.building ? h.building.owner : h.bridge || null);
  for (const h of S.hexes) {
    if (!owner(h)) continue;
    for (const [dq, dr] of DIRS) {
      const n = m[(h.q + dq) + ',' + (h.r + dr)];
      if (!n || owner(n) !== owner(h) || n.k < h.k) continue;
      const [x1, y1] = pos(h);
      const [x2, y2] = pos(n);
      const c = pl(owner(h)).color;
      // pri moste vedie cesta do jeho stredu (mostovka ju prekryje)
      const d = `M${x1},${y1 + (h.building ? 30 : 0)} L${x2},${y2 + (n.building ? 30 : 0)}`;
      const ek = [h.k, n.k].sort().join('|');
      edges.add(ek);
      if (edgeSnap && !edgeSnap.has(ek)) anims['e:' + ek] = { kind: 'road', t0: now };
      const ea = animOf('e:' + ek);
      const open = ea ? `<g class="anim road-new" style="${ea.style}">` : '<g>';
      if (onPath.has(ek)) {
        high += `${open}<path d="${d}" stroke="#ffe08a" stroke-width="11" stroke-linecap="round" opacity=".55"/>
          <path d="${d}" stroke="#2b1d0e" stroke-width="7" stroke-linecap="round"/>
          <path d="${d}" stroke="${c}" stroke-width="4.5" stroke-linecap="round"/></g>`;
      } else {
        low += `${open}<path d="${d}" stroke="#2b1d0e" stroke-width="5.5" stroke-linecap="round" opacity=".8"/>
          <path d="${d}" stroke="${c}" stroke-width="3" stroke-linecap="round" stroke-dasharray="6 5"/></g>`;
      }
    }
  }
  edgeSnap = edges;
  return low + high;
}

// Oceán okolo ostrova s pomaly sa pohybujúcimi vlnami
function oceanSvg(x, y, w, h) {
  if (!TEXTURES) return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="22" fill="url(#g-ocean)"/>`;
  return `<clipPath id="oceanclip"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="22"/></clipPath>
    <g clip-path="url(#oceanclip)"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#tx-ocean)"/>
    <rect class="shimmer" x="${x - 120}" y="${y - 120}" width="${w + 240}" height="${h + 240}" fill="url(#tx-caustic)" opacity=".35"/>
    <rect class="shimmer2" x="${x - 120}" y="${y - 120}" width="${w + 240}" height="${h + 240}" fill="url(#tx-caustic)" opacity=".2"/>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#g-sun)"/>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#g-vignette)"/></g>`;
}

// bodky pod číslom: koľkými spôsobmi sa dá súčet hodiť (1–5)
function numberDots(x, y, n, hot) {
  const k = 6 - Math.abs(7 - n);
  let out = '';
  for (let i = 0; i < k; i++) out += `<circle cx="${(x + (i - (k - 1) / 2) * 3.1).toFixed(1)}" cy="${y}" r="1.05" fill="${hot ? '#fff' : n === 6 || n === 8 ? '#7a1e12' : '#4a3a28'}"/>`;
  return out;
}

// Most: stredový pilier a ramená ku každej susednej stavbe/mostu toho istého hráča
const DIR_ANGLES = [0, -60, -120, 180, 120, 60];
// smery ramien mosta: ku každej susednej stavbe/mostu toho istého hráča
function bridgeDirs(h) {
  const m = hexMap();
  const dirs = [];
  DIRS.forEach(([dq, dr], i) => {
    const n = m[(h.q + dq) + ',' + (h.r + dr)];
    if (n && ((n.building && n.building.owner === h.bridge) || n.bridge === h.bridge)) dirs.push(i);
  });
  if (!dirs.length) dirs.push(h.bridgeDir || 0);
  if (dirs.length === 1) dirs.push((dirs[0] + 3) % 6); // jediné spojenie → most prejde na protiľahlý breh
  return dirs;
}
function bridgeSvg(x, y, h, c) {
  const dirs = bridgeDirs(h);
  const sprites = typeof SPRITES !== 'undefined' && SPRITES;
  const a = animOf(h.k + ':B');
  const arm = sprites ? SPRITES.image('bridgeArm', 0, 0, c)
    : `<rect x="2" y="-5" width="40" height="10" fill="#8a5a30" stroke="#3d2614"/><rect x="2" y="-6.5" width="40" height="1.5" fill="${c}"/><rect x="2" y="5" width="40" height="1.5" fill="${c}"/>`;
  let out = '';
  // vlny okolo piliera, ktorý sa vynára z vody
  if (a) {
    out += `<g class="anim" style="${a.style}">${[0, 1, 2].map(i => `<ellipse class="ripple" cx="${x}" cy="${y + 2}" rx="13" ry="13"
      fill="none" stroke="#d6f0ff" stroke-width="1.6" style="animation-delay:calc(var(--t) + ${i * 260}ms)"/>`).join('')}</g>`;
  }
  dirs.forEach((d, arm_i) => {
    // pri stavbe sa dosky kladú postupne od piliera k brehu
    const inner = a
      ? Array.from({ length: BRIDGE_SEGS }, (_, i) => `<g class="anim plank" clip-path="url(#bseg${i})"
          style="${a.style};--i:${i + arm_i * 0.5}">${arm}</g>`).join('')
      : arm;
    out += `<g transform="translate(${x},${y}) rotate(${DIR_ANGLES[d]})">${inner}</g>`;
  });
  const hub = sprites ? SPRITES.image('bridgeHub', 0, 0, c) : `<circle r="8" fill="#8a5a30" stroke="#3d2614"/>`;
  out += `<g transform="translate(${x},${y})">${a ? `<g class="anim b-hub" style="${a.style}">${hub}</g>` : hub}</g>`;
  return out;
}

function renderBoard() {
  const svg = $('board');
  const R = HEX_R;
  const W = Math.sqrt(3) * R;
  const pos = h => [W * (h.q + h.r / 2), 1.5 * R * h.r];
  const xs = S.hexes.map(h => pos(h)[0]);
  const ys = S.hexes.map(h => pos(h)[1]);
  const pad = R + 30;
  const minX = Math.min(...xs) - pad, minY = Math.min(...ys) - pad;
  svg.setAttribute('viewBox', `${minX} ${minY} ${Math.max(...xs) - minX + pad} ${Math.max(...ys) - minY + pad}`);
  const valid = validHexes();
  const lastNum = S.dice ? S.dice[0] + S.dice[1] : null; // produkuje súčet oboch kociek
  let tiles = '', seaTiles = '', shore = '', pieces = '', marks = '', banditPiece = '', fxLayer = '', bridges = '';
  const landTiles = [];
  const DEPTH = 7; // hrúbka ostrova – pevnina je vyvýšená ako na makete
  trackBuildAnims();
  const wrap = (key, svgStr, x, y, color, vp) => {
    const a = animOf(key);
    if (!a) return svgStr;
    fxLayer += `<g class="anim" style="${a.style}">${buildFxSvg(x, y, a.kind, color, vp)}</g>`;
    return `<g class="anim b-${a.kind}" style="${a.style}">${svgStr}</g>`;
  };
  const banditMoved = lastBandits !== undefined && lastBandits !== S.bandits;
  if (banditMoved) {
    const from = S.hexes.find(h => h.k === lastBandits);
    const to = S.hexes.find(h => h.k === S.bandits);
    if (from && to) {
      const [fx, fy] = pos(from), [tx, ty] = pos(to);
      anims.bandit = { kind: 'leap', t0: performance.now(), fx: fx - tx, fy: fy - ty, ox: fx, oy: fy,
        chased: /vyháňajú banditov/.test(S.log.at(-1) || '') };
      pendingFx.push({ kind: 'bandit', x: tx, y: ty, ox: fx, oy: fy });
    }
  }
  lastBandits = S.bandits;
  for (const h of S.hexes) {
    const [x, y] = pos(h);
    const id = h.revealed ? h.terrain : 'hmla';
    const flip = ((h.q * 7 + h.r * 13) & 1) ? -1 : 1;
    const isLand = h.revealed && h.terrain !== 'more';
    let inner = (isLand ? `<polygon points="${hexPts(x, y + DEPTH)}" fill="url(#g-earth)" stroke="#1a0f06" stroke-opacity=".5" stroke-width="1"/>` : '')
      + `<use href="#t-${id}" transform="translate(${x},${y}) scale(${flip},1)"/>
      <polygon points="${hexPts(x, y, R - 2.5)}" fill="none" stroke="#ffffff" stroke-opacity=".14" stroke-width="1.5"/>
      <polygon class="edge" points="${hexPts(x, y)}" fill="none" stroke="#0b1520" stroke-opacity=".55" stroke-width="1.6"/>`;
    if (h.revealed && h.terrain !== 'more') {
      const hot = h.num === lastNum && S.rolled;
      inner += `<g class="token${hot && freshRoll ? ' pop' : ''}"><ellipse cx="${x + 1}" cy="${y + 5}" rx="15" ry="14" fill="#0006"/>
        <circle cx="${x}" cy="${y + 2}" r="14" fill="url(#${hot ? 'g-token-hot' : 'g-token'})" stroke="${hot ? '#fff' : '#8b6f47'}" stroke-width="2"/>
        <circle cx="${x}" cy="${y + 2}" r="11" fill="none" stroke="${hot ? '#fff6' : '#8b6f4755'}" stroke-width="1"/>
        <text x="${x}" y="${y + 6}" text-anchor="middle" font-size="${h.num > 9 ? 13.5 : 15.5}" font-weight="800" fill="${h.num === 6 || h.num === 8 ? '#7a1e12' : '#2b2118'}" font-family="Georgia, serif">${h.num}</text>
        ${numberDots(x, y + 11, h.num, hot)}</g>`;
    }
    const ra = animOf(h.k + ':r');
    const tileG = `<g class="hex${valid.has(h.k) ? ' valid' : ''}${ra ? ' anim t-reveal' : ''}" data-k="${h.k}"${ra ? ` style="${ra.style}"` : ''}>${inner}</g>`;
    if (ra) {
      fxLayer += `<g class="anim" style="${ra.style}"><use class="fog-out" href="#t-hmla" transform="translate(${x},${y})"/>
        <circle class="ring" cx="${x}" cy="${y}" r="30" fill="none" stroke="#ffd166" stroke-width="3"/>
        ${Array.from({ length: 8 }, (_, i) => { const a = i / 8 * Math.PI * 2; return `<path class="spark" d="M${x},${y} l0,-5" stroke="#fff3b0" stroke-width="2" stroke-linecap="round" style="--dx:${(Math.cos(a) * 40).toFixed(1)}px;--dy:${(Math.sin(a) * 34).toFixed(1)}px"/>`; }).join('')}</g>`;
    }
    if (h.revealed && h.terrain !== 'more') {
      landTiles.push([y, x, tileG]);
      shore += `<polygon points="${hexPts(x, y + DEPTH * 0.6, R + 10)}" fill="#e0f2ff" fill-opacity=".16"/>`;
      shore += `<polygon points="${hexPts(x, y + DEPTH * 0.6, R + 5)}" fill="${TEXTURES ? 'url(#tx-piesok)' : '#e6cf95'}" stroke="#bfa063" stroke-opacity=".6" stroke-width="1"/>`;
    } else {
      seaTiles += tileG;
    }
    if (valid.has(h.k)) marks += `<polygon class="hl" points="${hexPts(x, y, R - 2)}"/>`;
    if (h.bridge && pl(h.bridge)) bridges += bridgeSvg(x, y, h, pl(h.bridge).color);
    if (h.building) {
      const c = pl(h.building.owner).color;
      const winG = S.phase === 'ended' && h.building.owner === S.winner;
      if (winG) pieces += '<g class="winglow">';
      pieces += wrap(h.k + ':b', h.building.type === 'camp' ? campSvg(x, y + 26, c) : townSvg(x, y + 26, c), x, y, c, 1);
      if (h.lighthouse) pieces += wrap(h.k + ':L', lighthouseSvg(x + 27, y + 12, c), x, y, c, 1);
      if (h.port) pieces += wrap(h.k + ':P', portSvg(x - 27, y + 14, c), x, y, c, 1);
      if (winG) pieces += '</g>';
    }
    if (h.k === S.bandits) {
      marks = `<polygon points="${hexPts(x, y, R - 1)}" fill="#000" fill-opacity=".38"/>` + marks;
      const lp = animOf('bandit');
      const B = anims.bandit;
      banditPiece = banditSvg(x, y - 22, lp ? `${lp.style};--fx:${B.fx.toFixed(1)}px;--fy:${B.fy.toFixed(1)}px` : null,
        S.pendingBandits && S.phase === 'play');
      if (lp) {
        fxLayer += `<g class="anim" style="${lp.style}">`
          + (B.chased ? `<text class="swords" x="${B.ox}" y="${B.oy}" text-anchor="middle" font-size="30">⚔️</text>` : '')
          + (typeof PFX === 'undefined' ? `<g class="land">${dustSvg(x, y - 9, '#4a4a4a')}${dustSvg(x, y - 9)}</g>` : '') + '</g>';
      }
      const bl = animOf('block');
      if (bl) {
        const r = TERRAIN[h.terrain] && TERRAIN[h.terrain].res;
        fxLayer += `<g class="anim" style="${bl.style}">
          <circle class="blockring" cx="${x}" cy="${y + 2}" r="22" fill="none" stroke="#ff4d4d" stroke-width="4"/>
          <text class="blockno" x="${x}" y="${y + 12}" text-anchor="middle" font-size="30">🚫</text>
          ${r ? `<text class="blockres" x="${x + 4}" y="${y + 30}" text-anchor="middle" font-size="18" style="--bx:-4px;--by:-46px">${RES_ICON[r]}</text>` : ''}</g>`;
      }
    }
  }
  tiles = landTiles.sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(t => t[2]).join('');
  const vb = svg.viewBox.baseVal;
  const cloudShadows = TEXTURES && TEXTURES.cshadow ? `<g clip-path="url(#oceanclip)" pointer-events="none">
    <rect class="cshadow" x="${vb.x - 320}" y="${vb.y - 320}" width="${vb.width + 640}" height="${vb.height + 640}" fill="url(#tx-cshadow)"/></g>` : '';
  svg.innerHTML = TILE_DEFS + oceanSvg(vb.x, vb.y, vb.width, vb.height) + `<g>${seaTiles}</g><g class="shore">${shore}</g><g filter="url(#f-shadow)">${tiles}</g>${cloudShadows}<g pointer-events="none">${marks}${roadsSvg(pos)}${bridges}${pieces}${garrisonSvg(pos)}${banditPiece}${fxLayer}</g>`;
  runPendingFx(pos);
  svg.querySelectorAll('.hex.valid').forEach(g => {
    g.onclick = () => {
      const k = g.dataset.k;
      if (S.phase === 'setup') act({ type: 'place', hex: k });
      else if (S.pendingBandits) act({ type: 'moveBandits', hex: k });
      else if (mode && mode.startsWith('card:')) act({ type: 'playCard', id: mode.slice(5), hex: k });
      else if (mode === 'explore') act({ type: 'explore', hex: k });
      else act({ type: 'build', kind: mode, hex: k });
      mode = null;
    };
  });
  $('legend').innerHTML = Object.values(TERRAIN).map(t =>
    `<span><i style="background:${t.color}"></i>${t.name}${t.res ? ' ' + icon(t.res, 14) : ''}</span>`).join('')
    + '<span>⛺ tábor</span><span>🏰 mesto</span><span>🗼 maják</span><span>⚓ prístav</span><span>🌉 most</span><span>🛤️ cesta</span><span>🦹 banditi</span>';
}

function renderPlayers() {
  $('playersPanel').innerHTML = `<h3>Hráči · cieľ ${S.target} b.</h3>` + S.players.map(p => `
    <div class="prow ${p.id === S.current ? 'cur' : ''} ${p.online ? '' : 'off'}" data-pid="${p.id}">
      <span class="dot" style="background:${p.color}"></span>
      <span class="nm">${esc(p.name)}${p.bot ? ` <small>${(LEVEL_NAMES[p.level] || '').split(' ')[0]}</small>` : ''}${p.id === S.me ? ' (ty)' : ''}${p.online ? '' : ' 📴'}<br>
        <small class="stats">🃏 ${p.cards} · ⛺${p.camps} 🏰${p.towns} 🗼${p.lighthouses} ⚓${p.ports || 0} 🌉${p.bridges || 0} · 🧭${p.discoveries}${S.explorer === p.id ? ' 🏅' : ''} · 📜${p.contracts.length} · 🎴${p.devCount || 0} · 🛤️${p.roadLen || 0}${S.roadHolder === p.id ? ' ⭐' : ''} · ⚔️${p.soldiers || 0}${S.armyHolder === p.id ? ' 🎖️' : ''}</small></span>
      <span class="vp">${p.vp}</span>
    </div>`).join('')
    + (S.phase !== 'ended' && pl(S.current) && !pl(S.current).online && S.current !== S.me
      ? `<button id="btnSkip" style="margin-top:6px;width:100%">Preskočiť ťah odpojeného hráča</button>` : '');
  const b = $('btnSkip');
  if (b) b.onclick = () => send({ t: 'skip' });
}

const cardDef = type => (S.cardDefs || []).find(d => d.id === type) || { name: type, icon: '🎴', text: '' };

function renderCards() {
  const panel = $('cardsPanel');
  const cards = me().devCards || [];
  if (S.phase !== 'play' && S.phase !== 'ended') { panel.hidden = true; return; }
  panel.hidden = false;
  const canNow = myTurn() && S.phase === 'play' && S.rolled && !S.pendingBandits && !S.cardPlayed;
  let html = `<h3>Rozvojové karty <small class="muted">(v balíčku ${S.cardsLeft ?? 0})</small></h3>`;
  if (!cards.length) {
    html += '<p class="muted">Nemáš žiadne karty. Kúpiš ich v Akciách za obilie, rudu a soľ.</p>';
  }
  for (const c of cards) {
    const d = cardDef(c.type);
    const why = c.fresh ? 'kúpená v tomto ťahu' : S.cardPlayed && myTurn() ? 'už si hral(a) kartu' : '';
    html += `<div class="devcard${mode === 'card:' + c.id ? ' active' : ''}">
      <div class="dicon">${d.icon}</div>
      <div class="info"><b>${esc(d.name)}</b><div class="cost">${esc(d.text)}</div>${why ? `<small class="muted">${why}</small>` : ''}</div>
      ${S.phase === 'play' ? `<button data-card="${c.id}" ${canNow && !c.fresh ? '' : 'disabled'}>${mode === 'card:' + c.id ? 'Zrušiť' : 'Zahrať'}</button>` : ''}
    </div>`;
  }
  panel.innerHTML = html;
  panel.querySelectorAll('[data-card]').forEach(b => {
    b.onclick = () => {
      const c = cards.find(x => x.id === b.dataset.card);
      const d = cardDef(c.type);
      if (!d.target) { mode = null; return act({ type: 'playCard', id: c.id }); }
      mode = mode === 'card:' + c.id ? null : 'card:' + c.id;
      if (mode && !validHexes().size) { toast('Kartu teraz nie je kam zahrať.'); mode = null; }
      render();
    };
  });
}

let prevMyRes = null;
function renderMine() {
  const m = me();
  $('myPanel').innerHTML = `<h3>Tvoje suroviny</h3><div class="res">` +
    RES.map(r => `<div class="resbox" data-res="${r}">${icon(r, 28)}<b>${m.res[r]}</b>${RES_NAMES[r]}</div>`).join('') + '</div>';
  // +N / −N pri každej zmene surovín
  if (prevMyRes && S.phase !== 'lobby') {
    for (const r of RES) {
      const d = m.res[r] - prevMyRes[r];
      if (!d) continue;
      const box = $('myPanel').querySelector(`[data-res="${r}"]`);
      const tag = document.createElement('span');
      tag.className = 'delta ' + (d > 0 ? 'pos' : 'neg');
      tag.textContent = (d > 0 ? '+' : '−') + Math.abs(d);
      box.appendChild(tag);
      box.classList.add(d > 0 ? 'gain' : 'loss');
    }
  }
  prevMyRes = { ...m.res };
}

// ---------- animácie obchodu ----------
let lastTradeN = null;
const reducedMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const centerOf = el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };

function bankAnchor() {
  let b = document.getElementById('bankBadge');
  if (!b) {
    b = document.createElement('div');
    b.id = 'bankBadge';
    b.innerHTML = '<span>🏦</span><small>Banka</small>';
    document.body.appendChild(b);
  }
  const area = document.querySelector('.boardArea');
  const c = area ? centerOf(area) : { x: innerWidth / 2, y: innerHeight / 2 };
  const y = Math.min(Math.max(c.y, 90), innerHeight - 90);
  b.style.left = c.x + 'px';
  b.style.top = y + 'px';
  b.classList.remove('show');
  void b.offsetWidth; // reštart CSS animácie
  b.classList.add('show');
  clearTimeout(bankAnchor.tm);
  bankAnchor.tm = setTimeout(() => b.classList.remove('show'), 1900);
  return { x: c.x, y };
}

function anchorFor(pid, r, bank) {
  if (pid === null) return bank;
  if (pid === S.me) {
    const box = document.querySelector(`#myPanel [data-res="${r}"]`);
    if (box) return { ...centerOf(box), el: box };
  }
  const row = document.querySelector(`#playersPanel .prow[data-pid="${pid}"]`);
  if (!row) return null;
  return { ...centerOf(row.querySelector('.dot') || row), el: row };
}

function flyIcon(r, from, to, delay) {
  const el = document.createElement('div');
  el.className = 'flyer';
  el.innerHTML = icon(r, 30);
  el.style.left = from.x - 15 + 'px';
  el.style.top = from.y - 15 + 'px';
  document.body.appendChild(el);
  const dx = to.x - from.x, dy = to.y - from.y;
  const lift = -Math.min(140, 40 + Math.hypot(dx, dy) * 0.22);
  const a = el.animate([
    { transform: 'translate(0,0) scale(.4) rotate(0deg)', opacity: 0 },
    { transform: `translate(${dx * 0.5}px, ${dy * 0.5 + lift}px) scale(1.2) rotate(180deg)`, opacity: 1, offset: 0.5 },
    { transform: `translate(${dx}px, ${dy}px) scale(.75) rotate(360deg)`, opacity: 0.95 },
  ], { duration: 900, delay, easing: 'cubic-bezier(.45,0,.25,1)', fill: 'backwards' });
  a.onfinish = () => {
    el.remove();
    if (to.el) { to.el.classList.remove('got'); void to.el.offsetWidth; to.el.classList.add('got'); }
  };
}

// ---------- oslava víťazstva ----------
function celebrate() {
  FX.sound('win');
  const win = pl(S.winner);
  if (!win) return;
  document.querySelectorAll('.victory').forEach(e => e.remove());
  const ranks = [...S.players].sort((a, b) => b.vp - a.vp);
  const medal = ['🥇', '🥈', '🥉'];
  const meWon = S.winner === S.me;
  const el = document.createElement('div');
  el.className = 'victory';
  el.innerHTML = `<div class="v-rays"></div><div class="v-card">
      <div class="v-trophy">🏆</div>
      <div class="v-title">${meWon ? 'Víťazstvo!' : 'Koniec hry'}</div>
      <div class="v-sub">${meWon ? 'Vyhral(a) si' : `<b style="color:${win.color}">${esc(win.name)}</b> vyhráva`} s ${win.vp} bodmi</div>
      <ol class="v-rank">${ranks.map((p, i) => `<li style="--d:${700 + i * 160}ms">
        <span class="m">${medal[i] || (i + 1) + '.'}</span><span class="dot" style="background:${p.color}"></span>
        <span class="n">${esc(p.name)}${p.id === S.me ? ' (ty)' : ''}</span><b>${p.vp} b.</b></li>`).join('')}</ol>
      <button class="primary" id="vClose">Pozrieť mapu</button></div>`;
  document.body.appendChild(el);
  const close = () => { el.classList.add('out'); setTimeout(() => el.remove(), 400); };
  $('vClose').onclick = close;
  if (typeof PFX === 'undefined' || reducedMotion()) return;
  const colors = [...S.players.map(p => p.color), '#ffd166', '#ffffff'];
  PFX.confetti(170, colors);
  setTimeout(() => document.body.contains(el) && PFX.confetti(110, colors), 2600);
  let n = 0;
  const t = setInterval(() => {
    if (++n > 16 || !document.body.contains(el)) { clearInterval(t); return; }
    const c = colors[Math.floor(Math.random() * colors.length)];
    PFX.firework(innerWidth * (0.12 + Math.random() * 0.76), innerHeight * (0.1 + Math.random() * 0.32), c, () => FX.sound('boom'));
  }, 380);
}

// ---------- animácie rozvojových kariet ----------
let lastCardN = null, lastBuyN = null;

function hexScreen(k) {
  const svg = $('board');
  const h = (S.hexes || []).find(x => x.k === k);
  if (!svg || !h || !svg.getScreenCTM()) return null;
  const W = Math.sqrt(3) * HEX_R;
  const pt = svg.createSVGPoint();
  pt.x = W * (h.q + h.r / 2); pt.y = 1.5 * HEX_R * h.r;
  const p = pt.matrixTransform(svg.getScreenCTM());
  return { x: p.x, y: p.y };
}

function floatText(pt, text, color = '#ffd166', delay = 0) {
  if (!pt) return;
  const el = document.createElement('div');
  el.className = 'floattext';
  el.textContent = text;
  el.style.left = pt.x + 'px'; el.style.top = pt.y + 'px'; el.style.color = color;
  el.style.animationDelay = delay + 'ms';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1900 + delay);
}

function burst(pt, glyph, n = 8, delay = 0, spread = 60, up = false) {
  if (!pt) return;
  for (let i = 0; i < n; i++) {
    const el = document.createElement('div');
    el.className = 'particle';
    el.textContent = glyph;
    el.style.left = pt.x + 'px'; el.style.top = pt.y + 'px';
    document.body.appendChild(el);
    const a = up ? -Math.PI / 2 + (Math.random() - 0.5) * 1.4 : (i / n) * Math.PI * 2;
    const d = spread * (0.6 + Math.random() * 0.6);
    const an = el.animate([
      { transform: 'translate(-50%,-50%) scale(.3)', opacity: 0 },
      { opacity: 1, offset: 0.2 },
      { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d - (up ? 20 : 0)}px)) scale(1) rotate(${(Math.random() - 0.5) * 120}deg)`, opacity: 0 },
    ], { duration: 1100 + Math.random() * 400, delay: delay + i * 40, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'backwards' });
    an.onfinish = () => el.remove();
  }
}

function playerPoint(pid) {
  if (pid === S.me) {
    const c = document.querySelector('#cardsPanel h3') || document.querySelector('#myPanel');
    if (c) return centerOf(c);
  }
  const a = anchorFor(pid, RES[0]);
  return a ? { x: a.x, y: a.y } : null;
}

function animateCardBuy(lb) {
  if (reducedMotion()) return;
  const area = document.querySelector('.boardArea');
  const to = playerPoint(lb.by);
  if (!area || !to) return;
  const from = centerOf(area);
  const el = document.createElement('div');
  el.className = 'minicard';
  el.style.left = from.x + 'px'; el.style.top = from.y + 'px';
  document.body.appendChild(el);
  const an = el.animate([
    { transform: 'translate(-50%,-50%) scale(.2) rotate(-20deg)', opacity: 0 },
    { transform: 'translate(-50%,-50%) scale(1.2) rotate(0deg)', opacity: 1, offset: 0.3 },
    { transform: `translate(calc(-50% + ${to.x - from.x}px), calc(-50% + ${to.y - from.y}px)) scale(.4) rotate(14deg)`, opacity: 0.9 },
  ], { duration: 1100, easing: 'cubic-bezier(.45,0,.25,1)' });
  an.onfinish = () => el.remove();
}

function animateCardPlay(lc) {
  const d = cardDef(lc.type);
  const who = pl(lc.by) || { name: '?', color: '#fff' };
  const area = document.querySelector('.boardArea');
  if (!area) return;
  document.querySelectorAll('.cardshow').forEach(e => e.remove());
  const box = document.createElement('div');
  box.className = 'cardshow';
  box.innerHTML = `<div class="card3d">
      <div class="face back"><div class="emblem">🎴</div></div>
      <div class="face front">
        <div class="cicon">${d.icon}</div>
        <div class="cname">${esc(d.name)}</div>
        <div class="ctext">${esc(d.text)}</div>
        <div class="cby" style="--c:${who.color}">${lc.by === S.me ? 'Hráš ty' : 'Hrá ' + esc(who.name)}</div>
      </div></div>`;
  area.appendChild(box);
  const reduced = reducedMotion();
  // efekty po otočení karty
  setTimeout(() => cardEffect(lc), reduced ? 0 : 750);
  // karta odletí k hráčovi
  setTimeout(() => {
    const to = playerPoint(lc.by);
    const card = box.querySelector('.card3d');
    if (reduced || !to || !card) { box.remove(); return; }
    const from = centerOf(card);
    const an = card.animate([
      { transform: 'translate(0,0) scale(1)', opacity: 1 },
      { transform: `translate(${to.x - from.x}px, ${to.y - from.y}px) scale(.15) rotate(18deg)`, opacity: 0 },
    ], { duration: 650, easing: 'cubic-bezier(.5,0,.75,0)', fill: 'forwards' });
    an.onfinish = () => box.remove();
  }, reduced ? 1600 : 2300);
  box.onclick = () => box.remove();
}

function cardEffect(lc) {
  if (reducedMotion()) return;
  const at = playerPoint(lc.by);
  switch (lc.type) {
    case 'uroda':
      for (const h of S.hexes) {
        if (!h.building || h.building.owner !== lc.by || h.k === S.bandits) continue;
        const p = hexScreen(h.k);
        burst(p, '🍃', 4, 0, 40, true);
        burst(p, '✨', 3, 150, 34, true);
      }
      break;
    case 'pasaci':
      for (const vid in lc.steals || {}) {
        let i = 0;
        for (const r in lc.steals[vid]) {
          const a = anchorFor(vid, r), b = anchorFor(lc.by, r);
          if (a && b) flyIcon(r, a, b, i++ * 120);
        }
      }
      burst(at, '🏴‍☠️', 1, 0, 1);
      break;
    case 'kupec':
      burst(at, '🪙', 10, 0, 70);
      floatText(at, '2:1', '#ffd166', 100);
      break;
    case 'listina':
      burst(at, '✨', 10, 0, 60);
      floatText(at, '+1 bod', '#ffd166', 100);
      break;
    case 'kompas':
      burst(at, '✨', 6, 0, 50);
      floatText(at, '+1 🧭', '#9fd1ff', 100);
      break;
    case 'mapa':
      if (lc.hex) burst(hexScreen(lc.hex), '✨', 10, 200, 70);
      break;
  }
}

function animateTrade(t) {
  FX.sound(t.kind === 'bank' ? 'coins' : 'trade');
  if (reducedMotion()) return;
  const bank = t.to === null ? bankAnchor() : null;
  const send = (bundle, fromPid, toPid, start) => {
    let i = 0;
    for (const r of RES) {
      for (let k = 0; k < Math.min(bundle[r] || 0, 4); k++) {
        const a = anchorFor(fromPid, r, bank), b = anchorFor(toPid, r, bank);
        if (a && b) flyIcon(r, a, b, start + i++ * 110);
      }
    }
    return i;
  };
  const n = send(t.give, t.from, t.to, 0);
  send(t.get, t.to, t.from, 380 + Math.max(0, n - 3) * 110);
  if (t.to !== null) {
    // 🤝 medzi obchodníkmi
    const a = anchorFor(t.from, RES[0]), b = anchorFor(t.to, RES[0]);
    if (a && b) {
      const h = document.createElement('div');
      h.className = 'handshake';
      h.textContent = t.kind === 'port' ? '⚓🤝' : '🤝';
      h.style.left = (a.x + b.x) / 2 + 'px';
      h.style.top = (a.y + b.y) / 2 + 'px';
      document.body.appendChild(h);
      setTimeout(() => h.remove(), 1600);
    }
  }
}

function renderActions() {
  const p = $('actionsPanel');
  if (S.phase === 'ended') {
    p.innerHTML = `<div class="banner">🏆 ${esc(pl(S.winner).name)} vyhral(a)!</div>
      <button id="btnHome" style="width:100%;margin-top:8px">Späť na úvod</button>`;
    $('btnHome').onclick = () => send({ t: 'leave' });
    return;
  }
  if (!myTurn() || S.phase === 'setup') {
    p.innerHTML = `<h3>Akcie</h3><p class="muted">${myTurn() ? 'Polož tábor na mapu.' : 'Počkaj na svoj ťah.'}</p>`;
    return;
  }
  if (S.pendingBandits) {
    p.innerHTML = `<h3>Akcie</h3><p>🦹 <b>Súčet 7!</b> Ťukni na pole na mape, kam presunieš banditov.
      Pole s banditmi nič neprodukuje.</p><button id="btnStay" style="width:100%">Nechať banditov na mieste</button>`;
    $('btnStay').onclick = () => act({ type: 'moveBandits', hex: null });
    return;
  }
  const dis = (cost, extra) => (!S.rolled || !canPay(cost) || extra) ? 'disabled' : '';
  const m = me();
  p.innerHTML = `<h3>Akcie</h3><div class="btns">
    ${!S.rolled ? '<button id="btnRoll" class="primary wide">🎲 Hodiť kockami</button>' : ''}
    <button data-mode="camp" ${dis(COSTS.camp, m.camps >= 6)} class="${mode === 'camp' ? 'active' : ''}">⛺ Tábor<small>${costStr(COSTS.camp)}</small></button>
    <button data-mode="town" ${dis(COSTS.town, m.towns >= 4 || !m.camps)} class="${mode === 'town' ? 'active' : ''}">🏰 Mesto<small>${costStr(COSTS.town)}</small></button>
    <button data-mode="lighthouse" ${dis(COSTS.lighthouse, m.lighthouses >= 3)} class="${mode === 'lighthouse' ? 'active' : ''}">🗼 Maják<small>${costStr(COSTS.lighthouse)}</small></button>
    <button data-mode="port" ${dis(COSTS.port, (m.ports || 0) >= 2)} class="${mode === 'port' ? 'active' : ''}">⚓ Prístav<small>${costStr(COSTS.port)}</small></button>
    <button data-mode="bridge" ${dis(COSTS.bridge, (m.bridges || 0) >= 4)} class="${mode === 'bridge' ? 'active' : ''}">🌉 Most<small>${costStr(COSTS.bridge)}</small></button>
    <button data-mode="explore" ${dis(COSTS.explore)} class="${mode === 'explore' ? 'active' : ''}">🧭 Výprava<small>${costStr(COSTS.explore)}</small></button>
    <button id="btnRecruit" ${dis(S.soldierCost || {}, (m.soldiers || 0) >= 10)}>⚔️ Vojak<small>${costStr(S.soldierCost || {})}</small></button>
    ${S.rolled && !S.chased && (m.soldiers || 0) > 0 && S.bandits && (hexMap()[S.bandits] || {}).building && hexMap()[S.bandits].building.owner === S.me
      ? '<button id="btnChase" class="wide">🗡️ Vyhnať banditov z môjho poľa</button>' : ''}
    <button id="btnBuyCard" ${dis(S.cardCost || {}, !S.cardsLeft)} title="Zostáva ${S.cardsLeft || 0} kariet">🎴 Rozvojová karta<small>${costStr(S.cardCost || {})}</small></button>
    ${S.rolled ? '<button id="btnEnd" class="primary wide">Ukončiť ťah ➜</button>' : ''}
  </div>`;
  if ($('btnRoll')) $('btnRoll').onclick = () => act({ type: 'roll' });
  if ($('btnBuyCard')) $('btnBuyCard').onclick = () => act({ type: 'buyCard' });
  if ($('btnRecruit')) $('btnRecruit').onclick = () => act({ type: 'recruit' });
  if ($('btnChase')) $('btnChase').onclick = () => act({ type: 'chaseBandits' });
  if ($('btnEnd')) $('btnEnd').onclick = () => { mode = null; act({ type: 'endTurn' }); };
  p.querySelectorAll('[data-mode]').forEach(b => {
    b.onclick = () => {
      mode = mode === b.dataset.mode ? null : b.dataset.mode;
      if (mode && !validHexes().size) { toast('Nie je kde to postaviť.'); mode = null; }
      render();
    };
  });
}

let tradeDraft = { give: {}, want: {} };
let bankGive = 'drevo', bankGet = 'kamen';

function renderTrade() {
  const p = $('tradePanel');
  if (S.phase !== 'play') { p.innerHTML = ''; p.hidden = true; return; }
  p.hidden = false;
  const active = myTurn() && S.rolled;
  let html = '<h3>Obchod</h3>';
  if (S.offer) {
    const from = pl(S.offer.from);
    const fmt = o => RES.filter(r => o[r]).map(r => `<span class="cst">${o[r]}× ${icon(r, 15)}</span>`).join('');
    html += `<div class="offer"><div><b style="color:${from.color}">${esc(from.name)}</b> ponúka <b>${fmt(S.offer.give)}</b> za <b>${fmt(S.offer.want)}</b></div>
      ${S.offer.from === S.me ? '<button id="btnCancelOffer">Stiahnuť ponuku</button>'
        : `<button id="btnAccept" class="primary" ${canPay(S.offer.want) ? '' : 'disabled'}>Prijať obchod</button>`}</div>`;
  }
  if (active) {
    const opts = sel => RES.map(r => `<option value="${r}" ${r === sel ? 'selected' : ''}>${RES_ICON[r]} ${RES_NAMES[r]}</option>`).join('');
    const rates = S.bankRates || Object.fromEntries(RES.map(r => [r, S.bankRate]));
    const rateOpts = sel => RES.map(r => `<option value="${r}" ${r === sel ? 'selected' : ''}>${RES_ICON[r]} ${RES_NAMES[r]}</option>`).join('');
    html += `<p class="muted" style="margin:8px 0 4px">S bankou – kurz: ${RES.map(r =>
        `<span class="rate${rates[r] === 2 ? ' best' : rates[r] === 3 ? ' good' : ''}" title="${rateWhy(rates[r], r)}">${icon(r, 14)}${rates[r]}:1</span>`).join(' ')}</p>
      <div class="row"><select id="bankGive">${rateOpts(bankGive)}</select><span style="align-self:center">➜</span>
      <select id="bankGet">${opts(bankGet)}</select><button id="btnBank">Vymeniť ${rates[bankGive]}:1</button></div>`;
    if (!S.offer) {
      html += `<p class="muted" style="margin:10px 0 4px">Ponuka hráčom</p><div class="tradeGrid"><span></span>
        ${RES.map(r => `<span style="text-align:center">${icon(r, 18)}</span>`).join('')}
        <span>Dám</span>${RES.map(r => `<input type="number" min="0" max="${me().res[r]}" data-g="${r}" value="${tradeDraft.give[r] || 0}">`).join('')}
        <span>Chcem</span>${RES.map(r => `<input type="number" min="0" max="20" data-w="${r}" value="${tradeDraft.want[r] || 0}">`).join('')}
        </div><button id="btnOffer" style="width:100%;margin-top:6px">Ponúknuť ostatným</button>`;
    }
  } else if (!S.offer) {
    html += '<p class="muted">Obchodovať môže hráč na ťahu. Jeho ponuky sa zobrazia tu.</p>';
  }
  html += renderPortTrade();
  // zachovaj rozpísané pole pri prekreslení (iní hráči môžu konať aj počas písania)
  const focused = document.activeElement && p.contains(document.activeElement) ? document.activeElement : null;
  const fKey = focused && ['g', 'w', 'pg', 'pw'].map(a => focused.dataset[a] && a + ':' + focused.dataset[a]).find(Boolean);
  p.innerHTML = html;
  if (fKey) {
    const [a, r] = fKey.split(':');
    const el = p.querySelector(`[data-${a}="${r}"]`);
    if (el) el.focus();
  }
  p.querySelectorAll('[data-pg]').forEach(i => { i.oninput = () => { portDraft.give[i.dataset.pg] = +i.value; }; });
  p.querySelectorAll('[data-pw]').forEach(i => { i.oninput = () => { portDraft.want[i.dataset.pw] = +i.value; }; });
  if ($('btnPortOffer')) $('btnPortOffer').onclick = () => {
    act({ type: 'portOffer', give: portDraft.give, want: portDraft.want });
    portDraft = { give: {}, want: {} };
  };
  p.querySelectorAll('[data-paccept]').forEach(b => { b.onclick = () => act({ type: 'portAccept', id: b.dataset.paccept }); });
  p.querySelectorAll('[data-pcancel]').forEach(b => { b.onclick = () => act({ type: 'portCancel', id: b.dataset.pcancel }); });
  if ($('btnAccept')) $('btnAccept').onclick = () => act({ type: 'acceptOffer' });
  if ($('btnCancelOffer')) $('btnCancelOffer').onclick = () => act({ type: 'cancelOffer' });
  if ($('btnBank')) {
    $('bankGive').onchange = e => { bankGive = e.target.value; renderTrade(); };
    $('bankGet').onchange = e => { bankGet = e.target.value; };
    $('btnBank').onclick = () => act({ type: 'bankTrade', give: bankGive, get: bankGet });
  }
  p.querySelectorAll('[data-g]').forEach(i => { i.oninput = () => { tradeDraft.give[i.dataset.g] = +i.value; }; });
  p.querySelectorAll('[data-w]').forEach(i => { i.oninput = () => { tradeDraft.want[i.dataset.w] = +i.value; }; });
  if ($('btnOffer')) $('btnOffer').onclick = () => {
    act({ type: 'offer', give: tradeDraft.give, want: tradeDraft.want });
    tradeDraft = { give: {}, want: {} };
  };
}

let portDraft = { give: {}, want: {} };

function rateWhy(rate, r) {
  if (rate === 2) return S.market ? 'Trhový deň / Kupec' : 'tvoj prístav na poli s touto surovinou';
  if (rate === 3) return 'maják';
  return 'bežný kurz';
}

function renderPortTrade() {
  const mine = me();
  const hasPort = (mine.ports || 0) > 0;
  const offers = S.portOffers || [];
  const fmt = o => RES.filter(r => o[r]).map(r => `<span class="cst">${o[r]}× ${icon(r, 15)}</span>`).join('');
  let html = '<h3 style="margin-top:14px">⚓ Námorný obchod</h3>';
  for (const o of offers) {
    const from = pl(o.from);
    const own = o.from === S.me;
    html += `<div class="offer port"><div><b style="color:${from.color}">${esc(from.name)}</b> ponúka <b>${fmt(o.give)}</b> za <b>${fmt(o.want)}</b></div>
      ${own ? `<button data-pcancel="${o.id}">Stiahnuť ponuku</button>`
        : hasPort ? `<button data-paccept="${o.id}" class="primary" ${canPay(o.want) ? '' : 'disabled'}>Prijať cez prístav</button>`
        : '<small class="muted">Na prijatie potrebuješ prístav.</small>'}</div>`;
  }
  if (!hasPort) {
    return html + `<p class="muted">${offers.length ? '' : 'Zatiaľ žiadne ponuky. '}Postav ⚓ prístav na pobreží a môžeš obchodovať s ostatnými prístavmi kedykoľvek – aj keď nie si na ťahu.</p>`;
  }
  if (!offers.length) html += '<p class="muted">Zatiaľ žiadne ponuky.</p>';
  html += `<p class="muted" style="margin:8px 0 4px">${offers.some(o => o.from === S.me) ? 'Nová ponuka nahradí tvoju súčasnú.' : 'Ponuka pre hráčov s prístavom (platí 1 kolo)'}</p>
    <div class="tradeGrid"><span></span>
    ${RES.map(r => `<span style="text-align:center">${icon(r, 18)}</span>`).join('')}
    <span>Dám</span>${RES.map(r => `<input type="number" min="0" max="${mine.res[r]}" data-pg="${r}" value="${portDraft.give[r] || 0}">`).join('')}
    <span>Chcem</span>${RES.map(r => `<input type="number" min="0" max="20" data-pw="${r}" value="${portDraft.want[r] || 0}">`).join('')}
    </div><button id="btnPortOffer" style="width:100%;margin-top:6px">⚓ Poslať cez prístav</button>`;
  return html;
}

function renderContracts() {
  const can = myTurn() && S.rolled && S.phase === 'play';
  $('contractsPanel').innerHTML = `<h3>Zákazky (v balíčku ${S.contractsLeft})</h3>` + (S.contracts.map(c => `
    <div class="contract"><div class="info"><b>${esc(c.name)}</b> · ${c.vp} b.<div class="cost">${costStr(c.cost)}</div></div>
    ${can ? `<button data-c="${c.id}" ${canPay(c.cost) ? '' : 'disabled'}>Splniť</button>` : ''}</div>`).join('') || '<p class="muted">Žiadne zákazky.</p>');
  $('contractsPanel').querySelectorAll('[data-c]').forEach(b => { b.onclick = () => act({ type: 'fulfill', id: b.dataset.c }); });
}

function renderLog() {
  if (!S || S.phase === 'lobby') return;
  const el = $('log');
  const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 30;
  el.innerHTML = S.log.map(l => `<div class="sys">${esc(l)}</div>`).join('')
    + chatLines.map(c => `<div class="chat"><b style="color:${c.color}">${esc(c.name)}:</b> ${esc(c.text)}</div>`).join('');
  if (atBottom || renderLog.first !== false) el.scrollTop = el.scrollHeight;
  renderLog.first = false;
}

// Ilustrácia ostrova na úvodnej obrazovke
function renderHero() {
  const svg = $('hero');
  if (!svg || svg.childElementCount) return;
  const R = HEX_R, W = Math.sqrt(3) * R;
  const cells = [[0, 0, 'pole'], [1, 0, 'les'], [0, 1, 'bana'], [-1, 1, 'solnisko'], [-1, 0, 'lom'], [0, -1, 'les'], [1, -1, 'more']];
  let shore = '', tiles = '';
  for (const [q, r, t] of cells) {
    const x = W * (q + r / 2), y = 1.5 * R * r;
    if (t !== 'more') {
      shore += `<polygon points="${hexPts(x, y, R + 10)}" fill="#e0f2ff" fill-opacity=".16"/><polygon points="${hexPts(x, y, R + 5)}" fill="${TEXTURES ? 'url(#tx-piesok)' : '#e6cf95'}" stroke="#bfa063" stroke-opacity=".6"/>`;
    }
    tiles += `<use href="#t-${t}" transform="translate(${x},${y})"/><polygon points="${hexPts(x, y)}" fill="none" stroke="#0b1520" stroke-opacity=".5" stroke-width="1.6"/>`;
  }
  svg.innerHTML = TILE_DEFS + oceanSvg(-150, -110, 300, 220) + shore + `<g filter="url(#f-shadow)">${tiles}</g>`
    + campSvg(0, 26, '#e4572e') + townSvg(W, 24, '#2e86de') + lighthouseSvg(W + 27, 12, '#2e86de')
    + portSvg(-W - 22, 14, '#f2c14e') + banditSvg(W / 2, 1.5 * R - 22, false);
}
renderHero();

connect();
