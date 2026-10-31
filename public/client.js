'use strict';

const RES = ['drevo', 'kamen', 'ruda', 'obilie', 'sol'];
const RES_NAMES = { drevo: 'Drevo', kamen: 'Kameň', ruda: 'Ruda', obilie: 'Obilie', sol: 'Soľ' };
const RES_ICON = { drevo: '🪵', kamen: '🪨', ruda: '⛏️', obilie: '🌾', sol: '🧂' };
const TERRAIN = {
  les: { name: 'Les', color: '#3f8a52', res: 'drevo' },
  lom: { name: 'Lom', color: '#97a2b0', res: 'kamen' },
  bana: { name: 'Baňa', color: '#80522f', res: 'ruda' },
  pole: { name: 'Pole', color: '#e4b84e', res: 'obilie' },
  solnisko: { name: 'Soľnisko', color: '#d3e2eb', res: 'sol' },
  more: { name: 'More', color: '#3577b5' },
};
const COSTS = {
  camp: { drevo: 1, kamen: 1, obilie: 1 },
  town: { ruda: 2, obilie: 2, sol: 1 },
  lighthouse: { kamen: 2, drevo: 1, sol: 1 },
  explore: { drevo: 1, obilie: 1 },
};
const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
const DIE = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

const RULES = `
<p><b>Cieľ:</b> ako prvý dosiahni stanovený počet bodov (štandardne 12) počas svojho ťahu.</p>
<ul>
<li><b>Mapa:</b> šesťuholníkové súostrovie. Stred je odkrytý, vonkajší okruh je zahalený v hmle a treba ho objaviť.</li>
<li><b>Príprava:</b> hráči postupne (tam a späť) položia 2 tábory na ľubovoľnú voľnú odkrytú pevninu. Za každý dostanú 1 surovinu z jej políčka.</li>
<li><b>Hod:</b> na začiatku ťahu hodíš dvoma kockami – <b>kockou produkcie</b> a <b>kockou udalostí</b>.
  Každá stavba na políčku s číslom kocky produkcie dá majiteľovi surovinu (tábor 1, mesto 2).</li>
<li><b>Kocka udalostí:</b> 1 = ťahá sa karta udalosti (Búrka, Hojnosť, Piráti, Obchodná loď, Sucho, Nález). 6 = Trhový deň – meníš s bankou 2:1.</li>
<li><b>Stavby</b> zaberajú celé políčko (jedna stavba na políčko):
  <ul>
  <li>⛺ <b>Tábor</b> (drevo, kameň, obilie) – 1 bod. Musí susediť s tvojou stavbou. Max. 6.</li>
  <li>🏰 <b>Mesto</b> (2 ruda, 2 obilie, soľ) – vylepší tábor, 2 body a dvojitá produkcia. Max. 4.</li>
  <li>🗼 <b>Maják</b> (2 kameň, drevo, soľ) – na pobrežnej stavbe, 1 bod, výmena s bankou 3:1 a ochrana pred pirátmi. Max. 3.</li>
  </ul></li>
<li>🧭 <b>Výprava</b> (drevo, obilie): odkry zahalené políčko vedľa svojej stavby. Ak je to pevnina, dostaneš 1 jej surovinu. Kto má najviac objavov (aspoň 3), je <b>Veľký objaviteľ</b> (+2 body).</li>
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
      S = m.state;
      if (S.phase === 'play' && S.current !== S.me && mode) mode = null;
      render();
    } else if (m.t === 'error') {
      toast(m.msg);
    } else if (m.t === 'chat') {
      chatLines.push(m);
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
  renderActions();
  renderTrade();
  renderContracts();
  renderLog();
}

function renderLobby() {
  show('lobby');
  $('lobbyCode').textContent = S.code;
  $('shareLink').value = `${location.origin}${location.pathname}?party=${S.code}`;
  $('lobbyPlayers').innerHTML = S.players.map(p =>
    `<li class="${p.online ? '' : 'off'}"><span class="dot" style="background:${p.color}"></span>${esc(p.name)}
     ${p.id === S.host ? '<small class="muted">(zakladateľ)</small>' : ''}${p.id === S.me ? ' <small class="muted">(ty)</small>' : ''}</li>`).join('');
  const host = S.host === S.me;
  $('hostControls').hidden = !host;
  $('waitHost').hidden = host;
  $('btnStart').disabled = S.players.length < 2;
  $('btnStart').textContent = S.players.length < 2 ? 'Čaká sa na ďalších hráčov…' : 'Spustiť hru';
}

const me = () => S.players.find(p => p.id === S.me);
const pl = id => S.players.find(p => p.id === id);
const myTurn = () => S.current === S.me && (S.phase === 'setup' || S.phase === 'play');
const canPay = cost => RES.every(r => me().res[r] >= (cost[r] || 0));
const costStr = c => RES.filter(r => c[r]).map(r => `${c[r] > 1 ? c[r] : ''}${RES_ICON[r]}`).join(' ');

function renderStatus() {
  const st = $('status');
  const cur = pl(S.current);
  let txt;
  if (S.phase === 'ended') {
    txt = `🏆 Vyhral(a) ${esc(pl(S.winner).name)}!`;
  } else if (S.phase === 'setup') {
    txt = myTurn() ? `Príprava (kolo ${S.setupRound}/2): klikni na voľnú pevninu a polož tábor.` : `Príprava: ${esc(cur.name)} kladie tábor…`;
  } else {
    const dice = S.dice ? ` · 🎲 produkcia <b>${S.dice[0]}</b> ${DIE[S.dice[0]]}, udalosť ${DIE[S.dice[1]]}` : '';
    txt = (myTurn() ? (S.rolled ? 'Tvoj ťah' : 'Tvoj ťah – hoď kockami!') : `Na ťahu: ${esc(cur.name)}`) + dice
      + (S.market ? ' · 🛒 Trhový deň' : '');
  }
  if (mode && myTurn()) txt += ` <br><small>Vyber políčko na mape (${modeName(mode)}). <a href="#" id="cancelMode">Zrušiť</a></small>`;
  st.innerHTML = txt + (S.lastEvent ? `<div class="event">⚡ <b>${esc(S.lastEvent.name)}:</b> ${esc(S.lastEvent.text)}</div>` : '');
  st.className = 'status' + (myTurn() ? ' mine' : '');
  const c = $('cancelMode');
  if (c) c.onclick = e => { e.preventDefault(); mode = null; render(); };
}

function modeName(m) {
  return { place: 'tábor', camp: 'tábor', town: 'mesto', lighthouse: 'maják', explore: 'výprava' }[m];
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
  const adjOwn = h => nbrs(h).some(own);
  const land = h => h.revealed && h.terrain !== 'more';
  const out = new Set();
  const m2 = S.phase === 'setup' ? 'place' : mode;
  for (const h of S.hexes) {
    let ok = false;
    if (m2 === 'place') ok = land(h) && !h.building;
    else if (m2 === 'camp') ok = land(h) && !h.building && adjOwn(h);
    else if (m2 === 'town') ok = own(h) && h.building.type === 'camp';
    else if (m2 === 'lighthouse') ok = own(h) && !h.lighthouse && h.coastal;
    else if (m2 === 'explore') ok = !h.revealed && adjOwn(h);
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
  return `<path transform="translate(${x},${y}) scale(${s})" d="M-12,0 q4,-5 8,0 t8,0 t8,0" fill="none" stroke="#bde0fe" stroke-width="2" stroke-linecap="round" opacity=".75"/>`;
}
function cloud(x, y, s = 1, c = '#2f4a6a') {
  return `<g transform="translate(${x},${y}) scale(${s})" fill="${c}">
    <circle cx="-8" cy="2" r="7"/><circle cx="0" cy="-3" r="9"/><circle cx="9" cy="2" r="7"/><rect x="-15" y="2" width="31" height="7" rx="3.5"/></g>`;
}

const TILE_DEFS = (() => {
  const grad = (id, a, b) => `<radialGradient id="${id}" cx="40%" cy="30%" r="80%"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></radialGradient>`;
  const tile = (id, body) => `<g id="${id}" clip-path="url(#hexclip)">${body}</g>`;
  const base = id => `<polygon points="${hexPts(0, 0)}" fill="url(#g-${id})"/>`;
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
    ${grad('g-les', '#5aa469', '#245c3b')}
    ${grad('g-lom', '#b8c1cc', '#6b7785')}
    ${grad('g-bana', '#a8714a', '#5a3620')}
    ${grad('g-pole', '#f6d77a', '#c9952a')}
    ${grad('g-solnisko', '#f4f9fc', '#a9c3d3')}
    ${grad('g-more', '#4f9bd9', '#1b4f86')}
    ${grad('g-hmla', '#273d58', '#131f30')}
    <radialGradient id="g-glow"><stop offset="0" stop-color="#ffe680" stop-opacity=".9"/><stop offset="1" stop-color="#ffe680" stop-opacity="0"/></radialGradient>
    <filter id="f-shadow" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#000" flood-opacity=".45"/></filter>
    <pattern id="p-furrow" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(-30)">
      <rect width="8" height="3" fill="#b9831f" opacity=".35"/></pattern>

    ${tile('t-les', base('les') + dots('#9be3a7', 18, 3)
      + pine(-20, -24, 1) + pine(2, -30, .9) + pine(23, -22, 1.05) + pine(-33, 0, .9)
      + pine(33, 2, .95) + pine(-25, 22, 1) + pine(25, 24, .9) + pine(-4, 34, .8) + pine(12, 36, .7))}

    ${tile('t-lom', base('lom')
      + '<path d="M-46,-14 L46,-24 L46,-40 L-46,-40Z" fill="#8a96a5"/><path d="M-46,-14 L46,-24" stroke="#5c6672" stroke-width="2"/>'
      + '<path d="M-46,30 L46,22 L46,46 L-46,46Z" fill="#7d8896"/><path d="M-46,30 L46,22" stroke="#5c6672" stroke-width="2"/>'
      + rock(-22, -20, 1) + rock(18, -28, .8) + rock(30, -6, .9) + rock(-30, 6, .8) + rock(-16, 28, .9) + rock(22, 28, 1.1)
      + '<path d="M-6,-34 l4,6 l-3,4" stroke="#4a525c" fill="none" stroke-width="1"/>')}

    ${tile('t-bana', base('bana')
      + '<path d="M-50,-2 L-26,-36 L-12,-18 L6,-42 L26,-16 L36,-28 L50,-4Z" fill="#6b4a32"/>'
      + '<path d="M-26,-36 L-18,-24 L-12,-18 L-22,-20Z M6,-42 L16,-28 L26,-16 L12,-22Z" fill="#4a2f1d"/>'
      + '<path d="M-26,-36 L-30,-30 L-24,-31 L-22,-28Z M6,-42 L1,-35 L7,-36 L10,-32Z" fill="#e9ecef"/>'
      + '<g transform="translate(-26,22)"><path d="M-10,10 L-10,-2 Q0,-12 10,-2 L10,10Z" fill="#1a110a"/>'
      + '<path d="M-12,10 L-12,-3 Q0,-15 12,-3 L12,10" fill="none" stroke="#c08552" stroke-width="3"/></g>'
      + '<path d="M-14,32 L40,32 M-14,36 L40,36" stroke="#3b2414" stroke-width="1.5"/>'
      + '<g fill="#7fdbff" stroke="#1d6fa5" stroke-width=".8"><path d="M22,6 l4,-5 l4,5 l-4,5Z"/><path d="M32,16 l3,-4 l3,4 l-3,4Z"/><path d="M-36,-8 l3,-4 l3,4 l-3,4Z"/></g>'
      + '<g transform="translate(22,26)"><rect x="-8" y="-6" width="16" height="7" fill="#8d6e63" stroke="#3b2414"/><circle cx="-4" cy="3" r="2.2" fill="#333"/><circle cx="4" cy="3" r="2.2" fill="#333"/><path d="M-6,-6 l3,-3 l4,2 l3,-2 l2,3Z" fill="#9aa5b1"/></g>')}

    ${tile('t-pole', base('pole') + `<polygon points="${hexPts(0, 0)}" fill="url(#p-furrow)"/>`
      + wheat(-22, -26) + wheat(2, -32, .9) + wheat(24, -22) + wheat(-34, 2, .9) + wheat(34, 4, .9)
      + wheat(-24, 26) + wheat(26, 26, .95) + wheat(0, 36, .8))}

    ${tile('t-solnisko', base('solnisko')
      + '<g stroke="#ffffff" stroke-width="2" fill="#9fd3e8">'
      + '<rect x="-30" y="-36" width="18" height="12" rx="2"/><rect x="-9" y="-38" width="18" height="12" rx="2"/><rect x="12" y="-36" width="18" height="12" rx="2"/>'
      + '<rect x="-40" y="-18" width="14" height="11" rx="2"/><rect x="26" y="-18" width="14" height="11" rx="2"/></g>'
      + '<g fill="#ffffff" opacity=".8"><path d="M-25,-31 l2,-3 l2,3Z"/><path d="M17,-31 l2,-3 l2,3Z"/></g>'
      + saltPile(-28, 16, 1.1) + saltPile(28, 18, 1) + saltPile(-10, 32, .8) + saltPile(12, 34, .75))}

    ${tile('t-more', base('more')
      + wave(-20, -26) + wave(14, -32, .9) + wave(22, -10) + wave(-30, -4, .9) + wave(-6, 8, 1.1)
      + wave(-22, 24) + wave(18, 22, .9) + wave(0, 38, .8)
      + '<g transform="translate(14,4) scale(.9)"><path d="M-10,4 L10,4 L7,9 L-7,9Z" fill="#8d5524"/><path d="M0,4 L0,-12 L8,2Z" fill="#fefae0"/><path d="M0,-12 L0,4" stroke="#5b3a1e"/></g>')}

    ${tile('t-hmla', `<polygon points="${hexPts(0, 0)}" fill="url(#g-hmla)"/>`
      + cloud(-20, -24, 1.1) + cloud(18, -16, .9, '#36547a') + cloud(-14, 22, .9, '#36547a') + cloud(22, 26, 1)
      + '<text x="0" y="9" text-anchor="middle" font-size="24" font-weight="700" fill="#6f8db0">?</text>')}
  </defs>`;
})();

function campSvg(x, y, c) {
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
function lighthouseSvg(x, y, c) {
  return `<g transform="translate(${x},${y})" stroke="#111" stroke-width="1">
    <circle cx="0" cy="-14" r="13" fill="url(#g-glow)" stroke="none"/>
    <ellipse cx="1" cy="16" rx="8" ry="2.5" fill="#0006" stroke="none"/>
    <path d="M-6,16 L-3.5,-8 L3.5,-8 L6,16Z" fill="#fdfdfd"/>
    <path d="M-5.4,10 L5.4,10 L4.9,5 L-4.9,5Z M-4.3,0 L4.3,0 L3.9,-4 L-3.9,-4Z" fill="${c}"/>
    <rect x="-4.5" y="-14" width="9" height="6" fill="#ffd166"/>
    <path d="M-6,-14 L0,-20 L6,-14Z" fill="#333"/>
  </g>`;
}

function renderBoard() {
  const svg = $('board');
  const R = HEX_R;
  const W = Math.sqrt(3) * R;
  const pos = h => [W * (h.q + h.r / 2), 1.5 * R * h.r];
  const xs = S.hexes.map(h => pos(h)[0]);
  const ys = S.hexes.map(h => pos(h)[1]);
  const pad = R + 8;
  const minX = Math.min(...xs) - pad, minY = Math.min(...ys) - pad;
  svg.setAttribute('viewBox', `${minX} ${minY} ${Math.max(...xs) - minX + pad} ${Math.max(...ys) - minY + pad}`);
  const valid = validHexes();
  const lastNum = S.dice ? S.dice[0] : null;
  let tiles = '', pieces = '', marks = '';
  for (const h of S.hexes) {
    const [x, y] = pos(h);
    const id = h.revealed ? h.terrain : 'hmla';
    const flip = ((h.q * 7 + h.r * 13) & 1) ? -1 : 1;
    let inner = `<use href="#t-${id}" transform="translate(${x},${y}) scale(${flip},1)"/>
      <polygon points="${hexPts(x, y, R - 3)}" fill="none" stroke="#ffffff" stroke-opacity=".18" stroke-width="2"/>
      <polygon class="edge" points="${hexPts(x, y)}" fill="none" stroke="#0b1520" stroke-width="2.5"/>`;
    if (h.revealed && h.terrain !== 'more') {
      const hot = h.num === lastNum && S.rolled;
      inner += `<ellipse cx="${x}" cy="${y + 4}" rx="15" ry="14" fill="#0005"/>
        <circle cx="${x}" cy="${y + 2}" r="14" fill="${hot ? '#f2a541' : '#f7f0dc'}" stroke="${hot ? '#fff' : '#8b6f47'}" stroke-width="2"/>
        <text x="${x}" y="${y + 8}" text-anchor="middle" font-size="17" font-weight="800" fill="#2b2118" font-family="Georgia, serif">${h.num}</text>`;
    }
    tiles += `<g class="hex${valid.has(h.k) ? ' valid' : ''}" data-k="${h.k}">${inner}</g>`;
    if (valid.has(h.k)) marks += `<polygon class="hl" points="${hexPts(x, y, R - 2)}"/>`;
    if (h.building) {
      const c = pl(h.building.owner).color;
      pieces += h.building.type === 'camp' ? campSvg(x, y + 26, c) : townSvg(x, y + 26, c);
      if (h.lighthouse) pieces += lighthouseSvg(x + 27, y + 12, c);
    }
  }
  svg.innerHTML = TILE_DEFS + `<g filter="url(#f-shadow)">${tiles}</g><g pointer-events="none">${marks}${pieces}</g>`;
  svg.querySelectorAll('.hex.valid').forEach(g => {
    g.onclick = () => {
      const k = g.dataset.k;
      if (S.phase === 'setup') act({ type: 'place', hex: k });
      else if (mode === 'explore') act({ type: 'explore', hex: k });
      else act({ type: 'build', kind: mode, hex: k });
      mode = null;
    };
  });
  $('legend').innerHTML = Object.values(TERRAIN).map(t =>
    `<span><i style="background:${t.color}"></i>${t.name}${t.res ? ' ' + RES_ICON[t.res] : ''}</span>`).join('')
    + '<span>⛺ tábor</span><span>🏰 mesto</span><span>🗼 maják</span>';
}

function renderPlayers() {
  $('playersPanel').innerHTML = `<h3>Hráči · cieľ ${S.target} b.</h3>` + S.players.map(p => `
    <div class="prow ${p.id === S.current ? 'cur' : ''} ${p.online ? '' : 'off'}">
      <span class="dot" style="background:${p.color}"></span>
      <span class="nm">${esc(p.name)}${p.id === S.me ? ' (ty)' : ''}${p.online ? '' : ' 📴'}<br>
        <small>🃏 ${p.cards} · ⛺${p.camps} 🏰${p.towns} 🗼${p.lighthouses} · 🧭${p.discoveries}${S.explorer === p.id ? ' 🏅' : ''} · 📜${p.contracts.length}</small></span>
      <span class="vp">${p.vp}</span>
    </div>`).join('')
    + (S.phase !== 'ended' && pl(S.current) && !pl(S.current).online && S.current !== S.me
      ? `<button id="btnSkip" style="margin-top:6px;width:100%">Preskočiť ťah odpojeného hráča</button>` : '');
  const b = $('btnSkip');
  if (b) b.onclick = () => send({ t: 'skip' });
}

function renderMine() {
  const m = me();
  $('myPanel').innerHTML = `<h3>Tvoje suroviny</h3><div class="res">` +
    RES.map(r => `<div>${RES_ICON[r]}<b>${m.res[r]}</b>${RES_NAMES[r]}</div>`).join('') + '</div>';
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
  const dis = (cost, extra) => (!S.rolled || !canPay(cost) || extra) ? 'disabled' : '';
  const m = me();
  p.innerHTML = `<h3>Akcie</h3><div class="btns">
    ${!S.rolled ? '<button id="btnRoll" class="primary wide">🎲 Hodiť kockami</button>' : ''}
    <button data-mode="camp" ${dis(COSTS.camp, m.camps >= 6)} class="${mode === 'camp' ? 'active' : ''}">⛺ Tábor<small>${costStr(COSTS.camp)}</small></button>
    <button data-mode="town" ${dis(COSTS.town, m.towns >= 4 || !m.camps)} class="${mode === 'town' ? 'active' : ''}">🏰 Mesto<small>${costStr(COSTS.town)}</small></button>
    <button data-mode="lighthouse" ${dis(COSTS.lighthouse, m.lighthouses >= 3)} class="${mode === 'lighthouse' ? 'active' : ''}">🗼 Maják<small>${costStr(COSTS.lighthouse)}</small></button>
    <button data-mode="explore" ${dis(COSTS.explore)} class="${mode === 'explore' ? 'active' : ''}">🧭 Výprava<small>${costStr(COSTS.explore)}</small></button>
    ${S.rolled ? '<button id="btnEnd" class="primary wide">Ukončiť ťah ➜</button>' : ''}
  </div>`;
  if ($('btnRoll')) $('btnRoll').onclick = () => act({ type: 'roll' });
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
    const fmt = o => RES.filter(r => o[r]).map(r => `${o[r]}× ${RES_ICON[r]}`).join(' ');
    html += `<div class="offer"><div><b style="color:${from.color}">${esc(from.name)}</b> ponúka <b>${fmt(S.offer.give)}</b> za <b>${fmt(S.offer.want)}</b></div>
      ${S.offer.from === S.me ? '<button id="btnCancelOffer">Stiahnuť ponuku</button>'
        : `<button id="btnAccept" class="primary" ${canPay(S.offer.want) ? '' : 'disabled'}>Prijať obchod</button>`}</div>`;
  }
  if (active) {
    const opts = sel => RES.map(r => `<option value="${r}" ${r === sel ? 'selected' : ''}>${RES_ICON[r]} ${RES_NAMES[r]}</option>`).join('');
    html += `<p class="muted" style="margin:8px 0 4px">S bankou ${S.bankRate}:1</p>
      <div class="row"><select id="bankGive">${opts(bankGive)}</select><span style="align-self:center">➜</span>
      <select id="bankGet">${opts(bankGet)}</select><button id="btnBank">Vymeniť</button></div>`;
    if (!S.offer) {
      html += `<p class="muted" style="margin:10px 0 4px">Ponuka hráčom</p><div class="tradeGrid"><span></span>
        ${RES.map(r => `<span style="text-align:center">${RES_ICON[r]}</span>`).join('')}
        <span>Dám</span>${RES.map(r => `<input type="number" min="0" max="${me().res[r]}" data-g="${r}" value="${tradeDraft.give[r] || 0}">`).join('')}
        <span>Chcem</span>${RES.map(r => `<input type="number" min="0" max="20" data-w="${r}" value="${tradeDraft.want[r] || 0}">`).join('')}
        </div><button id="btnOffer" style="width:100%;margin-top:6px">Ponúknuť ostatným</button>`;
    }
  } else if (!S.offer) {
    html += '<p class="muted">Obchodovať môže hráč na ťahu. Jeho ponuky sa zobrazia tu.</p>';
  }
  p.innerHTML = html;
  if ($('btnAccept')) $('btnAccept').onclick = () => act({ type: 'acceptOffer' });
  if ($('btnCancelOffer')) $('btnCancelOffer').onclick = () => act({ type: 'cancelOffer' });
  if ($('btnBank')) {
    $('bankGive').onchange = e => { bankGive = e.target.value; };
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

connect();
