'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const {
  cleanName, editDistance, findSimilar, evolutionCondition,
  evolutionPaths, typeEffectiveness, groupVersions,
  availableMoves, recommendMoves, pickMovePool, battleProfile
} = require('../pokedex/guide.js');

test('aceita acentos, espaços e variação de gênero na busca', () => {
  assert.equal(cleanName('Píká Chú'), 'pika-chu');
  assert.equal(cleanName('Nidoran♀'), 'nidoran-f');
});
test('encontra Pokémon com erro de digitação sem adivinhar quando longe', () => {
  const names = ['pikachu', 'charmander', 'bulbasaur', 'squirtle'];
  assert.equal(findSimilar('pikach', names)[0], 'pikachu');
  assert.equal(findSimilar('charmadner', names)[0], 'charmander');
  assert.deepEqual(findSimilar('zzzzzz', names), []);
  assert.deepEqual(findSimilar('999', names), []);
});
test('considera troca de letras próximas', () => {
  assert.equal(editDistance('pikahcu', 'pikachu'), 1);
});
test('descreve evolução por nível e por pedra', () => {
  assert.match(evolutionCondition({ trigger: { name: 'level-up' }, min_level: 16 }), /nível 16/);
  assert.match(evolutionCondition({ trigger: { name: 'use-item' }, item: { name: 'water-stone' } }), /Pedra da Água/);
});
test('mantém evolução ramificada, sem transformar ramos em sequência', () => {
  const chain = {
    species: { name: 'eevee', url: 'https://pokeapi.co/api/v2/pokemon-species/133/' },
    evolves_to: [
      {
        species: { name: 'vaporeon', url: 'https://pokeapi.co/api/v2/pokemon-species/134/' },
        evolution_details: [{ trigger: { name: 'use-item' }, item: { name: 'water-stone' } }],
        evolves_to: []
      },
      {
        species: { name: 'jolteon', url: 'https://pokeapi.co/api/v2/pokemon-species/135/' },
        evolution_details: [{ trigger: { name: 'use-item' }, item: { name: 'thunder-stone' } }],
        evolves_to: []
      }
    ]
  };
  const paths = evolutionPaths(chain);
  assert.deepEqual(paths.map(row => [row.name, row.from]), [
    ['eevee', null], ['vaporeon', 133], ['jolteon', 133]
  ]);
});
test('combina multiplicadores defensivos de dois tipos e imunidades', () => {
  const relations = [
    { name: 'grass', damage_relations: {
      double_damage_from: [{ name: 'fire' }],
      half_damage_from: [{ name: 'ground' }, { name: 'water' }],
      no_damage_from: []
    } },
    { name: 'poison', damage_relations: {
      double_damage_from: [{ name: 'ground' }],
      half_damage_from: [{ name: 'grass' }, { name: 'poison' }],
      no_damage_from: []
    } },
    { name: 'flying', damage_relations: {
      double_damage_from: [],
      half_damage_from: [],
      no_damage_from: [{ name: 'ground' }]
    } }
  ];
  const grassPoison = typeEffectiveness(['grass', 'poison'], relations);
  assert.equal(grassPoison.fire, 2);
  assert.equal(grassPoison.ground, 1);
  assert.equal(grassPoison.poison, 0.5);
  assert.equal(typeEffectiveness(['flying'], relations).ground, 0);
});
test('separa movimentos por grupo de versões e método disponível', () => {
  const pokemon = {
    moves: [{ move: { name: 'thunderbolt' }, version_group_details: [
      { version_group: { name: 'scarlet-violet', url: 'https://pokeapi.co/api/v2/version-group/25/' },
        move_learn_method: { name: 'machine' }, level_learned_at: 0 },
      { version_group: { name: 'red-blue', url: 'https://pokeapi.co/api/v2/version-group/1/' },
        move_learn_method: { name: 'machine' }, level_learned_at: 0 }
    ] }]
  };
  assert.equal(groupVersions(pokemon)[0].name, 'scarlet-violet');
  assert.deepEqual(availableMoves(pokemon, 'scarlet-violet').map(x => x.name), ['thunderbolt']);
});
test('dá preferência a danos do tipo do Pokémon e reserva apoio quando houver', () => {
  const p = {
    types: [{ type: { name: 'electric' } }],
    stats: [{ stat: { name: 'attack' }, base_stat: 45 },
      { stat: { name: 'special-attack' }, base_stat: 105 }]
  };
  const candidates = [
    { detail: { name: 'thunderbolt', power: 90, accuracy: 100, type: { name: 'electric' }, damage_class: { name: 'special' } } },
    { detail: { name: 'tackle', power: 40, accuracy: 100, type: { name: 'normal' }, damage_class: { name: 'physical' } } },
    { detail: { name: 'thunder-wave', power: null, accuracy: 90, type: { name: 'electric' }, damage_class: { name: 'status' } } }
  ];
  const result = recommendMoves(p, candidates);
  assert.equal(result[0].detail.name, 'thunderbolt');
  assert.ok(result.some(entry => entry.detail.name === 'thunder-wave'));
  assert.ok(pickMovePool([{ name: 'thunderbolt' }, { name: 'thunder-wave' }, { name: 'tackle', level: 30 }])
    .some(item => item.name === 'thunderbolt'));
});
test('perfil de batalha diferencia atacante e defensor', () => {
  const pokemon = stats => ({
    stats: Object.entries(stats).map(([name, base_stat]) => ({ stat: { name }, base_stat }))
  });
  assert.match(battleProfile(pokemon({
    attack: 100, 'special-attack': 50, speed: 110, hp: 70, defense: 50, 'special-defense': 50
  })).role, /físico rápido/);
  assert.match(battleProfile(pokemon({
    attack: 50, 'special-attack': 100, speed: 90, hp: 70, defense: 50, 'special-defense': 50
  })).role, /especial rápido/);
});
