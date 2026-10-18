'use strict';

/* Search runs entirely in the browser, based on National Pokédex IDs.
 * One list request indexes names; exact searches still use the Pokémon endpoint.
 */
(() => {
  const api = window.PokedexCatalog;
  const locale = window.PokedexLocale;
  const input = document.getElementById('pokemon-search');
  const generation = document.getElementById('generation-filter');
  const suggestionBox = document.getElementById('suggestions');
  const suggestionList = document.getElementById('suggestion-list');
  const status = document.getElementById('status');
  let entries = [];
  let indexPromise = null;
  let timer = null;
  let requestId = 0;

  function setGenerationLabels() {
    const all = generation.options[0];
    all.textContent = locale.t('search.genAll');
    for (const row of api.GENERATIONS) {
      const option = generation.querySelector('option[value="' + row.number + '"]');
      if (!option) continue;
      const prefix = locale.t('search.genSpecific', { number: row.number });
      option.textContent = prefix + ' · #' + String(row.first).padStart(3, '0') +
        '–' + String(row.last).padStart(3, '0');
    }
  }
  function hide() {
    requestId++;
    window.clearTimeout(timer);
    suggestionBox.hidden = true;
    suggestionList.replaceChildren();
  }
  function loadIndex() {
    if (entries.length) return Promise.resolve(entries);
    if (!indexPromise) {
      indexPromise = fetch('https://pokeapi.co/api/v2/pokemon?limit=1025&offset=0')
        .then(response => {
          if (!response.ok) throw new Error('PokéAPI unavailable');
          return response.json();
        })
        .then(data => {
          entries = api.parseEntries(data.results || []);
          return entries;
        })
        .catch(error => {
          indexPromise = null; // offline users can retry
          throw error;
        });
    }
    return indexPromise;
  }
  function suggest(query, notify = false) {
    hide();
    const search = api.normalize(query);
    if (search.length < 2 || /^\d+$/.test(search)) return;
    const id = requestId;
    void loadIndex().then(all => {
      if (id !== requestId || api.normalize(input.value) !== search) return;
      const choices = api.rankMatches(search, all, Number(generation.value));
      if (!choices.length) {
        if (notify) status.textContent = locale.t('status.noSuggest');
        return;
      }
      for (const choice of choices) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'suggestion-button';
        button.textContent = window.PokedexGuide.label(choice.name) +
          '  #' + String(choice.id).padStart(4, '0');
        button.addEventListener('click', () => {
          hide();
          window.PokedexApp.loadPokemon(choice.id);
        });
        suggestionList.append(button);
      }
      suggestionBox.hidden = false;
      if (notify) status.textContent = locale.t('status.suggest');
    }).catch(() => {
      if (id === requestId && notify) status.textContent = locale.t('status.suggestError');
    });
  }

  input.addEventListener('input', () => {
    hide();
    const query = input.value;
    if (api.normalize(query).length < 2) return;
    timer = window.setTimeout(() => suggest(query), 170);
  });
  input.addEventListener('focus', () => {
    if (api.normalize(input.value).length >= 2) suggest(input.value);
  });
  document.addEventListener('pokedex:search-start', hide);
  document.addEventListener('pokedex:not-found', event => {
    suggest(event.detail.query, true);
  });
  document.addEventListener('pokedex:pokemon', hide);

  generation.addEventListener('change', () => {
    hide();
    try { localStorage.setItem('k4-pokedex-generation-v1', generation.value); }
    catch { /* storage is optional */ }
    const range = api.rangeFor(generation.value);
    window.PokedexApp.refreshNavigation();
    if (Number(generation.value)) {
      status.textContent = locale.t('status.genSelected', { number: range.number });
    }
    const current = window.PokedexApp.currentPokemon;
    // Selecting a generation immediately displays the first entry when necessary.
    if (!current || !api.inGeneration(current.id, Number(generation.value))) {
      window.PokedexApp.loadPokemon(range.first);
    } else if (api.normalize(input.value).length >= 2) {
      suggest(input.value);
    }
  });

  document.addEventListener('pokedex:language-change', () => {
    setGenerationLabels();
    if (!suggestionBox.hidden) suggest(input.value);
  });

  try {
    const selected = localStorage.getItem('k4-pokedex-generation-v1');
    if (api.GENERATIONS.some(g => String(g.number) === selected)) {
      generation.value = selected;
    }
  } catch { /* storage is optional */ }
  setGenerationLabels();
  window.PokedexSearch = { suggest, hide, get generation() { return Number(generation.value); } };
  // Preload the index without delaying the visible Pokémon details.
  void loadIndex().catch(() => {});
})();
