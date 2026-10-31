'use strict';

// Ukladanie rozohraných hier.
//  - DATABASE_URL nastavená → PostgreSQL (odporúčané na Renderi, napr. Neon / Render Postgres)
//  - inak → JSON súbory v priečinku DATA_DIR (predvolene ./data)

const fs = require('fs');
const path = require('path');

function fileStorage(dir) {
  const file = code => path.join(dir, code.replace(/[^A-Z0-9]/g, '') + '.json');
  return {
    name: `súbory (${dir})`,
    async init() {
      await fs.promises.mkdir(dir, { recursive: true });
    },
    async loadAll() {
      const out = [];
      for (const f of await fs.promises.readdir(dir)) {
        if (!f.endsWith('.json')) continue;
        try {
          out.push(JSON.parse(await fs.promises.readFile(path.join(dir, f), 'utf8')));
        } catch (e) {
          console.error('Nepodarilo sa načítať', f, e.message);
        }
      }
      return out;
    },
    async save(code, data) {
      const target = file(code);
      const tmp = target + '.tmp';
      await fs.promises.writeFile(tmp, JSON.stringify(data));
      await fs.promises.rename(tmp, target); // atomický zápis
    },
    async remove(code) {
      await fs.promises.rm(file(code), { force: true });
    },
    async close() {},
  };
}

function pgStorage(url) {
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: url, max: 3 });
  pool.on('error', e => console.error('Chyba databázy:', e.message));
  return {
    name: 'PostgreSQL',
    async init() {
      await pool.query(`CREATE TABLE IF NOT EXISTS suostrovie_rooms (
        code TEXT PRIMARY KEY,
        data JSON NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
    },
    async loadAll() {
      const r = await pool.query('SELECT data FROM suostrovie_rooms');
      return r.rows.map(x => x.data);
    },
    async save(code, data) {
      await pool.query(
        `INSERT INTO suostrovie_rooms (code, data, updated_at) VALUES ($1, $2, now())
         ON CONFLICT (code) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
        [code, JSON.stringify(data)],
      );
    },
    async remove(code) {
      await pool.query('DELETE FROM suostrovie_rooms WHERE code = $1', [code]);
    },
    async close() {
      await pool.end();
    },
  };
}

function createStorage(env = process.env) {
  if (env.DATABASE_URL) return pgStorage(env.DATABASE_URL);
  return fileStorage(env.DATA_DIR || path.join(__dirname, '..', 'data'));
}

module.exports = { createStorage, fileStorage, pgStorage };
