'use strict';

const API_URL = 'https://pokeapi.co/api/v2/pokemon/';
const MAX_POKEMON = 1025;
const STORAGE_KEY = 'k4-pokedex-favorites-v1';
const LAST_KEY = 'k4-pokedex-last-v1';

const $ = (selector) => document.querySelector(selector);
const ui = {
  form: $('#search-form'),
  input: $('#pokemon-search'),
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
    empty.textContent = 'Nenhum favorito ainda.';
    ui.favoritesList.append(empty);
  }

  favorites.forEach(({ id, name }) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'favorite-chip';
    button.textContent = paddedId(id) + ' ' + formatName(name);
    button.setAttribute('aria-label', 'Exibir ' + formatName(name));
    button.addEventListener('click', () => loadPokemon(id));
    ui.favoritesList.append(button);
  });

  const selected = currentPokemon && favorites.some((item) => item.id === currentPokemon.id);
  ui.favorite.setAttribute('aria-pressed', String(Boolean(selected)));
  ui.favorite.setAttribute('aria-label',
    (selected ? 'Remover ' : 'Adicionar ') +
    (currentPokemon ? formatName(currentPokemon.name) : 'Pokémon') +
    (selected ? ' dos favoritos' : ' aos favoritos'));
  ui.favorite.innerHTML = selected
    ? '<span aria-hidden="true">♥</span> Favorito'
    : '<span aria-hidden="true">♡</span> Favoritar';
}

function renderPokemon(data) {
  currentPokemon = { id: data.id, name: data.name };
  const label = formatName(data.name);
  const number = paddedId(data.id);
  const artwork = data.sprites?.other?.['official-artwork']?.front_default;
  const sprite = data.sprites?.front_default;

  ui.screenName.textContent = label;
  ui.detailName.textContent = label;
  ui.screenId.textContent = number;
  ui.detailId.textContent = number;
  ui.height.textContent = (data.height / 10).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' m';
  ui.weight.textContent = (data.weight / 10).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' kg';

  ui.image.hidden = false;
  ui.imageFallback.hidden = true;
  ui.image.alt = 'Ilustração de ' + label;
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
    tag.textContent = TYPE_NAMES[type.name] || formatName(type.name);
    ui.types.append(tag);
  });

  ui.stats.replaceChildren();
  data.stats.forEach(({ stat, base_stat: value }) => {
    const row = document.createElement('div');
    row.className = 'stat-row';
    const name = document.createElement('span');
    name.className = 'stat-name';
    name.textContent = STAT_NAMES[stat.name] || formatName(stat.name);
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
    item.textContent = formatName(ability.name) + (hidden ? ' · oculta' : '');
    ui.abilities.append(item);
  });

  ui.previous.disabled = data.id <= 1;
  ui.next.disabled = data.id >= MAX_POKEMON;
  ui.input.value = '';
  persist(LAST_KEY, data.id);
  renderFavorites();
  document.dispatchEvent(new CustomEvent('pokedex:pokemon', { detail: { pokemon: data } }));
}

async function loadPokemon(query) {
  const search = normalizeQuery(String(query));
  if (!search) {
    setStatus('Digite um nome ou número para pesquisar.', true);
    ui.input.focus();
    return;
  }
  if (/^\d+$/.test(search) && (+search < 1 || +search > MAX_POKEMON)) {
    setStatus('Use um número entre 1 e ' + MAX_POKEMON + '.', true);
    return;
  }

  document.dispatchEvent(new CustomEvent('pokedex:search-start'));
  if (activeRequest) activeRequest.abort();
  const controller = new AbortController();
  activeRequest = controller;
  ui.screen.classList.add('is-loading');
  setStatus('Buscando Pokémon...');
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(API_URL + encodeURIComponent(search), { signal: controller.signal });
    if (response.status === 404) throw new Error('not-found');
    if (!response.ok) throw new Error('api-error');
    const data = await response.json();
    if (controller !== activeRequest) return;
    renderPokemon(data);
    setStatus(formatName(data.name) + ' encontrado com sucesso.');
  } catch (error) {
    if (controller !== activeRequest) return;
    if (error.name === 'AbortError') {
      setStatus('A consulta demorou demais. Tente novamente.', true);
    } else if (error.message === 'not-found') {
      setStatus('Pokémon não encontrado. Procurando nomes parecidos...', true);
      document.dispatchEvent(new CustomEvent('pokedex:not-found', { detail: { query: search } }));
    } else {
      setStatus('Falha de conexão com a PokéAPI. Verifique sua internet e tente novamente.', true);
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
  if (currentPokemon && currentPokemon.id > 1) loadPokemon(currentPokemon.id - 1);
});
ui.next.addEventListener('click', () => {
  if (currentPokemon && currentPokemon.id < MAX_POKEMON) loadPokemon(currentPokemon.id + 1);
});
ui.random.addEventListener('click', () => {
  let id = Math.floor(Math.random() * MAX_POKEMON) + 1;
  if (currentPokemon && MAX_POKEMON > 1 && id === currentPokemon.id) id = id % MAX_POKEMON + 1;
  loadPokemon(id);
});
ui.favorite.addEventListener('click', () => {
  if (!currentPokemon) return;
  const index = favorites.findIndex((item) => item.id === currentPokemon.id);
  if (index >= 0) {
    favorites.splice(index, 1);
    setStatus('Removido dos favoritos.');
  } else {
    favorites.unshift({ ...currentPokemon });
    favorites = favorites.slice(0, 50);
    setStatus('Adicionado aos favoritos.');
  }
  persist(STORAGE_KEY, favorites);
  renderFavorites();
});
ui.clearFavorites.addEventListener('click', () => {
  favorites = [];
  persist(STORAGE_KEY, favorites);
  renderFavorites();
  setStatus('Lista de favoritos limpa.');
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

renderFavorites();
let last = 1;
try {
  const stored = Number(JSON.parse(localStorage.getItem(LAST_KEY)));
  if (Number.isInteger(stored) && stored >= 1 && stored <= MAX_POKEMON) last = stored;
} catch { /* Sem histórico: Bulbasaur é o Pokémon inicial. */ }
loadPokemon(last);
