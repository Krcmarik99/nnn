'use strict';

// Jednoduchá AI pre Súostrovie. Každé volanie decide() vráti jednu akciu,
// aby server mohol ťahy botov prehrávať postupne a s prestávkami.

const { RES, COSTS, LIMITS, CONTRACTS, TERRAIN_RES, STORM_LIMIT } = require('./game');

const BOT_NAMES = ['Anka', 'Boris', 'Cyril', 'Dana', 'Emil', 'Fero', 'Gabika', 'Hugo'];
const OFFER_WAIT_MS = 6000;
const MAX_ACTIONS_PER_TURN = 30;

function missing(res, cost) {
  let m = 0;
  for (const r of RES) m += Math.max(0, (cost[r] || 0) - res[r]);
  return m;
}

function best(arr, score) {
  let b = null;
  let bs = -Infinity;
  for (const x of arr) {
    const s = score(x);
    if (s > bs) { bs = s; b = x; }
  }
  return b;
}

const entries = g => Object.entries(g.hexes);
const own = (h, p) => h.building && h.building.owner === p.id;

// Ako dobré je políčko pre nový tábor
function spotScore(g, p, h) {
  const mine = Object.values(g.hexes).filter(x => own(x, p));
  const ownRes = new Set(mine.map(x => TERRAIN_RES[x.terrain]));
  const ownNums = new Set(mine.map(x => x.num));
  const ns = g.neighbors(h);
  let s = 1;
  if (!ownRes.has(TERRAIN_RES[h.terrain])) s += 2;
  if (!ownNums.has(h.num)) s += 1;
  s += ns.filter(n => n.revealed && g.isLand(n) && !n.building).length * 0.35;
  s += ns.filter(n => !n.revealed).length * 0.25;
  if (g.isCoastal(h)) s += 0.2;
  return s + Math.random() * 0.3;
}

// Všetko, o čo sa bot môže snažiť; nižšie "pri" = dôležitejšie
function options(g, p) {
  const opts = [];
  const camps = g.count(p.id, 'camp');
  const towns = g.count(p.id, 'town');
  const lights = g.count(p.id, 'lighthouse');

  const spots = camps < LIMITS.camp
    ? entries(g).filter(([, h]) => h.revealed && g.isLand(h) && !h.building && g.adjacentToOwn(h, p.id))
    : [];
  if (spots.length) {
    const [k] = best(spots, ([, h]) => spotScore(g, p, h));
    opts.push({ action: { type: 'build', kind: 'camp', hex: k }, cost: COSTS.camp, pri: 0 });
  }
  if (towns < LIMITS.town) {
    const mine = entries(g).filter(([, h]) => own(h, p) && h.building.type === 'camp');
    if (mine.length) opts.push({ action: { type: 'build', kind: 'town', hex: mine[0][0] }, cost: COSTS.town, pri: 0 });
  }
  for (const id of g.openContracts) {
    const c = CONTRACTS.find(x => x.id === id);
    opts.push({ action: { type: 'fulfill', id }, cost: c.cost, pri: c.vp >= 2 ? 0.2 : 0.7 });
  }
  if (lights < LIMITS.lighthouse) {
    const coast = entries(g).filter(([, h]) => own(h, p) && !h.lighthouse && g.isCoastal(h));
    if (coast.length) opts.push({ action: { type: 'build', kind: 'lighthouse', hex: coast[0][0] }, cost: COSTS.lighthouse, pri: lights ? 1.5 : 0.8 });
  }
  const hidden = entries(g).filter(([, h]) => !h.revealed && g.adjacentToOwn(h, p.id));
  if (hidden.length) {
    const maxOther = Math.max(0, ...g.players.filter(o => o.id !== p.id).map(o => o.discoveries));
    const contest = g.explorer !== p.id && p.discoveries + 1 >= Math.max(3, maxOther);
    const pri = !spots.length ? 0.3 : contest ? 0.9 : 2.5;
    const [k] = hidden[Math.floor(Math.random() * hidden.length)];
    opts.push({ action: { type: 'explore', hex: k }, cost: COSTS.explore, pri });
  }
  return opts;
}

function goal(g, p) {
  return best(options(g, p), o => -(missing(p.res, o.cost) + o.pri));
}

function decide(g, p, mem) {
  if (g.phase === 'setup') {
    const free = entries(g).filter(([, h]) => h.revealed && g.isLand(h) && !h.building);
    return { type: 'place', hex: best(free, ([, h]) => spotScore(g, p, h))[0] };
  }

  const turnKey = g.round + ':' + g.turn;
  if (mem.turnKey !== turnKey) Object.assign(mem, { turnKey, actions: 0, offered: Math.random() < 0.5 }); // ponuku skúša len v polovici ťahov
  if (!g.rolled) return { type: 'roll' };
  if (++mem.actions > MAX_ACTIONS_PER_TURN) return { type: 'endTurn' };

  if (g.offer && g.offer.from === p.id) {
    // čakaj len ak ju môže prijať nejaký živý hráč
    const humanCan = g.players.some(o => !o.bot && g.canPay(o, g.offer.want));
    return !humanCan || Date.now() - mem.offerAt > OFFER_WAIT_MS ? { type: 'cancelOffer' } : 'wait';
  }

  // 1) Postav / splň, čo sa dá
  const ready = options(g, p)
    .filter(o => missing(p.res, o.cost) === 0 && (o.pri < 2 || g.cards(p) > 6))
    .sort((a, b) => a.pri - b.pri);
  if (ready.length) return ready[0].action;

  // 2) Obchoduj smerom k cieľu
  const gl = goal(g, p);
  if (gl) {
    const need = gl.cost;
    const spare = r => p.res[r] - (need[r] || 0);
    const lacking = RES.filter(r => p.res[r] < (need[r] || 0));
    const rate = g.bankRate(p);
    const surplus = RES.filter(r => spare(r) >= rate).sort((a, b) => spare(b) - spare(a));
    if (lacking.length && surplus.length) return { type: 'bankTrade', give: surplus[0], get: lacking[0] };

    if (lacking.length && !mem.offered) {
      mem.offered = true;
      const extra = RES.filter(r => spare(r) >= 1).sort((a, b) => spare(b) - spare(a));
      if (extra.length) {
        mem.offerAt = Date.now();
        const give = { [extra[0]]: spare(extra[0]) >= 3 && lacking.length === 1 && missing(p.res, need) >= 2 ? 2 : 1 };
        const want = { [lacking[0]]: Math.min(2, (need[lacking[0]] || 0) - p.res[lacking[0]]) };
        return { type: 'offer', give, want };
      }
    }
  }

  // 3) Ochrana pred búrkou – zníž počet kariet
  if (g.cards(p) > STORM_LIMIT) {
    const rate = g.bankRate(p);
    const most = best(RES, r => p.res[r]);
    const least = best(RES, r => -p.res[r]);
    if (p.res[most] >= rate && most !== least) return { type: 'bankTrade', give: most, get: least };
  }
  return { type: 'endTurn' };
}

// Prijme bot aktuálnu ponuku?
function wantsOffer(g, p) {
  const o = g.offer;
  if (!o || o.from === p.id || g.phase !== 'play') return false;
  if (!g.canPay(p, o.want)) return false;
  const from = g.player(o.from);
  if (g.vp(from) >= g.target - 2) return false; // nepomáhaj lídrovi tesne pred výhrou
  const gl = goal(g, p);
  if (!gl) return false;
  const after = { ...p.res };
  for (const r of RES) after[r] += o.give[r] - o.want[r];
  return missing(after, gl.cost) < missing(p.res, gl.cost);
}

function botName(g) {
  const used = new Set(g.players.map(p => p.name));
  const free = BOT_NAMES.filter(n => !used.has('🤖 ' + n));
  return '🤖 ' + (free[Math.floor(Math.random() * free.length)] || 'Bot');
}

module.exports = { decide, wantsOffer, botName, missing };
