'use strict';

const RES = ['drevo', 'kamen', 'ruda', 'obilie', 'sol'];
const RES_NAMES = { drevo: 'Drevo', kamen: 'Kameň', ruda: 'Ruda', obilie: 'Obilie', sol: 'Soľ' };
const RES_ICON = { drevo: '🪵', kamen: '🪨', ruda: '⛏️', obilie: '🌾', sol: '🧂' };
const TERRAIN = {
  les: { name: 'Les', color: '#2d6a4f', res: 'drevo' },
  lom: { name: 'Lom', color: '#8d99ae', res: 'kamen' },
  bana: { name: 'Baňa', color: '#7f5539', res: 'ruda' },
  pole: { name: 'Pole', color: '#d4a72c', res: 'obilie' },
  solnisko: { name: 'Soľnisko', color: '#c9d6df', res: 'sol' },
  more: { name: 'More', color: '#2f6fa8' },
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

function renderBoard() {
  const svg = $('board');
  const R = 46;
  const W = Math.sqrt(3) * R;
  const pos = h => [W * (h.q + h.r / 2), 1.5 * R * h.r];
  const pts = (x, y) => Array.from({ length: 6 }, (_, i) => {
    const a = Math.PI / 180 * (60 * i - 30);
    return `${(x + R * Math.cos(a)).toFixed(1)},${(y + R * Math.sin(a)).toFixed(1)}`;
  }).join(' ');
  const xs = S.hexes.map(h => pos(h)[0]);
  const ys = S.hexes.map(h => pos(h)[1]);
  const pad = R + 6;
  const minX = Math.min(...xs) - pad, minY = Math.min(...ys) - pad;
  svg.setAttribute('viewBox', `${minX} ${minY} ${Math.max(...xs) - minX + pad} ${Math.max(...ys) - minY + pad}`);
  const valid = validHexes();
  const lastNum = S.dice ? S.dice[0] : null;
  let html = '';
  for (const h of S.hexes) {
    const [x, y] = pos(h);
    const t = h.revealed ? TERRAIN[h.terrain] : null;
    const fill = t ? t.color : '#24384f';
    let inner = `<polygon points="${pts(x, y)}" fill="${fill}" stroke="#0f1c2b" stroke-width="2"/>`;
    if (!h.revealed) {
      inner += `<text x="${x}" y="${y + 9}" text-anchor="middle" font-size="26" fill="#5d7690">?</text>`;
    } else if (h.terrain !== 'more') {
      inner += `<text x="${x}" y="${y - 20}" text-anchor="middle" font-size="16">${RES_ICON[t.res]}</text>`;
      const hot = h.num === lastNum && S.rolled;
      inner += `<circle cx="${x}" cy="${y + 4}" r="13" fill="${hot ? '#f2a541' : '#f7f3e3'}" stroke="#0005"/>
        <text x="${x}" y="${y + 10}" text-anchor="middle" font-size="16" font-weight="700" fill="#222">${h.num}</text>`;
    } else {
      inner += `<text x="${x}" y="${y + 6}" text-anchor="middle" font-size="18" opacity=".6">🌊</text>`;
    }
    if (h.building) {
      const c = pl(h.building.owner).color;
      if (h.building.type === 'camp') {
        inner += `<polygon points="${x - 12},${y + 36} ${x},${y + 18} ${x + 12},${y + 36}" fill="${c}" stroke="#000" stroke-width="2"/>`;
      } else {
        inner += `<rect x="${x - 14}" y="${y + 18}" width="28" height="18" fill="${c}" stroke="#000" stroke-width="2"/>
          <rect x="${x - 14}" y="${y + 12}" width="7" height="7" fill="${c}" stroke="#000" stroke-width="2"/>
          <rect x="${x + 7}" y="${y + 12}" width="7" height="7" fill="${c}" stroke="#000" stroke-width="2"/>`;
      }
      if (h.lighthouse) inner += `<text x="${x + 26}" y="${y + 34}" text-anchor="middle" font-size="18">🗼</text>`;
    }
    html += `<g class="hex${valid.has(h.k) ? ' valid' : ''}" data-k="${h.k}">${inner}</g>`;
  }
  svg.innerHTML = html;
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
    + '<span>▲ tábor</span><span>▙▟ mesto</span><span>🗼 maják</span>';
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
