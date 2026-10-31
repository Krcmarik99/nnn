'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { Game, GameError, generateMap, RES } = require('../src/game');

function seeded(seed = 42) {
  return () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
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
  g.act(g.current().id, { type: 'roll' });
  assert.throws(() => g.act(g.current().id, { type: 'roll' }), GameError);
});

test('stavba tábora vyžaduje suseda a suroviny', () => {
  const { g } = setupGame(2);
  const p = g.current();
  g.act(p.id, { type: 'roll' });
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
  g.act(p.id, { type: 'roll' });
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
  g.act(a.id, { type: 'roll' });
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
  g.act(p.id, { type: 'roll' });
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
  g.act(p.id, { type: 'roll' });
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
      g.act(p.id, { type: 'roll' });
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
