'use strict';

/* Helpers sem dependências: também usados nos testes com Node. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PokedexGuide = api;
})(typeof window !== 'undefined' ? window : null, function () {
  const TYPE_NAMES = {
    normal: 'Normal', fire: 'Fogo', water: 'Água', electric: 'Elétrico',
    grass: 'Planta', ice: 'Gelo', fighting: 'Lutador', poison: 'Venenoso',
    ground: 'Terra', flying: 'Voador', psychic: 'Psíquico', bug: 'Inseto',
    rock: 'Pedra', ghost: 'Fantasma', dragon: 'Dragão', dark: 'Sombrio',
    steel: 'Aço', fairy: 'Fada'
  };
  const TYPE_LIST = Object.keys(TYPE_NAMES);
  const ABILITY_SCORES = {
    'huge-power': 6, 'pure-power': 6, 'wonder-guard': 6, 'magic-guard': 6,
    regenerator: 6, unaware: 6, 'speed-boost': 6,
    intimidate: 5, levitate: 5, multiscale: 5, prankster: 5,
    adaptability: 5, technician: 5, guts: 5, moxie: 5,
    'sheer-force': 5, drizzle: 5, drought: 5, 'poison-heal': 5,
    sturdy: 4, protean: 4, libero: 4, 'water-absorb': 4,
    'flash-fire': 4, 'volt-absorb': 4, 'sap-sipper': 4,
    chlorophyll: 4, 'swift-swim': 4, 'serene-grace': 4,
    'thick-fat': 4, 'natural-cure': 4, defiant: 4, competitive: 4,
    overgrow: 2, blaze: 2, torrent: 2, swarm: 2
  };
  const MOVES_PRIORITY = new Set([
    'earthquake', 'thunderbolt', 'ice-beam', 'flamethrower', 'surf',
    'shadow-ball', 'psychic', 'energy-ball', 'sludge-bomb', 'rock-slide',
    'close-combat', 'dragon-pulse', 'u-turn', 'volt-switch', 'moonblast',
    'dark-pulse', 'flash-cannon', 'hydro-pump', 'fire-blast', 'brave-bird',
    'flare-blitz', 'leaf-storm', 'draco-meteor', 'play-rough', 'body-press',
    'aura-sphere', 'focus-blast', 'stone-edge', 'bullet-punch', 'extreme-speed',
    'earth-power', 'waterfall', 'power-whip', 'shadow-claw', 'seed-bomb',
    'iron-head', 'air-slash', 'dragon-claw', 'liquidation', 'bug-buzz',
    'sludge-wave', 'heat-wave', 'mach-punch', 'aqua-jet', 'quick-attack',
    'leaf-blade', 'psychic-fangs', 'discharge'
  ]);
  const MOVES_SUPPORT = new Set([
    'swords-dance', 'nasty-plot', 'calm-mind', 'dragon-dance', 'quiver-dance',
    'stealth-rock', 'spikes', 'toxic-spikes', 'rapid-spin', 'defog',
    'will-o-wisp', 'thunder-wave', 'recover', 'roost', 'soft-boiled',
    'leech-seed', 'protect', 'substitute', 'taunt', 'wish', 'reflect',
    'light-screen', 'trick-room', 'encore', 'strength-sap', 'shell-smash'
  ]);
  const ITEMS_PT = {
    'fire-stone': 'Pedra do Fogo', 'water-stone': 'Pedra da Água',
    'thunder-stone': 'Pedra do Trovão', 'leaf-stone': 'Pedra da Folha',
    'moon-stone': 'Pedra da Lua', 'sun-stone': 'Pedra do Sol',
    'dusk-stone': 'Pedra do Crepúsculo', 'dawn-stone': 'Pedra da Alvorada',
    'shiny-stone': 'Pedra Brilhante', 'ice-stone': 'Pedra do Gelo',
    'kings-rock': 'Pedra do Rei', 'metal-coat': 'Revestimento Metálico',
    'dragon-scale': 'Escama de Dragão', upgrade: 'Upgrade',
    'dubious-disc': 'Disco Duvidoso'
  };
  function cleanName(value) {
    return String(value || '').trim().toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/♀/g, '-f').replace(/♂/g, '-m')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }
  function label(value) {
    return String(value || '').replace(/-/g, ' ')
      .replace(/\b[a-z]/g, char => char.toUpperCase());
  }
  // Distância com transposições adjacentes; não corrige nomes automaticamente.
  function editDistance(a, b) {
    const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
    for (let i = 0; i <= a.length; i++) dp[i][0] = i;
    for (let j = 0; j <= b.length; j++) dp[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1, dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
        );
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
          dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + 1);
        }
      }
    }
    return dp[a.length][b.length];
  }
  function findSimilar(value, names, limit = 5) {
    const query = cleanName(value);
    if (query.length < 2 || /^\d+$/.test(query)) return [];
    const tolerance = query.length <= 4 ? 1 : query.length <= 8 ? 2 : 3;
    return [...new Set(names.map(cleanName))].filter(Boolean).map(name => {
      const distance = editDistance(query, name);
      const starts = name.startsWith(query);
      return { name, distance, starts, rank: distance - (starts ? 1 : 0) };
    }).filter(row => row.distance <= tolerance || (row.starts && query.length >= 3))
      .sort((a, b) => a.rank - b.rank || a.name.length - b.name.length || a.name.localeCompare(b.name))
      .slice(0, limit).map(row => row.name);
  }
  function resourceId(url) {
    const result = String(url || '').match(/\/(\d+)\/?$/);
    return result ? Number(result[1]) : 0;
  }
  function evolutionCondition(detail) {
    if (!detail) return 'Método não informado';
    const trigger = detail.trigger?.name;
    const pieces = [];
    if (trigger === 'trade') pieces.push('Troca');
    else if (trigger === 'use-item') pieces.push('Usar item');
    else if (trigger === 'level-up') pieces.push('Subir de nível');
    else if (trigger) pieces.push(label(trigger));
    if (detail.min_level != null) pieces.push('nível ' + detail.min_level + '+');
    if (detail.item) pieces.push(ITEMS_PT[detail.item.name] || label(detail.item.name));
    if (detail.held_item) pieces.push('segurando ' + (ITEMS_PT[detail.held_item.name] || label(detail.held_item.name)));
    if (detail.min_happiness != null) pieces.push('amizade ' + detail.min_happiness + '+');
    if (detail.min_affection != null) pieces.push('afeição ' + detail.min_affection + '+');
    if (detail.min_beauty != null) pieces.push('beleza ' + detail.min_beauty + '+');
    if (detail.time_of_day) pieces.push(detail.time_of_day === 'day' ? 'de dia' : detail.time_of_day === 'night' ? 'à noite' : label(detail.time_of_day));
    if (detail.known_move) pieces.push('conhecendo ' + label(detail.known_move.name));
    if (detail.known_move_type) pieces.push('golpe do tipo ' + label(detail.known_move_type.name));
    if (detail.location) pieces.push('local: ' + label(detail.location.name));
    if (detail.party_species) pieces.push('equipe com ' + label(detail.party_species.name));
    if (detail.party_type) pieces.push('equipe com tipo ' + label(detail.party_type.name));
    if (detail.trade_species) pieces.push('trocando por ' + label(detail.trade_species.name));
    if (detail.needs_overworld_rain) pieces.push('chuva no ambiente');
    if (detail.turn_upside_down) pieces.push('console invertido');
    if (detail.gender === 1) pieces.push('fêmea');
    if (detail.gender === 2) pieces.push('macho');
    if (detail.relative_physical_stats === 1) pieces.push('Ataque maior que Defesa');
    if (detail.relative_physical_stats === -1) pieces.push('Defesa maior que Ataque');
    if (detail.relative_physical_stats === 0) pieces.push('Ataque igual à Defesa');
    return pieces.join(' · ') || 'Condição especial (varia por jogo)';
  }
  function evolutionPaths(chain) {
    const list = [];
    function traverse(node, previous) {
      const conditions = (node.evolution_details || []).map(evolutionCondition);
      const id = resourceId(node.species?.url);
      list.push({
        id, name: node.species?.name || '', from: previous,
        conditions: [...new Set(conditions)].slice(0, 3),
        details: node.evolution_details || []
      });
      for (const next of node.evolves_to || []) traverse(next, id);
    }
    if (chain) traverse(chain, null);
    return list;
  }
  function typeEffectiveness(defendingTypes, relations) {
    const result = Object.fromEntries(TYPE_LIST.map(type => [type, 1]));
    for (const name of defendingTypes) {
      const relation = relations.find(item => item.name === name)?.damage_relations;
      if (!relation) continue;
      for (const item of relation.double_damage_from || []) if (result[item.name] != null) result[item.name] *= 2;
      for (const item of relation.half_damage_from || []) if (result[item.name] != null) result[item.name] *= 0.5;
      for (const item of relation.no_damage_from || []) if (result[item.name] != null) result[item.name] = 0;
    }
    return result;
  }
  function groupVersions(pokemon) {
    const versions = new Map();
    for (const move of pokemon.moves || []) {
      for (const entry of move.version_group_details || []) {
        const id = resourceId(entry.version_group?.url);
        if (id) versions.set(entry.version_group.name, id);
      }
    }
    return [...versions].map(([name, id]) => ({ name, id }))
      .sort((a, b) => b.id - a.id);
  }
  function availableMoves(pokemon, version) {
    const results = [];
    for (const item of pokemon.moves || []) {
      const methods = (item.version_group_details || [])
        .filter(v => v.version_group?.name === version &&
          ['level-up', 'machine', 'tutor', 'egg'].includes(v.move_learn_method?.name));
      if (!methods.length) continue;
      const method = methods.find(v => v.move_learn_method.name === 'level-up') || methods[0];
      results.push({
        name: item.move.name,
        method: method.move_learn_method.name,
        level: method.level_learned_at || 0
      });
    }
    return results;
  }
  function pickMovePool(moves, limit = 12) {
    const preferredAttacks = moves.filter(move => MOVES_PRIORITY.has(move.name));
    const preferredSupport = moves.filter(move => MOVES_SUPPORT.has(move.name));
    const fallback = moves.filter(move =>
      !MOVES_PRIORITY.has(move.name) && !MOVES_SUPPORT.has(move.name))
      .sort((a, b) => b.level - a.level);
    const prioritized = [...preferredAttacks.slice(0, 6), ...preferredSupport.slice(0, 3)];
    return [...prioritized, ...fallback.slice(0, Math.max(0, limit - prioritized.length))]
      .slice(0, limit);
  }
  function recommendMoves(pokemon, candidates) {
    const stats = Object.fromEntries((pokemon.stats || []).map(stat => [stat.stat.name, stat.base_stat]));
    const types = (pokemon.types || []).map(entry => entry.type.name);
    const physical = stats.attack >= stats['special-attack'];
    const scores = candidates.map(({ detail, method, level }) => {
      const category = detail.damage_class?.name;
      const support = category === 'status';
      const sameType = types.includes(detail.type?.name);
      const categoryMatch = (physical && category === 'physical') || (!physical && category === 'special');
      const accuracy = detail.accuracy == null ? 1 : detail.accuracy / 100;
      const power = Number(detail.power || 0);
      const score = support
        ? (MOVES_SUPPORT.has(detail.name) ? 115 : 20)
        : power * accuracy * (sameType ? 1.5 : 1) * (categoryMatch ? 1.1 : 0.75)
          + (MOVES_PRIORITY.has(detail.name) ? 12 : 0);
      return { detail, method, level, score, support };
    }).sort((a, b) => b.score - a.score);
    const offensive = scores.filter(move => !move.support);
    const chosen = offensive.slice(0, 3);
    const utility = scores.find(move => move.support);
    if (utility) chosen.push(utility);
    else chosen.push(...offensive.slice(3, 4));
    if (chosen.length < 4) {
      for (const extra of scores) if (!chosen.includes(extra)) chosen.push(extra);
      return chosen.slice(0, 4);
    }
    return chosen;
  }
  function battleProfile(pokemon) {
    const stats = Object.fromEntries((pokemon.stats || []).map(entry => [entry.stat.name, entry.base_stat]));
    const attack = stats.attack || 0;
    const spAttack = stats['special-attack'] || 0;
    const speed = stats.speed || 0;
    const bulk = (stats.hp || 0) + (stats.defense || 0) + (stats['special-defense'] || 0);
    if (bulk > 310 && speed < 75) return { role: 'Resistente / suporte', nature: 'Calma, Cauta ou Ousada', focus: 'HP + Defesa/Defesa Especial' };
    if (attack >= spAttack) return {
      role: speed >= 90 ? 'Atacante físico rápido' : 'Atacante físico',
      nature: speed >= 90 ? 'Alegre (Jolly) ou Firme (Adamant)' : 'Firme (Adamant) ou Alegre (Jolly)',
      focus: 'Ataque + Velocidade'
    };
    return {
      role: speed >= 90 ? 'Atacante especial rápido' : 'Atacante especial',
      nature: speed >= 90 ? 'Medrosa (Timid) ou Modesta (Modest)' : 'Modesta (Modest) ou Medrosa (Timid)',
      focus: 'Ataque Especial + Velocidade'
    };
  }
  function abilityScore(name) { return ABILITY_SCORES[name] || 0; }
  return {
    TYPE_NAMES, cleanName, label, editDistance, findSimilar, resourceId,
    evolutionCondition, evolutionPaths, typeEffectiveness, groupVersions,
    availableMoves, pickMovePool, recommendMoves, battleProfile, abilityScore
  };
});
