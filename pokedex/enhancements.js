'use strict';

/* All game data is loaded in the second Pokédex screen on demand.
 * No battle guide is rendered under the device.
 */
(() => {
  const guide = window.PokedexGuide;
  const locale = window.PokedexLocale;
  const tr = (key, data) => locale.t(key, data);
  const $ = selector => document.querySelector(selector);
  const nodes = {
    intro: $('#intro-overlay'),
    suggestions: $('#suggestions'),
    suggestionsList: $('#suggestion-list'),
    profile: $('#guide-profile'),
    matchups: $('#guide-matchups'),
    evolutions: $('#guide-evolutions'),
    abilities: $('#guide-abilities'),
    moves: $('#guide-moves'),
    version: $('#game-version'),
    encounters: $('#guide-encounters'),
    encounterVersion: $('#encounter-version'),
    status: $('#status')
  };
  const API = 'https://pokeapi.co/api/v2/';
  const cached = new Map();
  let pokemon = null;
  let controller = null;
  let moveController = null;
  let suggestionController = null;
  let encounterRows = [];
  let allPokemonNames = null;
  let tabLoaded = new Set();

  if (nodes.intro) {
    const delay = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 3400;
    window.setTimeout(() => nodes.intro?.remove(), delay);
  }

  const el = (tag, className = '', content) => {
    const item = document.createElement(tag);
    if (className) item.className = className;
    if (content !== undefined) item.textContent = content;
    return item;
  };
  const label = value => guide.label(value || '');
  function line(container, heading, value) {
    const row = el('p');
    row.append(el('strong', '', heading + ' '), document.createTextNode(value));
    container.append(row);
  }
  function message(container, value) {
    container.replaceChildren(el('p', 'guide-small', value));
  }
  function loading(key, node) { message(node, tr(key)); }
  function pill(parent, name, factor, modifier = '') {
    parent.append(el('span', 'guide-pill ' + modifier, locale.type(name) + ' ×' + factor));
  }
  async function getJSON(path, signal) {
    if (cached.has(path)) return cached.get(path);
    const response = await fetch(API + path, { signal });
    if (!response.ok) throw new Error('API ' + response.status);
    const json = await response.json();
    cached.set(path, json);
    return json;
  }
  function chosenPokemon(value) {
    $('#pokemon-search').value = value;
    $('#search-form').requestSubmit();
  }
  function hideSuggestions() {
    suggestionController?.abort();
    nodes.suggestions.hidden = true;
    nodes.suggestionsList.replaceChildren();
  }
  async function suggestPokemon(search) {
    hideSuggestions();
    const request = new AbortController();
    suggestionController = request;
    try {
      if (!allPokemonNames) {
        const index = await getJSON('pokemon?limit=2000', request.signal);
        if (request.signal.aborted) return;
        allPokemonNames = index.results.map(p => p.name);
      }
      const names = guide.findSimilar(search, allPokemonNames);
      if (request.signal.aborted) return;
      if (!names.length) {
        nodes.status.textContent = tr('status.noSuggest');
        return;
      }
      nodes.suggestionsList.replaceChildren();
      for (const name of names) {
        const button = el('button', 'suggestion-button', label(name));
        button.type = 'button';
        button.addEventListener('click', () => chosenPokemon(name));
        nodes.suggestionsList.append(button);
      }
      nodes.suggestions.hidden = false;
      nodes.status.textContent = tr('status.suggest');
    } catch {
      if (!request.signal.aborted) nodes.status.textContent = tr('status.suggestError');
    }
  }

  // Interpretation of the PokeAPI evolution chain. Text is specific
  // to the selected language; location remains the source's actual location.
  function condition(detail) {
    const parts = [];
    const trigger = detail.trigger?.name;
    const trKey = { 'level-up': 'guide.evo.level', trade: 'guide.evo.trade', 'use-item': 'guide.evo.item' }[trigger];
    if (trigger) parts.push(trKey ? tr(trKey) : label(trigger));
    if (detail.min_level != null) parts.push(tr('guide.evo.minLevel', { level: detail.min_level }));
    if (detail.item) parts.push(locale.item(detail.item.name));
    if (detail.held_item) parts.push(tr('guide.evo.hold', { item: locale.item(detail.held_item.name) }));
    if (detail.min_happiness != null) parts.push(tr('guide.evo.happiness', { value: detail.min_happiness }));
    if (detail.min_affection != null) parts.push(tr('guide.evo.affection', { value: detail.min_affection }));
    if (detail.min_beauty != null) parts.push(tr('guide.evo.beauty', { value: detail.min_beauty }));
    if (detail.time_of_day) parts.push(tr('guide.evo.time.' + detail.time_of_day));
    if (detail.known_move) parts.push(tr('guide.evo.move', { name: label(detail.known_move.name) }));
    if (detail.known_move_type) parts.push(tr('guide.evo.moveType', { name: locale.type(detail.known_move_type.name) }));
    if (detail.party_species) parts.push(tr('guide.evo.partySpecies', { name: label(detail.party_species.name) }));
    if (detail.party_type) parts.push(tr('guide.evo.partyType', { name: locale.type(detail.party_type.name) }));
    if (detail.trade_species) parts.push(tr('guide.evo.tradeSpecies', { name: label(detail.trade_species.name) }));
    if (detail.needs_overworld_rain) parts.push(tr('guide.evo.rain'));
    if (detail.turn_upside_down) parts.push(tr('guide.evo.upsideDown'));
    if (detail.gender === 1) parts.push(tr('guide.evo.female'));
    if (detail.gender === 2) parts.push(tr('guide.evo.male'));
    if (detail.relative_physical_stats === 1) parts.push(tr('guide.evo.attackHigher'));
    if (detail.relative_physical_stats === -1) parts.push(tr('guide.evo.defenseHigher'));
    if (detail.relative_physical_stats === 0) parts.push(tr('guide.evo.statsEqual'));
    return {
      how: parts.join(' · ') || tr('guide.evo.special'),
      where: detail.location ? label(detail.location.name) : tr('guide.evo.anywhere')
    };
  }

  function profile(data) {
    nodes.profile.replaceChildren();
    const suggestion = guide.battleProfile(data);
    const map = {
      'Resistente / suporte': 'bulky',
      'Atacante físico rápido': 'physicalFast',
      'Atacante físico': 'physical',
      'Atacante especial rápido': 'specialFast',
      'Atacante especial': 'special'
    };
    const roles = {
      bulky: ['bulkNature', 'bulkFocus'],
      physicalFast: ['physicalFastNature', 'physicalFocus'],
      physical: ['physicalNature', 'physicalFocus'],
      specialFast: ['specialFastNature', 'specialFocus'],
      special: ['specialNature', 'specialFocus']
    };
    const id = map[suggestion.role];
    const [nature, focus] = roles[id] || [];
    line(nodes.profile, tr('guide.profile.role'), id ? tr('guide.profile.' + id) : suggestion.role);
    line(nodes.profile, tr('guide.profile.nature'), nature ? tr('guide.profile.' + nature) : suggestion.nature);
    line(nodes.profile, tr('guide.profile.training'), focus ? tr('guide.profile.' + focus) : suggestion.focus);
    nodes.profile.append(el('small', 'guide-small', tr('guide.profile.caveat')));
  }

  async function matchups(data, signal) {
    loading('guide.type.loading', nodes.matchups);
    const types = data.types.map(row => row.type.name);
    try {
      const relations = await Promise.all(types.map(async name => ({
        name, damage_relations: (await getJSON('type/' + encodeURIComponent(name), signal)).damage_relations
      })));
      if (signal.aborted) return;
      const factors = guide.typeEffectiveness(types, relations);
      nodes.matchups.replaceChildren();
      const groups = [
        ['guide.weak', value => value > 1, 'guide-pill-weak'],
        ['guide.resist', value => value > 0 && value < 1, 'guide-pill-resist'],
        ['guide.immune', value => value === 0, 'guide-pill-immune']
      ];
      for (const [key, check, kind] of groups) {
        nodes.matchups.append(el('p', 'guide-mini-title', tr(key)));
        const values = Object.entries(factors).filter(([, value]) => check(value))
          .sort((a, b) => b[1] - a[1]);
        if (!values.length) {
          nodes.matchups.append(el('p', 'guide-small', tr('guide.none')));
        } else {
          const row = el('div', 'guide-row');
          for (const [name, amount] of values) pill(row, name, amount, kind);
          nodes.matchups.append(row);
        }
      }
      nodes.matchups.append(el('small', 'guide-small', tr('guide.types.caveat')));
    } catch {
      if (!signal.aborted) message(nodes.matchups, tr('guide.types.error'));
    }
  }

  async function evolutions(data, signal) {
    loading('guide.evolution.loading', nodes.evolutions);
    try {
      const species = await getJSON('pokemon-species/' + encodeURIComponent(data.species.name), signal);
      const chainId = guide.resourceId(species.evolution_chain?.url);
      if (!chainId) throw new Error('No chain');
      const raw = await getJSON('evolution-chain/' + chainId, signal);
      if (signal.aborted) return;
      const stages = guide.evolutionPaths(raw.chain);
      if (!stages.length) return message(nodes.evolutions, tr('guide.evo.none'));
      nodes.evolutions.replaceChildren();
      const list = el('div', 'guide-list');
      for (const stage of stages) {
        const item = el('div', 'evolution-stage');
        if (stage.id === guide.resourceId(data.species.url)) item.classList.add('is-current');
        const img = el('img');
        img.src = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/' + stage.id + '.png';
        img.alt = '';
        img.width = 54;
        img.height = 54;
        img.loading = 'lazy';
        const info = el('div');
        const button = el('button', '', label(stage.name));
        button.type = 'button';
        button.addEventListener('click', () => chosenPokemon(stage.name));
        info.append(button);
        if (stage.from) {
          const rules = (stage.details || []).map(condition);
          info.append(el('div', 'evolution-condition',
            tr('guide.evo.details') + ' ' +
            (rules.length ? rules.map(x => x.how).join(tr('guide.evo.or')) : tr('guide.evo.unknown'))));
          const places = [...new Set(rules.map(x => x.where))];
          info.append(el('div', 'evolution-condition evolution-location',
            tr('guide.evo.where') + ' ' + (places.length ? places.join(tr('guide.evo.or')) : tr('guide.evo.anywhere'))));
        } else {
          info.append(el('div', 'evolution-condition', tr('guide.evo.root')));
        }
        item.append(img, info);
        list.append(item);
      }
      nodes.evolutions.append(list, el('small', 'guide-small', tr('guide.evo.caveat')));
    } catch {
      if (!signal.aborted) message(nodes.evolutions, tr('guide.evo.error'));
    }
  }

  function renderEncounters() {
    nodes.encounters.replaceChildren();
    const version = nodes.encounterVersion.value;
    const places = encounterRows.filter(row =>
      row.version_details.some(detail => detail.version.name === version));
    if (!places.length) return message(nodes.encounters, tr('guide.encounters.noLocation'));
    const list = el('div', 'location-list');
    for (const area of places.slice(0, 8)) {
      const container = el('div', 'encounter-area');
      container.append(el('strong', '', label(area.location_area.name)));
      const details = area.version_details.find(d => d.version.name === version)?.encounter_details || [];
      const levels = details.flatMap(entry => [entry.min_level, entry.max_level])
        .filter(value => Number.isInteger(value) && value > 0);
      if (levels.length) {
        container.append(el('small', '', tr('guide.encounters.level', {
          min: Math.min(...levels), max: Math.max(...levels)
        })));
      }
      list.append(container);
    }
    nodes.encounters.append(list);
    if (places.length > 8) nodes.encounters.append(el('p', 'guide-small',
      tr('guide.encounters.more', { count: 8, total: places.length })));
  }

  async function encounters(data, signal) {
    nodes.encounterVersion.disabled = true;
    nodes.encounterVersion.replaceChildren();
    loading('guide.encounters.loading', nodes.encounters);
    try {
      const raw = await getJSON('pokemon/' + data.id + '/encounters', signal);
      if (signal.aborted) return;
      encounterRows = raw;
      const versions = new Map();
      for (const row of raw) {
        for (const item of row.version_details) {
          versions.set(item.version.name, guide.resourceId(item.version.url));
        }
      }
      const ordered = [...versions].sort((a, b) => b[1] - a[1]);
      if (!ordered.length) {
        return message(nodes.encounters, tr('guide.encounters.noWild'));
      }
      const previous = nodes.encounterVersion.dataset.lastSelection;
      for (const [name] of ordered) {
        const option = el('option', '', label(name));
        option.value = name;
        nodes.encounterVersion.append(option);
      }
      if (ordered.some(row => row[0] === previous)) nodes.encounterVersion.value = previous;
      nodes.encounterVersion.disabled = false;
      renderEncounters();
    } catch {
      if (!signal.aborted) message(nodes.encounters, tr('guide.encounters.error'));
    }
  }

  const ABILITY_DESCRIPTIONS = {
    intimidate: {
      pt: 'Reduz o Ataque dos adversários ao entrar em combate.',
      en: 'Lowers opponents’ Attack upon entering battle.'
    },
    levitate: {
      pt: 'Concede imunidade a golpes de Terra, com exceções.',
      en: 'Grants immunity to Ground-type moves, with exceptions.'
    },
    overgrow: {
      pt: 'Fortalece golpes de Planta com HP baixo.',
      en: 'Boosts Grass moves when HP is low.'
    },
    blaze: {
      pt: 'Fortalece golpes de Fogo com HP baixo.',
      en: 'Boosts Fire moves when HP is low.'
    },
    torrent: {
      pt: 'Fortalece golpes de Água com HP baixo.',
      en: 'Boosts Water moves when HP is low.'
    },
    static: { pt: 'Pode paralisar quem faz contato.', en: 'May paralyze opponents on contact.' },
    sturdy: {
      pt: 'Pode impedir que o Pokémon seja derrotado com HP cheio.',
      en: 'Can prevent a knockout at full HP.'
    },
    regenerator: {
      pt: 'Recupera parte do HP ao sair de campo.',
      en: 'Restores some HP when switching out.'
    },
    'speed-boost': {
      pt: 'Aumenta a Velocidade ao fim de cada turno.',
      en: 'Raises Speed at the end of each turn.'
    },
    unaware: {
      pt: 'Ignora certas alterações de atributos adversários.',
      en: 'Ignores certain opponent stat changes.'
    },
    'huge-power': { pt: 'Dobra o Ataque.', en: 'Doubles Attack.' },
    'pure-power': { pt: 'Dobra o Ataque.', en: 'Doubles Attack.' },
    'magic-guard': { pt: 'Evita muitas fontes de dano indireto.', en: 'Avoids many forms of indirect damage.' }
  };
  async function abilities(data, signal) {
    loading('guide.abilities.loading', nodes.abilities);
    try {
      const list = data.abilities.map(({ ability, is_hidden }) => ({
        name: ability.name, hidden: is_hidden, score: guide.abilityScore(ability.name)
      })).sort((a, b) => b.score - a.score);
      if (!list.length) return message(nodes.abilities, tr('guide.ability.none'));
      const resolved = await Promise.all(list.map(async ability => {
        const known = ABILITY_DESCRIPTIONS[ability.name]?.[locale.language];
        if (known) return { ...ability, text: known };
        try {
          const info = await getJSON('ability/' + encodeURIComponent(ability.name), signal);
          const language = info.effect_entries.find(x => x.language.name === locale.language);
          const english = info.effect_entries.find(x => x.language.name === 'en');
          const flavor = info.flavor_text_entries?.find(x => x.language.name === 'en');
          return { ...ability, text: language?.short_effect || english?.short_effect ||
            flavor?.flavor_text || '—' };
        } catch {
          return { ...ability, text: '—' };
        }
      }));
      if (signal.aborted) return;
      nodes.abilities.replaceChildren();
      const highest = Math.max(...list.map(x => x.score));
      for (const item of resolved) {
        const wrapper = el('div', 'ability-analysis');
        wrapper.append(el('strong', '', label(item.name)));
        if (item.hidden) wrapper.append(el('span', 'guide-small', tr('guide.ability.hidden')));
        if (highest > 0 && item.score === highest) {
          wrapper.append(el('span', 'guide-highlight guide-small', tr('guide.ability.highlight')));
        }
        wrapper.append(el('p', 'guide-small', item.text.replace(/\s+/g, ' ')));
        nodes.abilities.append(wrapper);
      }
      nodes.abilities.append(el('small', 'guide-small', tr('guide.ability.note')));
    } catch {
      if (!signal.aborted) message(nodes.abilities, tr('guide.ability.error'));
    }
  }

  function versions(data) {
    const previous = nodes.version.value;
    nodes.version.replaceChildren();
    const list = guide.groupVersions(data);
    for (const group of list) {
      const option = el('option', '', label(group.name));
      option.value = group.name;
      nodes.version.append(option);
    }
    if (list.some(x => x.name === previous)) nodes.version.value = previous;
    nodes.version.disabled = !list.length;
    if (!list.length) message(nodes.moves, tr('guide.moves.noVersions'));
  }
  async function concurrentMap(items, limit, signal, worker) {
    const results = Array(items.length);
    let next = 0;
    async function run() {
      while (next < items.length && !signal.aborted) {
        const index = next++;
        try { results[index] = await worker(items[index]); }
        catch { results[index] = null; }
      }
    }
    await Promise.all(Array.from({ length: Math.min(items.length, limit) }, run));
    return results.filter(Boolean);
  }
  async function moves(data, version) {
    moveController?.abort();
    const signal = (moveController = new AbortController()).signal;
    loading('guide.moves.loading', nodes.moves);
    message(nodes.moves, tr('guide.moves.analyzing', { version: label(version) }));
    try {
      const pool = guide.pickMovePool(guide.availableMoves(data, version));
      if (!pool.length) return message(nodes.moves, tr('guide.moves.noMoves'));
      const options = await concurrentMap(pool, 4, signal, async move => ({
        detail: await getJSON('move/' + encodeURIComponent(move.name), signal),
        method: move.method, level: move.level
      }));
      if (signal.aborted || data !== pokemon) return;
      const suggested = guide.recommendMoves(data, options);
      if (!suggested.length) return message(nodes.moves, tr('guide.moves.noneAnalyzed'));
      nodes.moves.replaceChildren();
      const grid = el('div', 'moves-grid');
      for (const move of suggested) {
        const card = el('div', 'move-card');
        const heading = el('div', 'move-card-title');
        heading.append(el('strong', '', label(move.detail.name)),
          el('span', 'guide-pill', locale.type(move.detail.type?.name)));
        const kind = {
          physical: 'guide.moves.physical',
          special: 'guide.moves.special',
          status: 'guide.moves.status'
        }[move.detail.damage_class?.name] || 'guide.moves.status';
        const power = move.detail.power ?? '—';
        const accuracy = move.detail.accuracy == null ? '—' : move.detail.accuracy + '%';
        heading.append();
        const method = {
          'level-up': tr('guide.moves.level', { level: move.level || '—' }),
          machine: tr('guide.moves.machine'),
          tutor: tr('guide.moves.tutor'),
          egg: tr('guide.moves.egg')
        }[move.method] || label(move.method);
        card.append(heading,
          el('div', 'move-card-meta',
            tr(kind) + ' · ' + tr('guide.moves.power') + ' ' + power + ' · ' +
            tr('guide.moves.accuracy') + ' ' + accuracy),
          el('div', 'move-card-meta', tr('guide.moves.learn', { method })));
        grid.append(card);
      }
      nodes.moves.append(grid);
    } catch {
      if (!signal.aborted) message(nodes.moves, tr('guide.moves.error'));
    }
  }

  function ensureTab(name) {
    if (!pokemon || !controller || controller.signal.aborted || tabLoaded.has(name)) return;
    tabLoaded.add(name);
    const signal = controller.signal;
    if (name === 'summary') profile(pokemon);
    if (name === 'battle') void matchups(pokemon, signal);
    if (name === 'evolution') {
      void evolutions(pokemon, signal);
      void encounters(pokemon, signal);
    }
    if (name === 'abilities') void abilities(pokemon, signal);
    if (name === 'moves' && !nodes.version.disabled) void moves(pokemon, nodes.version.value);
  }
  function changePokemon(data) {
    controller?.abort();
    moveController?.abort();
    controller = new AbortController();
    pokemon = data;
    tabLoaded = new Set();
    loading('guide.profile.loading', nodes.profile);
    loading('guide.type.loading', nodes.matchups);
    loading('guide.evolution.loading', nodes.evolutions);
    loading('guide.encounters.loading', nodes.encounters);
    loading('guide.abilities.loading', nodes.abilities);
    loading('guide.moves.loading', nodes.moves);
    nodes.encounterVersion.disabled = true;
    nodes.encounterVersion.replaceChildren();
    encounterRows = [];
    versions(data);
    ensureTab(window.PokedexTabs?.active || 'summary');
  }
  nodes.version.addEventListener('change', () => {
    if (pokemon && !nodes.version.disabled) void moves(pokemon, nodes.version.value);
  });
  nodes.encounterVersion.addEventListener('change', () => {
    nodes.encounterVersion.dataset.lastSelection = nodes.encounterVersion.value;
    renderEncounters();
  });
  document.addEventListener('pokedex:search-start', hideSuggestions);
  document.addEventListener('pokedex:not-found', event => void suggestPokemon(event.detail.query));
  document.addEventListener('pokedex:pokemon', event => changePokemon(event.detail.pokemon));
  document.addEventListener('pokedex:tab-change', event => ensureTab(event.detail.tab));
})();
