'use strict';

// Recursos extras desacoplados do núcleo: o site continua utilizável
// se uma seção secundária da PokéAPI não responder.
(() => {
  const guide = window.PokedexGuide;
  const $ = selector => document.querySelector(selector);
  const nodes = {
    intro: $('#intro-overlay'),
    suggestions: $('#suggestions'),
    suggestionList: $('#suggestion-list'),
    profile: $('#guide-profile'),
    matchups: $('#guide-matchups'),
    evolutions: $('#guide-evolutions'),
    abilities: $('#guide-abilities'),
    moves: $('#guide-moves'),
    version: $('#game-version')
  };
  const API_ROOT = 'https://pokeapi.co/api/v2/';
  let pokemon = null;
  let guideController = null;
  let suggestionController = null;
  let movesController = null;
  let allPokemonNames = null;

  // Fallback sem JavaScript já é garantido pela animação CSS.
  if (nodes.intro) {
    const delay = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 3400;
    window.setTimeout(() => nodes.intro?.remove(), delay);
  }

  const create = (tag, cls, value) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (value !== undefined) node.textContent = value;
    return node;
  };
  function setMessage(container, message) {
    container.replaceChildren(create('p', 'guide-small', message));
  }
  function addLine(container, title, content) {
    const paragraph = create('p');
    paragraph.append(create('strong', '', title + ' '), document.createTextNode(content));
    container.append(paragraph);
  }
  function addPill(container, name, multiplier, typeClass) {
    const chip = create('span', 'guide-pill ' + (typeClass || ''),
      (guide.TYPE_NAMES[name] || guide.label(name)) + ' ×' + multiplier);
    container.append(chip);
  }
  async function getJSON(resource, signal) {
    const response = await fetch(API_ROOT + resource, { signal });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    return response.json();
  }
  function onError(container, signal, message) {
    if (!signal.aborted) setMessage(container, message);
  }
  function selectPokemon(query) {
    const input = $('#pokemon-search');
    input.value = query;
    $('#search-form').requestSubmit();
  }

  function hideSuggestions() {
    if (suggestionController) suggestionController.abort();
    nodes.suggestions.hidden = true;
    nodes.suggestionList.replaceChildren();
  }

  async function showSuggestions(search) {
    hideSuggestions();
    const controller = new AbortController();
    suggestionController = controller;
    try {
      if (!allPokemonNames) {
        // Inclui formas alternativas catalogadas no endpoint.
        const index = await getJSON('pokemon?limit=2000', controller.signal);
        if (controller.signal.aborted) return;
        allPokemonNames = index.results.map(entry => entry.name);
      }
      const similar = guide.findSimilar(search, allPokemonNames);
      if (controller.signal.aborted) return;
      if (similar.length === 0) {
        $('#status').textContent = 'Pokémon não encontrado. Confira o nome ou tente outro termo.';
        return;
      }
      $('#status').textContent = 'Pokémon não encontrado. Escolha uma sugestão abaixo.';
      nodes.suggestionList.replaceChildren();
      for (const name of similar) {
        const button = create('button', 'suggestion-button', guide.label(name));
        button.type = 'button';
        button.addEventListener('click', () => selectPokemon(name));
        nodes.suggestionList.append(button);
      }
      nodes.suggestions.hidden = false;
    } catch {
      if (!controller.signal.aborted) {
        $('#status').textContent = 'Pokémon não encontrado. Não foi possível consultar sugestões agora.';
      }
    }
  }

  function drawProfile(data) {
    nodes.profile.replaceChildren();
    const profile = guide.battleProfile(data);
    addLine(nodes.profile, 'Estilo:', profile.role);
    addLine(nodes.profile, 'Naturezas para avaliar:', profile.nature);
    addLine(nodes.profile, 'Prioridade de treino:', profile.focus);
    const disclaimer = create('small', 'guide-small',
      'Estimativa baseada nos atributos base. EVs, natureza e função ideal dependem de formato, habilidade, equipe e geração.');
    nodes.profile.append(disclaimer);
  }

  async function drawMatchups(data, signal) {
    setMessage(nodes.matchups, 'Consultando tabela de tipos...');
    const types = data.types.map(row => row.type.name);
    try {
      const relations = await Promise.all(types.map(async name => {
        const detail = await getJSON('type/' + encodeURIComponent(name), signal);
        return { name, damage_relations: detail.damage_relations };
      }));
      if (signal.aborted) return;
      const effectiveness = guide.typeEffectiveness(types, relations);
      nodes.matchups.replaceChildren();
      const groups = [
        { title: 'Fraquezas', values: Object.entries(effectiveness).filter(([, factor]) => factor > 1), cls: 'guide-pill-weak' },
        { title: 'Resistências', values: Object.entries(effectiveness).filter(([, factor]) => factor > 0 && factor < 1), cls: 'guide-pill-resist' },
        { title: 'Imunidades', values: Object.entries(effectiveness).filter(([, factor]) => factor === 0), cls: 'guide-pill-immune' }
      ];
      for (const group of groups) {
        nodes.matchups.append(create('p', 'guide-mini-title', group.title));
        if (!group.values.length) {
          nodes.matchups.append(create('p', 'guide-small', 'Nenhuma'));
          continue;
        }
        const row = create('div', 'guide-row');
        for (const [name, value] of group.values.sort((a, b) => b[1] - a[1])) {
          addPill(row, name, value, group.cls);
        }
        nodes.matchups.append(row);
      }
      nodes.matchups.append(create('small', 'guide-small',
        'Multiplicadores defensivos padrão da tabela atual. Habilidades, clima, itens e regras de gerações antigas podem alterar os danos.'));
    } catch {
      onError(nodes.matchups, signal, 'Não foi possível carregar as vantagens e fraquezas.');
    }
  }

  async function drawEvolutions(data, signal) {
    setMessage(nodes.evolutions, 'Consultando a família evolutiva...');
    try {
      const speciesName = data.species?.name;
      if (!speciesName) throw new Error('Sem espécie');
      const species = await getJSON('pokemon-species/' + encodeURIComponent(speciesName), signal);
      if (!species.evolution_chain?.url) throw new Error('Sem cadeia');
      const chainId = guide.resourceId(species.evolution_chain.url);
      if (!chainId) throw new Error('Sem cadeia');
      const raw = await getJSON('evolution-chain/' + chainId, signal);
      if (signal.aborted) return;
      const stages = guide.evolutionPaths(raw.chain);
      nodes.evolutions.replaceChildren();
      if (!stages.length) {
        setMessage(nodes.evolutions, 'Evolução não cadastrada.');
        return;
      }
      const list = create('div', 'guide-list');
      for (const stage of stages) {
        const item = create('div', 'evolution-stage');
        if (stage.id === guide.resourceId(data.species?.url)) item.classList.add('is-current');
        const img = create('img');
        img.src = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/' + stage.id + '.png';
        img.alt = '';
        img.loading = 'lazy';
        img.width = 62;
        img.height = 62;
        const text = create('div');
        const button = create('button', '', guide.label(stage.name));
        button.type = 'button';
        button.addEventListener('click', () => selectPokemon(stage.name));
        text.append(button);
        if (stage.from) {
          text.append(create('div', 'evolution-condition',
            stage.conditions.length ? stage.conditions.join(' OU ') : 'Condição não informada'));
        } else {
          text.append(create('div', 'evolution-condition', 'Início da família'));
        }
        item.append(img, text);
        list.append(item);
      }
      nodes.evolutions.append(list, create('small', 'guide-small',
        'As condições podem variar entre jogos, regiões e gerações; cadeias ramificadas mostram caminhos alternativos.'));
    } catch {
      onError(nodes.evolutions, signal, 'Informações de evolução indisponíveis no momento.');
    }
  }

  const ABILITY_TEXTS = {
    'intimidate': 'Reduz o Ataque dos adversários ao entrar em batalha.',
    'levitate': 'Concede imunidade a golpes do tipo Terra (salvo exceções).',
    'overgrow': 'Fortalece golpes de Planta quando o HP está baixo.',
    'blaze': 'Fortalece golpes de Fogo quando o HP está baixo.',
    'torrent': 'Fortalece golpes de Água quando o HP está baixo.',
    'static': 'Pode paralisar quem faz contato.',
    'sturdy': 'Pode impedir um nocaute com o HP cheio.',
    'technician': 'Fortalece golpes de menor poder base.',
    'regenerator': 'Recupera parte do HP ao sair de campo.',
    'speed-boost': 'Aumenta a Velocidade ao final dos turnos.',
    'unaware': 'Ignora certas mudanças de atributos do oponente.',
    'huge-power': 'Dobra o atributo de Ataque.',
    'pure-power': 'Dobra o atributo de Ataque.',
    'magic-guard': 'Evita dano indireto de muitas fontes.',
    'moxie': 'Aumenta o Ataque após derrotar um adversário.',
    'guts': 'Aumenta o Ataque quando o Pokémon está com uma condição de status.',
    'chlorophyll': 'Dobra a Velocidade sob sol forte.',
    'swift-swim': 'Dobra a Velocidade durante chuva.',
    'prankster': 'Aumenta a prioridade de golpes de status (com exceções).',
    'multiscale': 'Reduz dano recebido quando o HP está cheio.',
    'wonder-guard': 'Em geral, recebe dano direto somente de golpes superefetivos.'
  };

  async function drawAbilities(data, signal) {
    setMessage(nodes.abilities, 'Consultando habilidades...');
    try {
      const abilities = (data.abilities || []).map(row => ({
        name: row.ability.name,
        hidden: row.is_hidden,
        score: guide.abilityScore(row.ability.name)
      })).sort((a, b) => b.score - a.score);
      if (!abilities.length) {
        setMessage(nodes.abilities, 'Nenhuma habilidade cadastrada.');
        return;
      }
      // Busca somente as descrições que não possuem resumo em português.
      const details = await Promise.all(abilities.map(async ability => {
        if (ABILITY_TEXTS[ability.name]) return { ...ability, description: ABILITY_TEXTS[ability.name], english: false };
        try {
          const result = await getJSON('ability/' + encodeURIComponent(ability.name), signal);
          const effect = (result.effect_entries || []).find(entry => entry.language?.name === 'en');
          const flavor = (result.flavor_text_entries || []).find(entry => entry.language?.name === 'en');
          return { ...ability, description: effect?.short_effect || flavor?.flavor_text || 'Sem descrição.',
            english: true };
        } catch {
          return { ...ability, description: 'Descrição indisponível.', english: false };
        }
      }));
      if (signal.aborted) return;
      nodes.abilities.replaceChildren();
      const max = Math.max(...abilities.map(row => row.score));
      for (const ability of details) {
        const div = create('div', 'ability-analysis');
        const heading = create('strong', '', guide.label(ability.name));
        div.append(heading);
        if (ability.hidden) div.append(create('span', 'guide-small', 'Habilidade oculta'));
        if (max > 0 && ability.score === max) {
          div.append(create('span', 'guide-highlight guide-small', 'Destaque geral (estimativa)'));
        }
        div.append(create('p', 'guide-small',
          ability.description.replace(/\s+/g, ' ').trim() + (ability.english ? ' (EN)' : '')));
        nodes.abilities.append(div);
      }
      nodes.abilities.append(create('small', 'guide-small',
        'Destaque por potencial geral; a melhor habilidade depende do jogo, da estratégia e do adversário.'));
    } catch {
      onError(nodes.abilities, signal, 'Não foi possível consultar as habilidades.');
    }
  }

  function updateVersions(data) {
    nodes.version.replaceChildren();
    const versions = guide.groupVersions(data);
    for (const version of versions) {
      const option = create('option', '', guide.label(version.name));
      option.value = version.name;
      nodes.version.append(option);
    }
    nodes.version.disabled = !versions.length;
    if (!versions.length) setMessage(nodes.moves, 'Golpes não cadastrados para este Pokémon.');
    return versions.length > 0;
  }

  async function concurrentMap(items, limit, signal, worker) {
    const result = Array(items.length);
    let index = 0;
    async function run() {
      while (index < items.length && !signal.aborted) {
        const slot = index++;
        try { result[slot] = await worker(items[slot]); }
        catch { result[slot] = null; }
      }
    }
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
    return result.filter(Boolean);
  }

  async function drawMoves(data, version) {
    if (movesController) movesController.abort();
    const controller = new AbortController();
    movesController = controller;
    setMessage(nodes.moves, 'Analisando golpes disponíveis em ' + guide.label(version) + '...');
    try {
      const available = guide.availableMoves(data, version);
      const pool = guide.pickMovePool(available);
      if (!pool.length) {
        setMessage(nodes.moves, 'Esta versão não possui golpes cadastrados na PokéAPI.');
        return;
      }
      const options = await concurrentMap(pool, 4, controller.signal, async move => {
        const detail = await getJSON('move/' + encodeURIComponent(move.name), controller.signal);
        return { detail, method: move.method, level: move.level };
      });
      if (controller.signal.aborted || data !== pokemon) return;
      const picked = guide.recommendMoves(data, options);
      nodes.moves.replaceChildren();
      if (!picked.length) {
        setMessage(nodes.moves, 'Nenhum golpe pôde ser analisado nesta consulta.');
        return;
      }
      const grid = create('div', 'moves-grid');
      const methods = { 'level-up': 'Nível', machine: 'MT', tutor: 'Tutor', egg: 'Ovo' };
      for (const move of picked) {
        const card = create('div', 'move-card');
        const title = create('div', 'move-card-title');
        title.append(create('strong', '', guide.label(move.detail.name)));
        const type = create('span', 'guide-pill',
          guide.TYPE_NAMES[move.detail.type?.name] || guide.label(move.detail.type?.name));
        title.append(type);
        const category = move.detail.damage_class?.name === 'physical'
          ? 'Físico' : move.detail.damage_class?.name === 'special' ? 'Especial' : 'Status';
        const power = move.detail.power ?? '—';
        const accuracy = move.detail.accuracy == null ? '—' : move.detail.accuracy + '%';
        const source = (methods[move.method] || guide.label(move.method)) +
          (move.method === 'level-up' && move.level ? ' ' + move.level : '');
        card.append(title, create('div', 'move-card-meta',
          category + ' · Poder ' + power + ' · Precisão ' + accuracy));
        card.append(create('div', 'move-card-meta', 'Aprende via ' + source));
        grid.append(card);
      }
      nodes.moves.append(grid);
    } catch {
      if (!controller.signal.aborted) setMessage(nodes.moves, 'Não foi possível analisar os golpes.');
    }
  }

  function loadGuide(data) {
    if (guideController) guideController.abort();
    if (movesController) movesController.abort();
    guideController = new AbortController();
    pokemon = data;
    const signal = guideController.signal;
    drawProfile(data);
    void drawMatchups(data, signal);
    void drawEvolutions(data, signal);
    void drawAbilities(data, signal);
    if (updateVersions(data)) void drawMoves(data, nodes.version.value);
  }

  nodes.version.addEventListener('change', () => {
    if (pokemon) void drawMoves(pokemon, nodes.version.value);
  });
  document.addEventListener('pokedex:search-start', hideSuggestions);
  document.addEventListener('pokedex:not-found', event => {
    void showSuggestions(event.detail.query);
  });
  document.addEventListener('pokedex:pokemon', event => {
    hideSuggestions();
    loadGuide(event.detail.pokemon);
  });
})();
