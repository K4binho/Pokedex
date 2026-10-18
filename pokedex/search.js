'use strict';

/* Game-based Pokédex filter.
 * Never infer the set of Pokémon from their introduction generation.
 * Instead, request each game's regional Pokédex through PokéAPI.
 */
(() => {
  const api = window.PokedexCatalog;
  const locale = window.PokedexLocale;
  const input = document.getElementById('pokemon-search');
  const gameSelect = document.getElementById('game-filter');
  const suggestionBox = document.getElementById('suggestions');
  const suggestionList = document.getElementById('suggestion-list');
  const status = document.getElementById('status');
  const API = 'https://pokeapi.co/api/v2/';
  const cache = new Map();
  let allEntries = [];
  let allPromise = null;
  let selectedGame = '';
  let selectedEntries = [];
  let typingTimer = null;
  let searchRevision = 0;
  let selectionRevision = 0;

  const nameFor = gameId => api.getGame(gameId)?.title || '';
  const activeEntries = () => selectedGame ? selectedEntries : allEntries;

  function updateOptions() {
    gameSelect.replaceChildren();
    const all = document.createElement('option');
    all.value = '';
    all.textContent = locale.t('search.allGames');
    gameSelect.append(all);
    let previous = -1;
    for (const game of api.GAMES) {
      if (game.generation !== previous) {
        const group = document.createElement('optgroup');
        group.label = locale.t('search.gameGeneration', { number: game.generation });
        gameSelect.append(group);
        previous = game.generation;
      }
      const option = document.createElement('option');
      option.value = game.id;
      option.textContent = game.title;
      gameSelect.lastElementChild.append(option);
    }
    gameSelect.value = selectedGame;
  }
  function hideSuggestions() {
    searchRevision++;
    clearTimeout(typingTimer);
    suggestionBox.hidden = true;
    suggestionList.replaceChildren();
  }

  async function request(resource) {
    if (!cache.has(resource)) {
      const pending = fetch(API + resource)
        .then(response => {
          if (!response.ok) throw new Error('PokéAPI status ' + response.status);
          return response.json();
        })
        .catch(error => { cache.delete(resource); throw error; });
      cache.set(resource, pending);
    }
    return cache.get(resource);
  }

  function loadNational() {
    if (allEntries.length) return Promise.resolve(allEntries);
    if (!allPromise) {
      allPromise = request('pokemon?limit=1025&offset=0')
        .then(data => {
          allEntries = api.parseEntries(data.results || []);
          if (!allEntries.length) throw new Error('Missing National Pokédex');
          return allEntries;
        })
        .catch(error => { allPromise = null; throw error; });
    }
    return allPromise;
  }

  async function loadGame(gameId) {
    const game = api.getGame(gameId);
    if (!game) throw new Error('Unknown game');
    // Version groups describe which regional Pokédexes the game introduced.
    // Some editions reuse existing Pokédexes: the documented slugs cover those.
    const versionGroup = await request('version-group/' + encodeURIComponent(game.id));
    const names = [...new Set([
      ...(versionGroup.pokedexes || []).map(item => item.name),
      ...game.dexNames
    ])];
    const results = await Promise.allSettled(names.map(name =>
      request('pokedex/' + encodeURIComponent(name))));
    const dexes = results.filter(result => result.status === 'fulfilled')
      .map(result => result.value);
    if (!dexes.length) throw new Error('No Pokédex for game');
    const entries = api.parseGameDexes(dexes);
    if (!entries.length) throw new Error('Game Pokédex has no available entries');
    return entries;
  }

  function contains(id) {
    if (!selectedGame) return Number(id) >= 1 && Number(id) <= 1025;
    return selectedEntries.some(entry => entry.id === Number(id));
  }
  function adjacent(id, direction) {
    if (!selectedGame) {
      const next = Number(id) + direction;
      return next >= 1 && next <= 1025 ? next : null;
    }
    return api.adjacent(selectedEntries, Number(id), direction);
  }
  function random(currentId) {
    const ids = activeEntries();
    if (!selectedGame && !ids.length) {
      let id = Math.floor(Math.random() * 1025) + 1;
      if (id === currentId) id = id % 1025 + 1;
      return id;
    }
    if (!ids.length) return null;
    let index = Math.floor(Math.random() * ids.length);
    if (ids.length > 1 && ids[index].id === currentId) index = (index + 1) % ids.length;
    return ids[index].id;
  }

  function showSuggestions(raw, notify = false) {
    hideSuggestions();
    const query = api.normalize(raw);
    if (query.length < 2 || /^\d+$/.test(query)) return;
    const revision = searchRevision;
    const ready = selectedGame ? Promise.resolve(selectedEntries) : loadNational();
    void ready.then(entries => {
      if (revision !== searchRevision || api.normalize(input.value) !== query) return;
      const suggestions = api.rankMatches(query, entries);
      if (!suggestions.length) {
        if (notify) status.textContent = locale.t('status.noSuggest');
        return;
      }
      for (const suggestion of suggestions) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'suggestion-button';
        button.textContent = window.PokedexGuide.label(suggestion.name) +
          '  #' + String(suggestion.id).padStart(4, '0');
        button.addEventListener('click', () => {
          hideSuggestions();
          window.PokedexApp.loadPokemon(suggestion.id);
        });
        suggestionList.append(button);
      }
      suggestionBox.hidden = false;
      if (notify) status.textContent = locale.t('status.suggest');
    }).catch(() => {
      if (revision === searchRevision && notify) status.textContent = locale.t('status.suggestError');
    });
  }

  async function selectGame(nextGame, { restore = false } = {}) {
    const version = ++selectionRevision;
    hideSuggestions();
    gameSelect.disabled = true;
    status.textContent = locale.t('status.gameLoading');
    try {
      const entries = nextGame ? await loadGame(nextGame) : await loadNational();
      if (version !== selectionRevision) return;
      selectedGame = nextGame;
      selectedEntries = entries;
      gameSelect.value = nextGame;
      try { localStorage.setItem('k4-pokedex-game-v1', nextGame); }
      catch { /* optional persistence */ }
      window.PokedexApp.refreshNavigation();
      const current = window.PokedexApp.currentPokemon;
      const keepCurrent = current && contains(current.id);
      if (keepCurrent) {
        status.textContent = nextGame
          ? locale.t('status.gameSelected', { game: nameFor(nextGame), count: entries.length })
          : locale.t('status.allGames');
      } else {
        // Open the first Pokémon in the selected game's Pokédex.
        window.PokedexApp.loadPokemon(entries[0].id);
      }
    } catch {
      if (version !== selectionRevision) return;
      gameSelect.value = selectedGame;
      status.textContent = locale.t('status.gameError');
      status.dataset.error = 'true';
    } finally {
      if (version === selectionRevision) gameSelect.disabled = false;
    }
    if (restore && input.value.trim()) showSuggestions(input.value);
  }

  gameSelect.addEventListener('change', () => {
    void selectGame(gameSelect.value);
  });
  input.addEventListener('input', () => {
    hideSuggestions();
    const value = input.value;
    if (api.normalize(value).length < 2) return;
    typingTimer = setTimeout(() => showSuggestions(value), 170);
  });
  input.addEventListener('focus', () => {
    if (api.normalize(input.value).length >= 2) showSuggestions(input.value);
  });
  document.addEventListener('pokedex:search-start', hideSuggestions);
  document.addEventListener('pokedex:not-found', event => {
    showSuggestions(event.detail.query, true);
  });
  document.addEventListener('pokedex:pokemon', hideSuggestions);
  document.addEventListener('pokedex:language-change', () => {
    updateOptions();
    if (!suggestionBox.hidden) showSuggestions(input.value);
  });

  try {
    const saved = localStorage.getItem('k4-pokedex-game-v1') || '';
    if (api.getGame(saved)) {
      // Restored games are loaded after core application initialization.
      window.setTimeout(() => { gameSelect.value = saved; void selectGame(saved, { restore: true }); }, 0);
    }
  } catch { /* optional storage */ }
  updateOptions();
  window.PokedexSearch = {
    get game() { return selectedGame; },
    get entries() { return activeEntries(); },
    contains, adjacent, random, hide: hideSuggestions
  };
  // Preload names for the unfiltered live search without blocking first paint.
  void loadNational().catch(() => {});
})();
