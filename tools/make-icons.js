'use strict';
// Vygeneruje ikony aplikácie (PWA aj Android) z textúr a spritov hry.
// Spustenie: node tools/make-icons.js   (potrebuje Playwright s Chromiom)
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const OUT = [
  // [súbor, veľkosť, bezpečný okraj pre "maskable" (0–1), pozadie celé?]
  ['public/icons/icon-192.png', 192, 0.06],
  ['public/icons/icon-512.png', 512, 0.06],
  ['public/icons/maskable-512.png', 512, 0.2],
  ['public/icons/apple-touch-icon.png', 180, 0.06],
  ['public/icons/favicon-64.png', 64, 0.02],
  ['android-app/assets/icon-only.png', 1024, 0.2],
  ['android-app/assets/icon-foreground.png', 1024, 0.26, 'transparent'],
  ['android-app/assets/icon-background.png', 1024, 0, 'background'],
  ['android-app/assets/splash.png', 2732, 0.38, 'splash'],
  ['android-app/assets/splash-dark.png', 2732, 0.38, 'splash'],
];

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto('file://' + path.join(ROOT, 'public/index.html'));
  for (const [file, size, pad, mode] of OUT) {
    await p.setViewportSize({ width: size, height: size });
    await p.evaluate(([size, pad, mode]) => {
      const R = HEX_R, W = Math.sqrt(3) * R;
      const cells = [[0, 0, 'pole'], [1, 0, 'les'], [0, 1, 'bana'], [-1, 1, 'solnisko'], [-1, 0, 'lom'], [0, -1, 'les'], [1, -1, 'more']];
      // obsah ostrova má rozmer ~ 3·W; zmenšíme ho podľa bezpečného okraja
      const span = 3 * W + 24;
      const half = span / 2 / (1 - pad * 2);
      let shore = '', tiles = '';
      for (const [q, r, t] of cells) {
        const x = W * (q + r / 2), y = 1.5 * R * r;
        if (t !== 'more') shore += `<polygon points="${hexPts(x, y + 5, R + 9)}" fill="url(#tx-piesok)" stroke="#bfa063" stroke-opacity=".6"/>`;
        tiles += `<polygon points="${hexPts(x, y + 7)}" fill="url(#g-earth)"/><use href="#t-${t}" transform="translate(${x},${y})"/>
          <polygon points="${hexPts(x, y)}" fill="none" stroke="#0b1520" stroke-opacity=".5" stroke-width="1.6"/>`;
      }
      const bg = mode === 'transparent' ? '' : mode === 'splash'
        ? `<rect x="${-half}" y="${-half}" width="${half * 2}" height="${half * 2}" fill="#0c2440"/>
           <text x="0" y="${span / 2 + 34}" text-anchor="middle" font-family="Georgia, serif" font-weight="700" font-size="30" fill="#f2c14e" letter-spacing="2">SÚOSTROVIE</text>` : `<rect x="${-half}" y="${-half}" width="${half * 2}" height="${half * 2}" fill="url(#tx-ocean)"/>
        <rect x="${-half}" y="${-half}" width="${half * 2}" height="${half * 2}" fill="url(#tx-caustic)" opacity=".3"/>
        <rect x="${-half}" y="${-half}" width="${half * 2}" height="${half * 2}" fill="url(#g-sun)"/>
        <rect x="${-half}" y="${-half}" width="${half * 2}" height="${half * 2}" fill="url(#g-vignette)"/>`;
      const island = mode === 'background' ? '' : `${shore}<g filter="url(#f-shadow)">${tiles}</g>
        ${townSvg(0, 26, '#e4572e')}${lighthouseSvg(W + 6, -6, '#2e86de')}${campSvg(-W + 8, 26, '#3bb273')}`;
      document.body.innerHTML = `<svg id="icon" xmlns="http://www.w3.org/2000/svg" viewBox="${-half} ${-half} ${half * 2} ${half * 2}"
        style="position:fixed;left:0;top:0;width:${size}px;height:${size}px;background:${mode === 'transparent' ? 'transparent' : mode === 'splash' ? '#0c2440' : '#0c3157'}">
        ${TILE_DEFS}${bg}${island}</svg>`;
      document.body.style.background = 'transparent';
      document.documentElement.style.background = 'transparent';
    }, [size, pad, mode]);
    await p.waitForTimeout(150);
    await p.locator('#icon').screenshot({ path: path.join(ROOT, file), omitBackground: mode === 'transparent' });
    console.log('✔', file);
  }
  await b.close();
})();
