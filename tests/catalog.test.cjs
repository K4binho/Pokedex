'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const catalog = require('../pokedex/catalog.js');
const names = require('../pokedex/ability-names.js');

test('game choices are grouped into nine game generations, not species-ID ranges', () => {
  const games = catalog.GAMES;
  assert.ok(games.length >= 20);
  assert.deepEqual([...new Set(games.map(g => g.generation))], [1,2,3,4,5,6,7,8,9]);
  assert.equal(catalog.getGame('gold-silver').title, 'Gold / Silver');
  assert.equal(catalog.getGame('scarlet-violet').generation, 9);
  assert.equal(catalog.getGame('nonexistent'), null);
});

test('regional Pokédexes include earlier Pokémon and keep in-game order', () => {
  const dexes = [{
    name: 'original-johto',
    pokemon_entries: [
      { entry_number: 3, pokemon_species: { name: 'pikachu', url: 'https://pokeapi.co/api/v2/pokemon-species/25/' } },
      { entry_number: 1, pokemon_species: { name: 'chikorita', url: 'https://pokeapi.co/api/v2/pokemon-species/152/' } },
      { entry_number: 2, pokemon_species: { name: 'bulbasaur', url: 'https://pokeapi.co/api/v2/pokemon-species/1/' } }
    ]
  }, {
    name: 'additional',
    pokemon_entries: [
      { entry_number: 1, pokemon_species: { name: 'chikorita', url: 'https://pokeapi.co/api/v2/pokemon-species/152/' } },
      { entry_number: 2, pokemon_species: { name: 'celebi', url: 'https://pokeapi.co/api/v2/pokemon-species/251/' } }
    ]
  }];
  const members = catalog.parseGameDexes(dexes);
  assert.deepEqual(members.map(p => p.id), [152, 1, 25, 251]);
  assert.equal(catalog.adjacent(members, 152, 1), 1);
  assert.equal(catalog.adjacent(members, 1, -1), 152);
  assert.equal(catalog.adjacent(members, 251, 1), null);
  assert.equal(catalog.adjacent(members, 999, -1), null);
});

test('fuzzy search respects Pokédex membership, not the generation in which a Pokémon debuted', () => {
  const members = [
    { id: 25, name: 'pikachu' },
    { id: 152, name: 'chikorita' },
    { id: 251, name: 'celebi' }
  ];
  assert.equal(catalog.rankMatches('pikach', members)[0].id, 25);
  assert.equal(catalog.rankMatches('pikahcu', members)[0].id, 25);
  assert.equal(catalog.rankMatches('chiko', members)[0].id, 152);
  assert.equal(catalog.rankMatches('chikortia', members)[0].id, 152);
  assert.equal(catalog.rankMatches('#25', members)[0].id, 25);
  assert.equal(catalog.rankMatches('#4', members).length, 0);
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
