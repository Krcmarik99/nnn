'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { Game, RES } = require('../src/game');
const bot = require('../src/bot');

// Odohrá celú hru iba s botmi (ponuky čakajú len "virtuálne")
function playBots(n, seed) {
  let s = seed;
  const rng = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
  const g = new Game({ rng });
  for (let i = 0; i < n; i++) g.addPlayer(bot.botName(g), { bot: true });
  g.start(12);
  const mem = {};
  let steps = 0;
  while ((g.phase === 'setup' || g.phase === 'play') && steps++ < 20000) {
    if (g.offer) {
      const taker = g.players.find(p => bot.wantsOffer(g, p));
      if (taker) { g.act(taker.id, { type: 'acceptOffer' }); continue; }
    }
    const pt = g.players.map(p => [p, bot.wantsPortOffer(g, p)]).find(([, o]) => o);
    if (pt) { g.act(pt[0].id, { type: 'portAccept', id: pt[1].id }); continue; }
    const p = g.current();
    const m = (mem[p.id] ||= {});
    let a = bot.decide(g, p, m);
    if (a === 'wait') { m.offerAt = 0; a = bot.decide(g, p, m); }
    g.act(p.id, a);
    for (const q of g.players) assert.ok(RES.every(r => q.res[r] >= 0));
  }
  return { g, steps };
}

test('boti dohrajú hru do konca bez chyby', () => {
  const rounds = [];
  for (let seed = 1; seed <= 15; seed++) {
    const { g } = playBots(2 + (seed % 4), seed);
    assert.strictEqual(g.phase, 'ended', 'seed ' + seed);
    assert.ok(g.vp(g.player(g.winner)) >= 12);
    rounds.push(g.round);
  }
  const avg = rounds.reduce((a, b) => a + b, 0) / rounds.length;
  console.log('priemerný počet kôl:', avg.toFixed(1), rounds.join(','));
  assert.ok(avg < 60, 'hry trvajú príliš dlho');
});

test('bot prijme len výhodnú ponuku', () => {
  const g = new Game();
  const h = g.addPlayer('Človek');
  const b = g.addPlayer('🤖 Test', { bot: true });
  g.start(12);
  while (g.phase === 'setup') g.forceSkip();
  const roll = id => { g.act(id, { type: 'roll' }); if (g.pendingBandits) g.act(id, { type: 'moveBandits', hex: null }); };
  if (g.current().id !== h) { roll(g.current().id); g.act(g.current().id, { type: 'endTurn' }); }
  roll(h);
  const hp = g.player(h), bp = g.player(b);
  hp.res = { drevo: 0, kamen: 0, ruda: 0, obilie: 0, sol: 5 };
  bp.res = { drevo: 0, kamen: 0, ruda: 0, obilie: 0, sol: 0 };
  g.act(h, { type: 'offer', give: { sol: 1 }, want: { drevo: 1 } });
  assert.strictEqual(bot.wantsOffer(g, bp), false, 'nemá čo dať');
  bp.res = { drevo: 0, kamen: 1, ruda: 0, obilie: 1, sol: 5 };
  g.offer = null;
  hp.res.drevo = 3;
  g.act(h, { type: 'offer', give: { drevo: 1 }, want: { sol: 1 } });
  assert.strictEqual(bot.wantsOffer(g, bp), true, 'drevo mu chýba do tábora');
});

test('ťažší boti vyhrávajú častejšie', () => {
  const wins = { easy: 0, normal: 0, hard: 0 };
  for (let seed = 1; seed <= 60; seed++) {
    let s = seed;
    const rng = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
    const g = new Game({ rng });
    for (const level of ['easy', 'normal', 'hard']) g.addPlayer(level, { bot: true, level });
    g.start(12);
    const mem = {};
    let steps = 0;
    while ((g.phase === 'setup' || g.phase === 'play') && steps++ < 20000) {
      if (g.offer) {
        const taker = g.players.find(p => bot.wantsOffer(g, p));
        if (taker) { g.act(taker.id, { type: 'acceptOffer' }); continue; }
      }
      const p = g.current();
      const m = (mem[p.id] ||= {});
      let a = bot.decide(g, p, m);
      if (a === 'wait') { m.offerAt = 0; a = bot.decide(g, p, m); }
      g.act(p.id, a);
    }
    assert.strictEqual(g.phase, 'ended');
    wins[g.player(g.winner).level]++;
  }
  console.log('výhry podľa obtiažnosti:', wins);
  assert.ok(wins.hard > wins.easy, 'ťažký by mal vyhrávať častejšie ako ľahký');
  assert.ok(wins.normal > wins.easy, 'stredný by mal vyhrávať častejšie ako ľahký');
});
