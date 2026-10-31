# 🏝️ Súostrovie

Online stolová hra pre 2–5 hráčov o objavovaní ostrovov, obchodovaní a stavaní.
Hrá sa v prehliadači (počítač aj mobil), kamaráti sa pripájajú cez **párty kód**.

## Spustenie

```bash
npm install
npm start          # server na http://localhost:3000 (port sa dá zmeniť cez PORT)
npm test           # testy herného enginu
```

1. Jeden hráč otvorí stránku, zadá meno a klikne **Vytvoriť párty**.
2. Ostatným pošle 5-znakový kód alebo odkaz (`...?party=KOD`).
3. Keď sú všetci v lobby, zakladateľ zvolí počet bodov na výhru a spustí hru.

Pri obnovení stránky alebo výpadku spojenia sa hráč automaticky vráti do svojej hry.
Ak je hráč na ťahu odpojený, ostatní môžu jeho ťah preskočiť.

### Hranie cez internet

Aby sa kamaráti pripojili odinakiaľ, server musí byť verejne dostupný, napr.:
- nasadiť ho na hosting s podporou Node.js a WebSocketov (Render, Railway, Fly.io…) – príkaz `npm start`,
- alebo lokálne spustiť a vystaviť cez tunel (napr. `cloudflared tunnel --url http://localhost:3000`).

V rovnakej Wi-Fi stačí otvoriť `http://<IP-tvojho-počítača>:3000`.

## Pravidlá v skratke

- **Mapa:** 37 šesťuholníkov. Stred je odkrytý, vonkajší okruh je v hmle.
- **Príprava:** každý položí 2 tábory (poradie tam a späť) a dostane surovinu z každého z nich.
- **Ťah:** hoď **kockou produkcie** a **kockou udalostí**. Stavby na políčkach s padnutým číslom produkujú (tábor 1, mesto 2).
  Na kocke udalostí 1 sa ťahá karta udalosti, 6 znamená Trhový deň (výmena s bankou 2:1).
- **Stavby** (jedna na políčko): Tábor 1 b., Mesto 2 b., Maják 1 b. (na pobreží, výmena 3:1, ochrana pred pirátmi).
- **Výprava:** odkryje zahalené políčko vedľa tvojej stavby. Najviac objavov (aspoň 3) = Veľký objaviteľ (+2 b.).
- **Zákazky:** odovzdaj suroviny za 1–2 body.
- **Obchod:** s bankou alebo ponukou ostatným hráčom.
- **Výhra:** prvý, kto počas svojho ťahu dosiahne cieľový počet bodov (štandardne 12).

## Štruktúra

- `src/game.js` – herný engine (pravidlá, autoritatívne na serveri)
- `server.js` – HTTP + WebSocket server, správa párty
- `public/` – klient (HTML, CSS, JS, mapa v SVG)
- `test/` – testy enginu
