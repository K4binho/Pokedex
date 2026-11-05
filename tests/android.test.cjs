'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = name => fs.readFileSync(path.resolve(__dirname, '../pokedex', name), 'utf8');

test('Android layout is loaded after legacy layout fixes and uses safe viewports', () => {
  const html = source('index.html');
  const css = source('android.css');
  assert.match(html, /viewport-fit=cover/);
  assert.ok(html.indexOf('android.css?v=1') > html.indexOf('layout-fixes.css?v=1'));
  assert.match(html, /id="details-screen"/);
  assert.match(html, /href="#details-screen"/);
  assert.match(html, /href="#search-form"/);
  assert.match(css, /max-width:\s*820px/);
  assert.match(css, /env\(safe-area-inset-bottom/);
  assert.match(css, /min-height:\s*var\(--tap-height\)/);
  assert.match(css, /font-size:\s*16px/);
  assert.match(css, /overflow:\s*visible !important/);
});

test('manifest includes valid Android install icon sizes and files', () => {
  const manifest = JSON.parse(source('manifest.webmanifest'));
  assert.equal(manifest.name, 'K4 Pokédex');
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.prefer_related_applications, false);
  for (const width of [192, 512]) {
    const expected = width + 'x' + width;
    const icon = manifest.icons.find(entry => entry.sizes === expected);
    assert.ok(icon, 'Missing icon ' + expected);
    assert.equal(icon.type, 'image/png');
    const image = fs.readFileSync(path.resolve(__dirname, '../pokedex', icon.src));
    assert.deepEqual([...image.subarray(0,8)], [137,80,78,71,13,10,26,10]);
    assert.equal(image.readUInt32BE(16), width);
    assert.equal(image.readUInt32BE(20), width);
  }
  assert.ok(manifest.icons.some(entry => entry.type === 'image/svg+xml'));
});

test('service worker only caches same-origin UI, preserving network API data', () => {
  const script = source('sw.js');
  assert.match(script, /caches\.open\(CACHE_NAME\)/);
  assert.match(script, /url\.origin !== self\.location\.origin/);
  assert.match(script, /icons\/icon-512\.png/);
  assert.match(script, /android\.css\?v=1/);
});

test('horizontal swipe changes Pokémon, vertical scrolling does not', () => {
  const spriteHandlers = {};
  const counts = { prev: 0, next: 0 };
  const previous = { disabled: false, click() { counts.prev++; } };
  const next = { disabled: false, click() { counts.next++; } };
  const elements = {
    screen: { addEventListener(name, fn) { spriteHandlers[name] = fn; } },
    previous, next, 'install-app': {
      hidden: true, addEventListener() {}
    }
  };
  const window = {
    addEventListener() {},
    matchMedia() { return { matches: false }; },
    isSecureContext: false
  };
  const ctx = { window, navigator: {},
    document: { getElementById(id) { return elements[id]; } } };
  vm.runInNewContext(source('android.js'), ctx);
  spriteHandlers.touchstart({ touches: [{ clientX: 205, clientY: 110 }] });
  spriteHandlers.touchend({ changedTouches: [{ clientX: 120, clientY: 120 }] });
  assert.equal(counts.next, 1);
  spriteHandlers.touchstart({ touches: [{ clientX: 105, clientY: 100 }] });
  spriteHandlers.touchend({ changedTouches: [{ clientX: 190, clientY: 99 }] });
  assert.equal(counts.prev, 1);
  spriteHandlers.touchstart({ touches: [{ clientX: 120, clientY: 100 }] });
  spriteHandlers.touchend({ changedTouches: [{ clientX: 128, clientY: 230 }] });
  assert.equal(counts.next, 1);
  next.disabled = true;
  spriteHandlers.touchstart({ touches: [{ clientX: 205, clientY: 110 }] });
  spriteHandlers.touchend({ changedTouches: [{ clientX: 110, clientY: 112 }] });
  assert.equal(counts.next, 1);
});
