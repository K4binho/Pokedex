'use strict';

/* Game Pokédex catalog (NOT species introduction generations).
 * Slugs are version groups; dexNames provide a fallback for related editions
 * whose version-group response does not explicitly enumerate older Pokédexes.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PokedexCatalog = api;
})(typeof window !== 'undefined' ? window : null, () => {
  const GAMES = Object.freeze([
    { id: 'red-blue', generation: 1, title: 'Red / Blue', dexNames: ['kanto'] },
    { id: 'yellow', generation: 1, title: 'Yellow', dexNames: ['kanto'] },
    { id: 'gold-silver', generation: 2, title: 'Gold / Silver', dexNames: ['original-johto'] },
    { id: 'crystal', generation: 2, title: 'Crystal', dexNames: ['original-johto'] },
    { id: 'ruby-sapphire', generation: 3, title: 'Ruby / Sapphire', dexNames: ['hoenn'] },
    { id: 'emerald', generation: 3, title: 'Emerald', dexNames: ['hoenn'] },
    { id: 'firered-leafgreen', generation: 3, title: 'FireRed / LeafGreen', dexNames: ['kanto'] },
    { id: 'diamond-pearl', generation: 4, title: 'Diamond / Pearl', dexNames: ['original-sinnoh'] },
    { id: 'platinum', generation: 4, title: 'Platinum', dexNames: ['extended-sinnoh'] },
    { id: 'heartgold-soulsilver', generation: 4, title: 'HeartGold / SoulSilver', dexNames: ['updated-johto'] },
    { id: 'black-white', generation: 5, title: 'Black / White', dexNames: ['original-unova'] },
    { id: 'black-2-white-2', generation: 5, title: 'Black 2 / White 2', dexNames: ['updated-unova'] },
    { id: 'x-y', generation: 6, title: 'X / Y', dexNames: ['kalos-central', 'kalos-coastal', 'kalos-mountain'] },
    { id: 'omega-ruby-alpha-sapphire', generation: 6, title: 'Omega Ruby / Alpha Sapphire', dexNames: ['updated-hoenn'] },
    { id: 'sun-moon', generation: 7, title: 'Sun / Moon', dexNames: ['original-alola'] },
    { id: 'ultra-sun-ultra-moon', generation: 7, title: 'Ultra Sun / Ultra Moon', dexNames: ['updated-alola'] },
    { id: 'lets-go-pikachu-lets-go-eevee', generation: 7, title: "Let's Go Pikachu / Eevee", dexNames: ['letsgo-kanto'] },
    { id: 'sword-shield', generation: 8, title: 'Sword / Shield', dexNames: ['galar', 'isle-of-armor', 'crown-tundra'] },
    { id: 'brilliant-diamond-and-shining-pearl', generation: 8, title: 'Brilliant Diamond / Shining Pearl', dexNames: ['original-sinnoh'] },
    { id: 'legends-arceus', generation: 8, title: 'Legends: Arceus', dexNames: ['hisui'] },
    { id: 'scarlet-violet', generation: 9, title: 'Scarlet / Violet', dexNames: ['paldea', 'kitakami', 'blueberry'] }
  ]);
  const getGame = value => GAMES.find(game => game.id === value) || null;
  function normalize(value) {
    const raw = String(value ?? '').trim();
    if (/^#?\d+$/.test(raw)) return String(Number(raw.replace('#', '')));
    return raw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/♀/g, '-f').replace(/♂/g, '-m')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }
  const nationalId = url => {
    const found = String(url).match(/\/(\d+)\/?$/);
    return found ? Number(found[1]) : 0;
  };
  function parseEntries(entries) {
    return entries.map(entry => ({ id: nationalId(entry.url), name: entry.name }))
      .filter(entry => entry.id > 0 && entry.id <= 1025);
  }
  // Each game dex has its own order; when multiple dexes are available
  // their members are combined, preserving source order and deduplicating.
  function parseGameDexes(dexes) {
    const results = [], seen = new Set();
    for (const dex of dexes) {
      for (const entry of [...(dex.pokemon_entries || [])].sort((a, b) => a.entry_number - b.entry_number)) {
        const species = entry.pokemon_species;
        const id = nationalId(species?.url);
        if (id <= 0 || id > 1025 || seen.has(id)) continue;
        seen.add(id);
        results.push({ id, name: species.name });
      }
    }
    return results;
  }
  // Adjacent transpositions count as one typo (Damerau-Levenshtein).
  function distance(a, b) {
    const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
    for (let i = 0; i <= a.length; i++) dp[i][0] = i;
    for (let j = 0; j <= b.length; j++) dp[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + Number(a[i - 1] !== b[j - 1]));
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
          dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + 1);
        }
      }
    }
    return dp[a.length][b.length];
  }
  function rankMatches(query, entries, limit = 7) {
    const q = normalize(query);
    if (!q) return [];
    const numeric = /^\d+$/.test(q);
    const threshold = q.length <= 4 ? 1 : q.length <= 8 ? 2 : 3;
    return entries.map(entry => {
      const name = normalize(entry.name);
      if (numeric) return { ...entry, score: String(entry.id) === q ? 0 : Infinity };
      if (name === q) return { ...entry, score: 0 };
      if (name.startsWith(q)) return { ...entry, score: 2 + name.length / 100 };
      if (q.length >= 3 && name.includes(q)) return { ...entry, score: 6 + name.length / 100 };
      if (q.length < 3 || Math.abs(q.length - name.length) > threshold) {
        return { ...entry, score: Infinity };
      }
      const d = distance(q, name);
      return { ...entry, score: d <= threshold ? 12 + d * 4 + name.length / 100 : Infinity };
    }).filter(entry => Number.isFinite(entry.score))
      .sort((a, b) => a.score - b.score || a.id - b.id).slice(0, limit);
  }
  function adjacent(entries, currentId, direction) {
    const index = entries.findIndex(entry => entry.id === currentId);
    return index >= 0 ? entries[index + direction]?.id || null : null;
  }
  return { GAMES, getGame, normalize, nationalId, parseEntries, parseGameDexes, distance, rankMatches, adjacent };
});
