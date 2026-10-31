'use strict';

// Súostrovie – herný engine (autoritatívny, beží na serveri)

const RES = ['drevo', 'kamen', 'ruda', 'obilie', 'sol'];
const RES_NAMES = { drevo: 'drevo', kamen: 'kameň', ruda: 'ruda', obilie: 'obilie', sol: 'soľ' };
const TERRAIN_RES = { les: 'drevo', lom: 'kamen', bana: 'ruda', pole: 'obilie', solnisko: 'sol' };
const LAND = Object.keys(TERRAIN_RES);

const COSTS = {
  camp: { drevo: 1, kamen: 1, obilie: 1 },
  town: { ruda: 2, obilie: 2, sol: 1 },
  lighthouse: { kamen: 2, drevo: 1, sol: 1 },
  explore: { drevo: 1, obilie: 1 },
};
const LIMITS = { camp: 6, town: 4, lighthouse: 3 };
const COLORS = ['#e4572e', '#2e86de', '#f2c14e', '#3bb273', '#9b5de5'];
const MAX_PLAYERS = 5;
const MAP_RADIUS = 3;
const STORM_LIMIT = 8;
const EXPLORER_MIN = 3;
const EXPLORER_VP = 2;
const BANDIT_SUM = 7;
const TERRAIN_NAMES = { les: 'Les', lom: 'Lom', bana: 'Baňa', pole: 'Pole', solnisko: 'Soľnisko', more: 'More' };
const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];

const EVENTS = [
  { id: 'burka', name: 'Búrka', text: `Kto má viac ako ${STORM_LIMIT} surovín, stratí polovicu (náhodne).`, count: 3 },
  { id: 'hojnost', name: 'Hojnosť', text: 'Každá stavba ihneď vyprodukuje surovinu zo svojho políčka.', count: 2 },
  { id: 'pirati', name: 'Pirátsky nájazd', text: 'Každý hráč bez majáka stratí 1 náhodnú surovinu.', count: 3 },
  { id: 'lod', name: 'Obchodná loď', text: 'Každý hráč s majákom dostane 2 náhodné suroviny.', count: 2 },
  { id: 'sucho', name: 'Sucho', text: 'Každý hráč stratí polovicu obilia.', count: 2 },
  { id: 'nalez', name: 'Nález', text: 'Hráč na ťahu dostane 2 náhodné suroviny.', count: 2 },
];

const CONTRACTS = [
  ['Zásoby pre flotilu', { drevo: 2, obilie: 2 }],
  ['Soľná cesta', { sol: 2, obilie: 1, drevo: 1 }],
  ['Kamenný most', { kamen: 3, drevo: 1 }],
  ['Kováčska dielňa', { ruda: 2, drevo: 1, obilie: 1 }],
  ['Chrám na útese', { kamen: 2, ruda: 1, sol: 2 }],
  ['Veľká hostina', { obilie: 3, sol: 2 }],
  ['Zbrojnica', { ruda: 3, kamen: 2 }],
  ['Lodenica', { drevo: 3, ruda: 1, sol: 1 }],
  ['Sýpka', { obilie: 2, kamen: 2 }],
  ['Trh s korením', { sol: 3, drevo: 1 }],
  ['Strážna veža', { kamen: 2, drevo: 2, ruda: 1 }],
  ['Pevnosť', { kamen: 3, ruda: 2, obilie: 1 }],
  ['Rybárska osada', { drevo: 2, sol: 1, obilie: 1 }],
  ['Mincovňa', { ruda: 3, sol: 1 }],
].map(([name, cost], i) => {
  const n = Object.values(cost).reduce((a, b) => a + b, 0);
  return { id: 'c' + i, name, cost, vp: n >= 5 ? 2 : 1 };
});

class GameError extends Error {}

const key = (q, r) => q + ',' + r;
const dist = (q, r) => Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r));

function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function emptyRes() {
  return { drevo: 0, kamen: 0, ruda: 0, obilie: 0, sol: 0 };
}

function fmtRes(obj) {
  return RES.filter(r => obj[r]).map(r => `${obj[r]}× ${RES_NAMES[r]}`).join(', ') || 'nič';
}

function generateMap(rng) {
  const inner = [];
  const outer = [];
  for (let q = -MAP_RADIUS; q <= MAP_RADIUS; q++) {
    for (let r = -MAP_RADIUS; r <= MAP_RADIUS; r++) {
      const d = dist(q, r);
      if (d > MAP_RADIUS) continue;
      (d <= 2 ? inner : outer).push({ q, r, d });
    }
  }
  const hexes = {};
  // Vnútorná oblasť (odkrytá): 16 pevnina + 3 more na okraji
  const innerRing = shuffle(inner.filter(h => h.d === 2), rng);
  const innerWater = new Set(innerRing.slice(0, 3).map(h => key(h.q, h.r)));
  const outerShuf = shuffle(outer.slice(), rng);
  const outerWater = new Set(outerShuf.slice(0, 8).map(h => key(h.q, h.r)));

  const innerTerr = shuffle([...LAND, ...LAND, ...LAND, 'pole'], rng);
  const outerTerr = shuffle([...LAND, ...LAND], rng);
  const nums = n => {
    const base = [];
    while (base.length < n) for (let i = 1; i <= 6 && base.length < n; i++) base.push(i);
    return shuffle(base, rng);
  };
  const innerNums = nums(16);
  const outerNums = nums(10);

  for (const h of inner) {
    const k = key(h.q, h.r);
    if (innerWater.has(k)) hexes[k] = { q: h.q, r: h.r, terrain: 'more', num: null, revealed: true };
    else hexes[k] = { q: h.q, r: h.r, terrain: innerTerr.pop(), num: innerNums.pop(), revealed: true };
  }
  for (const h of outer) {
    const k = key(h.q, h.r);
    if (outerWater.has(k)) hexes[k] = { q: h.q, r: h.r, terrain: 'more', num: null, revealed: false };
    else hexes[k] = { q: h.q, r: h.r, terrain: outerTerr.pop(), num: outerNums.pop(), revealed: false };
  }
  for (const k in hexes) Object.assign(hexes[k], { building: null, lighthouse: false });
  return hexes;
}

class Game {
  constructor(opts = {}) {
    this.rng = opts.rng || Math.random;
    this.phase = 'lobby';
    this.target = 12;
    this.players = [];
    this.log = [];
    this.nextId = 1;
  }

  // ---------- lobby ----------
  addPlayer(name, opts = {}) {
    if (this.phase !== 'lobby') throw new GameError('Hra už začala.');
    if (this.players.length >= MAX_PLAYERS) throw new GameError('Párty je plná (max. 5 hráčov).');
    name = String(name || '').trim().slice(0, 20) || 'Hráč';
    const used = new Set(this.players.map(p => p.color));
    const p = {
      id: 'p' + this.nextId++,
      name,
      color: COLORS.find(c => !used.has(c)),
      res: emptyRes(),
      discoveries: 0,
      contractVP: 0,
      contracts: [],
      bot: !!opts.bot,
      level: opts.bot ? (opts.level || 'normal') : null,
    };
    this.players.push(p);
    return p.id;
  }

  removePlayer(id) {
    if (this.phase !== 'lobby') throw new GameError('Počas hry sa nedá odísť z poradia.');
    this.players = this.players.filter(p => p.id !== id);
  }

  start(target) {
    if (this.phase !== 'lobby') throw new GameError('Hra už beží.');
    if (this.players.length < 2) throw new GameError('Na začiatok treba aspoň 2 hráčov.');
    const t = Number(target);
    if (t >= 8 && t <= 20) this.target = Math.floor(t);
    shuffle(this.players, this.rng);
    this.hexes = generateMap(this.rng);
    const n = this.players.length;
    this.setupOrder = [...Array(n).keys(), ...[...Array(n).keys()].reverse()];
    this.setupIndex = 0;
    this.phase = 'setup';
    this.turn = 0;
    this.round = 1;
    this.rolled = false;
    this.dice = null;
    this.market = false;
    this.offer = null;
    this.explorer = null;
    this.lastEvent = null;
    this.winner = null;
    this.eventDeck = [];
    this.contractDeck = shuffle(CONTRACTS.map(c => c.id), this.rng);
    this.openContracts = this.contractDeck.splice(0, 3);
    // Banditi začínajú v horách – na odkrytom baníckom poli
    const mines = Object.keys(this.hexes).filter(k => this.hexes[k].revealed && this.hexes[k].terrain === 'bana');
    this.bandits = mines.length ? mines[Math.floor(this.rng() * mines.length)] : null;
    this.pendingBandits = false;
    this.addLog(`Hra začala! Cieľ: ${this.target} bodov. Každý hráč postaví 2 tábory.`);
  }

  // ---------- uloženie / obnovenie ----------
  serialize() {
    return JSON.parse(JSON.stringify(this)); // rng (funkcia) sa vynechá
  }

  static restore(data, opts = {}) {
    const g = new Game(opts);
    Object.assign(g, data);
    return g;
  }

  // ---------- helpers ----------
  addLog(msg) {
    this.log.push(msg);
    if (this.log.length > 60) this.log.shift();
  }

  player(id) {
    return this.players.find(p => p.id === id);
  }

  current() {
    if (this.phase === 'setup') return this.players[this.setupOrder[this.setupIndex]];
    if (this.phase === 'play') return this.players[this.turn];
    return null;
  }

  hex(k) {
    const h = this.hexes[k];
    if (!h) throw new GameError('Neplatné políčko.');
    return h;
  }

  neighbors(h) {
    return DIRS.map(([dq, dr]) => this.hexes[key(h.q + dq, h.r + dr)]).filter(Boolean);
  }

  isLand(h) {
    return h.terrain !== 'more';
  }

  adjacentToOwn(h, pid) {
    return this.neighbors(h).some(n => n.building && n.building.owner === pid);
  }

  isCoastal(h) {
    const ns = this.neighbors(h);
    return ns.length < 6 || ns.some(n => n.revealed && n.terrain === 'more');
  }

  count(pid, type) {
    let c = 0;
    for (const k in this.hexes) {
      const h = this.hexes[k];
      if (type === 'lighthouse') { if (h.lighthouse && h.building.owner === pid) c++; }
      else if (h.building && h.building.owner === pid && h.building.type === type) c++;
    }
    return c;
  }

  vp(p) {
    return this.count(p.id, 'camp') + 2 * this.count(p.id, 'town') + this.count(p.id, 'lighthouse')
      + p.contractVP + (this.explorer === p.id ? EXPLORER_VP : 0);
  }

  cards(p) {
    return RES.reduce((a, r) => a + p.res[r], 0);
  }

  canPay(p, cost) {
    return RES.every(r => p.res[r] >= (cost[r] || 0));
  }

  pay(p, cost) {
    if (!this.canPay(p, cost)) throw new GameError('Nemáš dosť surovín.');
    for (const r of RES) p.res[r] -= cost[r] || 0;
  }

  gain(p, r, n = 1) {
    p.res[r] += n;
  }

  randomRes() {
    return RES[Math.floor(this.rng() * RES.length)];
  }

  loseRandom(p, n) {
    const lost = emptyRes();
    for (let i = 0; i < n; i++) {
      const pool = RES.flatMap(r => Array(p.res[r]).fill(r));
      if (!pool.length) break;
      const r = pool[Math.floor(this.rng() * pool.length)];
      p.res[r]--;
      lost[r]++;
    }
    return lost;
  }

  bankRate(p) {
    if (this.market && this.current() === p) return 2;
    return this.count(p.id, 'lighthouse') > 0 ? 3 : 4;
  }

  checkWin() {
    const p = this.current();
    if (p && this.vp(p) >= this.target) {
      this.phase = 'ended';
      this.winner = p.id;
      this.offer = null;
      this.addLog(`🏆 ${p.name} vyhráva s ${this.vp(p)} bodmi!`);
    }
  }

  updateExplorer() {
    let best = this.explorer ? this.player(this.explorer) : null;
    for (const p of this.players) {
      if (p.discoveries < EXPLORER_MIN) continue;
      if (!best || p.discoveries > best.discoveries) best = p;
    }
    if (best && best.id !== this.explorer) {
      this.explorer = best.id;
      this.addLog(`🧭 ${best.name} získava titul Veľký objaviteľ (+${EXPLORER_VP} body).`);
    }
  }

  // ---------- akcie ----------
  act(pid, a) {
    if (!a || typeof a.type !== 'string') throw new GameError('Neplatná akcia.');
    const p = this.player(pid);
    if (!p) throw new GameError('Nie si v tejto hre.');
    if (a.type === 'acceptOffer') return this.acceptOffer(p);
    if (this.phase !== 'setup' && this.phase !== 'play') throw new GameError('Hra neprebieha.');
    if (this.current() !== p) throw new GameError('Nie si na ťahu.');

    if (this.phase === 'setup') {
      if (a.type !== 'place') throw new GameError('Najprv polož tábor.');
      return this.setupPlace(p, a.hex);
    }
    if (a.type === 'roll') return this.roll(p);
    if (!this.rolled) throw new GameError('Najprv hoď kockami.');
    if (a.type === 'moveBandits') return this.moveBandits(p, a.hex);
    if (this.pendingBandits) throw new GameError('Najprv presuň banditov (alebo ich nechaj na mieste).');
    switch (a.type) {
      case 'build': return this.build(p, a.kind, a.hex);
      case 'explore': return this.explore(p, a.hex);
      case 'bankTrade': return this.bankTrade(p, a.give, a.get);
      case 'offer': return this.makeOffer(p, a.give, a.want);
      case 'cancelOffer': this.offer = null; return;
      case 'fulfill': return this.fulfill(p, a.id);
      case 'endTurn': return this.endTurn(p);
      default: throw new GameError('Neznáma akcia.');
    }
  }

  setupPlace(p, k) {
    const h = this.hex(k);
    if (!h.revealed || !this.isLand(h)) throw new GameError('Tábor musí stáť na odkrytej pevnine.');
    if (h.building) throw new GameError('Políčko je obsadené.');
    h.building = { owner: p.id, type: 'camp' };
    const r = TERRAIN_RES[h.terrain];
    this.gain(p, r);
    this.addLog(`${p.name} postavil(a) tábor a dostáva 1× ${RES_NAMES[r]}.`);
    this.setupIndex++;
    if (this.setupIndex >= this.setupOrder.length) {
      this.phase = 'play';
      this.turn = 0;
      this.addLog(`Príprava skončila. Na ťahu je ${this.players[0].name}.`);
    }
  }

  roll(p) {
    if (this.rolled) throw new GameError('Už si hádzal(a).');
    const prod = 1 + Math.floor(this.rng() * 6);
    const ev = 1 + Math.floor(this.rng() * 6);
    this.dice = [prod, ev];
    this.rollCount = (this.rollCount || 0) + 1;
    this.lastRoll = { n: this.rollCount, by: p.id, dice: [prod, ev] };
    this.rolled = true;
    this.lastEvent = null;
    this.addLog(`${p.name} hádže: produkcia ${prod}, udalosť ${ev}.`);

    const gains = {};
    for (const k in this.hexes) {
      const h = this.hexes[k];
      if (!h.building || h.num !== prod) continue;
      if (k === this.bandits) {
        this.addLog(`  🦹 Banditi blokujú pole ${TERRAIN_NAMES[h.terrain]} (${h.num}) – ${this.player(h.building.owner).name} nič nedostáva.`);
        continue;
      }
      const owner = this.player(h.building.owner);
      const n = h.building.type === 'town' ? 2 : 1;
      const r = TERRAIN_RES[h.terrain];
      this.gain(owner, r, n);
      (gains[owner.id] ||= emptyRes())[r] += n;
    }
    for (const id in gains) this.addLog(`  ${this.player(id).name} dostáva ${fmtRes(gains[id])}.`);
    if (!Object.keys(gains).length) this.addLog('  Nikto nič nezískal.');

    if (ev === 6) {
      this.market = true;
      this.addLog('🛒 Trhový deň! Hráč na ťahu mení s bankou 2:1.');
    } else if (ev === 1) {
      this.drawEvent(p);
    }
    if (prod + ev === BANDIT_SUM) {
      this.pendingBandits = true;
      this.addLog(`🦹 Súčet ${BANDIT_SUM}! ${p.name} môže presunúť banditov.`);
    }
  }

  moveBandits(p, k) {
    if (!this.pendingBandits) throw new GameError('Banditov môžeš presunúť len po hode so súčtom 7.');
    if (k == null) {
      this.pendingBandits = false;
      this.addLog(`🦹 ${p.name} necháva banditov na mieste.`);
      return;
    }
    const h = this.hex(k);
    if (!h.revealed || !this.isLand(h)) throw new GameError('Banditi môžu ísť len na odkrytú pevninu.');
    if (k === this.bandits) throw new GameError('Banditi už na tomto poli sú.');
    this.bandits = k;
    this.pendingBandits = false;
    const who = h.building ? ` (${this.player(h.building.owner).name})` : '';
    this.addLog(`🦹 ${p.name} presúva banditov na pole ${TERRAIN_NAMES[h.terrain]} (${h.num})${who}.`);
  }

  drawEvent(p) {
    if (!this.eventDeck.length) {
      this.eventDeck = shuffle(EVENTS.flatMap(e => Array(e.count).fill(e.id)), this.rng);
    }
    const id = this.eventDeck.pop();
    const e = EVENTS.find(x => x.id === id);
    this.lastEvent = { name: e.name, text: e.text };
    this.addLog(`⚡ Udalosť: ${e.name} – ${e.text}`);
    switch (e.id) {
      case 'burka':
        for (const pl of this.players) {
          const c = this.cards(pl);
          if (c > STORM_LIMIT) this.addLog(`  ${pl.name} stráca ${fmtRes(this.loseRandom(pl, Math.floor(c / 2)))}.`);
        }
        break;
      case 'hojnost':
        for (const k in this.hexes) {
          const h = this.hexes[k];
          if (!h.building || k === this.bandits) continue;
          this.gain(this.player(h.building.owner), TERRAIN_RES[h.terrain], h.building.type === 'town' ? 2 : 1);
        }
        break;
      case 'pirati':
        for (const pl of this.players) {
          if (this.count(pl.id, 'lighthouse')) continue;
          const lost = this.loseRandom(pl, 1);
          if (this.cards({ res: lost })) this.addLog(`  ${pl.name} stráca ${fmtRes(lost)}.`);
        }
        break;
      case 'lod':
        for (const pl of this.players) {
          if (!this.count(pl.id, 'lighthouse')) continue;
          const g = emptyRes();
          for (let i = 0; i < 2; i++) { const r = this.randomRes(); g[r]++; this.gain(pl, r); }
          this.addLog(`  ${pl.name} dostáva ${fmtRes(g)}.`);
        }
        break;
      case 'sucho':
        for (const pl of this.players) pl.res.obilie -= Math.floor(pl.res.obilie / 2);
        break;
      case 'nalez': {
        const g = emptyRes();
        for (let i = 0; i < 2; i++) { const r = this.randomRes(); g[r]++; this.gain(p, r); }
        this.addLog(`  ${p.name} dostáva ${fmtRes(g)}.`);
        break;
      }
    }
  }

  build(p, kind, k) {
    const h = this.hex(k);
    if (kind === 'camp') {
      if (!h.revealed || !this.isLand(h)) throw new GameError('Tábor musí stáť na odkrytej pevnine.');
      if (h.building) throw new GameError('Políčko je obsadené.');
      if (!this.adjacentToOwn(h, p.id)) throw new GameError('Tábor musí susediť s tvojou stavbou.');
      if (this.count(p.id, 'camp') >= LIMITS.camp) throw new GameError('Nemáš už voľné tábory.');
      this.pay(p, COSTS.camp);
      h.building = { owner: p.id, type: 'camp' };
      this.addLog(`${p.name} stavia tábor.`);
    } else if (kind === 'town') {
      if (!h.building || h.building.owner !== p.id || h.building.type !== 'camp') throw new GameError('Mesto sa stavia na mieste tvojho tábora.');
      if (this.count(p.id, 'town') >= LIMITS.town) throw new GameError('Nemáš už voľné mestá.');
      this.pay(p, COSTS.town);
      h.building.type = 'town';
      this.addLog(`${p.name} rozširuje tábor na mesto.`);
    } else if (kind === 'lighthouse') {
      if (!h.building || h.building.owner !== p.id) throw new GameError('Maják sa stavia pri tvojej stavbe.');
      if (h.lighthouse) throw new GameError('Tu už maják stojí.');
      if (!this.isCoastal(h)) throw new GameError('Maják musí stáť na pobreží (pri mori alebo okraji mapy).');
      if (this.count(p.id, 'lighthouse') >= LIMITS.lighthouse) throw new GameError('Nemáš už voľné majáky.');
      this.pay(p, COSTS.lighthouse);
      h.lighthouse = true;
      this.addLog(`${p.name} stavia maják.`);
    } else {
      throw new GameError('Neznáma stavba.');
    }
    this.checkWin();
  }

  explore(p, k) {
    const h = this.hex(k);
    if (h.revealed) throw new GameError('Toto políčko je už objavené.');
    if (!this.adjacentToOwn(h, p.id)) throw new GameError('Objavovať môžeš len vedľa svojej stavby.');
    this.pay(p, COSTS.explore);
    h.revealed = true;
    p.discoveries++;
    if (this.isLand(h)) {
      const r = TERRAIN_RES[h.terrain];
      this.gain(p, r);
      this.addLog(`🧭 ${p.name} objavuje nové územie a dostáva 1× ${RES_NAMES[r]}.`);
    } else {
      this.addLog(`🧭 ${p.name} objavuje otvorené more.`);
    }
    this.updateExplorer();
    this.checkWin();
  }

  bankTrade(p, give, get) {
    if (!RES.includes(give) || !RES.includes(get) || give === get) throw new GameError('Neplatná výmena.');
    const rate = this.bankRate(p);
    this.pay(p, { [give]: rate });
    this.gain(p, get);
    this.addLog(`${p.name} mení s bankou ${rate}× ${RES_NAMES[give]} za 1× ${RES_NAMES[get]}.`);
  }

  cleanBundle(b) {
    const out = emptyRes();
    for (const r of RES) {
      const n = Math.floor(Number(b && b[r]) || 0);
      if (n < 0 || n > 30) throw new GameError('Neplatné množstvo.');
      out[r] = n;
    }
    return out;
  }

  makeOffer(p, give, want) {
    give = this.cleanBundle(give);
    want = this.cleanBundle(want);
    if (!this.cards({ res: give }) || !this.cards({ res: want })) throw new GameError('Ponuka musí niečo dávať aj niečo chcieť.');
    if (RES.some(r => give[r] && want[r])) throw new GameError('Nemôžeš dávať aj chcieť tú istú surovinu.');
    if (!this.canPay(p, give)) throw new GameError('Nemáš suroviny, ktoré ponúkaš.');
    this.offer = { from: p.id, give, want };
    this.addLog(`🤝 ${p.name} ponúka ${fmtRes(give)} za ${fmtRes(want)}.`);
  }

  acceptOffer(p) {
    const o = this.offer;
    if (this.phase !== 'play' || !o) throw new GameError('Žiadna ponuka nie je aktívna.');
    if (o.from === p.id) throw new GameError('Nemôžeš prijať vlastnú ponuku.');
    const from = this.player(o.from);
    if (!this.canPay(p, o.want)) throw new GameError('Nemáš požadované suroviny.');
    if (!this.canPay(from, o.give)) { this.offer = null; throw new GameError('Ponúkajúci už nemá dané suroviny.'); }
    this.pay(from, o.give);
    this.pay(p, o.want);
    for (const r of RES) { from.res[r] += o.want[r]; p.res[r] += o.give[r]; }
    this.offer = null;
    this.addLog(`🤝 ${p.name} prijíma obchod od ${from.name}.`);
  }

  fulfill(p, id) {
    if (!this.openContracts.includes(id)) throw new GameError('Táto zákazka nie je dostupná.');
    const c = CONTRACTS.find(x => x.id === id);
    this.pay(p, c.cost);
    p.contractVP += c.vp;
    p.contracts.push(c.name);
    const i = this.openContracts.indexOf(id);
    if (this.contractDeck.length) this.openContracts[i] = this.contractDeck.shift();
    else this.openContracts.splice(i, 1);
    this.addLog(`📜 ${p.name} plní zákazku „${c.name}“ (+${c.vp} b.).`);
    this.checkWin();
  }

  endTurn(p) {
    this.offer = null;
    this.market = false;
    this.rolled = false;
    this.dice = null;
    this.turn = (this.turn + 1) % this.players.length;
    if (this.turn === 0) this.round++;
    this.addLog(`Na ťahu je ${this.players[this.turn].name}.`);
  }

  // Pre odpojeného hráča: ostatní môžu jeho ťah preskočiť
  forceSkip() {
    const p = this.current();
    if (!p) throw new GameError('Hra neprebieha.');
    if (this.phase === 'setup') {
      const free = Object.keys(this.hexes).filter(k => {
        const h = this.hexes[k];
        return h.revealed && this.isLand(h) && !h.building;
      });
      this.addLog(`${p.name} je odpojený(á) – tábor sa položí náhodne.`);
      return this.setupPlace(p, free[Math.floor(this.rng() * free.length)]);
    }
    this.addLog(`${p.name} je odpojený(á) – ťah sa preskakuje.`);
    if (!this.rolled) this.roll(p);
    if (this.pendingBandits) this.moveBandits(p, null);
    if (this.phase === 'play') this.endTurn(p);
  }

  // ---------- pohľad pre klienta ----------
  view(pid) {
    const base = {
      phase: this.phase,
      target: this.target,
      me: pid,
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        bot: p.bot,
        level: p.level,
        color: p.color,
        cards: this.cards(p),
        res: p.id === pid ? { ...p.res } : null,
        vp: this.phase === 'lobby' ? 0 : this.vp(p),
        discoveries: p.discoveries,
        contracts: p.contracts.slice(),
        camps: this.phase === 'lobby' ? 0 : this.count(p.id, 'camp'),
        towns: this.phase === 'lobby' ? 0 : this.count(p.id, 'town'),
        lighthouses: this.phase === 'lobby' ? 0 : this.count(p.id, 'lighthouse'),
      })),
      log: this.log.slice(-40),
    };
    if (this.phase === 'lobby') return base;
    const me = this.player(pid);
    return Object.assign(base, {
      current: this.current() ? this.current().id : null,
      setupRound: this.phase === 'setup' ? (this.setupIndex < this.players.length ? 1 : 2) : null,
      round: this.round,
      rolled: this.rolled,
      dice: this.dice,
      market: this.market,
      offer: this.offer,
      explorer: this.explorer,
      lastEvent: this.lastEvent,
      lastRoll: this.lastRoll || null,
      bandits: this.bandits || null,
      pendingBandits: !!this.pendingBandits,
      winner: this.winner,
      bankRate: me ? this.bankRate(me) : 4,
      contracts: this.openContracts.map(id => CONTRACTS.find(c => c.id === id)),
      contractsLeft: this.contractDeck.length,
      hexes: Object.entries(this.hexes).map(([k, h]) => ({
        k, q: h.q, r: h.r,
        revealed: h.revealed,
        terrain: h.revealed ? h.terrain : null,
        num: h.revealed ? h.num : null,
        building: h.building,
        lighthouse: h.lighthouse,
        coastal: this.isCoastal(h),
      })),
    });
  }
}

module.exports = { Game, GameError, RES, COSTS, LIMITS, CONTRACTS, EVENTS, TERRAIN_RES, MAX_PLAYERS, STORM_LIMIT, BANDIT_SUM, generateMap, key };
