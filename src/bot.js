'use strict';

// Jednoduchá AI pre Súostrovie. Každé volanie decide() vráti jednu akciu,
// aby server mohol ťahy botov prehrávať postupne a s prestávkami.

const { RES, COSTS, LIMITS, CONTRACTS, TERRAIN_RES, STORM_LIMIT } = require('./game');

const BOT_NAMES = ['Anka', 'Boris', 'Cyril', 'Dana', 'Emil', 'Fero', 'Gabika', 'Hugo'];
const OFFER_WAIT_MS = 6000;
const MAX_ACTIONS_PER_TURN = 30;

// Úrovne obtiažnosti
const LEVELS = {
  easy: {
    label: 'ľahká',
    noise: 3,            // takmer náhodný výber políčok
    randomBuild: true,   // stavia čokoľvek, nie najlepšiu vec
    tradeMinCards: 7,    // s bankou mení až pri plnej ruke
    offerChance: 0.25,
    stormGuard: false,
    acceptLoose: true,   // prijme aj neutrálnu výmenu
    leaderGuard: -1,     // nestráži lídra
    valueAware: false,
  },
  normal: {
    label: 'stredná',
    noise: 0.3, randomBuild: false, tradeMinCards: 0, offerChance: 0.5,
    stormGuard: true, acceptLoose: false, leaderGuard: 2, valueAware: false,
  },
  hard: {
    label: 'ťažká',
    noise: 0.05, randomBuild: false, tradeMinCards: 0, offerChance: 0.9,
    stormGuard: true, acceptLoose: false, leaderGuard: 2, valueAware: true,
  },
};
const lv = p => LEVELS[p.level] || LEVELS.normal;

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
  if (lv(p).valueAware) {
    // ťažký bot počíta aj s tým, koľko jeho stavieb už má rovnaké číslo/surovinu
    s += mine.filter(x => x.num === h.num).length * -0.6;
    if (g.bandits && g.hexes[g.bandits] === h) s -= 3; // pole s banditmi nič nevyprodukuje
  }
  return s + Math.random() * lv(p).noise;
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
    if (mine.length) {
      // mesto tam, kde produkuje surovinu, ktorej má najmenej
      const [k] = lv(p).valueAware ? best(mine, ([key, h]) => -p.res[TERRAIN_RES[h.terrain]] - (key === g.bandits ? 10 : 0)) : mine[0];
      opts.push({ action: { type: 'build', kind: 'town', hex: k }, cost: COSTS.town, pri: lv(p).valueAware ? -0.4 : 0 });
    }
  }
  for (const id of g.openContracts) {
    const c = CONTRACTS.find(x => x.id === id);
    opts.push({ action: { type: 'fulfill', id }, cost: c.cost, pri: c.vp >= 2 ? (lv(p).valueAware ? 0 : 0.2) : 0.7, vp: c.vp });
  }
  if (lights < LIMITS.lighthouse) {
    const coast = entries(g).filter(([, h]) => own(h, p) && !h.lighthouse && g.isCoastal(h));
    if (coast.length) opts.push({ action: { type: 'build', kind: 'lighthouse', hex: coast[0][0] }, cost: COSTS.lighthouse, pri: lights ? 1.5 : lv(p).valueAware ? 0.5 : 0.8 });
  }
  if (g.count(p.id, 'port') < LIMITS.port) {
    const coast = entries(g).filter(([, h]) => own(h, p) && !h.port && g.isCoastal(h));
    const ports = g.count(p.id, 'port');
    if (coast.length) opts.push({ action: { type: 'build', kind: 'port', hex: coast[0][0] }, cost: COSTS.port, pri: ports ? 1.8 : lv(p).valueAware ? 0.6 : 0.9 });
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

// Kam presunúť banditov: na pole súpera (najmä lídra), nikdy nie na svoje
function banditTarget(g, p) {
  const L = lv(p);
  const land = entries(g).filter(([k, h]) => h.revealed && g.isLand(h) && k !== g.bandits);
  if (!land.length) return null;
  if (L.randomBuild) {
    const safe = land.filter(([, h]) => !own(h, p));
    const pick = safe.length ? safe : land;
    return pick[Math.floor(Math.random() * pick.length)][0];
  }
  const harm = (k, h) => {
    if (!h.building) return 0;
    if (own(h, p)) return -10;
    const owner = g.player(h.building.owner);
    const lead = g.vp(owner) / g.target;
    return (h.building.type === 'town' ? 2 : 1) * (1 + lead * (L.valueAware ? 3 : 1));
  };
  const [bk, bh] = best(land, ([k, h]) => harm(k, h) + Math.random() * 0.1);
  const cur = g.bandits && g.hexes[g.bandits];
  // ak banditi už stoja na dobrom mieste, nechaj ich tam
  if (cur && harm(g.bandits, cur) >= harm(bk, bh)) return null;
  return bk;
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
  const L = lv(p);
  if (mem.turnKey !== turnKey) Object.assign(mem, { turnKey, actions: 0, offered: Math.random() >= L.offerChance });
  if (!g.rolled) return { type: 'roll' };
  if (g.pendingBandits) return { type: 'moveBandits', hex: banditTarget(g, p) };
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
  if (ready.length) {
    if (L.randomBuild) return ready[Math.floor(Math.random() * ready.length)].action;
    if (L.valueAware) {
      // ak niektorá akcia prinesie výhru, urob ju hneď
      const gainVp = o => o.vp || (o.action.kind === 'town' ? 1 : o.action.type === 'build' ? 1 : 0);
      const win = ready.find(o => g.vp(p) + gainVp(o) >= g.target);
      if (win) return win.action;
    }
    return ready[0].action;
  }

  // 2) Obchoduj smerom k cieľu
  const gl = goal(g, p);
  if (gl) {
    const need = gl.cost;
    const spare = r => p.res[r] - (need[r] || 0);
    const lacking = RES.filter(r => p.res[r] < (need[r] || 0));
    const rate = g.bankRate(p);
    const surplus = RES.filter(r => spare(r) >= rate).sort((a, b) => spare(b) - spare(a));
    if (lacking.length && surplus.length && g.cards(p) >= L.tradeMinCards) return { type: 'bankTrade', give: surplus[0], get: lacking[0] };

    if (lacking.length && !mem.offered) {
      mem.offered = true;
      const extra = RES.filter(r => spare(r) >= 1).sort((a, b) => spare(b) - spare(a));
      if (extra.length) {
        const give = { [extra[0]]: spare(extra[0]) >= 3 && lacking.length === 1 && missing(p.res, need) >= 2 ? 2 : 1 };
        const want = { [lacking[0]]: Math.min(2, (need[lacking[0]] || 0) - p.res[lacking[0]]) };
        // s prístavom pošle námornú ponuku, ktorá platí celé kolo
        const mine = (g.portOffers || []).some(o => o.from === p.id);
        if (g.hasPort(p) && !mine && Math.random() < 0.5) return { type: 'portOffer', give, want };
        mem.offerAt = Date.now();
        return { type: 'offer', give, want };
      }
    }
  }

  // 3) Ochrana pred búrkou – zníž počet kariet
  if (L.stormGuard && g.cards(p) > STORM_LIMIT) {
    const rate = g.bankRate(p);
    const most = best(RES, r => p.res[r]);
    const least = best(RES, r => -p.res[r]);
    if (p.res[most] >= rate && most !== least) return { type: 'bankTrade', give: most, get: least };
  }
  return { type: 'endTurn' };
}

// Prijme bot aktuálnu ponuku?
function wantsOffer(g, p, o = g.offer) {
  if (!o || o.from === p.id || g.phase !== 'play') return false;
  if (o !== g.offer && !g.hasPort(p)) return false; // námorný obchod len s prístavom
  if (!g.canPay(p, o.want)) return false;
  const L = lv(p);
  const from = g.player(o.from);
  if (L.leaderGuard >= 0 && g.vp(from) >= g.target - L.leaderGuard) return false; // nepomáhaj lídrovi tesne pred výhrou
  const gl = goal(g, p);
  if (!gl) return false;
  const after = { ...p.res };
  for (const r of RES) after[r] += o.give[r] - o.want[r];
  const before = missing(p.res, gl.cost);
  const now = missing(after, gl.cost);
  if (L.acceptLoose) return now <= before;
  if (L.valueAware) {
    // ťažký bot nedá viac kariet, než dostane, ak to nie je nutné
    const giveN = RES.reduce((a, r) => a + o.want[r], 0);
    const getN = RES.reduce((a, r) => a + o.give[r], 0);
    return now < before && (getN >= giveN || now === 0);
  }
  return now < before;
}

// Prvá námorná ponuka, ktorú by bot prijal
function wantsPortOffer(g, p) {
  return (g.portOffers || []).find(o => wantsOffer(g, p, o)) || null;
}

function botName(g) {
  const used = new Set(g.players.map(p => p.name));
  const free = BOT_NAMES.filter(n => !used.has('🤖 ' + n));
  return '🤖 ' + (free[Math.floor(Math.random() * free.length)] || 'Bot');
}

module.exports = { decide, wantsOffer, wantsPortOffer, botName, missing, LEVELS, banditTarget };
