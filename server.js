'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');
const { Game, GameError } = require('./src/game');

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');
const ROOM_TTL = 3 * 60 * 60 * 1000; // neaktívne párty sa zmažú po 3 hodinách
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };

// ---------- statické súbory ----------
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  let file = url.pathname === '/' ? '/index.html' : url.pathname;
  const full = path.normalize(path.join(PUBLIC, file));
  if (!full.startsWith(PUBLIC + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(full, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Nenájdené'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream' });
    res.end(data);
  });
});

// ---------- párty ----------
/** code -> { code, game, host, tokens: Map(token->pid), sockets: Map(pid->Set(ws)), lastActive } */
const rooms = new Map();

function newCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c;
  do { c = Array.from({ length: 5 }, () => A[crypto.randomInt(A.length)]).join(''); } while (rooms.has(c));
  return c;
}

function send(ws, msg) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

function connected(room, pid) {
  const s = room.sockets.get(pid);
  return !!(s && s.size);
}

function broadcast(room) {
  room.lastActive = Date.now();
  for (const [pid, set] of room.sockets) {
    const state = room.game.view(pid);
    state.code = room.code;
    state.host = room.host;
    for (const p of state.players) p.online = connected(room, p.id);
    for (const ws of set) send(ws, { t: 'state', state });
  }
}

function attach(ws, room, pid, token) {
  if (!room.sockets.has(pid)) room.sockets.set(pid, new Set());
  room.sockets.get(pid).add(ws);
  ws.room = room;
  ws.pid = pid;
  send(ws, { t: 'joined', code: room.code, token, pid });
}

function detach(ws) {
  const room = ws.room;
  if (!room) return;
  const set = room.sockets.get(ws.pid);
  if (set) set.delete(ws);
  ws.room = null;
  broadcast(room);
}

function handle(ws, msg) {
  switch (msg.t) {
    case 'create': {
      const code = newCode();
      const room = { code, game: new Game(), tokens: new Map(), sockets: new Map(), lastActive: Date.now() };
      const pid = room.game.addPlayer(msg.name);
      const token = crypto.randomUUID();
      room.host = pid;
      room.tokens.set(token, pid);
      rooms.set(code, room);
      attach(ws, room, pid, token);
      return broadcast(room);
    }
    case 'join': {
      const room = rooms.get(String(msg.code || '').toUpperCase().trim());
      if (!room) throw new GameError('Párty s týmto kódom neexistuje.');
      const pid = room.game.addPlayer(msg.name);
      const token = crypto.randomUUID();
      room.tokens.set(token, pid);
      attach(ws, room, pid, token);
      room.game.addLog(`${room.game.player(pid).name} sa pridal(a) do párty.`);
      return broadcast(room);
    }
    case 'rejoin': {
      const room = rooms.get(String(msg.code || '').toUpperCase());
      const pid = room && room.tokens.get(msg.token);
      if (!pid || !room.game.player(pid)) return send(ws, { t: 'rejoinFailed' });
      attach(ws, room, pid, msg.token);
      return broadcast(room);
    }
  }

  const room = ws.room;
  if (!room) throw new GameError('Nie si v žiadnej párty.');
  const g = room.game;
  switch (msg.t) {
    case 'start':
      if (ws.pid !== room.host) throw new GameError('Hru môže spustiť len zakladateľ párty.');
      g.start(msg.target);
      return broadcast(room);
    case 'act':
      g.act(ws.pid, msg.action);
      return broadcast(room);
    case 'skip': {
      const cur = g.current();
      if (!cur || connected(room, cur.id)) throw new GameError('Ťah sa dá preskočiť len odpojenému hráčovi.');
      g.forceSkip();
      return broadcast(room);
    }
    case 'leave': {
      if (g.phase === 'lobby') {
        g.removePlayer(ws.pid);
        for (const [t, p] of room.tokens) if (p === ws.pid) room.tokens.delete(t);
        room.sockets.delete(ws.pid);
        if (room.host === ws.pid && g.players.length) room.host = g.players[0].id;
        if (!g.players.length) rooms.delete(room.code);
        ws.room = null;
        send(ws, { t: 'left' });
        return broadcast(room);
      }
      detach(ws);
      return send(ws, { t: 'left' });
    }
    case 'chat': {
      const text = String(msg.text || '').trim().slice(0, 200);
      if (!text) return;
      const p = g.player(ws.pid);
      for (const set of room.sockets.values()) for (const s of set) send(s, { t: 'chat', name: p.name, color: p.color, text });
      return;
    }
    default:
      throw new GameError('Neznáma správa.');
  }
}

const wss = new WebSocketServer({ server, maxPayload: 16 * 1024 });
wss.on('connection', ws => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  ws.on('message', data => {
    let msg;
    try { msg = JSON.parse(data); } catch { return; }
    try {
      handle(ws, msg);
    } catch (e) {
      if (e instanceof GameError) send(ws, { t: 'error', msg: e.message });
      else { console.error(e); send(ws, { t: 'error', msg: 'Chyba servera.' }); }
    }
  });
  ws.on('close', () => detach(ws));
});

setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false;
    ws.ping();
  }
  const now = Date.now();
  for (const [code, room] of rooms) if (now - room.lastActive > ROOM_TTL) rooms.delete(code);
}, 30000).unref();

server.listen(PORT, () => console.log(`Súostrovie beží na http://localhost:${PORT}`));
