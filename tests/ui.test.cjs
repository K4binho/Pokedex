'use strict';
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const assert = require('node:assert/strict');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
function mockLanguage(initial = null) {
  const memory = new Map(initial ? [['k4-pokedex-language-v1', initial]] : []);
  const staticLabel = { dataset: { i18n: 'tabs.evolution' }, textContent: '' };
  const placeholder = { dataset: { i18nPlaceholder: 'search.placeholder' }, placeholder: '' };
  const aria = {
    dataset: { i18nAria: 'tablist' }, setAttribute(name, value) { this[name] = value; }
  };
  const buttons = ['pt', 'en'].map(code => ({
    dataset: { language: code }, attributes: {}, classList: {
      toggle(name, on) { this[name] = on; }
    },
    addEventListener(type, callback) { this.callback = callback; },
    setAttribute(name, value) { this.attributes[name] = value; }
  }));
  const events = [];
  const document = {
    documentElement: { lang: '' },
    querySelectorAll(selector) {
      return {
        '[data-i18n]': [staticLabel],
        '[data-i18n-placeholder]': [placeholder],
        '[data-i18n-aria]': [aria],
        '[data-language]': buttons
      }[selector] || [];
    },
    dispatchEvent(event) { events.push(event); }
  };
  const window = { PokedexGuide: {
    TYPE_NAMES: { grass: 'Planta' },
    label: name => name
  } };
  const sandbox = {
    window, document, localStorage: {
      getItem: key => memory.get(key) || null,
      setItem: (key, value) => memory.set(key, value)
    },
    CustomEvent: class { constructor(type, options) {
      this.type = type; this.detail = options.detail;
    } }
  };
  const file = fs.readFileSync(path.join(root, 'pokedex/i18n.js'), 'utf8');
  vm.runInNewContext(file, sandbox);
  return { window, document, staticLabel, placeholder, aria, buttons, memory, events };
}
test('starts with Portuguese and switches the whole static interface to English', () => {
  const fixture = mockLanguage();
  assert.equal(fixture.document.documentElement.lang, 'pt-BR');
  assert.equal(fixture.staticLabel.textContent, 'Evolução');
  fixture.window.PokedexLocale.setLanguage('en');
  assert.equal(fixture.document.documentElement.lang, 'en');
  assert.equal(fixture.staticLabel.textContent, 'Evolution');
  assert.equal(fixture.placeholder.placeholder, 'Name or number. E.g.: pikachu');
  assert.equal(fixture.aria['aria-label'], 'Pokémon information menu');
  assert.equal(fixture.buttons[1].attributes['aria-pressed'], 'true');
  assert.equal(fixture.memory.get('k4-pokedex-language-v1'), 'en');
  assert.equal(fixture.events[0].type, 'pokedex:language-change');
});
test('keeps English across reloads and translates dynamically generated data', () => {
  const { window, document } = mockLanguage('en');
  assert.equal(document.documentElement.lang, 'en');
  assert.equal(window.PokedexLocale.type('grass'), 'Grass');
  assert.equal(window.PokedexLocale.stat('attack'), 'Attack');
  assert.equal(window.PokedexLocale.t('guide.evo.minLevel', { level: 16 }), 'level 16+');
  window.PokedexLocale.setLanguage('pt');
  assert.equal(window.PokedexLocale.type('grass'), 'Planta');
  assert.equal(window.PokedexLocale.item('water-stone'), 'Pedra da Água');
});

function mockTabs() {
  const events = [];
  const memory = new Map();
  const tabs = ['summary', 'evolution', 'battle', 'moves', 'abilities', 'favorites']
    .map(tab => ({
      dataset: { tab }, attributes: { 'aria-controls': 'panel-' + tab },
      tabIndex: -1,
      addEventListener(name, fn) { this[name] = fn; },
      setAttribute(name, value) { this.attributes[name] = value; },
      getAttribute(name) { return this.attributes[name]; },
      focus() { this.focused = true; }
    }));
  const panels = new Map(tabs.map(tab => ['panel-' + tab.dataset.tab, { hidden: false }]));
  const sandbox = {
    window: {},
    sessionStorage: {
      getItem: key => memory.get(key) || null,
      setItem: (key, value) => memory.set(key, value)
    },
    CustomEvent: class { constructor(type, opts) { this.type = type; this.detail = opts.detail; } },
    document: {
      querySelectorAll: () => tabs,
      getElementById: id => panels.get(id),
      querySelector: () => ({ scrollTo: () => {} }),
      dispatchEvent: event => events.push(event)
    }
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'pokedex/tabs.js'), 'utf8'), sandbox);
  return { sandbox, tabs, panels, memory, events };
}
test('six accessible tabs show only one panel and save the current choice', () => {
  const { sandbox, tabs, panels, memory, events } = mockTabs();
  sandbox.window.PokedexTabs.open('evolution');
  assert.equal(tabs[1].attributes['aria-selected'], 'true');
  assert.equal(tabs[0].attributes['aria-selected'], 'false');
  assert.equal(panels.get('panel-evolution').hidden, false);
  assert.equal(panels.get('panel-summary').hidden, true);
  assert.equal(memory.get('k4-pokedex-active-tab-v1'), 'evolution');
  assert.equal(events.at(-1).detail.tab, 'evolution');
});
test('keyboard navigation changes panels and focuses the corresponding button', () => {
  const { tabs, panels } = mockTabs();
  let prevented = false;
  tabs[0].keydown({ key: 'ArrowRight', preventDefault() { prevented = true; } });
  assert.ok(prevented);
  assert.equal(tabs[1].focused, true);
  assert.equal(panels.get('panel-evolution').hidden, false);
});
