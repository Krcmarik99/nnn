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

**Hráš sám?** V lobby klikni na **🤖 Pridať AI hráča** (1–4 boti) a spusti hru.
AI hráči stavajú, objavujú, plnia zákazky, obchodujú s bankou a občas ponúknu
výmenu aj tebe. Tvoje ponuky prijmú, ak im pomôžu. Keď nie je pripojený nikto
zo živých hráčov, boti čakajú.

Každý bot má vlastnú obtiažnosť (vyberá sa pri pridaní, dá sa zmeniť v lobby):
- 😊 **Ľahká** – stavia náhodne, s bankou mení až pri plnej ruke, prijme aj neutrálnu výmenu.
- 🙂 **Stredná** – rozumne plánuje, chráni sa pred búrkou, nepomáha lídrovi tesne pred výhrou.
- 😈 **Ťažká** – lepšie vyberá políčka a ciele, uprednostňuje mestá a hodnotné zákazky,
  nevynechá víťazný ťah, nestavia pod banditov a posiela ich na polia lídra.

Pri obnovení stránky alebo výpadku spojenia sa hráč automaticky vráti do svojej hry.
Ak je hráč na ťahu odpojený, ostatní môžu jeho ťah preskočiť.

### Nasadenie online (Render.com, zadarmo)

V repozitári je pripravený súbor `render.yaml`.

1. Zaregistruj sa na https://render.com (najjednoduchšie cez GitHub účet).
2. Klikni **New → Blueprint** a vyber repozitár `nnn`. Ak hra ešte nie je v hlavnej vetve,
   zvoľ vetvu, v ktorej je.
3. Potvrď **Apply**. Render nainštaluje závislosti a spustí server (trvá to pár minút).
4. Dostaneš adresu typu `https://suostrovie-xxxx.onrender.com`. Tú pošli kamarátom.

Bezplatný plán uspí server po 15 minútach bez návštev. Prvé otvorenie potom trvá
asi minútu, a rozohrané hry sa pri uspaní stratia (hry sú len v pamäti servera).
Každý ďalší push do zvolenej vetvy sa nasadí automaticky.

### Ukladanie hier

Rozohrané hry sa priebežne ukladajú (každé 2 sekundy a pri vypnutí servera), takže
prežijú reštart aj nové nasadenie. Hráči sa po reštarte automaticky pripoja späť.
Neaktívne hry sa mažú po 7 dňoch.

- **Lokálne** sa hry ukladajú do priečinka `data/` (dá sa zmeniť cez `DATA_DIR`).
- **Na Renderi** sa súbory pri reštarte mažú, preto treba databázu PostgreSQL:
  1. Založ si zadarmo databázu, napr. na https://neon.tech (New Project), a skopíruj
     *connection string* (`postgresql://…?sslmode=require`).
  2. V Renderi otvor službu `suostrovie` → **Environment** → **Add Environment Variable**:
     `DATABASE_URL` = skopírovaný reťazec → **Save Changes**.
  3. V logu po nasadení uvidíš `Úložisko: PostgreSQL, obnovených hier: …`.

  Tabuľka `suostrovie_rooms` sa vytvorí automaticky. Ak databáza nie je dostupná,
  server beží ďalej, len bez ukladania.

Iné možnosti: Railway, Fly.io, alebo lokálne spustenie + tunel
(`cloudflared tunnel --url http://localhost:3000`). V rovnakej Wi-Fi stačí
otvoriť `http://<IP-tvojho-počítača>:3000`.

## Pravidlá v skratke

- **Mapa:** 37 šesťuholníkov. Stred je odkrytý, vonkajší okruh je v hmle.
- **Príprava:** každý položí 2 tábory (poradie tam a späť) a dostane surovinu z každého z nich.
- **Ťah:** hoď **kockou produkcie** a **kockou udalostí**. Stavby na políčkach s padnutým číslom produkujú (tábor 1, mesto 2).
  Na kocke udalostí 1 sa ťahá karta udalosti, 6 znamená Trhový deň (výmena s bankou 2:1).
- **Banditi:** začínajú v horách (na baníckom poli). Keď je súčet oboch kociek 7, hráč na ťahu
  ich môže presunúť na ľubovoľnú odkrytú pevninu alebo nechať na mieste. Pole s banditmi nič neprodukuje.
- **Stavby** (jedna na políčko): Tábor 1 b., Mesto 2 b., Maják 1 b. (na pobreží, výmena 3:1, ochrana pred pirátmi).
- **Prístav** (2 drevo, ruda, obilie): na pobrežnej stavbe, 1 b., max. 2. Hráči s prístavom si
  môžu posielať **námorné ponuky kedykoľvek, aj mimo svojho ťahu**. Ponuka platí jedno celé kolo,
  každý hráč môže mať naraz jednu a prijať ju môže len hráč s prístavom.
- **Výprava:** odkryje zahalené políčko vedľa tvojej stavby. Najviac objavov (aspoň 3) = Veľký objaviteľ (+2 b.).
- **Zákazky:** odovzdaj suroviny za 1–2 body.
- **Obchod:** s bankou alebo ponukou ostatným hráčom.
- **Výhra:** prvý, kto počas svojho ťahu dosiahne cieľový počet bodov (štandardne 12).

## Štruktúra

- `src/game.js` – herný engine (pravidlá, autoritatívne na serveri)
- `src/bot.js` – AI hráči
- `src/storage.js` – ukladanie hier (PostgreSQL alebo súbory)
- `server.js` – HTTP + WebSocket server, správa párty a ťahy AI
- `public/` – klient (HTML, CSS, JS, mapa v SVG)
- `test/` – testy enginu
