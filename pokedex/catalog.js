'use strict';

/* National Pokédex generation ranges for the first 1,025 species. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PokedexCatalog = api;
})(typeof window !== 'undefined' ? window : null, () => {
  const GENERATIONS = Object.freeze([
    { number: 1, first: 1, last: 151 },
    { number: 2, first: 152, last: 251 },
    { number: 3, first: 252, last: 386 },
    { number: 4, first: 387, last: 493 },
    { number: 5, first: 494, last: 649 },
    { number: 6, first: 650, last: 721 },
    { number: 7, first: 722, last: 809 },
    { number: 8, first: 810, last: 905 },
    { number: 9, first: 906, last: 1025 }
  ]);
  function rangeFor(value) {
    const selected = Number(value);
    return GENERATIONS.find(g => g.number === selected) || { number: 0, first: 1, last: 1025 };
  }
  function inGeneration(id, generation) {
    const range = rangeFor(generation);
    return Number.isInteger(Number(id)) && Number(id) >= range.first && Number(id) <= range.last;
  }
  function normalize(value) {
    const raw = String(value ?? '').trim();
    if (/^#?\d+$/.test(raw)) return String(Number(raw.replace('#', '')));
    return raw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/♀/g, '-f').replace(/♂/g, '-m')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }
  function nationalId(url) {
    const found = String(url).match(/\/(\d+)\/?$/);
    return found ? Number(found[1]) : 0;
  }
  function parseEntries(entries) {
    return entries.map(e => ({ name: e.name, id: nationalId(e.url) }))
      .filter(e => e.id >= 1 && e.id <= 1025);
  }
  // Damerau-Levenshtein distance: catches missing, extra and transposed characters.
  function distance(a, b) {
    const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
    for (let i = 0; i <= a.length; i++) dp[i][0] = i;
    for (let j = 0; j <= b.length; j++) dp[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1, dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + Number(a[i - 1] !== b[j - 1])
        );
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
          dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + 1);
        }
      }
    }
    return dp[a.length][b.length];
  }
  function rankMatches(query, entries, generation = 0, limit = 7) {
    const q = normalize(query);
    if (!q) return [];
    const numeric = /^\d+$/.test(q);
    const threshold = q.length <= 4 ? 1 : q.length <= 8 ? 2 : 3;
    return entries.filter(e => inGeneration(e.id, generation)).map(e => {
      const name = normalize(e.name);
      if (numeric) return { ...e, score: String(e.id) === q ? 0 : Infinity };
      if (name === q) return { ...e, score: 0 };
      if (name.startsWith(q)) return { ...e, score: 2 + name.length / 100 };
      if (q.length >= 3 && name.includes(q)) return { ...e, score: 6 + name.length / 100 };
      if (q.length < 3 || Math.abs(q.length - name.length) > threshold) return { ...e, score: Infinity };
      const dist = distance(q, name);
      return { ...e, score: dist <= threshold ? 12 + dist * 4 + name.length / 100 : Infinity };
    }).filter(e => Number.isFinite(e.score))
      .sort((a, b) => a.score - b.score || a.id - b.id).slice(0, limit);
  }
  return { GENERATIONS, rangeFor, inGeneration, normalize, nationalId, parseEntries, distance, rankMatches };
});
