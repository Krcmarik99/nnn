'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const WebSocket = require('ws');
const { Game } = require('../src/game');
const { fileStorage } = require('../src/storage');

test('hra sa dá uložiť a obnoviť uprostred partie', () => {
  const g = new Game();
  g.addPlayer('A');
  g.addPlayer('B', { bot: true, level: 'hard' });
  g.start(12);
  while (g.phase === 'setup') g.forceSkip();
  g.act(g.current().id, { type: 'roll' });
  const data = JSON.parse(JSON.stringify(g.serialize()));
  const r = Game.restore(data);
  assert.deepStrictEqual(r.view(g.players[0].id), g.view(g.players[0].id));
  assert.strictEqual(r.bandits, g.bandits);
  // obnovená hra pokračuje (vrátane prípadného presunu banditov po súčte 7)
  if (r.pendingBandits) r.act(r.current().id, { type: 'moveBandits', hex: null });
  r.act(r.current().id, { type: 'endTurn' });
  r.act(r.current().id, { type: 'roll' });
  assert.strictEqual(r.phase, 'play');
});

test('súborové úložisko: uloží, načíta, zmaže', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'suo-'));
  const st = fileStorage(dir);
  await st.init();
  await st.save('ABCDE', { code: 'ABCDE', x: 1 });
  await st.save('FGHJK', { code: 'FGHJK', x: 2 });
  assert.deepStrictEqual((await st.loadAll()).map(d => d.x).sort(), [1, 2]);
  await st.remove('ABCDE');
  assert.deepStrictEqual((await st.loadAll()).map(d => d.code), ['FGHJK']);
  fs.rmSync(dir, { recursive: true });
});

// ---------- reštart servera ----------
function startServer(port, env) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
      env: { ...process.env, PORT: String(port), ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    p.stdout.on('data', d => { out += d; if (out.includes('beží')) resolve({ p, out: () => out }); });
    p.stderr.on('data', d => { out += d; });
    p.on('exit', c => reject(new Error('server skončil: ' + c + '\n' + out)));
  });
}
const stopServer = p => new Promise(r => { p.removeAllListeners('exit'); p.on('exit', r); p.kill('SIGTERM'); });

function client(port) {
  const ws = new WebSocket(`ws://localhost:${port}`);
  const queue = [];
  let waiter = null;
  ws.on('message', d => {
    const m = JSON.parse(d);
    queue.push(m);
    if (waiter && waiter.pred(m)) { const w = waiter; waiter = null; w.resolve(m); }
  });
  return {
    ready: new Promise(r => ws.on('open', r)),
    send: m => ws.send(JSON.stringify(m)),
    next(pred) {
      const i = queue.findIndex(pred);
      if (i >= 0) return Promise.resolve(queue.splice(i, 1)[0]);
      return new Promise((resolve, reject) => {
        waiter = { pred, resolve };
        setTimeout(() => reject(new Error('timeout')), 5000);
      });
    },
    clear: () => { queue.length = 0; },
    close: () => ws.close(),
  };
}

test('rozohraná hra prežije reštart servera', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'suo-'));
  const env = process.env.TEST_DATABASE_URL ? { DATABASE_URL: process.env.TEST_DATABASE_URL } : { DATA_DIR: dir };
  const port = 3900 + Math.floor(Math.random() * 90);
  const procs = [];
  const clients = [];
  try {
    let srv = await startServer(port, env);
    procs.push(srv.p);
    const a = client(port);
    const b = client(port);
    clients.push(a, b);
    await a.ready;
    a.send({ t: 'create', name: 'Ana' });
    const joined = await a.next(m => m.t === 'joined');
    await b.ready;
    b.send({ t: 'join', code: joined.code, name: 'Ben' });
    await b.next(m => m.t === 'joined');
    a.send({ t: 'start', target: 12 });
    let st = (await a.next(m => m.t === 'state' && m.state.phase === 'setup')).state;
    while (st.phase === 'setup') {
      const free = st.hexes.find(h => h.revealed && h.terrain !== 'more' && !h.building);
      (st.current === st.me ? a : b).send({ t: 'act', action: { type: 'place', hex: free.k } });
      const len = st.log.length;
      st = (await a.next(m => m.t === 'state' && m.state.log.length > len)).state;
    }
    assert.strictEqual(st.phase, 'play');
    a.close(); b.close();

    await stopServer(srv.p);
    srv = await startServer(port, env);
    procs.push(srv.p);
    assert.match(srv.out(), /obnovených hier: [1-9]/);

    const a2 = client(port);
    clients.push(a2);
    await a2.ready;
    a2.send({ t: 'rejoin', code: joined.code, token: joined.token });
    const after = (await a2.next(m => m.t === 'state')).state;
    assert.deepStrictEqual(after.hexes, st.hexes);
    assert.deepStrictEqual(after.players.map(p => p.res), st.players.map(p => p.res));
    assert.strictEqual(after.current, st.current);
    // hra pokračuje: hráč na ťahu (ak je to Ana) môže hodiť
    if (after.current === after.me) {
      a2.send({ t: 'act', action: { type: 'roll' } });
      const rolled = (await a2.next(m => m.t === 'state' && m.state.rolled)).state;
      assert.ok(rolled.dice);
    }
  } finally {
    clients.forEach(c => c.close());
    for (const p of procs) if (p.exitCode === null) await stopServer(p);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
