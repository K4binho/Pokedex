'use strict';

/* Android / PWA enhancements: optional, no change to desktop game logic. */
(() => {
  const spriteScreen = document.getElementById('screen');
  const previous = document.getElementById('previous');
  const next = document.getElementById('next');
  const install = document.getElementById('install-app');
  let start = null;
  let installEvent = null;

  if (spriteScreen) {
    spriteScreen.addEventListener('touchstart', event => {
      if (event.touches.length !== 1) { start = null; return; }
      start = {
        x: event.touches[0].clientX,
        y: event.touches[0].clientY
      };
    }, { passive: true });
    spriteScreen.addEventListener('touchend', event => {
      if (!start || event.changedTouches.length !== 1) return;
      const dx = event.changedTouches[0].clientX - start.x;
      const dy = event.changedTouches[0].clientY - start.y;
      start = null;
      if (Math.abs(dx) < 65 || Math.abs(dy) > 48 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      if (dx > 0 && !previous.disabled) previous.click();
      if (dx < 0 && !next.disabled) next.click();
    }, { passive: true });
    spriteScreen.addEventListener('touchcancel', () => { start = null; }, { passive: true });
  }

  // Browser prompts are shown only when the Android browser explicitly
  // confirms that the app meets its installability criteria.
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installEvent = event;
    if (install) install.hidden = false;
  });
  install?.addEventListener('click', async () => {
    if (!installEvent) return;
    const prompt = installEvent;
    installEvent = null;
    install.hidden = true;
    try {
      await prompt.prompt();
      await prompt.userChoice;
    } catch { /* The browser owns the installation UI. */ }
  });
  window.addEventListener('appinstalled', () => {
    if (install) install.hidden = true;
    installEvent = null;
  });

  // An existing standalone app should never show another install button.
  if (window.matchMedia('(display-mode: standalone)').matches && install) install.hidden = true;

  if ('serviceWorker' in navigator && window.isSecureContext) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js', { scope: './' })
        .catch(() => { /* Site remains online-only if storage is unavailable. */ });
    });
  }
})();
