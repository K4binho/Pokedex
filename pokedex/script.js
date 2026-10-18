'use strict';

const API_URL = 'https://pokeapi.co/api/v2/pokemon/';
const MAX_POKEMON = 1025;
const locale = window.PokedexLocale;
const tr = (key, vars) => locale?.t(key, vars) || key;

const STORAGE_KEY = 'k4-pokedex-favorites-v1';
const LAST_KEY = 'k4-pokedex-last-v1';

const $ = (selector) => document.querySelector(selector);
const ui = {
  form: $('#search-form'),
  input: $('#pokemon-search'),
  generation: $('#generation-filter'),
  status: $('#status'),
  screen: $('#screen'),
  image: $('#pokemon-image'),
  imageFallback: $('#artwork-fallback'),
  screenId: $('#screen-id'),
  screenName: $('#pokemon-name'),
  detailName: $('#detail-name'),
  detailId: $('#detail-id'),
  types: $('#types'),
  height: $('#height'),
  weight: $('#weight'),
  stats: $('#stats'),
  abilities: $('#abilities'),
  previous: $('#previous'),
  next: $('#next'),
  random: $('#random'),
  favorite: $('#favorite'),
  favoritesList: $('#favorites-list'),
  clearFavorites: $('#clear-favorites')
};

const TYPE_NAMES = {
  normal: 'Normal', fire: 'Fogo', water: 'Água', electric: 'Elétrico',
  grass: 'Planta', ice: 'Gelo', fighting: 'Lutador', poison: 'Venenoso',
  ground: 'Terra', flying: 'Voador', psychic: 'Psíquico', bug: 'Inseto',
  rock: 'Pedra', ghost: 'Fantasma', dragon: 'Dragão', dark: 'Sombrio',
  steel: 'Aço', fairy: 'Fada'
};
const STAT_NAMES = {
  hp: 'HP', attack: 'Ataque', defense: 'Defesa',
  'special-attack': 'Atq. Esp.', 'special-defense': 'Def. Esp.', speed: 'Velocidade'
};

let currentPokemon = null;
let lastRenderedPokemon = null;
let activeRequest = null;
let favorites = readFavorites();

function readFavorites() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(saved)
      ? saved.filter((item) => item && Number.isInteger(item.id) && item.id >= 1 &&
          item.id <= MAX_POKEMON && typeof item.name === 'string').slice(0, 50)
      : [];
  } catch {
    return [];
  }
}

function persist(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); }
  catch { /* Modo privado ou armazenamento bloqueado: a sessão continua funcionando. */ }
}

function formatName(name) {
  return name.replace(/-/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
}

function normalizeQuery(value) {
  return value.trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-');
}

function paddedId(id) {
  return '#' + String(id).padStart(4, '0');
}

function setStatus(message, isError = false) {
  ui.status.textContent = message;
  ui.status.dataset.error = String(isError);
}

function renderFavorites() {
  ui.favoritesList.replaceChildren();
  ui.clearFavorites.hidden = favorites.length === 0;

  if (!favorites.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-message';
    empty.textContent = tr('details.empty');
    ui.favoritesList.append(empty);
  }

  favorites.forEach(({ id, name }) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'favorite-chip';
    button.textContent = paddedId(id) + ' ' + formatName(name);
    button.setAttribute('aria-label', tr('controls.show', { name: formatName(name) }));
    button.addEventListener('click', () => loadPokemon(id));
    ui.favoritesList.append(button);
  });

  const selected = currentPokemon && favorites.some((item) => item.id === currentPokemon.id);
  ui.favorite.setAttribute('aria-pressed', String(Boolean(selected)));
  ui.favorite.setAttribute('aria-label', tr(selected ? 'controls.favRemove' : 'controls.favAdd', {
    name: currentPokemon ? formatName(currentPokemon.name) : 'Pokémon'
  }));
  ui.favorite.textContent = tr(selected ? 'controls.favorited' : 'controls.favorite');
}

function renderPokemon(data, preserveInput = false) {
  lastRenderedPokemon = data;
  currentPokemon = { id: data.id, name: data.name };
  const label = formatName(data.name);
  const number = paddedId(data.id);
  const artwork = data.sprites?.other?.['official-artwork']?.front_default;
  const sprite = data.sprites?.front_default;

  ui.screenName.textContent = label;
  ui.detailName.textContent = label;
  ui.screenId.textContent = number;
  ui.detailId.textContent = number;
  ui.height.textContent = (data.height / 10).toLocaleString(locale.language === 'en' ? 'en-US' : 'pt-BR', { maximumFractionDigits: 1 }) + ' m';
  ui.weight.textContent = (data.weight / 10).toLocaleString(locale.language === 'en' ? 'en-US' : 'pt-BR', { maximumFractionDigits: 1 }) + ' kg';

  ui.image.hidden = false;
  ui.imageFallback.hidden = true;
  ui.image.alt = tr('screen.image', { name: label });
  ui.image.dataset.fallback = sprite || '';
  if (artwork || sprite) {
    ui.image.src = artwork || sprite;
  } else {
    ui.image.hidden = true;
    ui.imageFallback.hidden = false;
  }

  ui.types.replaceChildren();
  data.types.forEach(({ type }) => {
    const tag = document.createElement('span');
    tag.className = 'type type-' + type.name;
    tag.textContent = locale.type(type.name);
    ui.types.append(tag);
  });

  ui.stats.replaceChildren();
  data.stats.forEach(({ stat, base_stat: value }) => {
    const row = document.createElement('div');
    row.className = 'stat-row';
    const name = document.createElement('span');
    name.className = 'stat-name';
    name.textContent = locale.stat(stat.name);
    const track = document.createElement('div');
    track.className = 'stat-track';
    track.setAttribute('role', 'meter');
    track.setAttribute('aria-label', name.textContent);
    track.setAttribute('aria-valuemin', '0');
    track.setAttribute('aria-valuemax', '255');
    track.setAttribute('aria-valuenow', String(Math.min(value, 255)));
    const fill = document.createElement('div');
    fill.className = 'stat-fill';
    fill.style.width = Math.min((value / 255) * 100, 100) + '%';
    track.append(fill);
    const amount = document.createElement('span');
    amount.className = 'stat-value';
    amount.textContent = String(value);
    row.append(name, track, amount);
    ui.stats.append(row);
  });

  ui.abilities.replaceChildren();
  data.abilities.forEach(({ ability, is_hidden: hidden }) => {
    const item = document.createElement('span');
    item.className = 'ability';
    item.textContent = locale.ability(ability.name) + (hidden ? ' · ' + tr('guide.ability.hidden') : '');
    item.title = formatName(ability.name);
    ui.abilities.append(item);
  });

  const currentRange = window.PokedexCatalog.rangeFor(ui.generation.value);
  ui.previous.disabled = data.id <= currentRange.first || data.id > currentRange.last;
  ui.next.disabled = data.id >= currentRange.last || data.id < currentRange.first;
  if (!preserveInput) ui.input.value = '';
  persist(LAST_KEY, data.id);
  renderFavorites();
  document.dispatchEvent(new CustomEvent('pokedex:pokemon', { detail: { pokemon: data } }));
}

async function loadPokemon(query) {
  const search = window.PokedexCatalog.normalize(String(query));
  if (!search) {
    setStatus(tr('status.empty'), true);
    ui.input.focus();
    return;
  }
  if (/^\d+$/.test(search) && (+search < 1 || +search > MAX_POKEMON)) {
    setStatus(tr('status.range', { max: MAX_POKEMON }), true);
    return;
  }

  const generation = Number(ui.generation.value);
  const range = window.PokedexCatalog.rangeFor(generation);
  if (/^\d+$/.test(search) && !window.PokedexCatalog.inGeneration(Number(search), generation)) {
    setStatus(tr('status.outsideGen', { name: '#' + search }), true);
    return;
  }
  document.dispatchEvent(new CustomEvent('pokedex:search-start'));
  if (activeRequest) activeRequest.abort();
  const controller = new AbortController();
  activeRequest = controller;
  ui.screen.classList.add('is-loading');
  setStatus(tr('status.searching'));
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(API_URL + encodeURIComponent(search), { signal: controller.signal });
    if (response.status === 404) throw new Error('not-found');
    if (!response.ok) throw new Error('api-error');
    const data = await response.json();
    if (controller !== activeRequest) return;
    // A filter may change while a fetch is in flight.
    if (!window.PokedexCatalog.inGeneration(data.id, Number(ui.generation.value))) {
      setStatus(tr('status.outsideGen', { name: formatName(data.name) }), true);
      return;
    }
    renderPokemon(data);
    setStatus(tr('status.found', { name: formatName(data.name) }));
  } catch (error) {
    if (controller !== activeRequest) return;
    if (error.name === 'AbortError') {
      setStatus(tr('status.timeout'), true);
    } else if (error.message === 'not-found') {
      setStatus(tr('status.notFound'), true);
      document.dispatchEvent(new CustomEvent('pokedex:not-found', { detail: { query: search } }));
    } else {
      setStatus(tr('status.network'), true);
    }
  } finally {
    clearTimeout(timeoutId);
    if (controller === activeRequest) {
      activeRequest = null;
      ui.screen.classList.remove('is-loading');
    }
  }
}

ui.form.addEventListener('submit', (event) => {
  event.preventDefault();
  loadPokemon(ui.input.value);
});
ui.previous.addEventListener('click', () => {
  const range = window.PokedexCatalog.rangeFor(ui.generation.value);
  if (currentPokemon && currentPokemon.id > range.first && currentPokemon.id <= range.last) loadPokemon(currentPokemon.id - 1);
});
ui.next.addEventListener('click', () => {
  const range = window.PokedexCatalog.rangeFor(ui.generation.value);
  if (currentPokemon && currentPokemon.id >= range.first && currentPokemon.id < range.last) loadPokemon(currentPokemon.id + 1);
});
ui.random.addEventListener('click', () => {
  const range = window.PokedexCatalog.rangeFor(ui.generation.value);
  const count = range.last - range.first + 1;
  let id = Math.floor(Math.random() * count) + range.first;
  if (currentPokemon && count > 1 && id === currentPokemon.id) {
    id = range.first + (id - range.first + 1) % count;
  }
  loadPokemon(id);
});
ui.favorite.addEventListener('click', () => {
  if (!currentPokemon) return;
  const index = favorites.findIndex((item) => item.id === currentPokemon.id);
  if (index >= 0) {
    favorites.splice(index, 1);
    setStatus(tr('status.favRemoved'));
  } else {
    favorites.unshift({ ...currentPokemon });
    favorites = favorites.slice(0, 50);
    setStatus(tr('status.favAdded'));
  }
  persist(STORAGE_KEY, favorites);
  renderFavorites();
});
ui.clearFavorites.addEventListener('click', () => {
  favorites = [];
  persist(STORAGE_KEY, favorites);
  renderFavorites();
  setStatus(tr('status.favCleared'));
});
ui.image.addEventListener('error', () => {
  const fallback = ui.image.dataset.fallback;
  if (fallback && ui.image.src !== fallback) {
    ui.image.src = fallback;
    return;
  }
  ui.image.hidden = true;
  ui.imageFallback.hidden = false;
});
document.addEventListener('keydown', (event) => {
  if (event.altKey || event.ctrlKey || event.metaKey ||
      event.target.closest('input, textarea, select, button, a, [contenteditable]')) return;
  if (event.key === 'ArrowLeft' && !ui.previous.disabled) {
    event.preventDefault();
    ui.previous.click();
  }
  if (event.key === 'ArrowRight' && !ui.next.disabled) {
    event.preventDefault();
    ui.next.click();
  }
});

document.addEventListener('pokedex:language-change', () => {
  if (lastRenderedPokemon) {
    renderPokemon(lastRenderedPokemon, true);
    setStatus(tr('status.found', { name: formatName(lastRenderedPokemon.name) }));
  } else {
    renderFavorites();
  }
});
window.PokedexApp = {
  loadPokemon,
  get currentPokemon() { return currentPokemon; },
  refreshNavigation() {
    const range = window.PokedexCatalog.rangeFor(ui.generation.value);
    ui.previous.disabled = !currentPokemon || currentPokemon.id <= range.first || currentPokemon.id > range.last;
    ui.next.disabled = !currentPokemon || currentPokemon.id >= range.last || currentPokemon.id < range.first;
  }
};

renderFavorites();
let last = 1;
try {
  const stored = Number(JSON.parse(localStorage.getItem(LAST_KEY)));
  if (Number.isInteger(stored) && stored >= 1 && stored <= MAX_POKEMON) last = stored;
} catch { /* Sem histórico: Bulbasaur é o Pokémon inicial. */ }
loadPokemon(last);
