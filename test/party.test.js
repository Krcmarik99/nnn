'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const WebSocket = require('ws');
const { Game } = require('../src/game');

test('engine: odchod z hry nahradí hráča AI, ukončenie vyhlási lídra', () => {
  const g = new Game();
  const a = g.addPlayer('Ana'); const b = g.addPlayer('Ben');
  g.start(12);
  while (g.phase === 'setup') g.forceSkip();
  g.replaceWithBot(b);
  const pb = g.player(b);
  assert.ok(pb.bot && pb.name.startsWith('🤖') && pb.level === 'normal');
  g.player(a).contractVP = 3;
  g.abort('Ana');
  assert.strictEqual(g.phase, 'ended');
  assert.strictEqual(g.winner, a);
  assert.strictEqual(g.view(a).aborted, true);
  assert.throws(() => g.abort('Ana'), /neprebieha/);
});

function startServer(port, env) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
      env: { ...process.env, PORT: String(port), ...env }, stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    p.stdout.on('data', d => { out += d; if (out.includes('beží')) resolve(p); });
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
      return new Promise((resolve, reject) => { waiter = { pred, resolve }; setTimeout(() => reject(new Error('timeout')), 5000); });
    },
    close: () => ws.close(),
  };
}
const st = (pred) => m => m.t === 'state' && pred(m.state);

test('párty: ukončenie hry, nová hra s rovnakou partiou, odchod počas hry', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'suo-'));
  const port = 4000 + Math.floor(Math.random() * 90);
  const srv = await startServer(port, { DATA_DIR: dir });
  const a = client(port), b = client(port);
  try {
    await a.ready; await b.ready;
    a.send({ t: 'create', name: 'Ana' });
    const ja = await a.next(m => m.t === 'joined');
    b.send({ t: 'join', code: ja.code, name: 'Ben' });
    const jb = await b.next(m => m.t === 'joined');
    a.send({ t: 'start', target: 12 });
    await b.next(st(s => s.phase === 'setup'));

    // len zakladateľ môže ukončiť hru
    b.send({ t: 'endGame' });
    assert.match((await b.next(m => m.t === 'error')).msg, /zakladateľ/);
    a.send({ t: 'endGame' });
    const ended = (await b.next(st(s => s.phase === 'ended'))).state;
    assert.strictEqual(ended.aborted, true);
    assert.ok(ended.winner);

    // nová hra s rovnakou partiou – obaja v lobby, tokeny platia
    a.send({ t: 'rematch' });
    const lobby = (await b.next(st(s => s.phase === 'lobby'))).state;
    assert.deepStrictEqual(lobby.players.map(p => p.name), ['Ana', 'Ben']);
    assert.strictEqual(lobby.host, lobby.players[0].id);

    // nová hra a odchod zakladateľa počas hry → AI prevezme miesto, zakladateľom je Ben
    a.send({ t: 'start', target: 12 });
    await b.next(st(s => s.phase === 'setup'));
    a.send({ t: 'leave' });
    await a.next(m => m.t === 'left');
    const after = (await b.next(st(s => s.players.some(p => p.bot)))).state;
    const ana = after.players.find(p => p.name.includes('Ana'));
    assert.ok(ana.bot && ana.name.startsWith('🤖'));
    assert.strictEqual(after.host, after.me, 'zakladateľom je teraz Ben');
    assert.ok(after.log.some(l => l.includes('odišiel(a) z hry')));

    // Ana sa už do hry nevráti
    const a2 = client(port);
    await a2.ready;
    a2.send({ t: 'rejoin', code: ja.code, token: ja.token });
    await a2.next(m => m.t === 'rejoinFailed');
    a2.close();

    // Ben ostal jediný človek – môže hru ukončiť
    b.send({ t: 'endGame' });
    await b.next(st(s => s.phase === 'ended'));
    void jb;
  } finally {
    a.close(); b.close();
    await stopServer(srv);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
