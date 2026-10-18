'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const catalog = require('../pokedex/catalog.js');
const names = require('../pokedex/ability-names.js');

test('generation ranges cover 1 to 1025 exactly once', () => {
  assert.equal(catalog.GENERATIONS.length, 9);
  assert.equal(catalog.rangeFor(0).first, 1);
  assert.equal(catalog.rangeFor(0).last, 1025);
  assert.equal(catalog.GENERATIONS[0].last, 151);
  assert.equal(catalog.GENERATIONS[8].first, 906);
  for (let id = 1; id <= 1025; id++) {
    assert.equal(catalog.GENERATIONS.filter(x => id >= x.first && id <= x.last).length, 1);
  }
  assert.equal(catalog.inGeneration(152, 1), false);
  assert.equal(catalog.inGeneration(152, 2), true);
  assert.equal(catalog.inGeneration(1026, 0), false);
});
test('smart names match prefixes, misspellings and transposed letters', () => {
  const index = catalog.parseEntries([
    { name: 'pikachu', url: 'https://pokeapi.co/api/v2/pokemon/25/' },
    { name: 'pidgey', url: 'https://pokeapi.co/api/v2/pokemon/16/' },
    { name: 'charmander', url: 'https://pokeapi.co/api/v2/pokemon/4/' },
    { name: 'chikorita', url: 'https://pokeapi.co/api/v2/pokemon/152/' },
    { name: 'celebi', url: 'https://pokeapi.co/api/v2/pokemon/251/' }
  ]);
  assert.equal(catalog.rankMatches('pikach', index)[0].name, 'pikachu');
  assert.equal(catalog.rankMatches('pikahcu', index)[0].name, 'pikachu');
  assert.equal(catalog.rankMatches('charmadner', index)[0].name, 'charmander');
  assert.equal(catalog.rankMatches('Chiko', index, 2)[0].name, 'chikorita');
  assert.equal(catalog.rankMatches('pik', index, 2).length, 0);
  assert.equal(catalog.rankMatches('#25', index, 1)[0].name, 'pikachu');
  assert.equal(catalog.rankMatches('#25', index, 2).length, 0);
  assert.equal(catalog.normalize('Nidoran♀'), 'nidoran-f');
});
test('Brazilian Portuguese names cover familiar abilities and preserve original identifiers', () => {
  assert.ok(Object.keys(names).length >= 250);
  assert.equal(names.intimidate, 'Intimidação');
  assert.equal(names['speed-boost'], 'Impulso de Velocidade');
  assert.equal(names.overgrow, 'Supercrescimento');
  assert.equal(names.levitate, 'Levitação');
  assert.equal(names['huge-power'], 'Poder Imenso');
});
test('locale changes localized ability names without changing Pokémon ability IDs', () => {
  const window = {
    PokedexAbilitiesPT: names,
    PokedexGuide: {
      TYPE_NAMES: { grass: 'Planta' },
      label: name => name.replace(/-/g, ' ').replace(/\b\w/g, x => x.toUpperCase())
    }
  };
  const context = {
    window,
    document: {
      documentElement: { lang: '' },
      querySelectorAll: () => [],
      dispatchEvent: () => {}
    },
    localStorage: { getItem: () => null, setItem: () => {} },
    CustomEvent: class {},
  };
  vm.runInNewContext(
    fs.readFileSync(path.resolve(__dirname, '../pokedex/i18n.js'), 'utf8'),
    context
  );
  const { PokedexLocale: t } = window;
  assert.equal(t.ability('intimidate'), 'Intimidação');
  assert.equal(t.ability('levitate'), 'Levitação');
  assert.equal(t.ability('unknown-ability'), 'Unknown Ability');
  t.setLanguage('en');
  assert.equal(t.ability('intimidate'), 'Intimidate');
});
