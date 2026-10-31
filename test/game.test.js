'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { Game, GameError, generateMap, RES, TERRAIN_RES } = require('../src/game');

function seeded(seed = 42) {
  return () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
}

// hod kockami; ak padne súčet 7, banditi zostanú na mieste
function roll(g, p) {
  g.act(p.id, { type: 'roll' });
  if (g.pendingBandits) g.act(p.id, { type: 'moveBandits', hex: null });
}

function setupGame(n = 3) {
  const g = new Game({ rng: seeded() });
  const ids = Array.from({ length: n }, (_, i) => g.addPlayer('Hráč ' + i));
  g.start(12);
  while (g.phase === 'setup') {
    const free = Object.keys(g.hexes).filter(k => { const h = g.hexes[k]; return h.revealed && h.terrain !== 'more' && !h.building; });
    g.act(g.current().id, { type: 'place', hex: free[0] });
  }
  return { g, ids };
}

test('mapa má 37 políčok, 19 odkrytých a 26 pevnín s číslami 1–6', () => {
  const m = generateMap(seeded(7));
  const hs = Object.values(m);
  assert.strictEqual(hs.length, 37);
  assert.strictEqual(hs.filter(h => h.revealed).length, 19);
  const land = hs.filter(h => h.terrain !== 'more');
  assert.strictEqual(land.length, 26);
  assert.ok(land.every(h => h.num >= 1 && h.num <= 6));
});

test('lobby: max 5 hráčov a min 2 na štart', () => {
  const g = new Game();
  g.addPlayer('A');
  assert.throws(() => g.start(), GameError);
  for (let i = 0; i < 4; i++) g.addPlayer('X');
  assert.throws(() => g.addPlayer('Y'), GameError);
});

test('príprava: hadové poradie, 2 tábory na hráča', () => {
  const { g } = setupGame(3);
  assert.strictEqual(g.phase, 'play');
  for (const p of g.players) assert.strictEqual(g.count(p.id, 'camp'), 2);
  for (const p of g.players) assert.strictEqual(g.cards(p), 2);
});

test('nedá sa konať mimo ťahu a bez hodu', () => {
  const { g } = setupGame(2);
  const other = g.players[1];
  assert.throws(() => g.act(other.id, { type: 'roll' }), /Nie si na ťahu/);
  assert.throws(() => g.act(g.current().id, { type: 'endTurn' }), /hoď/);
  roll(g, g.current());
  assert.throws(() => g.act(g.current().id, { type: 'roll' }), GameError);
});

test('stavba tábora vyžaduje suseda a suroviny', () => {
  const { g } = setupGame(2);
  const p = g.current();
  roll(g, p);
  RES.forEach(r => { p.res[r] = 5; });
  const target = Object.keys(g.hexes).find(k => {
    const h = g.hexes[k];
    return h.revealed && h.terrain !== 'more' && !h.building && g.adjacentToOwn(h, p.id);
  });
  const far = Object.keys(g.hexes).find(k => {
    const h = g.hexes[k];
    return h.revealed && h.terrain !== 'more' && !h.building && !g.adjacentToOwn(h, p.id);
  });
  if (far) assert.throws(() => g.act(p.id, { type: 'build', kind: 'camp', hex: far }), /susediť/);
  g.act(p.id, { type: 'build', kind: 'camp', hex: target });
  assert.strictEqual(g.count(p.id, 'camp'), 3);
  assert.strictEqual(p.res.drevo, 4);
  g.act(p.id, { type: 'build', kind: 'town', hex: target });
  assert.strictEqual(g.hexes[target].building.type, 'town');
  assert.strictEqual(g.vp(p), 4);
});

test('výprava odkrýva políčko a dáva titul Veľký objaviteľ', () => {
  const { g } = setupGame(2);
  const p = g.current();
  roll(g, p);
  RES.forEach(r => { p.res[r] = 20; });
  // dostaneme sa k okraju: stavaj tábory smerom von, kým sa nedá objavovať
  for (let i = 0; i < 10 && p.discoveries < 3; i++) {
    const hidden = Object.keys(g.hexes).find(k => !g.hexes[k].revealed && g.adjacentToOwn(g.hexes[k], p.id));
    if (hidden) { g.act(p.id, { type: 'explore', hex: hidden }); continue; }
    const k = Object.keys(g.hexes).find(k => { const h = g.hexes[k]; return h.revealed && h.terrain !== 'more' && !h.building && g.adjacentToOwn(h, p.id); });
    g.act(p.id, { type: 'build', kind: 'camp', hex: k });
  }
  if (p.discoveries >= 3) assert.strictEqual(g.explorer, p.id);
});

test('obchod medzi hráčmi', () => {
  const { g } = setupGame(2);
  const [a, b] = [g.current(), g.players[1]];
  roll(g, a);
  a.res = { drevo: 2, kamen: 0, ruda: 0, obilie: 0, sol: 0 };
  b.res = { drevo: 0, kamen: 0, ruda: 0, obilie: 0, sol: 1 };
  g.act(a.id, { type: 'offer', give: { drevo: 2 }, want: { sol: 1 } });
  g.act(b.id, { type: 'acceptOffer' });
  assert.deepStrictEqual([a.res.drevo, a.res.sol, b.res.drevo, b.res.sol], [0, 1, 2, 0]);
  assert.strictEqual(g.offer, null);
});

test('výmena s bankou 4:1 a zákazka', () => {
  const { g } = setupGame(2);
  const p = g.current();
  roll(g, p);
  g.market = false;
  p.res = { drevo: 4, kamen: 0, ruda: 0, obilie: 0, sol: 0 };
  g.act(p.id, { type: 'bankTrade', give: 'drevo', get: 'sol' });
  assert.deepStrictEqual(p.res, { drevo: 0, kamen: 0, ruda: 0, obilie: 0, sol: 1 });
  const c = g.openContracts[0];
  RES.forEach(r => { p.res[r] = 5; });
  const before = g.vp(p);
  g.act(p.id, { type: 'fulfill', id: c });
  assert.ok(g.vp(p) > before);
  assert.ok(!g.openContracts.includes(c));
});

test('výhra pri dosiahnutí cieľa', () => {
  const { g } = setupGame(2);
  const p = g.current();
  roll(g, p);
  p.contractVP = 9;
  RES.forEach(r => { p.res[r] = 5; });
  g.act(p.id, { type: 'fulfill', id: g.openContracts[0] });
  assert.strictEqual(g.phase, 'ended');
  assert.strictEqual(g.winner, p.id);
});

test('simulácia celej hry nespadne', () => {
  for (let s = 1; s <= 20; s++) {
    const g = new Game({ rng: seeded(s) });
    for (let i = 0; i < 4; i++) g.addPlayer('P' + i);
    g.start(10);
    let steps = 0;
    while (g.phase !== 'ended' && steps++ < 3000) {
      const p = g.current();
      if (g.phase === 'setup') { g.forceSkip(); continue; }
      roll(g, p);
      for (const kind of ['town', 'camp', 'lighthouse']) {
        for (const k of Object.keys(g.hexes)) {
          try { g.act(p.id, { type: 'build', kind, hex: k }); } catch (e) { if (!(e instanceof GameError)) throw e; }
          if (g.phase === 'ended') break;
        }
      }
      if (g.phase === 'ended') break;
      for (const k of Object.keys(g.hexes)) {
        try { g.act(p.id, { type: 'explore', hex: k }); } catch (e) { if (!(e instanceof GameError)) throw e; }
      }
      for (const c of g.openContracts.slice()) {
        try { g.act(p.id, { type: 'fulfill', id: c }); } catch (e) { if (!(e instanceof GameError)) throw e; }
      }
      if (g.phase === 'ended') break;
      g.act(p.id, { type: 'endTurn' });
      for (const q of g.players) assert.ok(RES.every(r => q.res[r] >= 0));
    }
    assert.strictEqual(g.phase, 'ended', 'hra so seedom ' + s + ' neskončila');
  }
});

test('banditi: začínajú v horách, súčet 7 ich dovolí presunúť a blokujú produkciu', () => {
  const { g } = setupGame(2);
  assert.strictEqual(g.hexes[g.bandits].terrain, 'bana');
  const p = g.current();
  // vynúť hod 3 + 4
  const seq = [2 / 6 + 0.01, 3 / 6 + 0.01];
  const orig = g.rng;
  g.rng = () => (seq.length ? seq.shift() : orig());
  g.act(p.id, { type: 'roll' });
  assert.deepStrictEqual(g.dice, [3, 4]);
  assert.strictEqual(g.pendingBandits, true);
  assert.throws(() => g.act(p.id, { type: 'endTurn' }), /banditov/);
  assert.throws(() => g.act(p.id, { type: 'moveBandits', hex: g.bandits }), /už/);
  // presuň na pole súpera
  const other = g.players.find(x => x.id !== p.id);
  const target = Object.keys(g.hexes).find(k => g.hexes[k].building && g.hexes[k].building.owner === other.id);
  g.act(p.id, { type: 'moveBandits', hex: target });
  assert.strictEqual(g.bandits, target);
  g.act(p.id, { type: 'endTurn' });
  // keď padne číslo poľa s banditmi, majiteľ nič nedostane
  const num = g.hexes[target].num;
  const before = g.cards(other);
  const othersSameNum = Object.keys(g.hexes).filter(k => k !== target && g.hexes[k].building && g.hexes[k].building.owner === other.id && g.hexes[k].num === num);
  g.rng = (() => { const q = [(num - 1) / 6 + 0.01, 1 / 6 + 0.01]; return () => (q.length ? q.shift() : orig()); })();
  g.act(g.current().id, { type: 'roll' });
  const expected = before + othersSameNum.reduce((a, k) => a + (g.hexes[k].building.type === 'town' ? 2 : 1), 0);
  assert.strictEqual(g.cards(other), expected);
});

test('banditi sa dajú nechať na mieste a forceSkip ich vyrieši', () => {
  const { g } = setupGame(2);
  g.pendingBandits = false;
  const p = g.current();
  g.rolled = true;
  g.pendingBandits = true;
  const start = g.bandits;
  g.act(p.id, { type: 'moveBandits', hex: null });
  assert.strictEqual(g.bandits, start);
  assert.strictEqual(g.pendingBandits, false);
  g.pendingBandits = true;
  g.forceSkip();
  assert.strictEqual(g.pendingBandits, false);
  assert.notStrictEqual(g.current().id, p.id);
});

test('prístavy: stavba na pobreží, obchod mimo ťahu, platnosť jedno kolo', () => {
  const { g } = setupGame(3);
  const [a, b, c] = g.players;
  // každému daj prístav na pobrežnú stavbu (pre test priamo)
  const givePort = p => {
    const k = Object.keys(g.hexes).find(k => g.hexes[k].building && g.hexes[k].building.owner === p.id);
    g.hexes[k].port = true;
  };
  // stavba cez akciu
  const cur = g.current();
  roll(g, cur);
  RES.forEach(r => { cur.res[r] = 5; });
  const coast = Object.keys(g.hexes).find(k => g.hexes[k].building && g.hexes[k].building.owner === cur.id && g.isCoastal(g.hexes[k]));
  if (coast) {
    const vp = g.vp(cur);
    g.act(cur.id, { type: 'build', kind: 'port', hex: coast });
    assert.strictEqual(g.vp(cur), vp + 1);
    assert.throws(() => g.act(cur.id, { type: 'build', kind: 'port', hex: coast }), /už prístav/);
  }
  [a, b, c].forEach(p => { if (!g.hasPort(p)) givePort(p); });

  // hráč, ktorý NIE JE na ťahu, pošle námornú ponuku
  const off = g.players.find(p => p !== g.current());
  const other = g.players.find(p => p !== off);
  off.res = { drevo: 3, kamen: 0, ruda: 0, obilie: 0, sol: 0 };
  other.res = { drevo: 0, kamen: 0, ruda: 0, obilie: 0, sol: 2 };
  g.act(off.id, { type: 'portOffer', give: { drevo: 2 }, want: { sol: 1 } });
  assert.strictEqual(g.portOffers.length, 1);
  const id = g.portOffers[0].id;
  g.act(other.id, { type: 'portAccept', id });
  assert.deepStrictEqual([off.res.drevo, off.res.sol, other.res.drevo, other.res.sol], [1, 1, 2, 1]);
  assert.strictEqual(g.portOffers.length, 0);

  // bez prístavu sa nedá ani ponúknuť, ani prijať
  const noPort = new Game();
  noPort.addPlayer('X'); noPort.addPlayer('Y'); noPort.start(12);
  while (noPort.phase === 'setup') noPort.forceSkip();
  const x = noPort.players[0];
  x.res.drevo = 2;
  assert.throws(() => noPort.act(x.id, { type: 'portOffer', give: { drevo: 1 }, want: { sol: 1 } }), /prístav/);

  // ponuka vyprší po jednom celom kole
  off.res.drevo = 5;
  g.act(off.id, { type: 'portOffer', give: { drevo: 1 }, want: { sol: 1 } });
  for (let i = 0; i < g.players.length; i++) {
    const p = g.current();
    if (!g.rolled) roll(g, p);
    assert.strictEqual(g.portOffers.length, 1, 'ešte platí po ' + i + ' ťahoch');
    g.act(p.id, { type: 'endTurn' });
  }
  assert.strictEqual(g.portOffers.length, 0);
});

test('rozvojové karty: kúpa, zákaz hrania v ťahu kúpy, max. 1 za ťah, efekty', () => {
  const { g } = setupGame(2);
  const p = g.current();
  const other = g.players.find(x => x !== p);
  roll(g, p);
  p.res = { drevo: 0, kamen: 0, ruda: 5, obilie: 5, sol: 5 };
  const left = g.cardDeck.length;
  g.act(p.id, { type: 'buyCard' });
  assert.strictEqual(g.cardDeck.length, left - 1);
  assert.deepStrictEqual([p.res.ruda, p.res.obilie, p.res.sol], [4, 4, 4]);
  const c = p.devCards[0];
  assert.throws(() => g.act(p.id, { type: 'playCard', id: c.id }), /kúpil/);
  // ostatní nevidia, aké karty mám
  assert.strictEqual(g.view(other.id).players.find(x => x.id === p.id).devCards, null);
  assert.strictEqual(g.view(other.id).players.find(x => x.id === p.id).devCount, 1);

  // nasledujúci ťah: listina +1 bod, druhá karta v tom istom ťahu už nejde
  g.act(p.id, { type: 'endTurn' });
  roll(g, g.current()); g.act(g.current().id, { type: 'endTurn' });
  roll(g, p);
  p.devCards = [{ id: 'x1', type: 'listina', turnNo: -1 }, { id: 'x2', type: 'kupec', turnNo: -1 }];
  const vp = g.vp(p);
  g.act(p.id, { type: 'playCard', id: 'x1' });
  assert.strictEqual(g.vp(p), vp + 1);
  assert.throws(() => g.act(p.id, { type: 'playCard', id: 'x2' }), /len jednu/);
  g.act(p.id, { type: 'endTurn' });

  // kupec → 2:1, mapa pokladu → odkryje vzdialené pole
  roll(g, g.current()); g.act(g.current().id, { type: 'endTurn' });
  roll(g, p);
  g.market = false;
  g.act(p.id, { type: 'playCard', id: 'x2' });
  assert.strictEqual(g.bankRate(p), 2);
  g.act(p.id, { type: 'endTurn' });
  roll(g, g.current()); g.act(g.current().id, { type: 'endTurn' });
  roll(g, p);
  p.devCards = [{ id: 'x3', type: 'mapa', turnNo: -1 }];
  const hidden = Object.keys(g.hexes).find(k => !g.hexes[k].revealed);
  const disc = p.discoveries;
  assert.throws(() => g.act(p.id, { type: 'playCard', id: 'x3', hex: Object.keys(g.hexes).find(k => g.hexes[k].revealed) }), /zahalené/);
  g.act(p.id, { type: 'playCard', id: 'x3', hex: hidden });
  assert.ok(g.hexes[hidden].revealed);
  assert.strictEqual(p.discoveries, disc + 1);
  assert.strictEqual(p.devCards.length, 0);
});

test('najdlhšia cesta: reťaz 4+ stavieb na susedných poliach dá +2 body, prebratie len pri dlhšej', () => {
  const g = new Game({ rng: seeded(3) });
  g.addPlayer('A'); g.addPlayer('B');
  g.start(20);
  for (const k in g.hexes) g.hexes[k].building = null;
  const [a, b] = g.players;
  g.phase = 'play';
  const put = (k, pid) => { g.hexes[k] = { ...g.hexes[k], revealed: true, terrain: 'les', num: 1 }; g.hexes[k].building = { owner: pid, type: 'camp' }; };
  // A: rovná línia (0,0),(1,0),(2,0) + odbočka (0,1) → najdlhšia cesta = 4 ((0,1)-(0,0)-(1,0)-(2,0))
  ['0,0', '1,0', '2,0'].forEach(k => put(k, a.id));
  assert.strictEqual(g.longestPath(a.id).length, 3);
  g.updateRoad();
  assert.strictEqual(g.roadHolder, null, 'pod 4 stavby titul nie je');
  put('-1,1', a.id);
  assert.strictEqual(g.longestPath(a.id).length, 4);
  const vp = g.vp(a);
  g.updateRoad();
  assert.strictEqual(g.roadHolder, a.id);
  assert.strictEqual(g.vp(a), vp + 2);
  // B s rovnakou dĺžkou titul nepreberie
  ['0,-2', '1,-2', '2,-2', '3,-3'].forEach(k => put(k, b.id));
  g.updateRoad();
  assert.strictEqual(g.roadHolder, a.id);
  // dlhšia cesta titul preberie
  put('-1,-1', b.id); put('-1,-2', b.id); // napojenie: (-1,-1)-(0,-2)? sused (0,-2) je (-1,-1)
  assert.ok(g.longestPath(b.id).length >= 5, 'B má aspoň 5');
  g.updateRoad();
  assert.strictEqual(g.roadHolder, b.id);
});

test('vojsko: verbovanie, Najväčšie vojsko, vyhnanie banditov, ochrana pred pirátmi', () => {
  const { g } = setupGame(2);
  const p = g.current();
  const o = g.players.find(x => x !== p);
  roll(g, p);
  p.res = { drevo: 5, kamen: 0, ruda: 5, obilie: 5, sol: 0 };
  const vp = g.vp(p);
  g.act(p.id, { type: 'recruit' });
  g.act(p.id, { type: 'recruit' });
  assert.strictEqual(p.soldiers, 2);
  assert.deepStrictEqual([p.res.drevo, p.res.ruda, p.res.obilie], [5, 3, 3]);
  assert.strictEqual(g.armyHolder, null, 'pod 3 vojakov titul nie je');
  g.act(p.id, { type: 'recruit' });
  assert.strictEqual(g.armyHolder, p.id);
  assert.strictEqual(g.vp(p), vp + 2);
  // rovnako veľké vojsko titul nevezme, väčšie áno
  o.soldiers = 3; g.updateArmy();
  assert.strictEqual(g.armyHolder, p.id);
  o.soldiers = 4; g.updateArmy();
  assert.strictEqual(g.armyHolder, o.id);

  // vyhnanie banditov z vlastného poľa
  const mineHex = Object.keys(g.hexes).find(k => g.hexes[k].building && g.hexes[k].building.owner === p.id);
  g.bandits = mineHex;
  g.act(p.id, { type: 'chaseBandits' });
  assert.notStrictEqual(g.bandits, mineHex);
  const t = g.hexes[g.bandits];
  assert.ok(!(t.building && t.building.owner === p.id), 'banditi nesmú skončiť na mojom poli');
  assert.throws(() => g.act(p.id, { type: 'chaseBandits' }), /raz za ťah|nie sú na tvojom/);

  // piráti: hráč s 2+ vojakmi nič nestratí
  p.res = { drevo: 3, kamen: 3, ruda: 3, obilie: 3, sol: 3 };
  const before = g.cards(p);
  g.eventDeck = ['pirati'];
  g.drawEvent(p);
  assert.strictEqual(g.cards(p), before);
});

test('lepší kurz s bankou: prístav dá 2:1 na surovinu svojho poľa', () => {
  const { g } = setupGame(2);
  const p = g.current();
  roll(g, p);
  g.market = false;
  const k = Object.keys(g.hexes).find(x => g.hexes[x].building && g.hexes[x].building.owner === p.id);
  const r = TERRAIN_RES[g.hexes[k].terrain];
  const other = RES.find(x => x !== r);
  assert.strictEqual(g.bankRate(p, r), 4);
  g.hexes[k].port = true;
  assert.strictEqual(g.bankRate(p, r), 2, 'surovina prístavu 2:1');
  assert.strictEqual(g.bankRate(p, other), g.count(p.id, 'lighthouse') ? 3 : 4, 'ostatné bez zmeny');
  p.res = { drevo: 0, kamen: 0, ruda: 0, obilie: 0, sol: 0 };
  p.res[r] = 2;
  g.act(p.id, { type: 'bankTrade', give: r, get: other });
  assert.strictEqual(p.res[r], 0);
  assert.strictEqual(p.res[other], 1);
  assert.deepStrictEqual(g.view(p.id).bankRates[r], 2);
});
