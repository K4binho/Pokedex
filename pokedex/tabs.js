'use strict';

/* One screen, six accessible panels. Keyboard: arrows, Home and End. */
(() => {
  const tabs = [...document.querySelectorAll('#detail-tabs [role="tab"]')];
  const panels = new Map(tabs.map(button => [
    button.dataset.tab, document.getElementById(button.getAttribute('aria-controls'))
  ]));
  const storageKey = 'k4-pokedex-active-tab-v1';
  let selected = 'summary';
  try {
    const previous = sessionStorage.getItem(storageKey);
    if (panels.has(previous)) selected = previous;
  } catch { /* optional storage */ }

  function open(tab, focus = false) {
    if (!panels.has(tab)) return;
    selected = tab;
    for (const button of tabs) {
      const active = button.dataset.tab === tab;
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
      if (active && focus) button.focus();
    }
    for (const [name, panel] of panels) panel.hidden = name !== tab;
    document.querySelector('.tab-viewport')?.scrollTo?.({ top: 0, behavior: 'instant' });
    try { sessionStorage.setItem(storageKey, tab); } catch { /* optional storage */ }
    document.dispatchEvent(new CustomEvent('pokedex:tab-change', { detail: { tab } }));
  }

  for (const button of tabs) {
    button.addEventListener('click', () => open(button.dataset.tab));
    button.addEventListener('keydown', event => {
      const index = tabs.indexOf(button);
      const keys = {
        ArrowRight: (index + 1) % tabs.length,
        ArrowLeft: (index - 1 + tabs.length) % tabs.length,
        Home: 0,
        End: tabs.length - 1
      };
      if (Object.prototype.hasOwnProperty.call(keys, event.key)) {
        event.preventDefault();
        open(tabs[keys[event.key]].dataset.tab, true);
      }
    });
  }
  window.PokedexTabs = { open, get active() { return selected; } };
  open(selected);
})();
